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

export async function POST() {
  try {
    ensurePipelineStarted();
    const metrics = await crmSyncWorker.runFastSync();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

