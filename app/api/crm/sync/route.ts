import { NextResponse } from 'next/server';
import { crmSyncWorker } from '@/lib/crm/crmSyncWorker';

export async function GET() {
  try {
    crmSyncWorker.ensureAutoSyncStarted();
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
    crmSyncWorker.ensureAutoSyncStarted();
    const metrics = await crmSyncWorker.runFastSync();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

