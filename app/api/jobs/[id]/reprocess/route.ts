import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '../../../../../lib/db/store';
import { geminiService } from '../../../../../lib/ai/geminiService';
import { qaEngine } from '../../../../../lib/qa/qaEngine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = dbStore.getJobById(id);

    if (!job) {
      return NextResponse.json({ success: false, error: `Job not found: ${id}` }, { status: 404 });
    }

    if (!job.rawTranscript) {
      return NextResponse.json(
        { success: false, error: 'Raw transcript is required before reprocessing with latest prompt.' },
        { status: 400 }
      );
    }

    const lead = job.lead || dbStore.getLeadByRef(job.leadRef);
    if (!lead) {
      return NextResponse.json({ success: false, error: `Lead not found for job: ${id}` }, { status: 404 });
    }

    const client = dbStore.getClientByCode(lead.clientCode);
    if (!client) {
      return NextResponse.json(
        { success: false, error: `Client configuration missing for client code ${lead.clientCode}` },
        { status: 400 }
      );
    }

    const campaign = dbStore.getCampaignByCode(lead.campaignCode);

    job.status = 'AI_EDITING';
    job.stepError = undefined;
    dbStore.saveJob(job);

    try {
      const edited = await geminiService.editTranscript(client, campaign, lead, job.rawTranscript);

      job.editedTranscript = edited.editedTranscript;
      job.promptVersionUsed = `${edited.versionTag} (Reprocessed)`;
      job.promptTokens = (job.promptTokens || 0) + edited.promptTokens;
      job.completionTokens = (job.completionTokens || 0) + edited.completionTokens;
      job.status = 'QA_EVALUATING';
      dbStore.saveJob(job);

      const qaResult = await qaEngine.evaluateLead(
        client,
        campaign,
        lead,
        job.rawTranscript,
        edited.editedTranscript
      );

      job.qaResultJson = qaResult;
      job.qaStatus = qaResult.qualificationStatus;
      job.promptTokens = (job.promptTokens || 0) + Number(qaResult.metadata?.promptTokens || 0);
      job.completionTokens = (job.completionTokens || 0) + Number(qaResult.metadata?.completionTokens || 0);
      job.status = 'COMPLETED';
      job.stepError = undefined;
    } catch (err: any) {
      const stepError = err.message || 'Regenerate failed.';
      job.status = 'FAILED';
      job.stepError = stepError;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_FAILED', stepError);
      return NextResponse.json({ success: false, error: stepError, job }, { status: 500 });
    }

    dbStore.saveJob(job);
    dbStore.addAuditLog(
      job.id,
      'JOB_REPROCESSED',
      `Manual reprocessing completed with latest client prompt (Version ${client.promptVersion || 1}).`
    );

    return NextResponse.json({
      success: true,
      job,
      message: `Lead ${job.leadRef} reprocessed successfully with latest prompt version!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
