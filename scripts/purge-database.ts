import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function purgeDatabase() {
  console.log('Purging test/hardcoded records from database...');

  try {
    // Delete in order of foreign key dependencies
    await prisma.auditLog.deleteMany({});
    await prisma.processingJob.deleteMany({});
    await prisma.crmLead.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.clientPromptVersion.deleteMany({});
    await prisma.client.deleteMany({});

    console.log('Database tables cleared successfully!');

    // Reset local JSON backup file as well
    const DATA_DIR = path.join(process.cwd(), '.data');
    const STORE_FILE = path.join(DATA_DIR, 'db_store.json');
    if (fs.existsSync(STORE_FILE)) {
      const cleanStore = {
        clients: [],
        campaigns: [],
        leads: [],
        jobs: [],
        auditLogs: [],
        clientPrompts: [],
        settings: {
          id: 'global',
          crmEndpoint: '',
          crmApiKey: '',
          webhookSecret: '',
          crmWritebackUrl: '',
          sttProvider: 'gemini',
          sttApiKey: '',
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
          isProcessingPaused: false,
          audioRetentionDays: 90,
          sttCostPerMinute: 0.016,
          geminiInputCostPer1M: 0.075,
          geminiOutputCostPer1M: 0.30,
          updatedAt: new Date().toISOString(),
        }
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(cleanStore, null, 2), 'utf-8');
      console.log('Local store backup reset to clean state.');
    }
  } catch (err) {
    console.error('Error purging database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

purgeDatabase();
