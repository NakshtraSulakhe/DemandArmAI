import { dbStore } from '../db/store';
import { SystemSettingsConfig, ProviderMetadata } from '../types';
import { encryptCredential, decryptCredential, isEncrypted } from '../security/encryption';

export class SettingsRepository {
  /**
   * Retrieves global system settings with decrypted credentials for server-side usage.
   */
  public getSettings(): SystemSettingsConfig {
    const raw = dbStore.getSettings();
    return {
      ...raw,
      geminiApiKey: raw.geminiApiKey ? decryptCredential(raw.geminiApiKey) : '',
      sttApiKey: raw.sttApiKey ? decryptCredential(raw.sttApiKey) : '',
      assemblyAiApiKey: raw.assemblyAiApiKey ? decryptCredential(raw.assemblyAiApiKey) : '',
      crmApiKey: raw.crmApiKey ? decryptCredential(raw.crmApiKey) : '',
      gcpPrivateKey: raw.gcpPrivateKey ? decryptCredential(raw.gcpPrivateKey) : '',
    };
  }

  /**
   * Saves updated settings to backend storage, encrypting sensitive API keys.
   * If a key field is omitted, empty, or contains masked characters (e.g. '******'), existing stored key is retained.
   */
  public saveSettings(newSettings: Partial<SystemSettingsConfig>): SystemSettingsConfig {
    const currentRaw = dbStore.getSettings();
    const updatePayload: Partial<SystemSettingsConfig> = { ...newSettings };

    // 1. Gemini API Key
    if (
      updatePayload.geminiApiKey === undefined ||
      updatePayload.geminiApiKey.trim() === '' ||
      updatePayload.geminiApiKey.includes('******')
    ) {
      updatePayload.geminiApiKey = currentRaw.geminiApiKey;
    } else {
      updatePayload.geminiApiKey = encryptCredential(updatePayload.geminiApiKey);
    }

    // 2. Google STT API Key / STT API Key
    if (
      updatePayload.sttApiKey === undefined ||
      updatePayload.sttApiKey.trim() === '' ||
      updatePayload.sttApiKey.includes('******')
    ) {
      updatePayload.sttApiKey = currentRaw.sttApiKey;
    } else {
      updatePayload.sttApiKey = encryptCredential(updatePayload.sttApiKey);
    }

    // 3. AssemblyAI API Key
    if (
      updatePayload.assemblyAiApiKey === undefined ||
      updatePayload.assemblyAiApiKey.trim() === '' ||
      updatePayload.assemblyAiApiKey.includes('******')
    ) {
      updatePayload.assemblyAiApiKey = currentRaw.assemblyAiApiKey;
    } else {
      updatePayload.assemblyAiApiKey = encryptCredential(updatePayload.assemblyAiApiKey);
    }

    // 4. CRM API Key
    if (
      updatePayload.crmApiKey === undefined ||
      updatePayload.crmApiKey.trim() === '' ||
      updatePayload.crmApiKey.includes('******')
    ) {
      updatePayload.crmApiKey = currentRaw.crmApiKey;
    } else {
      updatePayload.crmApiKey = encryptCredential(updatePayload.crmApiKey);
    }

    // 5. GCP Private Key
    if (
      updatePayload.gcpPrivateKey === undefined ||
      updatePayload.gcpPrivateKey.trim() === '' ||
      updatePayload.gcpPrivateKey.includes('******') ||
      updatePayload.gcpPrivateKey === '***CONFIGURED***'
    ) {
      updatePayload.gcpPrivateKey = currentRaw.gcpPrivateKey;
    } else {
      updatePayload.gcpPrivateKey = encryptCredential(updatePayload.gcpPrivateKey);
    }

    // Update metadata rotation timestamp if keys changed
    const providerMetadata = {
      ...(currentRaw.providerMetadata || {}),
      ...(updatePayload.providerMetadata || {}),
    };

    if (updatePayload.geminiApiKey !== currentRaw.geminiApiKey) {
      providerMetadata.gemini = {
        ...(providerMetadata.gemini || {}),
        updatedAt: new Date().toISOString(),
      };
    }
    if (updatePayload.sttApiKey !== currentRaw.sttApiKey) {
      providerMetadata.googleStt = {
        ...(providerMetadata.googleStt || {}),
        updatedAt: new Date().toISOString(),
      };
    }
    if (updatePayload.assemblyAiApiKey !== currentRaw.assemblyAiApiKey) {
      providerMetadata.assemblyAi = {
        ...(providerMetadata.assemblyAi || {}),
        updatedAt: new Date().toISOString(),
      };
    }

    updatePayload.providerMetadata = providerMetadata;

    const saved = dbStore.updateSettings(updatePayload);
    return saved;
  }

  /**
   * Updates test results metadata for a given provider.
   */
  public updateTestMetadata(provider: 'gemini' | 'googleStt' | 'assemblyAi', success: boolean): void {
    const currentRaw = dbStore.getSettings();
    const meta: Record<string, ProviderMetadata> = currentRaw.providerMetadata || {};
    meta[provider] = {
      ...(meta[provider] || {}),
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: success ? 'success' : 'failed',
    };
    dbStore.updateSettings({ providerMetadata: meta });
  }
}

export const settingsRepository = new SettingsRepository();
