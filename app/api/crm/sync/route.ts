import { NextResponse } from 'next/server';
import { crmSyncWorker } from '@/lib/crm/crmSyncWorker';
import { ensurePipelineStarted } from '@/lib/jobs/pipelineScheduler';

export async function GET() {
  try {
    ensurePipelineStarted();
    const metrics = crmSyncWorker.getSyncMetrics();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    ensurePipelineStarted();
    const body = await req.json().catch(() => ({}));
    const dateFrom = body.dateFrom || body.date_from;
    const isFull = body.full === true || body.fullSync === true;
    const metrics = isFull
      ? await crmSyncWorker.runReconciliationSync()
      : await crmSyncWorker.runFastSync(dateFrom);
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
