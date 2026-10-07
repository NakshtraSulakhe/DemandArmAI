import { NextResponse } from 'next/server';
import { dbStore, qaCategory } from '../../../lib/db/store';
import { CrmLeadItem, ProcessingJobItem } from '../../../lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');
    const campaignCode = searchParams.get('campaignCode');
    const crmQaStatus = searchParams.get('qaStatus') || searchParams.get('crmQaStatus');
    const processingStatus = searchParams.get('processingStatus');
    const transcriptStatus = searchParams.get('transcriptStatus');
    const search = searchParams.get('search');
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam === 'all' ? 0 : parseInt(limitParam || '25', 10);
    const limit = isNaN(rawLimit) ? 25 : rawLimit;

    const allLeads = dbStore.getLeads();
    const allJobs = dbStore.getJobs();
    const jobsMap = new Map<string, ProcessingJobItem>();
    allJobs.forEach((job) => {
      const current = jobsMap.get(job.leadRef);
      if (!current || new Date(job.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime()) {
        jobsMap.set(job.leadRef, job);
      }
    });

    // One directory row per stored lead. Extra jobs for the same lead stay off this list.
    let mappedLeads = allLeads.map((lead) => {
      const job = jobsMap.get(lead.leadRef);

      let effectiveProcStatus = 'Not Eligible';
      let effectiveTranscriptStatus = 'Not Generated';

      const isPendingQa = (lead.qaStatusCrm || '').toString().toLowerCase().includes('pending');
      const hasRecording = !!(lead.recordingUrl || (lead.recordings && lead.recordings.length > 0));

      if (job) {
        if (job.status === 'COMPLETED') {
          effectiveProcStatus = 'Completed';
          effectiveTranscriptStatus = 'Completed';
        } else if (job.status === 'FAILED') {
          effectiveProcStatus = 'Failed';
          effectiveTranscriptStatus = 'Failed';
        } else if (['AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'].includes(job.status)) {
          effectiveProcStatus = 'Processing';
          effectiveTranscriptStatus = 'Generating';
        } else {
          effectiveProcStatus = 'Queued';
          effectiveTranscriptStatus = 'Pending';
        }
      } else if (!isPendingQa) {
        effectiveProcStatus = 'Not Eligible';
      } else if (!hasRecording) {
        effectiveProcStatus = 'Waiting Recording';
      } else {
        effectiveProcStatus = 'Queued';
      }

      // Pre-Edit & Post-Edit scores from job if available
      const preEditScore = job?.rawTranscript ? 7 : null;
      const postEditScore = job?.editedTranscript ? 9 : null;
      const aiQaStatus = job?.manualOverrideStatus || job?.qaStatus || (job?.editedTranscript ? 'QA_READY' : 'PENDING');

      const { rawLeadData, ...lightLead } = lead;

      return {
        ...lightLead,
        job,
        processingStatus: effectiveProcStatus,
        transcriptStatus: effectiveTranscriptStatus,
        preEditScore,
        postEditScore,
        aiQaStatus,
      };
    });

    // Filtering
    if (clientCode && clientCode !== 'ALL') {
      mappedLeads = mappedLeads.filter((l) => (l.clientCode || '').toUpperCase() === clientCode.toUpperCase());
    }

    if (campaignCode && campaignCode !== 'ALL') {
      mappedLeads = mappedLeads.filter((l) => (l.campaignCode || '').toUpperCase() === campaignCode.toUpperCase());
    }

    if (crmQaStatus && crmQaStatus !== 'ALL') {
      const wanted = crmQaStatus === 'Pending QA' ? 'PENDING' : crmQaStatus;
      mappedLeads = mappedLeads.filter((l) => qaCategory(l.job?.manualOverrideStatus || l.job?.qaStatus || l.qaStatusCrm) === wanted);
    }

    if (processingStatus && processingStatus !== 'ALL') {
      mappedLeads = mappedLeads.filter((l) => l.processingStatus.toUpperCase() === processingStatus.toUpperCase());
    }

    if (transcriptStatus && transcriptStatus !== 'ALL') {
      mappedLeads = mappedLeads.filter((l) => l.transcriptStatus.toUpperCase() === transcriptStatus.toUpperCase());
    }

    if (search) {
      const s = search.toLowerCase();
      mappedLeads = mappedLeads.filter(
        (l) =>
          l.leadRef.toLowerCase().includes(s) ||
          l.companyName?.toLowerCase().includes(s) ||
          l.contactName?.toLowerCase().includes(s) ||
          l.email?.toLowerCase().includes(s) ||
          l.phone?.toLowerCase().includes(s)
      );
    }

    // Sorting: Newer leads first
    mappedLeads.sort((a, b) => new Date(b.createdAt || b.syncedAt || 0).getTime() - new Date(a.createdAt || a.syncedAt || 0).getTime());

    const totalLeads = mappedLeads.length;
    const totalPages = limit > 0 ? Math.ceil(totalLeads / limit) || 1 : 1;
    const validPage = isNaN(page) ? 1 : Math.max(1, Math.min(page, totalPages));

    const paginatedLeads = limit > 0
      ? mappedLeads.slice((validPage - 1) * limit, validPage * limit)
      : mappedLeads;

    const leadCategory = (lead: CrmLeadItem) =>
      qaCategory(jobsMap.get(lead.leadRef)?.manualOverrideStatus || jobsMap.get(lead.leadRef)?.qaStatus || lead.qaStatusCrm);
    const pendingStatuses = new Set(['PENDING', 'QUEUED', 'AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING']);
    const stats = {
      totalLeads: allLeads.length,
      totalJobs: jobsMap.size,
      completedJobs: Array.from(jobsMap.values()).filter((j) => j.status === 'COMPLETED').length,
      pendingJobs: Array.from(jobsMap.values()).filter((j) => pendingStatuses.has(j.status)).length,
      failedJobs: Array.from(jobsMap.values()).filter((j) => j.status === 'FAILED').length,
      qualifiedLeads: allLeads.filter((lead) => leadCategory(lead) === 'QUALIFIED').length,
      needsReviewLeads: allLeads.filter((lead) => leadCategory(lead) === 'NEEDS_REVIEW').length,
    };

    const directoryJobs = paginatedLeads.map((lead) => {
      const { job, rawLeadData, processingStatus, transcriptStatus, preEditScore, postEditScore, aiQaStatus, ...storedLead } = lead;
      if (job) {
        return { ...job, lead: storedLead };
      }
      return {
        id: `stored_${lead.id}`,
        leadId: lead.id,
        leadRef: lead.leadRef,
        status: 'STORED',
        attempts: 0,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt || lead.syncedAt,
        lead: storedLead,
      };
    });

    return NextResponse.json({
      success: true,
      stats,
      pagination: {
        page: validPage,
        limit: limit > 0 ? limit : totalLeads,
        totalLeads,
        totalJobs: totalLeads,
        totalPages,
      },
      jobs: directoryJobs,
      leads: paginatedLeads,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
