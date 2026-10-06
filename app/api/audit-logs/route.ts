import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const logs = dbStore.getAuditLogs(jobId, isNaN(limit) ? 50 : limit);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
