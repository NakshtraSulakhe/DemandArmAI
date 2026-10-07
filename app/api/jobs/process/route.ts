import { NextResponse } from 'next/server';
import { jobWorker } from '../../../../lib/jobs/jobWorker';
import { ensurePipelineStarted } from '../../../../lib/jobs/pipelineScheduler';

export async function POST() {
  try {
    ensurePipelineStarted();
    if (jobWorker.isPaused()) {
      return NextResponse.json({
        success: false,
        error: 'The pipeline is stopped. Start it before running the queue.',
      }, { status: 409 });
    }

    jobWorker.processQueue().catch((err) => console.error('[Pipeline] Manual run failed:', err));
    return NextResponse.json({
      success: true,
      result: { started: true },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
