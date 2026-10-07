'use client';

import React, { useState } from 'react';
import {
  Clock,
  Play,
  AlertTriangle,
  CheckCircle2,
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
import EmptyState from './ui/EmptyState';
import RowActions from './ui/RowActions';

interface QueueViewProps {
  queueStats: {
    waitingCount: number;
    processingCount: number;
    failedCount: number;
    completedTodayCount: number;
    activeCount: number;
  };
  jobs: ProcessingJobItem[];
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  selectedTab: 'active' | 'failed' | 'completed';
  onTabChange: (tab: 'active' | 'failed' | 'completed') => void;
  selectedClientCode: string;
  setSelectedClientCode: (code: string) => void;
  selectedCampaignCode: string;
  setSelectedCampaignCode: (code: string) => void;
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
  onProcessQueue: () => void;
  isProcessing: boolean;
  isProcessingPaused?: boolean;
  onTogglePause?: () => void;
}

export default function QueueView({
  queueStats,
  jobs,
  clients,
  campaigns,
  selectedTab,
  onTabChange,
  selectedClientCode,
  setSelectedClientCode,
  selectedCampaignCode,
  setSelectedCampaignCode,
  searchQuery,
  setSearchQuery,
  pagination,
  onPageChange,
  onSelectJob,
  onRetryJob,
  onJobFinished,
  onActionError,
  onProcessQueue,
  isProcessing,
  isProcessingPaused = false,
  onTogglePause,
}: QueueViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((cmp) => cmp.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;

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
            Leads waiting for quality review and automated Speech-to-Text & Gemini AI editing.
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
              className="px-3 py-1.5 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Campaigns</option>
              {availableCampaigns.map((cmp) => (
                <option key={cmp.id} value={cmp.code}>
                  {cmp.code} - {cmp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-14" />
              <col className="w-28" />
              <col />
              <col />
              <col />
              <col className="w-[7.5rem]" />
              <col className="w-[17.5rem]" />
            </colgroup>
            {selectedIds.length > 0 && (
              <caption className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-300">{selectedIds.length} selected</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => selectedIds.forEach((id) => onRetryJob(id))}
                  >
                    Batch retry
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
                <th className="py-3.5 px-4 w-16 text-center">SR NO.</th>
                <th className="py-3.5 px-4">CREATED DATE</th>
                <th className="py-3.5 px-4">LEAD INFO</th>
                <th className="py-3.5 px-4">COMPANY</th>
                <th className="py-3.5 px-4">CAMPAIGN/AGENT</th>
                <th className="py-3.5 px-4">QUALITY</th>
                <th className="py-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/20 bg-slate-950/20 text-slate-300">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4">
                    <EmptyState
                      icon={<Layers className="w-8 h-8 text-slate-500" />}
                      title={`No leads in ${selectedTab === 'active' ? 'Active Queue' : selectedTab === 'failed' ? 'Failed Jobs' : 'Completed History'}`}
                      description={
                        selectedTab === 'active'
                          ? 'New leads requiring quality review will appear here automatically upon CRM sync.'
                          : 'No records match your selected filters.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((job, index) => {
                  const srNo = (pagination.page - 1) * pagination.limit + index + 1;
                  const lead = job.lead;
                  const rawQaStatus = (lead?.qaStatusCrm || job.qaStatus || 'Pending QA').toString().trim();
                  const effectiveQa = job.manualOverrideStatus || job.qaStatus || rawQaStatus;

                  const createdDateObj = new Date(lead?.createdAt || lead?.syncedAt || job.createdAt);
                  const formattedDate = createdDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const formattedTime = createdDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                  return (
                    <tr key={job.id} className="hover:bg-indigo-500/10 transition-all">
                      {/* SR NO. */}
                      <td className="px-3 py-2 text-center font-bold text-slate-400 font-mono align-middle">
                        <label className="inline-flex items-center gap-2">
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
                          <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-amber-300" title={job.stepError}>{job.stepError}</div>
                        )}
                      </td>

                      {/* QUALITY BADGE */}
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <StatusBadge status={effectiveQa} size="sm" />
                      </td>

                      {/* ACTIONS */}
                      <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
                        <RowActions
                          job={job}
                          reviewLabel="Preview"
                          showCompletedActions={selectedTab === 'completed'}
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
