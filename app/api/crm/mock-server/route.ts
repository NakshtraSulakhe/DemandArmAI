import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  if (process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid CRM Bearer token.' },
        { status: 401 }
      );
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    return NextResponse.json({
      status: 'success',
      total: 0,
      count: 0,
      page,
      limit,
      total_pages: 0,
      leads: [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
