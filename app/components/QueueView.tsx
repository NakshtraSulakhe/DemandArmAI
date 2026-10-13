'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Play,
  AlertTriangle,
  CheckCircle2,
  FilterX,
  SkipForward,
  ListFilter,
  Search,
  Activity,
  Layers,
  Sparkles,
  Volume2,
  FileText,
  ShieldCheck,
  Shield,
  Zap,
} from 'lucide-react';
import { ClientConfig, CampaignConfig, ProcessingJobItem } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import { usePopup } from './ui/Popup';
import EmptyState from './ui/EmptyState';
import RowActions from './ui/RowActions';

export type QueueTab = 'active' | 'failed' | 'completed' | 'skipped';

function crmCreatedDate(value?: string): Date {
  if (!value) return new Date(NaN);
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.replace(' ', 'T')}Z`);
  }
  return new Date(trimmed);
}

const PROCESS_STEPS = [
  { key: 'recording', label: '1', name: 'Recording', short: 'Audio' },
  { key: 'transcript', label: '2', name: 'Transcript', short: 'Text' },
  { key: 'edit', label: '3', name: 'Edit', short: 'Edit' },
  { key: 'score', label: '4', name: 'Score', short: 'Score' },
] as const;

function ProcessSequence({ job }: { job: ProcessingJobItem }) {
  const done: Record<(typeof PROCESS_STEPS)[number]['key'], boolean> = {
    recording: !!(job.gcsAudioUri || job.lead?.recordingUrl || job.rawTranscript),
    transcript: !!job.rawTranscript,
    edit: !!job.editedTranscript,
    score: !!(job.qaResultJson || job.qaStatus),
  };

  return (
    <div className="process-sequence" aria-label="Process sequence">
      {PROCESS_STEPS.map((step, index) => (
        <React.Fragment key={step.key}>
          {index > 0 && <span className="process-arrow" aria-hidden="true">→</span>}
          <span
            className={`process-step ${done[step.key] ? 'done' : 'missed'}`}
            title={`${step.label} ${step.name}: ${done[step.key] ? 'done' : 'did not run'}`}
            aria-label={`${step.name} ${done[step.key] ? 'done' : 'did not run'}`}
          >
            {step.label} {step.short}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

interface QueueViewProps {
  queueStats: {
    waitingCount: number;
    processingCount: number;
    failedCount: number;
    skippedCount: number;
    completedTodayCount: number;
    activeCount: number;
  };
  qualitySummary: {
    utcDay: string;
    scoredCount: number;
    averageQuality: number | null;
  };
  jobs: ProcessingJobItem[];
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  selectedTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  selectedClientCode: string;
  setSelectedClientCode: (code: string) => void;
  selectedCampaignCode: string;
  setSelectedCampaignCode: (code: string) => void;
  qaFilter: string;
  setQaFilter: (qa: string) => void;
  agentFilter: string;
  setAgentFilter: (agent: string) => void;
  dateFilter: string;
  setDateFilter: (date: string) => void;
  recordingFilter: string;
  setRecordingFilter: (recording: string) => void;
  stageFilter: string;
  setStageFilter: (stage: string) => void;
  agentOptions: string[];
  onClearFilters: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  pagination: {
    page: number;
    limit: number;
    totalJobs: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onSelectJob: (job: ProcessingJobItem) => void;
  onRetryJob: (jobId: string) => void;
  onJobFinished: (job: ProcessingJobItem) => void;
  onActionError: (message: string) => void;
  onMoved: (job: ProcessingJobItem) => void;
  onDeleted?: () => void;
  onProcessQueue: () => void;
  isProcessing: boolean;
  isProcessingPaused?: boolean;
  onTogglePause?: () => void;
}

export default function QueueView({
  queueStats,
  qualitySummary,
  jobs,
  clients,
  campaigns,
  selectedTab,
  onTabChange,
  selectedClientCode,
  setSelectedClientCode,
  selectedCampaignCode,
  setSelectedCampaignCode,
  qaFilter,
  setQaFilter,
  agentFilter,
  setAgentFilter,
  dateFilter,
  setDateFilter,
  recordingFilter,
  setRecordingFilter,
  stageFilter,
  setStageFilter,
  agentOptions,
  onClearFilters,
  searchQuery,
  setSearchQuery,
  pagination,
  onPageChange,
  onSelectJob,
  onRetryJob,
  onJobFinished,
  onActionError,
  onMoved,
  onDeleted,
  onProcessQueue,
  isProcessing,
  isProcessingPaused = false,
  onTogglePause,
}: QueueViewProps) {
  const popup = usePopup();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageIds = jobs.map((job) => job.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    const visible = new Set(pageIds);
    setSelectedIds((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
  }, [pageIds.join('|')]);

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      allPageSelected ? current.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...current, ...pageIds]))
    );
  };
  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((cmp) => cmp.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;
  const filtersActive = [selectedClientCode, selectedCampaignCode, qaFilter, agentFilter, dateFilter, recordingFilter, stageFilter, searchQuery].some((value) => value && value !== 'ALL');
  const filterClass = 'px-3 py-1.5 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-6">
      {/* Top Header & Action Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/40 backdrop-blur-md shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-blue-400" />
            QA Audit & Transcript Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            The running pipeline starts only leads whose CRM status is Pending QA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePause && (
            <button
              onClick={onTogglePause}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isProcessingPaused
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              }`}
            >
              {isProcessingPaused ? 'Start Pipeline' : 'Stop Pipeline'}
            </button>
          )}

          <button
            onClick={onProcessQueue}
            disabled={isProcessing || isProcessingPaused}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing Queue...' : 'Run Pipeline Worker Now'}
          </button>
        </div>
      </div>

      {/* Paused Warning Banner */}
      {isProcessingPaused && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-amber-300">Continuous Speech-to-Text & AI Editing is STOPPED</div>
              <div className="text-[11px] text-amber-300/80">
                Background transcription and Gemini API calls are strictly locked OFF until you click &ldquo;Start Pipeline&rdquo;.
              </div>
            </div>
          </div>
          {onTogglePause && (
            <button
              onClick={onTogglePause}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs shrink-0 transition-colors shadow cursor-pointer"
            >
              Start Pipeline Now
            </button>
          )}
        </div>
      )}

      {/* Main Queue Table Card Container */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/40 overflow-hidden shadow-xl">
        {/* Queue Navigation Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-800/40 gap-4 bg-slate-950/40">
          <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/60">
            <button
              type="button"
              onClick={() => onTabChange('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                selectedTab === 'active'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Active Queue</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-blue-300 ml-1 pointer-events-none">
                {queueStats.activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('failed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                selectedTab === 'failed'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Failed</span>
              {queueStats.failedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-950 text-rose-300 ml-1 pointer-events-none">
                  {queueStats.failedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('skipped')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                selectedTab === 'skipped'
                  ? 'bg-slate-600 text-white shadow-md shadow-slate-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Skipped</span>
              {queueStats.skippedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-slate-200 ml-1 pointer-events-none">
                  {queueStats.skippedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                selectedTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Completed History</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search lead ref, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-100" aria-label="Clear search">
                  ×
                </button>
              )}
            </div>

            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCampaignCode}
              onChange={(e) => setSelectedCampaignCode(e.target.value)}
              className={filterClass}
              aria-label="Campaign"
            >
              <option value="ALL">All Campaigns</option>
              {availableCampaigns.map((cmp) => (
                <option key={cmp.id} value={cmp.code}>
                  {cmp.code} - {cmp.name}
                </option>
              ))}
            </select>

            <select value={qaFilter} onChange={(e) => setQaFilter(e.target.value)} className={filterClass} aria-label="Quality">
              <option value="ALL">All QA statuses</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="Pending QA">Pending QA</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={filterClass} aria-label="Agent">
              <option value="ALL">All agents</option>
              {agentOptions.map((agent) => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>

            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={filterClass} aria-label="Date">
              <option value="ALL">All dates</option>
              <option value="today">Today (UTC)</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>

            <select value={recordingFilter} onChange={(e) => setRecordingFilter(e.target.value)} className={filterClass} aria-label="Recording">
              <option value="ALL">All recordings</option>
              <option value="yes">Has recording</option>
              <option value="no">No recording</option>
            </select>

            {selectedTab === 'active' && (
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={filterClass} aria-label="Pipeline stage">
                <option value="ALL">All stages</option>
                <option value="WAITING">Waiting</option>
                <option value="RUNNING">Running</option>
                <option value="SETUP">Needs setup</option>
              </select>
            )}

            {filtersActive && (
              <button type="button" onClick={onClearFilters} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 hover:text-slate-100 hover:border-slate-500">
                <FilterX className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>
        <p className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-800/40 bg-slate-950/20">
          {dateFilter === 'today'
            ? `Current UTC day ${qualitySummary.utcDay || ''}. This list and the lead counts use UTC, so the US workday stays on one date from India.`
            : 'Date filter is using UTC. Choose Today (UTC) to see the current US workday.'}
          {qualitySummary.scoredCount > 0 && qualitySummary.averageQuality !== null
            ? ` Average call quality in this view: ${qualitySummary.averageQuality}%.`
            : ' No scored call in this view yet.'}
          {selectedTab === 'completed' ? ' Finished leads stay in completion order.' : ''}
        </p>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="lead-table w-full min-w-[54rem] table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-16" />
              <col className="w-[6.5rem]" />
              <col />
              <col />
              <col />
              <col className="w-[9.5rem]" />
              <col className="w-[12rem]" />
            </colgroup>
            {selectedIds.length > 0 && (
              <caption className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-300">{selectedIds.length} selected</span>
                  {(selectedTab === 'active' || selectedTab === 'failed') && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const ids = [...selectedIds];
                        setSelectedIds([]);
                        void (async () => {
                          await Promise.all(ids.map((id) => fetch(`/api/jobs/${id}/skip`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ restore: false }),
                          })));
                          onMoved({ id: ids[0], status: 'SKIPPED' } as ProcessingJobItem);
                        })();
                      }}
                    >
                      Skip selected
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => selectedIds.forEach((id) => onRetryJob(id))}
                  >
                    Batch retry
                  </button>
                  <button
                    type="button"
                    className="action-btn action-delete action-compact"
                    onClick={() => {
                      const ids = [...selectedIds];
                      const count = ids.length;
                      void (async () => {
                        const accepted = await popup.confirm({
                          title: 'Delete selected leads',
                          message: `Delete ${count} selected lead${count === 1 ? '' : 's'}? They leave the queue and All Leads, and the pipeline will not pick them up again.`,
                          confirmLabel: 'Delete',
                          tone: 'danger',
                        });
                        if (!accepted) return;
                        try {
                          const res = await fetch('/api/leads/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids }),
                          });
                          const data = await res.json();
                          if (!data.success) {
                            await popup.message({
                              title: 'Could not delete',
                              message: data.error || 'These leads could not be deleted.',
                              tone: 'warning',
                            });
                            return;
                          }
                          setSelectedIds([]);
                          onDeleted?.();
                          const leftBehind = Array.isArray(data.blocked) && data.blocked.length > 0
                            ? ` ${data.blocked.length} still processing and left in the queue.`
                            : '';
                          await popup.message({
                            title: 'Leads deleted',
                            message: `${data.deleted.length} lead${data.deleted.length === 1 ? '' : 's'} deleted.${leftBehind}`,
                            tone: 'success',
                          });
                        } catch (err: unknown) {
                          await popup.message({
                            title: 'Could not delete',
                            message: err instanceof Error ? err.message : 'These leads could not be deleted.',
                            tone: 'warning',
                          });
                        }
                      })();
                    }}
                  >
                    Delete selected
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const chosen = jobs.filter((job) => selectedIds.includes(job.id));
                      const lines = ['lead,company,status', ...chosen.map((job) => `"${job.lead?.contactName || ''}","${job.lead?.companyName || ''}","${job.qaStatus || job.status}"`)];
                      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'queue-export.csv';
                      link.click();
                    }}
                  >
                    Export CSV
                  </button>
                </div>
              </caption>
            )}
            <thead className="sticky top-0 z-10 bg-slate-950/95 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/40">
              <tr>
                <th className="py-3 px-2 text-center">
                  <label className="inline-flex items-center justify-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      onChange={toggleSelectAll}
                      disabled={jobs.length === 0}
                      aria-label="Select all leads on this page"
                      title="Select all"
                    />
                    <span>SR</span>
                  </label>
                </th>
                <th className="py-3 px-3" title="Date this lead was created in the CRM">CRM CREATED</th>
                <th className="py-3 px-3">LEAD</th>
                <th className="py-3 px-3">COMPANY</th>
                <th className="py-3 px-3" title="Campaign and agent">CAMPAIGN</th>
                <th className="py-3 px-3">CRM / AI QA</th>
                <th className="py-3 px-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/20 bg-slate-950/20 text-slate-300">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4">
                    <EmptyState
                      icon={<Layers className="w-8 h-8 text-slate-500" />}
                      title={`No leads in ${selectedTab === 'active' ? 'Active Queue' : selectedTab === 'failed' ? 'Failed Jobs' : selectedTab === 'skipped' ? 'Skipped' : 'Completed History'}`}
                      description={
                        selectedTab === 'active'
                          ? 'New leads requiring quality review will appear here automatically upon CRM sync.'
                          : selectedTab === 'skipped'
                            ? 'Use Skip on a waiting lead to move it here without processing it.'
                            : 'No records match your selected filters.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((job, index) => {
                  const srNo = (pagination.page - 1) * pagination.limit + index + 1;
                  const lead = job.lead;
                  const crmQa = (lead?.qaStatusCrm || 'Pending QA').toString().trim();
                  const aiQa = (job.manualOverrideStatus || job.qaStatus || 'Not scored').toString().trim();
                  const qualityScore = typeof job.qaResultJson?.overallScore === 'number' ? job.qaResultJson.overallScore : null;

                  const createdDateObj = crmCreatedDate(lead?.createdAt);
                  const formattedDate = Number.isNaN(createdDateObj.getTime())
                    ? '—'
                    : createdDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
                  const formattedTime = Number.isNaN(createdDateObj.getTime())
                    ? ''
                    : `${createdDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })} UTC`;

                  return (
                    <tr key={job.id} className="hover:bg-indigo-500/10 transition-all">
                      {/* SR NO. */}
                      <td className="px-2 py-2 text-center font-bold text-slate-400 font-mono align-middle">
                        <label className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(job.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id]
                              )
                            }
                            aria-label={`Select ${lead?.companyName || srNo}`}
                          />
                          {srNo}
                        </label>
                      </td>

                      {/* CREATED DATE */}
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <div className="font-semibold text-slate-200">{formattedDate}</div>
                        <div className="font-mono text-[10px] text-slate-400">{formattedTime}</div>
                      </td>

                      {/* LEAD INFO */}
                      <td className="px-3 py-2 align-middle">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {lead?.contactName || 'Lead Name'}
                        </div>
                        <div className="truncate text-[11px] text-slate-400" title={lead?.email || ''}>
                          {lead?.email || 'No email'}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {lead?.phone || lead?.leadRef || 'No phone'}
                        </div>
                        {selectedTab === 'completed' && <ProcessSequence job={job} />}
                      </td>

                      {/* COMPANY */}
                      <td className="px-3 py-2 align-middle">
                        <div className="truncate text-sm font-semibold text-slate-100" title={lead?.companyName || ''}>
                          {lead?.companyName || 'Company'}
                        </div>
                        <div className="truncate text-[11px] text-slate-400" title={lead?.jobTitle || ''}>
                          {lead?.jobTitle || 'Job title unavailable'}
                        </div>
                      </td>

                      {/* CAMPAIGN / AGENT */}
                      <td className="px-3 py-2 align-middle">
                        <div className="truncate font-semibold text-slate-200" title={`${lead?.campaignName || lead?.campaignCode || ''} · ${lead?.clientCode || ''}`}>
                          {lead?.campaignName || `Campaign ${lead?.campaignCode}`}
                          {lead?.clientCode ? ` · ${lead.clientCode}` : ''}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {lead?.agentName || 'Unassigned'}
                        </div>
                        {job.stepError && (
                          <div className="mt-0.5 truncate text-[11px] text-amber-300" title={job.stepError}>{job.stepError}</div>
                        )}
                      </td>

                      {/* CRM STATUS, AI STATUS, AND CALL QUALITY */}
                      <td className="px-3 py-2 align-middle">
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="w-7 shrink-0 text-[10px] font-bold uppercase text-slate-500">CRM</span>
                            <StatusBadge status={crmQa} size="sm" />
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="w-7 shrink-0 text-[10px] font-bold uppercase text-slate-500">AI</span>
                            <StatusBadge status={aiQa} customLabel={aiQa === 'Not scored' ? 'Not scored' : undefined} size="sm" />
                          </div>
                          <div className="font-mono text-[11px] font-bold text-slate-200">
                            {qualityScore === null ? 'Quality —' : `Quality ${qualityScore}%`}
                          </div>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-2 py-2 text-right align-middle">
                        <RowActions
                          job={job}
                          reviewLabel="Preview"
                          showCompletedActions={selectedTab === 'completed'}
                          allowSkip={selectedTab === 'active' || selectedTab === 'failed'}
                          allowRestore={selectedTab === 'skipped'}
                          onMoved={onMoved}
                          onDeleted={onDeleted}
                          onSelect={onSelectJob}
                          onRetry={onRetryJob}
                          onFinished={onJobFinished}
                          onError={onActionError}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalJobs > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800/40 text-xs text-slate-400 bg-slate-950/40">
            <div>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalJobs} Total Jobs)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-800/60 text-slate-200 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange(pagination.page + 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-800/60 text-slate-200 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
