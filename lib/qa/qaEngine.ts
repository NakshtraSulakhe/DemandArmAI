import { AgentCoaching, ClientConfig, CampaignConfig, CrmLeadItem, RawTranscriptData, QaResultData } from '../types';
import { coachingFromScore } from './agentCoaching';
import { credentialService } from '../config/credentialService';
import { GoogleGenerativeAI } from '@google/generative-ai';

function criteriaLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[\).\]]\s*/, '').replace(/^\s*[-*]\s*/, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, 12);
}

function normalizeStatus(value: string | undefined): QaResultData['qualificationStatus'] {
  const status = (value || '').toUpperCase();
  if (status.includes('QUALIFIED') && !status.includes('UN') && !status.includes('NOT')) return 'QUALIFIED';
  if (status.includes('REJECT') || status.includes('UNQUALIFIED') || status.includes('DISQUALIFIED')) return 'REJECTED';
  return 'NEEDS_REVIEW';
}

export class QaEngine {
  /**
   * Scores the transcript against the client criteria and any campaign override.
   * Prioritizes the original raw transcript so QA verification and agent coaching
   * reflect the authentic, verbatim spoken conversation rather than the AI-edited version.
   */
  public async evaluateLead(
    client: ClientConfig,
    campaign: CampaignConfig | undefined,
    lead: CrmLeadItem,
    rawTranscript: RawTranscriptData,
    editedTranscript: string
  ): Promise<QaResultData> {
    const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();
    const rawText = rawTranscript?.fullText?.trim();
    const transcriptToEvaluate = rawText || editedTranscript;
    const isUsingRaw = Boolean(rawText);

    const aiQa = await this.evaluateWithGemini(
      apiKey,
      configuredModel,
      client,
      campaign,
      lead,
      transcriptToEvaluate,
      isUsingRaw
    );
    if (!aiQa) {
      throw new Error('Gemini QA evaluation failed. Check the Gemini API key and model in Settings.');
    }
    return aiQa;
  }

  private async evaluateWithGemini(
    apiKey: string,
    modelName: string,
    client: ClientConfig,
    campaign: CampaignConfig | undefined,
    lead: CrmLeadItem,
    transcript: string,
    isUsingRaw: boolean = true
  ): Promise<QaResultData | null> {
    const requirements = [
      ...criteriaLines(client.qualificationCriteria),
      ...criteriaLines(campaign?.qualificationRulesOverride),
    ];
    const rubric = requirements.length
      ? requirements.map((requirement, index) => `${index + 1}. ${requirement}`).join('\n')
      : 'No client criteria are configured. Mark the call NEEDS_REVIEW and explain what is missing.';

    const checklistShape = (requirements.length ? requirements : ['Client qualification criteria are configured']).map(
      (requirement, index) =>
        `{ "id": "c${index + 1}", "requirement": ${JSON.stringify(requirement)}, "isMet": boolean, "evidence": "short quote or note" }`
    );

    const candidateModels = Array.from(new Set([modelName, 'gemini-1.5-flash'].filter(Boolean)));

    const prompt = `You are a strict Quality Assurance Lead Auditor and Sales Coaching Evaluator. Score this call and evaluate the sales agent's actual spoken performance based ONLY on the ${isUsingRaw ? 'ORIGINAL RAW CONVERSATION TRANSCRIPT' : 'TRANSCRIPT'} below. Do not add requirements that are not listed.

CLIENT: ${client.name} (${client.code})
CAMPAIGN: ${campaign?.name || 'No campaign'} (${campaign?.code || 'N/A'})
ASSET: ${campaign?.assetTitle || 'Not specified'}

REQUIREMENTS:
${rubric}

CRM LEAD:
Contact: ${lead.contactName}, Company: ${lead.companyName}, Title: ${lead.jobTitle || 'Unknown'}
Agent on the call: ${lead.agentName || 'Unknown'}

${isUsingRaw ? 'ORIGINAL RAW CONVERSATION TRANSCRIPT (VERBATIM CALL AS RECORDED):' : 'TRANSCRIPT:'}
${transcript}

Output ONLY valid JSON:
{
  "qualificationStatus": "QUALIFIED" | "NEEDS_REVIEW" | "REJECTED",
  "overallScore": number,
  "checklist": [
    ${checklistShape.join(',\n    ')}
  ],
  "supportingEvidence": ["verbatim quotes that support a pass"],
  "missingRequirements": ["requirements that were not met"],
  "reviewReasons": ["why a person should look at this call"],
  "agentCoaching": {
    "summary": "2 sentences a supervisor can read about THIS call",
    "avoid": ["what the agent should stop doing, tied directly to a moment on this raw call"],
    "sayInstead": ["a line the agent can say next time, written as natural spoken words"],
    "improve": ["one habit that would raise the quality of this kind of call"]
  }
}

Rules:
- QUALIFIED only when every required item is met.
- REJECTED when a required item is clearly contradicted or refused.
- NEEDS_REVIEW when evidence is missing, unclear, or criteria are not configured.
- overallScore is the percent of checklist items met, from 0 to 100.
- evidence must come verbatim from the raw transcript. If it was not actually said, isMet is false.
- agentCoaching must coach the agent based on what was ACTUALLY SPOKEN in this raw recording. Pinpoint weak phrasing, skipped questions, hesitation, or missed opportunities from the conversation. Do not give generic sales advice.
- avoid: 2 to 4 items. Each one points at a weak moment or flawed approach on this recording.
- sayInstead: 2 to 4 spoken lines they can use on the next call to cover the exact gap.
- improve: 2 to 4 short habits. If the raw transcript does not support a tip, leave that list item out.`;

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
        const checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
        const metCount = checklist.filter((item: { isMet?: boolean }) => item.isMet).length;
        const computedScore = checklist.length ? Math.round((metCount / checklist.length) * 100) : 0;
        const usage = res.response.usageMetadata;
        const rawCoaching = parsed.agentCoaching || {};
        const agentCoaching: AgentCoaching = {
          summary: String(rawCoaching.summary || '').trim(),
          avoid: Array.isArray(rawCoaching.avoid) ? rawCoaching.avoid.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
          sayInstead: Array.isArray(rawCoaching.sayInstead) ? rawCoaching.sayInstead.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
          improve: Array.isArray(rawCoaching.improve) ? rawCoaching.improve.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
        };

        const result: QaResultData = {
          qualificationStatus: normalizeStatus(parsed.qualificationStatus),
          overallScore: Number.isFinite(parsed.overallScore) ? Math.max(0, Math.min(100, Number(parsed.overallScore))) : computedScore,
          checklist,
          supportingEvidence: parsed.supportingEvidence || [],
          missingRequirements: parsed.missingRequirements || [],
          reviewReasons: parsed.reviewReasons || [],
          agentCoaching,
          evaluatedAt: new Date().toISOString(),
          metadata: {
            engine: `gemini-qa-${mName}`,
            evaluatedAt: new Date().toISOString(),
            promptTokens: usage?.promptTokenCount || 0,
            completionTokens: usage?.candidatesTokenCount || 0,
          },
        };
        if (!result.agentCoaching?.summary && !result.agentCoaching?.avoid.length) {
          result.agentCoaching = coachingFromScore({ ...result, agentCoaching: undefined }) || agentCoaching;
        }
        return result;
      } catch (err: any) {
        console.warn(`Gemini QA model ${mName} failed: ${err.message}`);
      }
    }

    return null;
  }
}

export const qaEngine = new QaEngine();
