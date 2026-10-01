import { GoogleGenerativeAI } from '@google/generative-ai';
import { credentialService } from '../config/credentialService';
import { ClientConfig, CampaignConfig, CrmLeadItem, RawTranscriptData } from '../types';

export interface PromptConstructResult {
  systemInstructions: string;
  effectivePrompt: string;
  versionTag: string;
}

export class GeminiService {
  /**
   * Constructs the effective prompt dynamically from client, campaign, lead, and system rules.
   */
  public constructPrompt(
    client: ClientConfig,
    campaign: CampaignConfig,
    lead: CrmLeadItem,
    rawTranscript: RawTranscriptData
  ): PromptConstructResult {
    const versionTag = `${client.code}_v${client.updatedAt.slice(0, 10)} + ${campaign.code}_v${campaign.updatedAt.slice(0, 10)}`;

    const systemInstructions = `SYSTEM EVIDENCE & EDITING CONSTRAINTS:
1. You are a precise, professional AI Call Transcript Editor and Evidence Quality Manager.
2. ABSOLUTELY NO FABRICATION OR HALLUCINATION: Never invent customer responses, job titles, timelines, budget numbers, or commitments that were not explicitly stated in the transcript.
3. REMOVE FILLER WORDS: Intelligently omit conversational noise (e.g. "um", "uh", "you know", "like", "so yeah") ONLY when doing so preserves the exact original meaning and customer intent.
4. FAITHFUL TERM PRESERVATION: Keep specific product names, technical acronyms, dates, quotes, and dollar amounts verbatim.
5. FORMATTING: Structure the edited transcript into clean speaker turns labeled with "[Speaker Name - Role]" followed by formatted paragraphs.
6. NO UNSUPPORTED DECISIONS: Do not add summary conclusions into the edited transcript text itself. Preserve all actual questions and answers accurately.`;

    const clientBlock = `CLIENT GLOBAL EDITING DIRECTIVES (${client.name} - ${client.code}):
${client.globalPrompt}

CLIENT QUALIFICATION STANDARDS:
${client.qualificationCriteria}`;

    const campaignBlock = `CAMPAIGN SPECIFIC DIRECTIVES (${campaign.name} - ${campaign.code}):
- Asset / Solution Title: ${campaign.assetTitle}
- Key Value Propositions:
${campaign.valueProps.map((vp) => `  * ${vp}`).join('\n')}
- Additional Editing Instructions: ${campaign.additionalEditingInstructions}
${campaign.qualificationRulesOverride ? `- Campaign Rule Overrides: ${campaign.qualificationRulesOverride}` : ''}`;

    const crmContextBlock = `CRM LEAD CONTEXT:
- Lead Reference: ${lead.leadRef}
- Contact Name: ${lead.contactName}
- Company Name: ${lead.companyName}
- Stated Job Title: ${lead.jobTitle || 'Not specified'}
- Email / Contact: ${lead.email || 'N/A'}`;

    const rawTranscriptBlock = `ORIGINAL RAW TRANSCRIPT:
${rawTranscript.fullText}`;

    const effectivePrompt = `${systemInstructions}

==================================================
${clientBlock}

==================================================
${campaignBlock}

==================================================
${crmContextBlock}

==================================================
${rawTranscriptBlock}

==================================================
TASK: Please generate the cleaned, professionally edited transcript in full accordance with all client, campaign, and system evidence preservation rules.`;

    return {
      systemInstructions,
      effectivePrompt,
      versionTag,
    };
  }

  /**
   * Sends the prompt and raw transcript to Gemini API and returns edited transcript.
   * Dynamically resolves stored credentials at runtime via CredentialService.
   */
  public async editTranscript(
    client: ClientConfig,
    campaign: CampaignConfig,
    lead: CrmLeadItem,
    rawTranscript: RawTranscriptData
  ): Promise<{ editedTranscript: string; versionTag: string }> {
    const { effectivePrompt, versionTag } = this.constructPrompt(client, campaign, lead, rawTranscript);
    const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();

    const candidateModels = Array.from(
      new Set([
        configuredModel,
        'gemini-3.8-flash',
        'gemini-3.5-transcribe',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.0-flash',
      ].filter(Boolean))
    );

    let lastError = '';
    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(effectivePrompt);
        const responseText = result.response.text();

        if (responseText && responseText.trim().length > 0) {
          return {
            editedTranscript: responseText.trim(),
            versionTag,
          };
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Gemini API call warning for model ${modelName}: ${err.message}. Trying candidate model...`);
      }
    }

    throw new Error(`Gemini API Transcript Editing Failed: ${lastError || 'No content returned from Gemini API.'}`);
  }
}

export const geminiService = new GeminiService();
