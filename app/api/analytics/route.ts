import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const clientCode = searchParams.get('clientCode') || undefined;
    const campaignCode = searchParams.get('campaignCode') || undefined;

    const days = daysParam ? parseInt(daysParam, 10) : undefined;

    const analytics = dbStore.getAnalytics(days, clientCode, campaignCode);
    return NextResponse.json({ success: true, analytics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
