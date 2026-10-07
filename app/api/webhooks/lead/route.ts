import { NextResponse } from 'next/server';
import { crmClient } from '@/lib/crm/crmClient';
import { jobWorker } from '@/lib/jobs/jobWorker';
import { dbStore } from '@/lib/db/store';
import { settingsRepository } from '@/lib/config/settingsRepository';

function expectedWebhookSecret(): string {
  return process.env.WEBHOOK_SECRET || settingsRepository.getSettings().webhookSecret || '';
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get('secret');
    const headerSecret = req.headers.get('x-webhook-secret') || req.headers.get('x-api-key');
    const providedSecret = querySecret || headerSecret;
    const expectedSecret = expectedWebhookSecret();

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized. Set a webhook secret in Settings and send it with the request.' },
        { status: 401 }
      );
    }

    // Read payload body
    const bodyText = await req.text();

    if (!bodyText || bodyText.trim() === '') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Bad Request: Received empty payload body.',
        },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Bad Request: Invalid JSON body received.',
        },
        { status: 400 }
      );
    }

    const result = crmClient.processIncomingWebhookPayload(payload);

    dbStore.addAuditLog(
      undefined,
      'WEBHOOK_LEAD_RECEIVED',
      `Processed ${result.processedCount} lead(s) via webhook. ${result.newLeadsCount} new leads added, ${result.enqueuedJobsCount} QA processing job(s) enqueued.`
    );

    // Trigger job processing asynchronously in background if jobs were enqueued
    if (result.enqueuedJobsCount > 0 && !jobWorker.isPaused()) {
      jobWorker.processQueue(10).catch((err) => console.error('Background worker error after webhook:', err));
    }

    return NextResponse.json(
      {
        status: 'success',
        message: `Successfully processed ${result.processedCount} lead(s) via webhook.`,
        processed_count: result.processedCount,
        new_leads_count: result.newLeadsCount,
        enqueued_jobs_count: result.enqueuedJobsCount,
        leads: result.processedLeads,
        errors: [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: `Internal Server Error: ${err.message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'DemandArm Webhook Receiver',
    endpoint: '/api/webhooks/lead',
    auth: 'Send the webhook secret in the x-webhook-secret header.',
    supported_methods: ['POST'],
  });
}
