'use client';

import React, { useState } from 'react';
import {
  Clock,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  ListFilter,
  Search,
  Eye,
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
  onProcessQueue,
  isProcessing,
  isProcessingPaused = false,
  onTogglePause,
}: QueueViewProps) {
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  const handleProcessSingle = async (jobId: string) => {
    setProcessingJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(`Error processing lead: ${data.error}`);
      }
      onProcessQueue();
    } catch (e: any) {
      console.error(e);
      alert(`Error processing lead: ${e.message}`);
    } finally {
      setProcessingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            QA Audit & Transcript Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated Speech-to-Text & Gemini AI editing queue for pending call quality audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePause && (
            <button
              onClick={onTogglePause}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processing Queue...' : 'Run Pipeline Worker Now'}
          </button>
        </div>
      </div>

      {/* Paused Warning Banner */}
      {isProcessingPaused && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-sm font-bold">Continuous Speech-to-Text & AI Editing is STOPPED</div>
              <div className="text-xs text-amber-300/80">
                Background transcription and Gemini API calls are strictly locked OFF. The pipeline will NOT resume automatically until you explicitly click &ldquo;Start Pipeline&rdquo;.
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

      {/* Top QA Status Counts & Client Delivery Counts Pill Panel (Matching app.tarajglobal.com/demandflowbridge/modules/qa/audit) */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-lg">
        {/* QA Status Counts Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">QA STATUS COUNTS:</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Pending QA: {queueStats.waitingCount + queueStats.processingCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300">
            TBD: 2
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            In Progress: {queueStats.processingCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Qualified: {queueStats.completedTodayCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Disqualified: {queueStats.failedCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] text-slate-400 bg-slate-950">
            Rework Needed: 0
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] text-slate-400 bg-slate-950">
            Reopened: 0
          </span>
        </div>

        {/* Client Delivery Counts Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-800/60">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">CLIENT DELIVERY COUNTS:</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Pending: {queueStats.activeCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Delivered: {queueStats.completedTodayCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            Accepted: {queueStats.completedTodayCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Rejected: {queueStats.failedCount}
          </span>
        </div>
      </div>

      {/* Main Queue Table Card Container */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        {/* Queue Navigation Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-slate-800/80 gap-4 bg-slate-950/40">
          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
            <button
              onClick={() => onTabChange('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'active'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Active Queue
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/80 text-blue-300 ml-1">
                {queueStats.activeCount}
              </span>
            </button>

            <button
              onClick={() => onTabChange('failed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'failed'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Failed
              {queueStats.failedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-950 text-red-300 ml-1">
                  {queueStats.failedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed History
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
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
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
              className="px-3 py-1.5 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Campaigns</option>
              {campaigns.map((cmp) => (
                <option key={cmp.id} value={cmp.code}>
                  {cmp.code} - {cmp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue Table matching /modules/qa/audit */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SR NO.</th>
                <th className="py-3.5 px-4">CREATED DATE</th>
                <th className="py-3.5 px-4">LEAD INFO</th>
                <th className="py-3.5 px-4">COMPANY</th>
                <th className="py-3.5 px-4">CAMPAIGN/AGENT</th>
                <th className="py-3.5 px-4">QUALITY</th>
                <th className="py-3.5 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Layers className="w-8 h-8 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-400">
                        No jobs in {selectedTab === 'active' ? 'Active Queue' : selectedTab === 'failed' ? 'Failed' : 'Completed History'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedTab === 'active'
                          ? 'All eligible Pending QA leads have finished processing! New leads enter automatically on CRM sync.'
                          : 'No records match your filters.'}
                      </p>
                    </div>
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

                  const isJobProcessing = processingJobId === job.id;

                  return (
                    <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* SR NO. */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400">{srNo}</td>

                      {/* CREATED DATE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200">{formattedDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{formattedTime}</div>
                      </td>

                      {/* LEAD INFO */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-100 text-sm">
                          {lead?.contactName || 'Lead Name'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Primary email • <span className="text-slate-300">{lead?.email || 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Contact number • <span className="text-slate-300">{lead?.phone || lead?.leadRef || 'N/A'}</span>
                        </div>
                      </td>

                      {/* COMPANY */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-100 text-sm">
                          {lead?.companyName || 'Company'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Job title • <span className="text-slate-300">{lead?.jobTitle || 'Executive'}</span>
                        </div>
                      </td>

                      {/* CAMPAIGN / AGENT */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-200">
                          {lead?.campaignName || `Campaign ${lead?.campaignCode}`} - {lead?.clientCode}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Assigned agent • <span className="text-slate-300">{lead?.agentName || 'Faizan Shabbir shaikh'}</span>
                        </div>
                      </td>

                      {/* QUALITY BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {effectiveQa.toLowerCase().includes('qualified') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Qualified
                          </span>
                        )}
                        {effectiveQa.toLowerCase().includes('pending') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm shadow-amber-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pending QA
                          </span>
                        )}
                        {effectiveQa.toLowerCase().includes('review') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Needs Review
                          </span>
                        )}
                        {effectiveQa.toLowerCase().includes('rejected') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Disqualified
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details Eye Icon Button */}
                          <button
                            onClick={() => onSelectJob(job)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="View Full Lead Details & AI Transcript"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {(job.status === 'PENDING' || (job.status as any) === 'QUEUED') && (
                            <button
                              onClick={() => handleProcessSingle(job.id)}
                              disabled={isJobProcessing}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Prioritize & Process Now"
                            >
                              <Play className="w-3 h-3" />
                              Process
                            </button>
                          )}

                          {job.status === 'FAILED' && (
                            <button
                              onClick={() => onRetryJob(job.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Retry Processing"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                        </div>
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
          <div className="flex items-center justify-between p-4 border-t border-slate-800/80 text-xs text-slate-400 bg-slate-950/40">
            <div>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalJobs} Total Jobs)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 transition-colors cursor-pointer"
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
