import { NextResponse } from 'next/server';
import { dbStore } from '../../../lib/db/store';
import { jobWorker } from '../../../lib/jobs/jobWorker';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'active'; // 'active' | 'failed' | 'completed'
    const clientCode = searchParams.get('clientCode');
    const campaignCode = searchParams.get('campaignCode');
    const search = searchParams.get('search');
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam === 'all' ? 0 : parseInt(limitParam || '25', 10);
    const limit = isNaN(rawLimit) ? 25 : rawLimit;

    const allJobs = dbStore.getJobs();

    // Calculate queue metrics across all jobs
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const waitingCount = allJobs.filter((j) => j.status === 'PENDING' || (j.status as any) === 'QUEUED').length;
    const processingCount = allJobs.filter((j) =>
      ['AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'].includes(j.status)
    ).length;
    const failedCount = allJobs.filter((j) => j.status === 'FAILED').length;
    const completedTodayCount = allJobs.filter((j) => {
      if (j.status !== 'COMPLETED' || !j.updatedAt) return false;
      const updated = new Date(j.updatedAt);
      if (Number.isNaN(updated.getTime())) return false;
      const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, '0')}-${String(updated.getDate()).padStart(2, '0')}`;
      return key === todayStr;
    }).length;
    const activeCount = waitingCount + processingCount;

    const queueStats = {
      waitingCount,
      processingCount,
      failedCount,
      completedTodayCount,
      activeCount,
    };

    // Filter jobs based on active tab
    let filteredJobs = allJobs;
    if (tab === 'active') {
      filteredJobs = allJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'FAILED');
    } else if (tab === 'failed') {
      filteredJobs = allJobs.filter((j) => j.status === 'FAILED');
    } else if (tab === 'completed') {
      filteredJobs = allJobs.filter((j) => j.status === 'COMPLETED');
    }

    if (clientCode && clientCode !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => (j.lead?.clientCode || '').toUpperCase() === clientCode.toUpperCase());
    }

    if (campaignCode && campaignCode !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => (j.lead?.campaignCode || '').toUpperCase() === campaignCode.toUpperCase());
    }

    if (search) {
      const s = search.toLowerCase();
      filteredJobs = filteredJobs.filter(
        (j) =>
          j.leadRef.toLowerCase().includes(s) ||
          j.lead?.companyName?.toLowerCase().includes(s) ||
          j.lead?.contactName?.toLowerCase().includes(s)
      );
    }

    const totalFilteredJobs = filteredJobs.length;
    const totalPages = limit > 0 ? Math.ceil(totalFilteredJobs / limit) || 1 : 1;
    const validPage = isNaN(page) ? 1 : Math.max(1, Math.min(page, totalPages));

    const paginatedJobs = limit > 0
      ? filteredJobs.slice((validPage - 1) * limit, validPage * limit)
      : filteredJobs;

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
      isProcessingPaused: !!dbStore.getSettings().isProcessingPaused,
      queueStats,
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
