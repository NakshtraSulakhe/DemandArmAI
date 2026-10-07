import { NextResponse } from 'next/server';
import { dbStore, qaCategory } from '../../../lib/db/store';
import { jobWorker } from '../../../lib/jobs/jobWorker';
import { crmClient } from '../../../lib/crm/crmClient';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');
    const campaignCode = searchParams.get('campaignCode');
    const status = searchParams.get('status');
    const qaStatus = searchParams.get('qaStatus');
    const search = searchParams.get('search'); // leadRef or companyName
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam === 'all' ? 0 : parseInt(limitParam || '25', 10);
    const limit = isNaN(rawLimit) ? 25 : rawLimit;

    let jobs = dbStore.getJobs();

    if (clientCode && clientCode !== 'ALL') {
      jobs = jobs.filter((j) => (j.lead?.clientCode || '').toUpperCase() === clientCode.toUpperCase());
    }

    if (campaignCode && campaignCode !== 'ALL') {
      jobs = jobs.filter((j) => (j.lead?.campaignCode || '').toUpperCase() === campaignCode.toUpperCase());
    }

    if (status && status !== 'ALL') {
      jobs = jobs.filter((j) => j.status === status);
    }

    if (qaStatus && qaStatus !== 'ALL') {
      const wanted = qaStatus === 'Pending QA' ? 'PENDING' : qaStatus;
      jobs = jobs.filter((j) => qaCategory(j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm) === wanted);
    }

    if (search) {
      const s = search.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.leadRef.toLowerCase().includes(s) ||
          j.lead?.companyName?.toLowerCase().includes(s) ||
          j.lead?.contactName?.toLowerCase().includes(s)
      );
    }

    const allJobs = dbStore.getJobs();
    const stats = {
      totalLeads: dbStore.getLeads().length,
      totalJobs: allJobs.length,
      completedJobs: allJobs.filter((j) => j.status === 'COMPLETED').length,
      pendingJobs: allJobs.filter((j) => j.status === 'PENDING' || j.status === 'AUDIO_RETRIEVED' || j.status === 'TRANSCRIBING' || j.status === 'AI_EDITING' || j.status === 'QA_EVALUATING').length,
      failedJobs: allJobs.filter((j) => j.status === 'FAILED').length,
      qualifiedLeads: allJobs.filter((j) => qaCategory(j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm) === 'QUALIFIED').length,
      needsReviewLeads: allJobs.filter((j) => qaCategory(j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm) === 'NEEDS_REVIEW').length,
    };

    const totalFilteredJobs = jobs.length;
    const totalPages = limit > 0 ? (Math.ceil(totalFilteredJobs / limit) || 1) : 1;
    const validPage = isNaN(page) ? 1 : Math.max(1, Math.min(page, totalPages));

    const paginatedJobs = limit > 0
      ? jobs.slice((validPage - 1) * limit, validPage * limit)
      : jobs;

    // Sanitize jobs list to strip heavy rawLeadData for fast JSON serialization
    const lightJobs = paginatedJobs.map((j) => {
      if (!j.lead) return j;
      const { rawLeadData, ...lightLead } = j.lead;
      return {
        ...j,
        lead: lightLead,
      };
    });

    return NextResponse.json({
      success: true,
      stats,
      pagination: {
        page: validPage,
        limit: limit > 0 ? limit : totalFilteredJobs,
        totalJobs: totalFilteredJobs,
        totalPages,
      },
      jobs: lightJobs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leadRef } = body;

    if (!leadRef) {
      return NextResponse.json({ success: false, error: 'leadRef is required' }, { status: 400 });
    }

    const lead = dbStore.getLeadByRef(leadRef);
    if (!lead) {
      return NextResponse.json({ success: false, error: `Lead reference ${leadRef} not found.` }, { status: 404 });
    }

    let job = dbStore.getJobById(leadRef);
    if (!job) {
      job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        leadId: lead.id,
        leadRef: lead.leadRef,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_CREATED', `Manual job enqueued for ${leadRef}`);
    }

    // Process job immediately
    const processed = await jobWorker.processSingleJob(job.id);
    return NextResponse.json({ success: true, job: processed });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
