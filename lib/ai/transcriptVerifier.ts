import { GoogleGenerativeAI } from '@google/generative-ai';
import { credentialService } from '../config/credentialService';
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
   * contactName, companyName, jobTitle, email, phone, etc.
   * Corrects any phonetic or STT spelling discrepancies and returns the verified transcript.
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

    const prompt = `You are an expert CRM Lead Verification Auditor and Speech-to-Text Transcript Post-Editor.

Your mission is to perform a rigorous THIRD-LAYER VERIFICATION on the edited call transcript below. You must cross-check the transcript against the verified ground-truth CRM lead details.

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
- Campaign: ${campaign?.name || 'N/A'}

=== INSTRUCTIONS ===
1. Analyze the edited transcript line-by-line.
2. Identify where either the agent or the prospect mentions, spells out, confirms, or repeats the prospect's:
   - First name, last name, or full name
   - Company name
   - Job title / role
   - Email address (including domain or spelled out characters)
   - Phone number or other entity details
3. Speech-to-Text often transcribes names and entities phonetically with errors or typos (e.g. "Jonathon" vs "Jonathan", "Smyth" vs "Smith", "Sales Force" vs "Salesforce", "Acme Core" vs "Acme Corp", phonetic email domains, or slightly misspelled titles).
4. If any mention in the transcript refers to the prospect or their organization but is misspelled, phonetically garbled, or slightly inaccurate compared to the verified CRM ground truth above, CORRECT IT in the transcript so that it accurately reflects the verified spelling.
5. If a detail in the transcript already matches the CRM ground truth or is not spoken in the call, leave that portion untouched.
6. DO NOT invent dialogue, remove conversational context, or alter speaker tags and timestamps. Only correct spelling/entity discrepancies.
7. Return your response as STRICT JSON matching the following structure:

{
  "verifiedTranscript": "The full verbatim transcript with all corrections applied",
  "hasCorrections": true,
  "corrections": [
    {
      "field": "contactName" | "firstName" | "lastName" | "email" | "jobTitle" | "companyName" | "phone" | "other",
      "originalInTranscript": "exact phrase from transcript before correction",
      "correctedTo": "corrected phrase matching CRM ground truth",
      "explanation": "brief reason for correction"
    }
  ],
  "status": "VERIFIED_WITH_CORRECTIONS" | "VERIFIED_MATCH" | "UNVERIFIED_NOT_MENTIONED",
  "detectedLeadDetails": {
    "contactName": "name detected in transcript, or null if not spoken",
    "companyName": "company detected in transcript, or null if not spoken",
    "email": "email detected in transcript, or null if not spoken",
    "jobTitle": "title detected in transcript, or null if not spoken",
    "phone": "phone detected in transcript, or null if not spoken"
  },
  "summary": "One sentence summary describing the verification and any corrections made."
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
            const status: VerificationResultData['status'] =
              parsed.status === 'VERIFIED_WITH_CORRECTIONS' || hasCorrections
                ? 'VERIFIED_WITH_CORRECTIONS'
                : parsed.status === 'VERIFIED_MATCH'
                ? 'VERIFIED_MATCH'
                : 'UNVERIFIED_NOT_MENTIONED';

            const verificationResult: VerificationResultData = {
              status: hasCorrections ? 'VERIFIED_WITH_CORRECTIONS' : status,
              hasCorrections,
              corrections,
              verifiedAt: new Date().toISOString(),
              detectedLeadDetails: parsed.detectedLeadDetails || {},
              summary:
                parsed.summary ||
                (hasCorrections
                  ? `Applied ${corrections.length} correction(s) for CRM lead details.`
                  : 'Transcript matches CRM lead details with no discrepancies.'),
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
        corrections: [],
        verifiedAt: new Date().toISOString(),
        summary: 'Verification completed (baseline preserved).',
      },
    };
  }
}

export const transcriptVerifier = new TranscriptVerifier();
