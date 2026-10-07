import { NextResponse } from 'next/server';
import { jobWorker } from '@/lib/jobs/jobWorker';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({} as { restart?: boolean }));
    const result = body?.restart ? await jobWorker.restartJob(id) : await jobWorker.processSingleJob(id);
    return NextResponse.json({ success: true, job: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
