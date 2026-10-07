import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';
import { ensurePipelineStarted } from '../../../lib/jobs/pipelineScheduler';

export async function GET() {
  try {
    ensurePipelineStarted();
    const settingsCount = await prisma.systemSettings.count();
    const clientsCount = await prisma.client.count();
    const campaignsCount = await prisma.campaign.count();
    const leadsCount = await prisma.crmLead.count();
    const jobsCount = await prisma.processingJob.count();

    return NextResponse.json({
      status: 'OK',
      database: 'CONNECTED',
      engine: 'MySQL',
      databaseName: 'configured DATABASE_URL',
      counts: {
        systemSettings: settingsCount,
        clients: clientsCount,
        campaigns: campaignsCount,
        leads: leadsCount,
        jobs: jobsCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'ERROR',
        database: 'DISCONNECTED',
        error: error.message || 'Database connection error',
      },
      { status: 500 }
    );
  }
}
