import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');

    await dbStore.ensureConfigBackupImported();
    await dbStore.refreshDirectoryFromDb();
    const campaigns = dbStore.getCampaigns(clientCode || undefined);
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.code || !body.clientCode || !body.assetTitle) {
      return NextResponse.json(
        { success: false, error: 'Campaign name, unique code, parent client code, and asset title are required.' },
        { status: 400 }
      );
    }

    const parentClient = dbStore.getClientByCode(body.clientCode);
    if (!parentClient) {
      return NextResponse.json(
        { success: false, error: `Parent Client with code '${body.clientCode}' does not exist.` },
        { status: 400 }
      );
    }

    const saved = dbStore.saveCampaign(body);
    dbStore.addAuditLog(
      undefined,
      'CAMPAIGN_SAVED',
      `Campaign configuration updated: ${saved.name} (${saved.code}) under Client ${saved.clientCode}`
    );

    return NextResponse.json({ success: true, campaign: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, error: 'Campaign code is required.' }, { status: 400 });
    }

    const success = dbStore.deleteCampaign(code);
    if (success) {
      dbStore.addAuditLog(undefined, 'CAMPAIGN_DELETED', `Campaign deleted: ${code}`);
      return NextResponse.json({ success: true, message: `Campaign ${code} removed.` });
    } else {
      return NextResponse.json({ success: false, error: 'Campaign code not found.' }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
