import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MySQL database for DemandArm AI...');

  // Seed Default System Settings
  await prisma.systemSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      crmEndpoint: 'https://app.tarajglobal.com/demandflowbridge/api/get_leads.php',
      crmApiKey: 'crm_sec_demandarm_live_2026',
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

  // Seed Clients
  const clients = [
    {
      code: '1020',
      name: 'Software Finder',
      globalPrompt: `You are an expert sales call transcript editor for Software Finder.\nFormat the edited transcript cleanly with clear speaker labels ([Sales Rep] / [Prospect Name]).\nRemove filler words like "um", "uh", "you know", "like" while strictly preserving software implementation timelines, user seat counts, pricing numbers, product features, and client commitments.\nDo NOT fabricate any statements. Preserve verbatim customer objections and feature requests.`,
      qualificationCriteria: `1. Verification of prospect name, company, and decision-maker role.\n2. Discussion of software integration requirements or LMS implementation.\n3. Target implementation timeline identified (e.g. 3-6 months, 6-12 months).\n4. Follow-up action or demo agreed upon.`,
      isActive: true,
    },
    {
      code: '1010',
      name: 'Enterprise Tech Solutions 1010',
      globalPrompt: `You are an enterprise sales transcript editor for Client 1010.\nEnsure technical terms, Zero-Trust compliance markers, and cloud workload metrics are captured accurately.\nMaintain precise numbers, budget ranges, and compliance mandates mentioned by the prospect.\nNever infer consent or interest that was not explicitly voiced by the customer.`,
      qualificationCriteria: `1. Confirmed decision maker (VP / CISO / Director level).\n2. Cloud infrastructure or cybersecurity need identified.\n3. Implementation timeline within 6 months.\n4. Demo or follow-up technical review scheduled.`,
      isActive: true,
    },
    {
      code: '1030',
      name: 'Healthcare Informatics 1030',
      globalPrompt: `You are a compliance-focused transcript editor for Client 1030.\nEnsure all HIPAA compliance markers, EHR integrations (Epic, Cerner), and medical software features discussed are captured accurately.\nMaintain precise numbers, seats, and budget ranges.`,
      qualificationCriteria: `1. Verified prospect is a decision maker at a healthcare provider or hospital network.\n2. Discussion of patient data management or EHR integration.\n3. Implementation timeframe defined.\n4. Next step defined with specific target timeline.`,
      isActive: true,
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { code: client.code },
      update: client,
      create: client,
    });
  }

  // Seed Campaigns
  const campaigns = [
    {
      code: 'TG-1020-004',
      name: 'LMS Software Campaign',
      clientCode: '1020',
      assetTitle: 'LMS Software Enterprise Suite',
      valueProps: JSON.stringify([
        'Real-time LMS & HRIS Data Integration',
        'Automated Student & Employee Onboarding Tracking',
        '99.9% Uptime with SOC2 Data Compliance',
      ]),
      additionalEditingInstructions: `Capitalize LMS Software, HRIS Integration, and Learning Analytics correctly. Preserve implementation timelines.`,
      qualificationRulesOverride: `Prospect must manage active training or software implementation requirements.`,
      isActive: true,
    },
    {
      code: 'TG-1010-001',
      name: 'CloudShield Zero Trust',
      clientCode: '1010',
      assetTitle: 'CloudShield Enterprise Architecture Briefing',
      valueProps: JSON.stringify([
        'Automated Zero-Trust Micro-segmentation',
        '99.999% SLA with multi-region failover',
      ]),
      additionalEditingInstructions: `Capitalize Zero-Trust Architecture and IAM Policy Engine correctly.`,
      qualificationRulesOverride: `Must confirm prospect cloud workload infrastructure fit.`,
      isActive: true,
    },
    {
      code: 'TG-1030-002',
      name: 'Healthcare EHR Data Sync',
      clientCode: '1030',
      assetTitle: 'FinHealth Interoperability Engine',
      valueProps: JSON.stringify([
        'Epic & Cerner HL7/FHIR Data Sync',
        'Real-time insurance verification',
      ]),
      additionalEditingInstructions: `Ensure Epic, Cerner, HL7, and FHIR are capitalized properly.`,
      qualificationRulesOverride: `Prospect must manage hospital or healthcare clinic network.`,
      isActive: true,
    },
  ];

  for (const cmp of campaigns) {
    await prisma.campaign.upsert({
      where: { code: cmp.code },
      update: cmp,
      create: cmp,
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
