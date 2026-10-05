import { ClientConfig, CampaignConfig, CrmLeadItem, RawTranscriptData } from '../types';

export interface PromptBuilderInput {
  client: ClientConfig;
  campaign?: CampaignConfig;
  lead?: CrmLeadItem;
  rawTranscript?: RawTranscriptData;
  customClientPrompt?: string;
  customCampaignPrompt?: string;
}

export interface AssembledPromptResult {
  systemInstructions: string;
  clientPromptSection: string;
  campaignPromptSection: string;
  crmContextSection: string;
  rawTranscriptSection: string;
  finalPrompt: string;
  versionTag: string;
}

export class PromptBuilder {
  /**
   * Assembles the prompt according to the strict priority hierarchy:
   * 1. System Safety & Integrity Rules
   * 2. Client-Level Editing Prompt
   * 3. Campaign-Level Editing Prompt
   * 4. Campaign Asset & Value Propositions
   * 5. CRM Context & Raw Transcript
   */
  public static buildPrompt(input: PromptBuilderInput): AssembledPromptResult {
    const { client, campaign, lead, rawTranscript, customClientPrompt, customCampaignPrompt } = input;

    const systemInstructions = `SYSTEM SAFETY & FACTUAL INTEGRITY RULES:
1. You are an expert B2B sales call transcript editor.
2. ABSOLUTELY NO FABRICATION: Never invent statements, timelines, numbers, or commitments not explicitly uttered in the call.
3. REMOVE FILLER WORDS: Omit conversational noise ("um", "uh", "you know", "like") without changing the factual meaning.
4. VERBATIM METRICS: Preserve all customer pricing, seat counts, software features, and objection notes accurately.
5. SPEAKER TURN FORMATTING: Format into clear speaker turns labeled with "[Speaker Name - Role]".`;

    const clientPromptText = customClientPrompt ?? client.globalPrompt ?? '';
    const clientVersion = client.promptVersion || 1;

    const clientPromptSection = `CLIENT EDITING DIRECTIVES (${client.name} - Code: ${client.code} | Prompt Version: v${clientVersion}):
${clientPromptText || 'Default clean transcription rules apply.'}

CLIENT QUALIFICATION CRITERIA:
${client.qualificationCriteria || 'N/A'}`;

    let campaignPromptSection = '';
    let versionTag = `${client.code}_v${clientVersion}`;

    if (campaign) {
      const campPrompt = customCampaignPrompt ?? campaign.additionalEditingInstructions ?? '';
      versionTag += ` + ${campaign.code}`;
      campaignPromptSection = `CAMPAIGN SPECIFIC DIRECTIVES (${campaign.name} - Code: ${campaign.code}):
- Asset / Solution Title: ${campaign.assetTitle || 'Solution Overview'}
- Value Propositions:
${(campaign.valueProps || []).map((vp) => `  * ${vp}`).join('\n')}
- Campaign Additional Instructions: ${campPrompt}
${campaign.qualificationRulesOverride ? `- Qualification Override: ${campaign.qualificationRulesOverride}` : ''}`;
    }

    const crmContextSection = lead
      ? `CRM LEAD CONTEXT:
- Lead Reference: ${lead.leadRef}
- Contact Person: ${lead.contactName} (${lead.jobTitle || 'Executive'})
- Target Company: ${lead.companyName} (${lead.industry || 'Industry N/A'})`
      : `SAMPLE LEAD CONTEXT (Preview)`;

    const rawTranscriptSection = rawTranscript
      ? `ORIGINAL RAW TRANSCRIPT:
${rawTranscript.fullText}`
      : `ORIGINAL RAW TRANSCRIPT:
[Sample raw transcript will be provided at execution time]`;

    const finalPrompt = `${systemInstructions}

==================================================
${clientPromptSection}

${campaignPromptSection ? `==================================================\n${campaignPromptSection}\n` : ''}==================================================
${crmContextSection}

==================================================
${rawTranscriptSection}

==================================================
TASK: Please generate the cleaned, professionally formatted transcript following all instructions above.`;

    return {
      systemInstructions,
      clientPromptSection,
      campaignPromptSection,
      crmContextSection,
      rawTranscriptSection,
      finalPrompt,
      versionTag,
    };
  }
}
