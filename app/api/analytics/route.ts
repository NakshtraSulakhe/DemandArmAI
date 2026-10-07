import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';
import { getUsdToInrRate } from '../../../lib/fx/usdInr';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const clientCode = searchParams.get('clientCode') || undefined;
    const campaignCode = searchParams.get('campaignCode') || undefined;

    const days = daysParam ? parseInt(daysParam, 10) : undefined;

    const analytics = dbStore.getAnalytics(days, clientCode, campaignCode);
    const usdToInrRate = await getUsdToInrRate();
    return NextResponse.json({ success: true, analytics: { ...analytics, usdToInrRate } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
