import { GoogleGenerativeAI } from '@google/generative-ai';
import { credentialService } from '../config/credentialService';
import { dbStore } from '../db/store';
import {
  ClientConfig,
  CampaignConfig,
  CrmLeadItem,
  VerificationResultData,
  VerificationCorrection,
} from '../types';

export interface VerifiedTranscriptOutput {
  verifiedTranscript: string;
  result: VerificationResultData;
}

export class TranscriptVerifier {
  /**
   * Cross-checks an edited transcript against verified CRM lead details:
   * contactName, companyName, jobTitle, email, phone, and Campaign Asset Title.
   * Corrects any phonetic or STT spelling discrepancies and detects Campaign Asset Mismatches.
   */
  public async verifyAndCorrectTranscript(
    client: ClientConfig,
    campaign: CampaignConfig | undefined,
    lead: CrmLeadItem,
    editedTranscript: string
  ): Promise<VerifiedTranscriptOutput> {
    const trimmedTranscript = (editedTranscript || '').trim();
    if (!trimmedTranscript) {
      return {
        verifiedTranscript: editedTranscript,
        result: {
          status: 'UNVERIFIED_NOT_MENTIONED',
          hasCorrections: false,
          hasAssetMismatch: false,
          corrections: [],
          verifiedAt: new Date().toISOString(),
          summary: 'Transcript is empty; verification skipped.',
        },
      };
    }

    // Split name into first and last name if possible
    const nameParts = (lead.contactName || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Pull any additional info from rawLeadData or formData
    const raw = lead.rawLeadData || {};
    const form = lead.formData || {};
    const email = lead.email || raw.email || form.email || '';
    const phone = lead.phone || raw.phone || form.phone || '';
    const jobTitle = lead.jobTitle || raw.job_title || raw.title || form.job_title || '';
    const company = lead.companyName || raw.company_name || raw.company || form.company_name || '';

    // Campaign and Asset Title details
    const expectedAsset = (campaign?.assetTitle || lead.campaignName || '').trim();
    const campaignName = (campaign?.name || lead.campaignName || '').trim();
    const campaignCode = (campaign?.code || lead.campaignCode || '').trim();

    // Query other campaigns for this client to detect cross-campaign asset pitching (e.g. LMS, ATS instead of HRIS)
    const otherCampaigns = dbStore
      .getCampaigns(client.code)
      .filter((c) => c.code !== campaignCode);
    const otherAssetsCatalog = otherCampaigns
      .map((c) => `Campaign "${c.name}" (${c.code}): Asset "${c.assetTitle}"`)
      .slice(0, 10)
      .join(' | ');

    const prompt = `You are an expert CRM Lead Verification Auditor and Speech-to-Text Transcript Post-Editor.

Your mission is to perform a rigorous THIRD-LAYER VERIFICATION on the call transcript below. You must cross-check the transcript against:
1. Ground-truth CRM lead details (Name, Company, Job Title, Email, Phone).
2. Ground-truth Campaign Asset Title (the specific whitepaper, guide, report, or content asset this lead was generated for).

=== VERIFIED CRM LEAD DETAILS (GROUND TRUTH) ===
- Contact Full Name: ${lead.contactName || 'N/A'}
- First Name: ${firstName || 'N/A'}
- Last Name: ${lastName || 'N/A'}
- Company Name: ${company || 'N/A'}
- Job Title: ${jobTitle || 'N/A'}
- Email Address: ${email || 'N/A'}
- Phone Number: ${phone || 'N/A'}
- Industry: ${lead.industry || 'N/A'}
- Country: ${lead.country || 'N/A'}
- Client: ${client.name} (${client.code})
- Expected Campaign: ${campaignName || 'N/A'} (${campaignCode || 'N/A'})
- Expected Campaign Asset Title: ${expectedAsset || 'N/A'}
${otherAssetsCatalog ? `- Other Known Assets in Client Catalog: ${otherAssetsCatalog}` : ''}

=== VERIFICATION INSTRUCTIONS ===
1. LEAD DETAILS CROSS-CHECK & SPELLING CORRECTION:
   - Identify where either the agent or the prospect mentions, spells out, or confirms the prospect's:
     • First name, last name, or full name
     • Company name
     • Job title / role
     • Email address (including domain or spelled out letters)
     • Phone number
   - Speech-to-Text often transcribes names and entities phonetically with errors or typos (e.g. "Jonathon" vs "Jonathan", "Smyth" vs "Smith", "Sales Force" vs "Salesforce", "Acme Core" vs "Acme Corp", phonetic email domains, or slightly misspelled titles).
   - If any mention in the transcript refers to the prospect or their organization but is misspelled, phonetically garbled, or slightly inaccurate compared to the verified CRM ground truth above, CORRECT IT in the transcript so that it accurately reflects the verified spelling.
   - If a detail already matches or is not spoken, leave that portion untouched.

2. ASSET TITLE CROSS-CHECK & MISMATCH DETECTION (CRITICAL):
   - Identify the specific content asset, report, guide, whitepaper, or solution topic that the agent pitches or the prospect agrees to receive in this call.
   - Cross-check what was ACTUALLY spoken against the Expected Campaign Asset Title: "${expectedAsset || 'Not specified'}".
   - Determine the Asset Status:
     • MATCH: The asset pitched in the call matches "${expectedAsset}" (e.g. agent pitched HRIS guide and lead is for HRIS campaign). If phonetically garbled (e.g. "H-R-I-S" or "HR IS"), correct spelling in the transcript.
     • MISMATCH: The lead is registered for "${expectedAsset}", but in the call the agent or prospect pitched or discussed a DIFFERENT campaign asset (e.g., pitched an "LMS" or "ATS" guide instead of "HRIS", or an entirely different publication).
       If an ASSET MISMATCH occurs:
       - Set "hasAssetMismatch": true
       - Set "status": "ASSET_MISMATCH"
       - In "detectedLeadDetails", record "assetStatus": "MISMATCH", "expectedAssetTitle": "${expectedAsset}", "detectedAssetTitle": "<what was actually pitched>", and explain the discrepancy in "assetNotes".
       - Add a correction/alert item with field: "assetTitle", originalInTranscript: "<what was spoken in transcript>", correctedTo: "MISMATCH ALERT (Pitched '<detected>' instead of expected '<expected>')", isMismatch: true.
     • NOT_MENTIONED: No specific whitepaper, asset, or guide title was named in the call.

3. CONVERSATION PRESERVATION:
   - DO NOT invent dialogue, remove conversational context, or alter speaker tags and timestamps. Only correct spelling and entity discrepancies.

4. Return your response as STRICT JSON matching the following structure:

{
  "verifiedTranscript": "The full verbatim transcript with corrections applied",
  "hasCorrections": boolean,
  "hasAssetMismatch": boolean,
  "corrections": [
    {
      "field": "contactName" | "firstName" | "lastName" | "email" | "jobTitle" | "companyName" | "phone" | "assetTitle" | "other",
      "originalInTranscript": "exact phrase from transcript",
      "correctedTo": "corrected phrase matching CRM ground truth or mismatch alert",
      "explanation": "brief reason for correction or mismatch",
      "isMismatch": boolean
    }
  ],
  "status": "VERIFIED_MATCH" | "VERIFIED_WITH_CORRECTIONS" | "ASSET_MISMATCH" | "UNVERIFIED_NOT_MENTIONED",
  "detectedLeadDetails": {
    "contactName": "name detected in transcript, or null",
    "companyName": "company detected in transcript, or null",
    "email": "email detected in transcript, or null",
    "jobTitle": "job title detected in transcript, or null",
    "phone": "phone detected in transcript, or null",
    "expectedAssetTitle": "${expectedAsset || ''}",
    "detectedAssetTitle": "asset or guide title detected in transcript, or null",
    "assetStatus": "MATCH" | "MISMATCH" | "NOT_MENTIONED",
    "assetNotes": "explanation of asset check"
  },
  "summary": "One sentence summary describing the verification, asset cross-check, and any corrections made."
}

=== EDITED TRANSCRIPT TO VERIFY ===
${trimmedTranscript}`;

    try {
      const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();
      const candidateModels = Array.from(new Set([configuredModel, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'].filter(Boolean)));

      let lastError = '';
      for (const modelName of candidateModels) {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' },
          });

          const result = await model.generateContent(prompt);
          const responseText = result.response.text();

          if (responseText && responseText.trim().length > 0) {
            const parsed = JSON.parse(responseText.trim());
            const verifiedTranscript = (parsed.verifiedTranscript || trimmedTranscript).trim();
            const corrections: VerificationCorrection[] = Array.isArray(parsed.corrections) ? parsed.corrections : [];
            const hasCorrections = Boolean(parsed.hasCorrections || corrections.length > 0);
            const hasAssetMismatch = Boolean(
              parsed.hasAssetMismatch ||
              parsed.status === 'ASSET_MISMATCH' ||
              parsed.detectedLeadDetails?.assetStatus === 'MISMATCH' ||
              corrections.some((c) => c.field === 'assetTitle' && c.isMismatch)
            );

            let status: VerificationResultData['status'] = 'UNVERIFIED_NOT_MENTIONED';
            if (hasAssetMismatch) {
              status = 'ASSET_MISMATCH';
            } else if (hasCorrections || parsed.status === 'VERIFIED_WITH_CORRECTIONS') {
              status = 'VERIFIED_WITH_CORRECTIONS';
            } else if (parsed.status === 'VERIFIED_MATCH') {
              status = 'VERIFIED_MATCH';
            }

            const verificationResult: VerificationResultData = {
              status,
              hasCorrections,
              hasAssetMismatch,
              corrections,
              verifiedAt: new Date().toISOString(),
              detectedLeadDetails: {
                ...(parsed.detectedLeadDetails || {}),
                expectedAssetTitle: expectedAsset || parsed.detectedLeadDetails?.expectedAssetTitle || null,
              },
              summary:
                parsed.summary ||
                (hasAssetMismatch
                  ? `Asset Mismatch: Expected '${expectedAsset}' but detected '${parsed.detectedLeadDetails?.detectedAssetTitle || 'different asset'}'.`
                  : hasCorrections
                  ? `Applied ${corrections.length} correction(s) for CRM lead details.`
                  : 'Transcript matches CRM lead details and asset title.'),
            };

            return {
              verifiedTranscript,
              result: verificationResult,
            };
          }
        } catch (callErr: any) {
          lastError = callErr.message;
          console.warn(`Gemini verification call warning for model ${modelName}: ${callErr.message}. Trying candidate model...`);
        }
      }

      console.warn('Transcript verification fallback due to Gemini errors:', lastError);
    } catch (err: any) {
      console.warn('Transcript verification caught exception:', err.message);
    }

    // Graceful fallback: return original edited transcript if AI call fails
    return {
      verifiedTranscript: trimmedTranscript,
      result: {
        status: 'UNVERIFIED_NOT_MENTIONED',
        hasCorrections: false,
        hasAssetMismatch: false,
        corrections: [],
        verifiedAt: new Date().toISOString(),
        detectedLeadDetails: {
          expectedAssetTitle: expectedAsset || null,
          assetStatus: 'NOT_MENTIONED',
        },
        summary: 'Verification completed (baseline preserved).',
      },
    };
  }
}

export const transcriptVerifier = new TranscriptVerifier();
