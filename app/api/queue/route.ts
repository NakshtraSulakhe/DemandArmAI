import { NextResponse } from 'next/server';
import { currentUtcDay, dbStore, matchesDateRange, qaCategory } from '../../../lib/db/store';
import { jobWorker } from '../../../lib/jobs/jobWorker';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'active'; // 'active' | 'failed' | 'completed' | 'skipped'
    const clientCode = searchParams.get('clientCode');
    const campaignCode = searchParams.get('campaignCode');
    const search = searchParams.get('search');
    const agent = searchParams.get('agent');
    const qaStatus = searchParams.get('qaStatus');
    const dateRange = searchParams.get('date');
    const recording = searchParams.get('recording');
    const stage = searchParams.get('stage');
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam === 'all' ? 0 : parseInt(limitParam || '25', 10);
    const limit = isNaN(rawLimit) ? 25 : rawLimit;

    const allJobs = dbStore.getJobs();

    // Calculate queue metrics across all jobs
    const todayStr = currentUtcDay();

    const waitingCount = allJobs.filter((j) => j.status === 'PENDING' || (j.status as any) === 'QUEUED').length;
    const processingCount = allJobs.filter((j) =>
      ['AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'].includes(j.status)
    ).length;
    const failedCount = allJobs.filter((j) => j.status === 'FAILED').length;
    const skippedCount = allJobs.filter((j) => j.status === 'SKIPPED').length;
    const completedTodayCount = allJobs.filter((j) => {
      if (j.status !== 'COMPLETED' || !j.updatedAt) return false;
      const updated = new Date(j.updatedAt);
      return !Number.isNaN(updated.getTime()) && updated.toISOString().slice(0, 10) === todayStr;
    }).length;
    const activeCount = waitingCount + processingCount;

    const queueStats = {
      waitingCount,
      processingCount,
      failedCount,
      skippedCount,
      completedTodayCount,
      activeCount,
    };

    // Filter jobs based on active tab
    let filteredJobs = allJobs;
    if (tab === 'active') {
      filteredJobs = allJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'FAILED' && j.status !== 'SKIPPED');
    } else if (tab === 'failed') {
      filteredJobs = allJobs.filter((j) => j.status === 'FAILED');
    } else if (tab === 'completed') {
      filteredJobs = allJobs.filter((j) => j.status === 'COMPLETED');
    } else if (tab === 'skipped') {
      filteredJobs = allJobs.filter((j) => j.status === 'SKIPPED');
    }

    const stamp = (value?: string) => {
      const time = new Date(value || 0).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    if (tab === 'completed') {
      filteredJobs = [...filteredJobs].sort(
        (a, b) => stamp(a.updatedAt) - stamp(b.updatedAt) || stamp(a.createdAt) - stamp(b.createdAt)
      );
    } else if (tab === 'skipped') {
      filteredJobs = [...filteredJobs].sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt));
    }

    if (clientCode && clientCode !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => (j.lead?.clientCode || '').toUpperCase() === clientCode.toUpperCase());
    }

    if (campaignCode && campaignCode !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => (j.lead?.campaignCode || '').toUpperCase() === campaignCode.toUpperCase());
    }

    const agents = [...new Set(filteredJobs.map((j) => (j.lead?.agentName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    if (agent && agent !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => (j.lead?.agentName || '').trim().toLowerCase() === agent.trim().toLowerCase());
    }

    if (qaStatus && qaStatus !== 'ALL') {
      const wanted = qaStatus === 'Pending QA' ? 'PENDING' : qaStatus;
      filteredJobs = filteredJobs.filter((j) => qaCategory(j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm) === wanted);
    }

    if (dateRange && dateRange !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => {
        const when = j.lead?.createdAt || j.createdAt;
        return matchesDateRange(when, dateRange);
      });
    }

    if (recording === 'yes' || recording === 'no') {
      filteredJobs = filteredJobs.filter((j) => {
        const hasRecording = !!(j.lead?.recordingUrl || (j.lead?.recordings && j.lead.recordings.length > 0));
        return recording === 'yes' ? hasRecording : !hasRecording;
      });
    }

    if (tab === 'active' && stage && stage !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => {
        if (stage === 'WAITING') return j.status === 'PENDING' || (j.status as string) === 'QUEUED';
        if (stage === 'RUNNING') return ['AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'].includes(j.status);
        if (stage === 'SETUP') return j.status === 'CONFIGURATION_REQUIRED' || j.status === 'CAMPAIGN_CONFIGURATION_REQUIRED';
        return true;
      });
    }

    if (search) {
      const s = search.toLowerCase();
      filteredJobs = filteredJobs.filter(
        (j) =>
          j.leadRef.toLowerCase().includes(s) ||
          j.lead?.companyName?.toLowerCase().includes(s) ||
          j.lead?.contactName?.toLowerCase().includes(s) ||
          j.lead?.email?.toLowerCase().includes(s) ||
          j.lead?.phone?.toLowerCase().includes(s) ||
          j.lead?.agentName?.toLowerCase().includes(s)
      );
    }

    const qualityScores = filteredJobs
      .map((job) => job.qaResultJson?.overallScore)
      .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));
    const averageQuality = qualityScores.length
      ? Number((qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length).toFixed(1))
      : null;

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
      qualitySummary: {
        utcDay: todayStr,
        scoredCount: qualityScores.length,
        averageQuality,
      },
      pagination: {
        page: validPage,
        limit: limit > 0 ? limit : totalFilteredJobs,
        totalJobs: totalFilteredJobs,
        totalPages,
      },
      agents,
      jobs: lightJobs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
