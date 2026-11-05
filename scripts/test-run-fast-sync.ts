import { crmSyncWorker } from '../lib/crm/crmSyncWorker';
import { dbStore } from '../lib/db/store';

async function main() {
  console.log('Testing fast sync with all pending leads...');
  const t0 = Date.now();
  const metrics = await crmSyncWorker.runFastSync();
  const duration = Date.now() - t0;
  console.log(`Sync completed in ${duration}ms!`);
  console.log('Metrics summary:');
  for (const [code, m] of Object.entries(metrics.clientMetrics)) {
    console.log(`  Client ${code}: status=${m.status}, fetched=${m.recordsFetched}, inserted=${m.recordsInserted}, updated=${m.recordsUpdated}, newJobs=${m.newJobsCreated}, duration=${m.durationMs}ms`);
  }

  const allJobs = dbStore.getJobs();
  const pendingJobs = allJobs.filter((j) => j.status === 'PENDING');
  console.log(`Total jobs in DB: ${allJobs.length}, Pending jobs in queue: ${pendingJobs.length}`);
}

main().catch(console.error);
