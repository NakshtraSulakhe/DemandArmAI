import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initializing System Settings for DemandArm AI...');

  // Seed Default System Settings
  await prisma.systemSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      crmEndpoint: '',
      crmApiKey: '',
      webhookSecret: '',
      crmWritebackUrl: '',
      isProcessingPaused: false,
      gcsBucketName: 'qtranscript-recordings',
      gcpProjectId: 'demandarm-ai-qa',
      gcpClientEmail: '',
      gcpPrivateKey: '',
      sttLanguageCode: 'en-US',
      sttModel: 'telephony',
      sttDiarizationEnabled: true,
      geminiApiKey: '',
      geminiModel: 'gemini-3.8-flash',
      geminiTemperature: 0.2,
      geminiMaxTokens: 4096,
      maxConcurrency: 3,
      autoSyncInterval: 15,
      autoGenerateTranscripts: true,
      autoQaEvaluation: true,
      audioRetentionDays: 90,
      sttCostPerMinute: 0.016,
      geminiInputCostPer1M: 0.075,
      geminiOutputCostPer1M: 0.30,
    },
  });

  console.log('System settings initialized successfully!');
}

main()
  .catch((e) => {
    console.error('Initialization error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
