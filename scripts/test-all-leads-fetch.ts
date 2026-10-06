import { crmSyncWorker } from '../lib/crm/crmSyncWorker';
import { dbStore } from '../lib/db/store';
import { prisma } from '../lib/db/prisma';

async function testFetchAllLeads() {
  console.log('Testing full CRM lead synchronization across all client codes...');

  // Run fast sync with wide date range
  const metrics = await crmSyncWorker.runReconciliationSync();
  console.log('Sync Metrics Result:', JSON.stringify(metrics, null, 2));

  const leadCount = await prisma.crmLead.count();
  const clientCount = await prisma.client.count();
  const campaignCount = await prisma.campaign.count();
  const jobCount = await prisma.processingJob.count();

  console.log('\n===================================================');
  console.log('FETCH RESULTS IN MYSQL DATABASE:');
  console.log('===================================================');
  console.log('Clients auto-registered in DB: ', clientCount);
  console.log('Campaigns auto-registered in DB:', campaignCount);
  console.log('Total CRM Leads saved in DB:    ', leadCount);
  console.log('Total Processing Jobs in DB:   ', jobCount);
}

testFetchAllLeads();
