import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';

export async function GET() {
  try {
    const clients = dbStore.getClients();
    const campaigns = dbStore.getCampaigns();

    const clientsWithCampaigns = clients.map((client) => ({
      ...client,
      campaigns: campaigns.filter((cmp) => cmp.clientCode.toUpperCase() === client.code.toUpperCase()),
    }));

    return NextResponse.json({ success: true, clients: clientsWithCampaigns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.code || !body.globalPrompt) {
      return NextResponse.json(
        { success: false, error: 'Client name, unique client code, and global prompt are required.' },
        { status: 400 }
      );
    }

    const saved = dbStore.saveClient(body);
    dbStore.addAuditLog(undefined, 'CLIENT_SAVED', `Client configuration updated: ${saved.name} (${saved.code})`);

    return NextResponse.json({ success: true, client: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, error: 'Client code is required for deletion.' }, { status: 400 });
    }

    const success = dbStore.deleteClient(code);
    if (success) {
      dbStore.addAuditLog(undefined, 'CLIENT_DELETED', `Client deactivated / deleted: ${code}`);
      return NextResponse.json({ success: true, message: `Client ${code} removed successfully.` });
    } else {
      return NextResponse.json({ success: false, error: 'Client code not found.' }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
