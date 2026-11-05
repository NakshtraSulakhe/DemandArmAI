const { crmSyncWorker } = require('./transcript-app/lib/crm/crmSyncWorker');

async function run() {
  console.log('--- Triggering CRM Sync for Date: 2026-11-03 ---');
  const metrics = await crmSyncWorker.runFastSync('2026-11-03');
  console.log('Sync Result Metrics:');
  console.log(JSON.stringify(metrics, null, 2));

  // Now verify how many leads for 2026-11-03 exist in the DB
  const { dbStore } = require('./transcript-app/lib/db/store');
  const allLeads = dbStore.getLeads();
  const nov3Leads = allLeads.filter(l => (l.createdAt || '').slice(0, 10) === '2026-11-03');
  console.log(`\nFound ${nov3Leads.length} leads in database dated 2026-11-03!`);

  // Count QA statuses
  const qaCounts = {};
  nov3Leads.forEach(l => {
    const s = l.qaStatusCrm || 'Unknown';
    qaCounts[s] = (qaCounts[s] || 0) + 1;
  });
  console.log('Nov 3 QA Statuses in DB:', qaCounts);

  // Check jobs created
  const allJobs = dbStore.getJobs();
  const nov3Jobs = allJobs.filter(j => j.lead && (j.lead.createdAt || '').slice(0, 10) === '2026-11-03');
  console.log(`Found ${nov3Jobs.length} processing jobs created for Nov 3 leads!`);

  console.log('\nSample Nov 3 lead in DB:');
  if (nov3Leads.length > 0) {
    console.log({
      id: nov3Leads[0].id,
      leadRef: nov3Leads[0].leadRef,
      contactName: nov3Leads[0].contactName,
      companyName: nov3Leads[0].companyName,
      clientCode: nov3Leads[0].clientCode,
      campaignCode: nov3Leads[0].campaignCode,
      qaStatusCrm: nov3Leads[0].qaStatusCrm,
      createdAt: nov3Leads[0].createdAt,
      recordingUrl: nov3Leads[0].recordingUrl,
    });
  }

  console.log('\n=== Nov 3 Leads Sync Complete ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Error syncing Nov 3 leads:', err);
  process.exit(1);
});

