import { NextResponse } from 'next/server';
import { dbStore } from '../../../../lib/db/store';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id)).filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Choose at least one lead to delete.' }, { status: 400 });
    }

    const result = dbStore.deleteLeads(ids);
    if (result.deleted.length === 0 && result.blocked.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'These leads are still being processed. Wait until they finish, then delete them.',
          ...result,
        },
        { status: 409 }
      );
    }
    if (result.deleted.length === 0) {
      return NextResponse.json({ success: false, error: 'Those leads are no longer in the list.', ...result }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not delete the lead.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
