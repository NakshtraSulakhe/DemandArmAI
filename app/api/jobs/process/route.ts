import { NextResponse } from 'next/server';
import { jobWorker } from '../../../../lib/jobs/jobWorker';

export async function POST() {
  try {
    const result = await jobWorker.processQueue();
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
