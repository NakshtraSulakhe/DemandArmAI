import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const logs = dbStore.getAuditLogs(jobId, limit);
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
