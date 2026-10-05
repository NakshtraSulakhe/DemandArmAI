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

    // Re-run AI transcript editing with latest active client prompt
    const { editedTranscript, versionTag } = await geminiService.editTranscript(
      client,
      campaign,
      lead,
      job.rawTranscript
    );

    // Re-evaluate QA criteria
    const qaResult = await qaEngine.evaluateLead(
      client,
      campaign,
      lead,
      job.rawTranscript,
      editedTranscript
    );

    job.editedTranscript = editedTranscript;
    job.promptVersionUsed = `${versionTag} (Reprocessed)`;
    job.qaResultJson = qaResult;
    job.qaStatus = qaResult.qualificationStatus;
    job.status = 'COMPLETED';
    job.stepError = undefined;

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
