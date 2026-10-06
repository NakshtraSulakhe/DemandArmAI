import { dbStore } from '../lib/db/store';
import { prisma } from '../lib/db/prisma';

async function runEndToEndPersistenceTests() {
  console.log('====================================================');
  console.log('STARTING DIRECT DATABASE PERSISTENCE TESTS (PRISMA)');
  console.log('====================================================\n');

  // 1. Sync store from DB
  await dbStore.syncFromDb();

  // TEST 1: CLIENT PERSISTENCE
  console.log('--- TEST 1: CLIENT PERSISTENCE ---');
  const testClient = dbStore.saveClient({
    code: 'TEST_CLI_999',
    name: 'Acme Test Corp',
    globalPrompt: 'Edit transcripts for Acme Corp preserving technical specs.',
    qualificationCriteria: '1. Confirmed decision maker.\n2. Budget over $50k.',
    isActive: true,
  }, 'QA Engineer');
  await new Promise((r) => setTimeout(r, 200));

  // Query Database Directly
  const dbClient = await prisma.client.findUnique({ where: { code: 'TEST_CLI_999' } });
  if (!dbClient) throw new Error('FAILED: Client not persisted to Prisma database!');
  console.log('✔ Client persisted to database:', dbClient.code, '->', dbClient.name);

  // TEST 2: CAMPAIGN PERSISTENCE
  console.log('\n--- TEST 2: CAMPAIGN PERSISTENCE ---');
  const testCampaign = dbStore.saveCampaign({
    code: 'CMP-TEST-999',
    name: 'Acme Cloud Launch',
    clientCode: 'TEST_CLI_999',
    assetTitle: 'Acme Cloud Architecture Whitepaper',
    valueProps: ['Zero latency cloud sync', 'SOC2 Compliant'],
    additionalEditingInstructions: 'Capitalize Acme Cloud correctly.',
    qualificationRulesOverride: 'Must be CTO or Director level.',
    isActive: true,
  });
  await new Promise((r) => setTimeout(r, 200));

  // Query Database Directly
  const dbCampaign = await prisma.campaign.findUnique({ where: { code: 'CMP-TEST-999' } });
  if (!dbCampaign) throw new Error('FAILED: Campaign not persisted to Prisma database!');
  console.log('✔ Campaign persisted to database:', dbCampaign.code, '->', dbCampaign.name, '(Client:', dbCampaign.clientCode + ')');

  // TEST 3: PROMPT VERSION PERSISTENCE
  console.log('\n--- TEST 3: PROMPT VERSION PERSISTENCE ---');
  const updatedClient = dbStore.saveClient({
    code: 'TEST_CLI_999',
    globalPrompt: 'UPDATED PROMPT VERSION 2: Ensure strict compliance metrics and SLA terms are captured.',
  }, 'Lead QA');
  await new Promise((r) => setTimeout(r, 200));

  const dbPrompts = await prisma.clientPromptVersion.findMany({ where: { clientCode: 'TEST_CLI_999' } });
  if (dbPrompts.length === 0) throw new Error('FAILED: Prompt version not persisted to Prisma database!');
  console.log('✔ Prompt Version persisted to database! Total versions:', dbPrompts.length, 'Latest version:', dbPrompts[dbPrompts.length - 1].version);

  // TEST 4: CRM LEAD PERSISTENCE
  console.log('\n--- TEST 4: CRM LEAD PERSISTENCE ---');
  const testLeadRef = `TEST_LEAD_${Date.now()}`;
  dbStore.upsertLeadsAndSyncJobs([
    {
      id: `lead_${Date.now()}`,
      leadRef: testLeadRef,
      clientCode: 'TEST_CLI_999',
      campaignCode: 'CMP-TEST-999',
      campaignName: 'Acme Cloud Launch',
      agentId: 'AGT_101',
      agentName: 'John Doe',
      contactName: 'Alice Smith',
      companyName: 'TechCorp Solutions',
      companySize: '500-1000',
      industry: 'Enterprise Software',
      country: 'USA',
      jobTitle: 'VP of Engineering',
      email: 'alice@techcorp.com',
      phone: '+1-555-0199',
      recordingUrl: 'https://storage.googleapis.com/test-bucket/recording_999.wav',
      qaStatusCrm: 'Pending QA',
      syncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ], []);
  await new Promise((r) => setTimeout(r, 200));

  // Query Database Directly
  const dbLead = await prisma.crmLead.findUnique({ where: { leadRef: testLeadRef } });
  if (!dbLead) throw new Error('FAILED: Lead not persisted to Prisma database!');
  console.log('✔ CRM Lead persisted to database:', dbLead.leadRef, 'Contact:', dbLead.contactName, 'Company:', dbLead.companyName);

  // TEST 5: PROCESSING JOB & RAW TRANSCRIPT PERSISTENCE
  console.log('\n--- TEST 5: PROCESSING JOB & RAW TRANSCRIPT PERSISTENCE ---');
  const testJobId = `job_test_${Date.now()}`;
  const rawTranscriptData = {
    text: '[Sales Rep]: Hello Alice, thank you for taking the call today.\n[Alice Smith]: Thanks John. We are looking to replace our current cloud setup by Q3.',
    speakerDiarization: [
      { speaker: 'Sales Rep', text: 'Hello Alice, thank you for taking the call today.' },
      { speaker: 'Alice Smith', text: 'Thanks John. We are looking to replace our current cloud setup by Q3.' }
    ],
    durationSeconds: 145,
    languageCode: 'en-US',
  };

  dbStore.saveJob({
    id: testJobId,
    leadId: dbLead.id,
    leadRef: testLeadRef,
    status: 'TRANSCRIBING',
    rawTranscript: rawTranscriptData as any,
    attempts: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 200));

  const dbJobRaw = await prisma.processingJob.findUnique({ where: { id: testJobId } });
  if (!dbJobRaw || !dbJobRaw.rawTranscript) throw new Error('FAILED: Processing job & raw transcript not persisted to database!');
  console.log('✔ Raw Transcript & Processing Job persisted to database! Status:', dbJobRaw.status);

  // TEST 6: AI EDITED TRANSCRIPT & QA PERSISTENCE
  console.log('\n--- TEST 6: AI EDITED TRANSCRIPT & QA EVALUATION PERSISTENCE ---');
  const editedTranscriptText = '[Sales Rep]: Hello Alice, thank you for taking the call.\n[Alice Smith]: Thanks John. We are looking to replace our cloud setup by Q3.';
  const qaResultData = {
    score: 95,
    status: 'QUALIFIED',
    feedback: 'Verified prospect is VP of Engineering with Q3 target timeline and cloud migration budget.',
    criteriaMet: ['Decision Maker Verified', 'Cloud Need Confirmed', 'Timeline Q3 Established'],
  };

  dbStore.saveJob({
    id: testJobId,
    leadId: dbLead.id,
    leadRef: testLeadRef,
    status: 'COMPLETED',
    rawTranscript: rawTranscriptData as any,
    editedTranscript: editedTranscriptText as any,
    promptVersionUsed: 'v2',
    qaStatus: 'QUALIFIED',
    qaResultJson: qaResultData as any,
    manualOverrideStatus: 'QUALIFIED',
    manualOverrideNotes: 'Verified and approved by QA Lead',
    reviewedBy: 'QA Auditor',
    reviewedAt: new Date().toISOString(),
    attempts: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 200));

  const dbJobCompleted = await prisma.processingJob.findUnique({ where: { id: testJobId } });
  if (!dbJobCompleted || !dbJobCompleted.editedTranscript || !dbJobCompleted.qaResultJson) {
    throw new Error('FAILED: Edited transcript or QA evaluation not persisted to database!');
  }
  console.log('✔ Edited Transcript & QA Result persisted to database!');
  console.log('  QA Status:', dbJobCompleted.qaStatus, '| Override Status:', dbJobCompleted.manualOverrideStatus);

  // TEST 7: SYSTEM SETTINGS PERSISTENCE
  console.log('\n--- TEST 7: SYSTEM SETTINGS PERSISTENCE ---');
  dbStore.updateSettings({
    geminiModel: 'gemini-3.8-flash',
    sttCostPerMinute: 0.016,
    geminiInputCostPer1M: 0.075,
    geminiOutputCostPer1M: 0.30,
  });
  await new Promise((r) => setTimeout(r, 200));

  const dbSettings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  if (!dbSettings) throw new Error('FAILED: System Settings not persisted to database!');
  console.log('✔ System Settings persisted to database! Gemini Model:', dbSettings.geminiModel);

  // TEST 8: AUDIT LOG PERSISTENCE
  console.log('\n--- TEST 8: AUDIT LOG PERSISTENCE ---');
  dbStore.addAuditLog(testJobId, 'QA_MANUAL_OVERRIDE', 'Approved qualified status for lead ' + testLeadRef);
  await new Promise((r) => setTimeout(r, 200));
  const dbAuditLogs = await prisma.auditLog.findMany({ where: { jobId: testJobId } });
  if (dbAuditLogs.length === 0) throw new Error('FAILED: Audit log not persisted to database!');
  console.log('✔ Audit Log persisted to database! Action:', dbAuditLogs[0].action);

  console.log('\n====================================================');
  console.log('SUMMARY OF TABLE ROW COUNTS IN PRISMA DATABASE:');
  console.log('====================================================');
  console.log('SystemSettings rows:', await prisma.systemSettings.count());
  console.log('Client rows:        ', await prisma.client.count());
  console.log('Campaign rows:      ', await prisma.campaign.count());
  console.log('PromptVersion rows: ', await prisma.clientPromptVersion.count());
  console.log('CrmLead rows:       ', await prisma.crmLead.count());
  console.log('ProcessingJob rows: ', await prisma.processingJob.count());
  console.log('AuditLog rows:      ', await prisma.auditLog.count());
  console.log('\nALL 8 DATABASE PERSISTENCE TESTS PASSED 100%!');
}

runEndToEndPersistenceTests()
  .catch((e) => {
    console.error('\n❌ DATABASE TEST FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
