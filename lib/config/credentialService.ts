import { settingsRepository } from './settingsRepository';
import { maskApiKey } from '../security/encryption';
import { SystemSettingsConfig, ProviderMetadata } from '../types';

export interface GeminiCredentials {
  apiKey: string;
  model: string;
}

export interface GoogleSttCredentials {
  apiKey: string;
  projectId: string;
  gcsBucket: string;
  clientEmail: string;
  privateKey: string;
  hasPrivateKey: boolean;
}

export interface AssemblyAiCredentials {
  apiKey: string;
}

export class CredentialService {
  /**
   * Resolves Gemini API credentials dynamically at execution time.
   * Both Gemini Multimodal STT and Gemini Transcript Editing / QA MUST call this.
   * NO module-level key caching.
   */
  public async getGeminiCredentials(): Promise<GeminiCredentials> {
    const settings = settingsRepository.getSettings();
    let apiKey = settings.geminiApiKey;

    // Optional 1-time fallback check for initial setup migration if storage is unconfigured
    if (!apiKey || apiKey.trim() === '') {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
        console.warn('[CredentialService] Migrating process.env.GEMINI_API_KEY to secure backend storage...');
        apiKey = process.env.GEMINI_API_KEY.trim();
        settingsRepository.saveSettings({ geminiApiKey: apiKey });
      }
    }

    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'Gemini API Key is not configured. Please open Admin Settings → API Credentials and save your Gemini API Key.'
      );
    }

    const model = settings.geminiModel || 'gemini-3.8-flash';

    return {
      apiKey: apiKey.trim(),
      model: model.replace(/-(high|low|medium)$/i, '').trim(),
    };
  }

  /**
   * Resolves Google Speech-to-Text credentials dynamically at execution time.
   */
  public async getGoogleSttCredentials(): Promise<GoogleSttCredentials> {
    const settings = settingsRepository.getSettings();
    let apiKey = settings.sttApiKey;

    if (!apiKey || apiKey.trim() === '') {
      if (process.env.GOOGLE_STT_API_KEY && process.env.GOOGLE_STT_API_KEY.trim()) {
        apiKey = process.env.GOOGLE_STT_API_KEY.trim();
        settingsRepository.saveSettings({ sttApiKey: apiKey });
      }
    }

    return {
      apiKey: apiKey ? apiKey.trim() : '',
      projectId: settings.gcpProjectId || 'demandarm-ai-qa',
      gcsBucket: settings.gcsBucketName || 'qtranscript-recordings',
      clientEmail: settings.gcpClientEmail || '',
      privateKey: settings.gcpPrivateKey || '',
      hasPrivateKey: !!(settings.gcpPrivateKey && settings.gcpPrivateKey.trim()),
    };
  }

  /**
   * Resolves AssemblyAI credentials dynamically at execution time.
   */
  public async getAssemblyAiCredentials(): Promise<AssemblyAiCredentials> {
    const settings = settingsRepository.getSettings();
    let apiKey = settings.assemblyAiApiKey;

    if (!apiKey || apiKey.trim() === '') {
      if (process.env.ASSEMBLYAI_API_KEY && process.env.ASSEMBLYAI_API_KEY.trim()) {
        apiKey = process.env.ASSEMBLYAI_API_KEY.trim();
        settingsRepository.saveSettings({ assemblyAiApiKey: apiKey });
      }
    }

    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'AssemblyAI API Key is not configured. Please open Admin Settings → API Credentials and save your AssemblyAI API Key.'
      );
    }

    return {
      apiKey: apiKey.trim(),
    };
  }

  /**
   * Gets configured default Speech-to-Text provider ('gemini' | 'gcp' | 'assemblyai').
   */
  public async getDefaultSttProvider(): Promise<string> {
    const settings = settingsRepository.getSettings();
    return settings.defaultSttProvider || settings.sttProvider || 'gemini';
  }

  /**
   * Formats system configuration with masked API keys for frontend Admin UI.
   * NEVER returns complete plain-text API keys in HTTP response.
   */
  public getPublicSettingsStatus() {
    const settings = settingsRepository.getSettings();
    const meta = settings.providerMetadata || {};

    return {
      gemini: {
        configured: !!(settings.geminiApiKey && settings.geminiApiKey.trim()),
        maskedKey: maskApiKey(settings.geminiApiKey),
        model: settings.geminiModel || 'gemini-3.8-flash',
        temperature: settings.geminiTemperature ?? 0.2,
        maxTokens: settings.geminiMaxTokens || 4096,
        updatedAt: meta.gemini?.updatedAt || settings.updatedAt,
        lastTestedAt: meta.gemini?.lastTestedAt,
        lastTestStatus: meta.gemini?.lastTestStatus || 'untested',
      },
      googleStt: {
        configured: !!((settings.sttApiKey && settings.sttApiKey.trim()) || (settings.gcpPrivateKey && settings.gcpPrivateKey.trim())),
        maskedKey: maskApiKey(settings.sttApiKey || ''),
        projectId: settings.gcpProjectId || '',
        gcsBucket: settings.gcsBucketName || '',
        clientEmail: settings.gcpClientEmail || '',
        hasPrivateKey: !!(settings.gcpPrivateKey && settings.gcpPrivateKey.trim()),
        updatedAt: meta.googleStt?.updatedAt || settings.updatedAt,
        lastTestedAt: meta.googleStt?.lastTestedAt,
        lastTestStatus: meta.googleStt?.lastTestStatus || 'untested',
      },
      assemblyAi: {
        configured: !!(settings.assemblyAiApiKey && settings.assemblyAiApiKey.trim()),
        maskedKey: maskApiKey(settings.assemblyAiApiKey || ''),
        updatedAt: meta.assemblyAi?.updatedAt || settings.updatedAt,
        lastTestedAt: meta.assemblyAi?.lastTestedAt,
        lastTestStatus: meta.assemblyAi?.lastTestStatus || 'untested',
      },
      crm: {
        configured: !!(settings.crmEndpoint && settings.crmEndpoint.trim()),
        endpoint: settings.crmEndpoint || '',
        maskedApiKey: maskApiKey(settings.crmApiKey),
      },
      defaultSttProvider: settings.defaultSttProvider || settings.sttProvider || 'gemini',
      defaultEditingProvider: settings.defaultEditingProvider || 'gemini',
      maxConcurrency: settings.maxConcurrency || 3,
      autoSyncInterval: settings.autoSyncInterval || 15,
      autoGenerateTranscripts: settings.autoGenerateTranscripts ?? true,
      autoQaEvaluation: settings.autoQaEvaluation ?? true,
      audioRetentionDays: settings.audioRetentionDays || 90,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Updates global settings and credential storage.
   */
  public updateSettings(payload: Partial<SystemSettingsConfig>) {
    return settingsRepository.saveSettings(payload);
  }

  /**
   * Records test status for provider.
   */
  public recordTestStatus(provider: 'gemini' | 'googleStt' | 'assemblyAi', success: boolean) {
    settingsRepository.updateTestMetadata(provider, success);
  }
}

export const credentialService = new CredentialService();
