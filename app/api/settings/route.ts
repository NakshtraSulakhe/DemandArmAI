import { NextResponse } from 'next/server';
import { credentialService } from '@/lib/config/credentialService';
import { dbStore } from '@/lib/db/store';

export async function GET() {
  try {
    const publicSettings = credentialService.getPublicSettingsStatus();
    return NextResponse.json({
      success: true,
      settings: publicSettings,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Map UI inputs to SystemSettingsConfig payload
    const payload: Record<string, any> = {};

    if (body.geminiApiKey !== undefined) payload.geminiApiKey = body.geminiApiKey;
    if (body.geminiModel !== undefined) payload.geminiModel = body.geminiModel;
    if (body.geminiTemperature !== undefined) payload.geminiTemperature = body.geminiTemperature;
    if (body.geminiMaxTokens !== undefined) payload.geminiMaxTokens = body.geminiMaxTokens;

    if (body.sttApiKey !== undefined) payload.sttApiKey = body.sttApiKey;
    if (body.googleSttApiKey !== undefined) payload.sttApiKey = body.googleSttApiKey;
    if (body.gcpProjectId !== undefined) payload.gcpProjectId = body.gcpProjectId;
    if (body.gcsBucketName !== undefined) payload.gcsBucketName = body.gcsBucketName;
    if (body.gcsBucket !== undefined) payload.gcsBucketName = body.gcsBucket;
    if (body.gcpClientEmail !== undefined) payload.gcpClientEmail = body.gcpClientEmail;
    if (body.gcpPrivateKey !== undefined) payload.gcpPrivateKey = body.gcpPrivateKey;

    if (body.assemblyAiApiKey !== undefined) payload.assemblyAiApiKey = body.assemblyAiApiKey;

    if (body.defaultSttProvider !== undefined) {
      payload.defaultSttProvider = body.defaultSttProvider;
      payload.sttProvider = body.defaultSttProvider;
    } else if (body.sttProvider !== undefined) {
      payload.sttProvider = body.sttProvider;
      payload.defaultSttProvider = body.sttProvider;
    }

    if (body.crmEndpoint !== undefined) payload.crmEndpoint = body.crmEndpoint;
    if (body.crmApiKey !== undefined) payload.crmApiKey = body.crmApiKey;

    if (body.maxConcurrency !== undefined) payload.maxConcurrency = body.maxConcurrency;
    if (body.autoSyncInterval !== undefined) payload.autoSyncInterval = body.autoSyncInterval;
    if (body.autoGenerateTranscripts !== undefined) payload.autoGenerateTranscripts = body.autoGenerateTranscripts;
    if (body.autoQaEvaluation !== undefined) payload.autoQaEvaluation = body.autoQaEvaluation;
    if (body.audioRetentionDays !== undefined) payload.audioRetentionDays = body.audioRetentionDays;

    credentialService.updateSettings(payload);
    dbStore.addAuditLog(undefined, 'SETTINGS_UPDATED', 'API Credentials and global pipeline settings were updated.');

    const publicSettings = credentialService.getPublicSettingsStatus();
    return NextResponse.json({ success: true, settings: publicSettings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return POST(req);
}
