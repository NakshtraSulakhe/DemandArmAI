import { ClientConfig, CampaignConfig, CrmLeadItem, RawTranscriptData, QaResultData, QaChecklistItem } from '../types';
import { credentialService } from '../config/credentialService';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class QaEngine {
  /**
   * Evaluates call evidence against Client & Campaign qualification criteria.
   * Returns structured QA Result JSON.
   */
  public async evaluateLead(
    client: ClientConfig,
    campaign: CampaignConfig,
    lead: CrmLeadItem,
    rawTranscript: RawTranscriptData,
    editedTranscript: string
  ): Promise<QaResultData> {
    const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();

    const aiQa = await this.evaluateWithGemini(apiKey, configuredModel, client, campaign, lead, editedTranscript);
    if (!aiQa) {
      throw new Error('Gemini QA evaluation failed. Please check Gemini API Key and model permissions in Admin Settings.');
    }
    return aiQa;
  }

  private async evaluateWithGemini(
    apiKey: string,
    modelName: string,
    client: ClientConfig,
    campaign: CampaignConfig,
    lead: CrmLeadItem,
    transcript: string
  ): Promise<QaResultData | null> {
    const candidateModels = Array.from(
      new Set([modelName, 'gemini-3.8-flash', 'gemini-3.5-transcribe', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.0-flash'].filter(Boolean))
    );

    const prompt = `You are a strict Quality Assurance Lead Auditor. Evaluate the following call transcript against client & campaign requirements.

CLIENT: ${client.name} (${client.code})
GLOBAL CRITERIA: ${client.qualificationCriteria}

CAMPAIGN: ${campaign.name} (${campaign.code})
ASSET: ${campaign.assetTitle}
RULES OVERRIDE: ${campaign.qualificationRulesOverride || 'None'}

CRM LEAD METADATA:
Contact: ${lead.contactName}, Company: ${lead.companyName}, Stated Title: ${lead.jobTitle}

TRANSCRIPT CONTENT:
${transcript}

Output ONLY valid JSON matching this exact structure:
{
  "qualificationStatus": "QUALIFIED" | "NEEDS_REVIEW",
  "overallScore": number (0-100),
  "checklist": [
    { "id": "c1", "requirement": "Company Introduction & Representative Identification", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c2", "requirement": "Prospect Job Title & Decision-Maker Confirmation", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c3", "requirement": "Company Scale / Infrastructure Fit", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c4", "requirement": "Product Asset Discussion", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c5", "requirement": "Expressed Customer Interest & Intent", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c6", "requirement": "Implementation Timeline Stated", "isMet": boolean, "evidence": "quote or note" },
    { "id": "c7", "requirement": "Explicit Follow-up Commitment / Scheduled Next Step", "isMet": boolean, "evidence": "quote or note" }
  ],
  "supportingEvidence": ["string array of verified verbatim evidence"],
  "missingRequirements": ["string array of missing required items"],
  "reviewReasons": ["string array of reasons why review is required, if any"]
}`;

    for (const mName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: { responseMimeType: 'application/json' },
        });

        const res = await model.generateContent(prompt);
        const text = res.response.text();
        const parsed = JSON.parse(text);

        return {
          qualificationStatus: parsed.qualificationStatus === 'QUALIFIED' ? 'QUALIFIED' : 'NEEDS_REVIEW',
          overallScore: parsed.overallScore || 75,
          checklist: parsed.checklist || [],
          supportingEvidence: parsed.supportingEvidence || [],
          missingRequirements: parsed.missingRequirements || [],
          reviewReasons: parsed.reviewReasons || [],
          evaluatedAt: new Date().toISOString(),
          metadata: { engine: `gemini-qa-${mName}`, evaluatedAt: new Date().toISOString() },
        };
      } catch (err: any) {
        console.warn(`Gemini QA model ${mName} call failed: ${err.message}. Trying candidate model fallback...`);
      }
    }

    return null;
  }
}

export const qaEngine = new QaEngine();
