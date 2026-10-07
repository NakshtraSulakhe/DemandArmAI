import { NextResponse } from 'next/server';
import { dbStore } from '../../../../lib/db/store';
import { pushQaResultToCrm } from '../../../../lib/crm/crmWriteback';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = dbStore.getJobById(id);

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const auditLogs = dbStore.getAuditLogs(job.id);

    return NextResponse.json({
      success: true,
      job,
      auditLogs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const job = dbStore.getJobById(id);

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const { manualOverrideStatus, manualOverrideNotes, editedTranscript, reviewedBy } = body;

    // 1. Manual transcript correction
    if (editedTranscript !== undefined && editedTranscript !== job.editedTranscript) {
      job.editedTranscript = editedTranscript;
      dbStore.addAuditLog(
        job.id,
        'MANUAL_TRANSCRIPT_EDIT',
        `Edited transcript manually updated by ${reviewedBy || 'Admin'}.`
      );
    }

    // 2. Manual QA override decision
    if (manualOverrideStatus) {
      job.manualOverrideStatus = manualOverrideStatus;
      job.manualOverrideNotes = manualOverrideNotes || '';
      job.reviewedBy = reviewedBy || 'Admin';
      job.reviewedAt = new Date().toISOString();

      dbStore.addAuditLog(
        job.id,
        'QA_MANUAL_OVERRIDE',
        `QA Qualification status manually set to '${manualOverrideStatus}' by ${job.reviewedBy}. Notes: ${job.manualOverrideNotes || 'None'}`
      );
    }

    dbStore.saveJob(job);
    if (manualOverrideStatus) {
      await pushQaResultToCrm(job, job.lead);
    }
    const updatedJob = dbStore.getJobById(job.id);

    return NextResponse.json({
      success: true,
      job: updatedJob,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
