import { NextResponse } from 'next/server';
import { jobWorker } from '../../../../lib/jobs/jobWorker';
import { ensurePipelineStarted } from '../../../../lib/jobs/pipelineScheduler';
import { getSessionUser } from '../../../../lib/security/session';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: Only administrators can start or trigger the processing pipeline.',
        },
        { status: 403 }
      );
    }

    ensurePipelineStarted();
    if (jobWorker.isPaused()) {
      return NextResponse.json(
        {
          success: false,
          error: 'The pipeline is stopped. Start it before running the queue.',
        },
        { status: 409 }
      );
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
