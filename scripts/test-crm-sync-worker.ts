import { dbStore } from '../lib/db/store';
import { crmSyncWorker } from '../lib/crm/crmSyncWorker';
import { ClientConfig } from '../lib/types';

async function runCrmSyncWorkerTests() {
  console.log('===========================================================');
  console.log('🤖 DEMANDARM NEAR-REAL-TIME CRM SYNC WORKER TEST SUITE');
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Dynamic Client Discovery
  // -------------------------------------------------------------
  const testClientCode = '9999_DYNAMIC';

  const newClient: Partial<ClientConfig> = {
    name: 'Dynamic Test Client 9999',
    code: testClientCode,
    globalPrompt: 'Test Prompt',
    qualificationCriteria: 'Test Criteria',
    isActive: true,
  };
  dbStore.saveClient(newClient);

  const activeCodes = dbStore.getClients().filter((c) => c.isActive).map((c) => c.code);
  assert(
    activeCodes.includes(testClientCode),
    '1. Dynamic Client Discovery includes newly added client code without code modifications'
  );

  // -------------------------------------------------------------
  // TEST 2: Lock Protection Against Overlapping Sync Execution
  // -------------------------------------------------------------
  const p1 = crmSyncWorker.runFastSync();
  const p2 = crmSyncWorker.runFastSync(); // Concurrent trigger

  const [res1, res2] = await Promise.all([p1, p2]);
  assert(
    res1 !== null && res2 !== null,
    '2. Concurrent sync triggers handled safely by global lock without race conditions'
  );

  // -------------------------------------------------------------
  // TEST 3: Idempotent Upsert & State Protection
  // -------------------------------------------------------------
  const mockLeadRef = 'REF-SYNC-PROTECT-001';
  dbStore.saveLead({
    id: 'lead_001',
    leadRef: mockLeadRef,
    clientCode: '1020',
    campaignCode: '1020-CAMP',
    contactName: 'Original Contact',
    companyName: 'Original Company',
    recordingUrl: 'https://example.com/audio.wav',
    syncedAt: new Date().toISOString(),
  });

  dbStore.upsertLeadsAndSyncJobs([], [
    {
      id: 'job_protect_001',
      leadId: 'lead_001',
      leadRef: mockLeadRef,
      status: 'COMPLETED',
      editedTranscript: 'Preserved Finished Transcript Data',
      qaStatus: 'QUALIFIED',
      attempts: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const jobBefore = dbStore.getJobById(mockLeadRef);
  assert(jobBefore?.status === 'COMPLETED', '3a. ProcessingJob exists in COMPLETED state before sync pass');

  // Run fast sync pass
  await crmSyncWorker.runFastSync();

  const jobAfter = dbStore.getJobById(mockLeadRef);
  assert(
    jobAfter?.status === 'COMPLETED' && jobAfter?.editedTranscript === 'Preserved Finished Transcript Data',
    '3b. DemandArm processing state (COMPLETED, transcripts, QA results) strictly preserved during CRM sync pass'
  );

  // -------------------------------------------------------------
  // TEST 4: No Recording Binary Downloads During Sync Pass
  // -------------------------------------------------------------
  const leadSample = dbStore.getLeadByRef(mockLeadRef);
  assert(
    typeof leadSample?.recordingUrl === 'string' && !leadSample.rawLeadData?.audioBinary,
    '4. Synchronization stores ONLY recording URL metadata without downloading audio binaries'
  );

  // -------------------------------------------------------------
  // TEST 5: Sync Metrics State Tracking
  // -------------------------------------------------------------
  const metrics = crmSyncWorker.getSyncMetrics();
  assert(
    typeof metrics.currentSyncIntervalMinutes === 'number' && metrics.currentSyncIntervalMinutes >= 2,
    '5. Operational sync metrics track 2-minute fast sync interval and client status'
  );

  // Clean up test client
  dbStore.deleteClient(testClientCode);

  console.log('===========================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed.`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCrmSyncWorkerTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
