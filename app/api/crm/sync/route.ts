import { NextResponse } from 'next/server';
import { crmClient } from '../../../../lib/crm/crmClient';
import { jobWorker } from '../../../../lib/jobs/jobWorker';
import { dbStore } from '../../../../lib/db/store';

export async function POST() {
  try {
    const syncResult = await crmClient.syncLeads();
    dbStore.addAuditLog(
      undefined,
      'CRM_SYNC_EXECUTED',
      `Synchronized ${syncResult.fetchedCount} matching leads from CRM. ${syncResult.newLeadsCount} new leads, ${syncResult.newJobsCount} new jobs enqueued.`
    );

    // Run job queue processing asynchronously in background without blocking response
    jobWorker.processQueue(10).catch((err) => console.error('Background worker error during sync:', err));

    return NextResponse.json({
      success: true,
      syncResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
