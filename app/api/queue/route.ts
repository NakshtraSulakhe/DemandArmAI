import { NextResponse } from 'next/server';
import { currentUtcDay, dbStore, matchesDateRange, qaCategory, getLeadTrueDate } from '../../../lib/db/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get('tab') || 'active').toLowerCase(); // 'active' | 'failed' | 'completed' | 'skipped'
    const clientCode = searchParams.get('clientCode');
    const campaignCode = searchParams.get('campaignCode');
    const search = searchParams.get('search');
    const agent = searchParams.get('agent');
    const qaStatus = searchParams.get('qaStatus');
    const dateRange = searchParams.get('date');
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('from');
    const dateTo = searchParams.get('dateTo') || searchParams.get('to');
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
    const runningStatuses = new Set([
      'AUDIO_RETRIEVED',
      'TRANSCRIBING',
      'AI_EDITING',
      'AI_VERIFYING',
      'QA_EVALUATING',
    ]);

    const waitingCount = allJobs.filter((j) => j.status === 'PENDING' || (j.status as any) === 'QUEUED').length;
    const processingCount = allJobs.filter((j) => runningStatuses.has(j.status)).length;
    const failedCount = allJobs.filter((j) => j.status === 'FAILED').length;
    const skippedCount = allJobs.filter((j) => j.status === 'SKIPPED').length;
    const completedCount = allJobs.filter((j) => j.status === 'COMPLETED').length;
    const completedTodayCount = allJobs.filter((j) => {
      if (j.status !== 'COMPLETED' || !j.updatedAt) return false;
      const updated = new Date(j.updatedAt);
      return !Number.isNaN(updated.getTime()) && updated.toISOString().slice(0, 10) === todayStr;
    }).length;
    const activeCount = allJobs.filter(
      (j) => j.status !== 'COMPLETED' && j.status !== 'FAILED' && j.status !== 'SKIPPED'
    ).length;

    const queueStats = {
      waitingCount,
      processingCount,
      failedCount,
      skippedCount,
      completedCount,
      completedTodayCount,
      activeCount,
    };

    // Filter jobs based on active tab
    let filteredJobs = allJobs;
    if (tab === 'active') {
      filteredJobs = allJobs.filter(
        (j) => j.status !== 'COMPLETED' && j.status !== 'FAILED' && j.status !== 'SKIPPED'
      );
    } else if (tab === 'failed') {
      filteredJobs = allJobs.filter((j) => j.status === 'FAILED');
    } else if (tab === 'completed') {
      filteredJobs = allJobs.filter((j) => j.status === 'COMPLETED');
    } else if (tab === 'skipped') {
      filteredJobs = allJobs.filter((j) => j.status === 'SKIPPED');
    }

    const stamp = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    // Sort per tab
    if (tab === 'completed') {
      filteredJobs = [...filteredJobs].sort(
        (a, b) => stamp(b.updatedAt) - stamp(a.updatedAt) || stamp(b.createdAt) - stamp(a.createdAt)
      );
    } else if (tab === 'skipped') {
      filteredJobs = [...filteredJobs].sort(
        (a, b) => stamp(b.updatedAt) - stamp(a.updatedAt) || stamp(b.createdAt) - stamp(a.createdAt)
      );
    } else if (tab === 'failed') {
      filteredJobs = [...filteredJobs].sort(
        (a, b) => stamp(b.updatedAt) - stamp(a.updatedAt) || stamp(b.createdAt) - stamp(a.createdAt)
      );
    } else {
      // Active: running jobs first, then newest
      filteredJobs = [...filteredJobs].sort((a, b) => {
        const isRunningA = runningStatuses.has(a.status) ? 1 : 0;
        const isRunningB = runningStatuses.has(b.status) ? 1 : 0;
        if (isRunningB !== isRunningA) return isRunningB - isRunningA;
        const dateA = stamp(a.createdAt || (a.lead ? getLeadTrueDate(a.lead) : ''));
        const dateB = stamp(b.createdAt || (b.lead ? getLeadTrueDate(b.lead) : ''));
        return dateB - dateA;
      });
    }

    // Client Filter
    if (clientCode && clientCode !== 'ALL') {
      filteredJobs = filteredJobs.filter(
        (j) => (j.lead?.clientCode || '').trim().toUpperCase() === clientCode.trim().toUpperCase()
      );
    }

    // Campaign Filter
    if (campaignCode && campaignCode !== 'ALL') {
      filteredJobs = filteredJobs.filter(
        (j) => (j.lead?.campaignCode || '').trim().toUpperCase() === campaignCode.trim().toUpperCase()
      );
    }

    // Agents in current tab
    const agents = [
      ...new Set(filteredJobs.map((j) => (j.lead?.agentName || '').trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    // Agent Filter
    if (agent && agent !== 'ALL') {
      filteredJobs = filteredJobs.filter(
        (j) => (j.lead?.agentName || '').trim().toLowerCase() === agent.trim().toLowerCase()
      );
    }

    // QA Status Filter
    if (qaStatus && qaStatus !== 'ALL') {
      const rawUpper = qaStatus.toUpperCase();
      let wanted: string;
      if (rawUpper === 'PENDING' || qaStatus === 'Pending QA') wanted = 'PENDING';
      else if (rawUpper === 'QUALIFIED') wanted = 'QUALIFIED';
      else if (rawUpper === 'NEEDS_REVIEW' || rawUpper === 'NEEDS REVIEW') wanted = 'NEEDS_REVIEW';
      else if (rawUpper === 'REJECTED') wanted = 'REJECTED';
      else wanted = rawUpper;
      filteredJobs = filteredJobs.filter((j) => {
        const catEffective = qaCategory(j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm);
        const catCrm = qaCategory(j.lead?.qaStatusCrm);
        const catJob = qaCategory(j.manualOverrideStatus || j.qaStatus);
        return catEffective === wanted || catCrm === wanted || catJob === wanted;
      });
    }

    // Date Range Filter
    if ((dateRange && dateRange !== 'ALL') || dateFrom || dateTo) {
      filteredJobs = filteredJobs.filter((j) => {
        const when =
          (j.lead ? getLeadTrueDate(j.lead) : '') ||
          j.lead?.createdAt ||
          j.lead?.syncedAt ||
          j.createdAt ||
          j.updatedAt ||
          '';
        return matchesDateRange(when, dateRange, dateFrom, dateTo);
      });
    }

    // Recording Filter
    if (recording === 'yes' || recording === 'no') {
      filteredJobs = filteredJobs.filter((j) => {
        const hasRecording = !!(
          j.lead?.recordingUrl ||
          (j.lead?.recordings && j.lead.recordings.length > 0) ||
          j.gcsAudioUri
        );
        return recording === 'yes' ? hasRecording : !hasRecording;
      });
    }

    // Pipeline Stage Filter (Active tab only)
    if (tab === 'active' && stage && stage !== 'ALL') {
      filteredJobs = filteredJobs.filter((j) => {
        if (stage === 'WAITING') return j.status === 'PENDING' || (j.status as string) === 'QUEUED';
        if (stage === 'RUNNING') return runningStatuses.has(j.status);
        if (stage === 'SETUP')
          return (
            j.status === 'CONFIGURATION_REQUIRED' || j.status === 'CAMPAIGN_CONFIGURATION_REQUIRED'
          );
        return true;
      });
    }

    // Text Search Filter
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filteredJobs = filteredJobs.filter(
        (j) =>
          (j.id || '').toLowerCase().includes(s) ||
          (j.leadRef || '').toLowerCase().includes(s) ||
          (j.lead?.companyName || '').toLowerCase().includes(s) ||
          (j.lead?.contactName || '').toLowerCase().includes(s) ||
          (j.lead?.email || '').toLowerCase().includes(s) ||
          (j.lead?.phone || '').toLowerCase().includes(s) ||
          (j.lead?.agentName || '').toLowerCase().includes(s) ||
          (j.lead?.campaignName || '').toLowerCase().includes(s) ||
          (j.lead?.campaignCode || '').toLowerCase().includes(s) ||
          (j.lead?.clientCode || '').toLowerCase().includes(s) ||
          (j.lead?.jobTitle || '').toLowerCase().includes(s) ||
          (j.lead?.country || '').toLowerCase().includes(s)
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
      jobs: paginatedJobs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
