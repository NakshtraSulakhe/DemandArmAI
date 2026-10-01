import { NextResponse } from 'next/server';
import { jobWorker } from '../../../../../lib/jobs/jobWorker';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const retriedJob = await jobWorker.retryJob(id);

    return NextResponse.json({
      success: true,
      job: retriedJob,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
