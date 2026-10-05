import { GoogleGenerativeAI } from '@google/generative-ai';
import { credentialService } from '../config/credentialService';
import { ClientConfig, CampaignConfig, CrmLeadItem, RawTranscriptData } from '../types';
import { PromptBuilder, AssembledPromptResult } from './promptBuilder';

export class GeminiService {
  /**
   * Constructs prompt dynamically using PromptBuilder
   */
  public constructPrompt(
    client: ClientConfig,
    campaign?: CampaignConfig,
    lead?: CrmLeadItem,
    rawTranscript?: RawTranscriptData
  ): AssembledPromptResult {
    return PromptBuilder.buildPrompt({
      client,
      campaign,
      lead,
      rawTranscript,
    });
  }

  /**
   * Sends prompt to Gemini API with gemini-3.8-flash as primary model.
   * Dynamically resolves stored credentials at runtime.
   */
  public async editTranscript(
    client: ClientConfig,
    campaign: CampaignConfig | undefined,
    lead: CrmLeadItem,
    rawTranscript: RawTranscriptData
  ): Promise<{ editedTranscript: string; versionTag: string }> {
    const { finalPrompt, versionTag } = this.constructPrompt(client, campaign, lead, rawTranscript);
    const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();

    const candidateModels = Array.from(
      new Set([
        configuredModel,
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-1.5-flash',
      ].filter(Boolean))
    );

    let lastError = '';
    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        if (responseText && responseText.trim().length > 0) {
          return {
            editedTranscript: responseText.trim(),
            versionTag,
          };
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Gemini API call warning for model ${modelName}: ${err.message}. Trying next candidate model...`);
      }
    }

    throw new Error(`Gemini API Transcript Editing Failed: ${lastError || 'No content returned from Gemini API.'}`);
  }

  /**
   * Prompt Test Tool: generates an edited transcript preview for a sample raw transcript.
   */
  public async testPromptPreview(
    promptText: string,
    sampleRawTranscript: string,
    client: ClientConfig,
    campaign?: CampaignConfig
  ): Promise<string> {
    const { finalPrompt } = PromptBuilder.buildPrompt({
      client,
      campaign,
      customClientPrompt: promptText,
      rawTranscript: {
        fullText: sampleRawTranscript,
        utterances: [],
        confidence: 1,
        languageCode: 'en-US',
        durationSeconds: 120,
      },
    });

    const { apiKey, model: configuredModel } = await credentialService.getGeminiCredentials();
    const candidateModels = Array.from(
      new Set([configuredModel, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-1.5-flash'].filter(Boolean))
    );

    let lastError = '';
    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        if (responseText && responseText.trim().length > 0) {
          return responseText.trim();
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    throw new Error(`Test Prompt Generation Failed: ${lastError || 'No response from Gemini API.'}`);
  }
}

export const geminiService = new GeminiService();
