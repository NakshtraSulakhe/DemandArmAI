import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '../../../../lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode') || searchParams.get('code');

    if (!clientCode) {
      return NextResponse.json({ success: false, error: 'clientCode parameter is required' }, { status: 400 });
    }

    const promptVersions = dbStore.getClientPromptVersions(clientCode);
    return NextResponse.json({
      success: true,
      clientCode,
      promptVersions,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
