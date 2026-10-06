'use client';

import React from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Eye,
  FileCheck2,
  Users,
  ChevronLeft,
  ChevronRight,
  FilterX,
} from 'lucide-react';
import { ClientConfig, CampaignConfig, ProcessingJobItem } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';

interface AllLeadsViewProps {
  stats: {
    totalLeads: number;
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    failedJobs: number;
    qualifiedLeads: number;
    needsReviewLeads: number;
  };
  jobs: ProcessingJobItem[];
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  selectedClientCode: string;
  setSelectedClientCode: (code: string) => void;
  selectedCampaignCode: string;
  setSelectedCampaignCode: (code: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  qaFilter: string;
  setQaFilter: (qa: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  pagination: {
    page: number;
    limit: number;
    totalJobs: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSelectJob: (job: ProcessingJobItem) => void;
  onRetryJob: (jobId: string) => void;
  isProcessingPaused?: boolean;
  onTogglePause?: () => void;
}

export default function AllLeadsView({
  stats,
  jobs,
  clients,
  campaigns,
  selectedClientCode,
  setSelectedClientCode,
  selectedCampaignCode,
  setSelectedCampaignCode,
  qaFilter,
  setQaFilter,
  searchQuery,
  setSearchQuery,
  pagination,
  onPageChange,
  onLimitChange,
  onSelectJob,
  onRetryJob,
  isProcessingPaused = false,
  onTogglePause,
}: AllLeadsViewProps) {
  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((c) => c.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;

  return (
    <div className="space-y-6">
      {/* Header Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/40 backdrop-blur-md shadow-lg">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" />
            CRM Sales Leads Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse, filter, listen to recordings, view raw STT, and inspect Gemini AI transcripts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold shadow-sm">
            Total Leads: {stats.totalLeads}
          </span>
        </div>
      </div>

      {/* Paused Warning Banner */}
      {isProcessingPaused && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div className="text-xs">
              <strong className="text-amber-400">Continuous AI Processing is STOPPED & LOCKED:</strong> All background Speech-to-Text and Gemini API credit usage is disabled until you manually click Start Pipeline.
            </div>
          </div>
          {onTogglePause && (
            <button
              onClick={onTogglePause}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-md"
            >
              Start Pipeline
            </button>
          )}
        </div>
      )}

      {/* Quick KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total CRM Leads</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{stats.totalLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">Synchronized Live</p>
        </div>

        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transcribed</span>
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{stats.completedJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">STT & Gemini Edited</p>
        </div>

        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">{stats.pendingJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">Awaiting Processing</p>
        </div>

        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Qualified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{stats.qualifiedLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">QA Criteria Satisfied</p>
        </div>

        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">{stats.needsReviewLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">Requires Manual Audit</p>
        </div>

        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">{stats.failedJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">Pipeline Retry Needed</p>
        </div>
      </div>

      {/* Main CRM Table Card Container */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800/40">
        {/* Filters Toolbar */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads (ID, email, company, contact)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800/60 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/80 transition-all"
              />
            </div>

            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="bg-slate-950/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/80 transition-all"
            >
              <option value="ALL">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.code} - {client.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCampaignCode}
              onChange={(e) => setSelectedCampaignCode(e.target.value)}
              className="bg-slate-950/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/80 transition-all"
            >
              <option value="ALL">All Campaigns</option>
              {availableCampaigns.map((cmp) => (
                <option key={cmp.id} value={cmp.code}>
                  {cmp.code} - {cmp.name}
                </option>
              ))}
            </select>

            <select
              value={qaFilter}
              onChange={(e) => setQaFilter(e.target.value)}
              className="bg-slate-950/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/80 transition-all"
            >
              <option value="ALL">All QA Statuses</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="Pending QA">Pending QA</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Total Matches: <strong className="text-slate-100 font-bold">{pagination?.totalJobs || jobs.length}</strong>
          </div>
        </div>

        {/* All Leads CRM Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/40">
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
            <tbody className="divide-y divide-slate-800/20 bg-slate-950/20 text-slate-300">
              {jobs.length > 0 ? (
                jobs.map((job, index) => {
                  const srNo = (pagination.page - 1) * pagination.limit + index + 1;
                  const lead = job.lead;
                  const rawQaStatus = (lead?.qaStatusCrm || job.qaStatus || 'Pending QA').toString().trim();
                  const effectiveQa = job.manualOverrideStatus || job.qaStatus || rawQaStatus;

                  const createdDateObj = new Date(lead?.createdAt || lead?.syncedAt || job.createdAt);
                  const formattedDate = createdDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const formattedTime = createdDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                  return (
                    <tr key={job.id} className="hover:bg-blue-500/5 transition-all">
                      {/* SR NO. */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400 font-mono">{srNo}</td>

                      {/* CREATED DATE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200">{formattedDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formattedTime}</div>
                      </td>

                      {/* LEAD INFO */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-100 text-sm">
                          {lead?.contactName || 'Lead Name'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
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
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Country • <span className="text-slate-300">{lead?.country || 'United States'}</span>
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
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Assigned agent • <span className="text-slate-300">{lead?.agentName || 'Faizan Shabbir shaikh'}</span>
                        </div>
                      </td>

                      {/* QUALITY BADGE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge status={effectiveQa} />
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onSelectJob(job)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600/15 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="View Full Lead Details & AI Transcript"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => onRetryJob(job.id)}
                            className="p-1.5 rounded-xl bg-slate-800/60 text-slate-400 hover:text-amber-400 hover:bg-slate-700/80 border border-slate-700/60 transition-all cursor-pointer"
                            title="Retry Pipeline Processing"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-4">
                    <EmptyState
                      icon={<FilterX className="w-8 h-8 text-slate-500" />}
                      title="No leads matching criteria"
                      description="No lead records match your search filters. Try clearing search filters or sync CRM leads."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {pagination && pagination.totalJobs > 0 && (
          <div className="px-4 py-3.5 bg-slate-900/60 border-t border-slate-800/40 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-200">{Math.min(((isNaN(pagination.page) ? 1 : pagination.page) - 1) * (isNaN(pagination.limit) ? 25 : pagination.limit) + 1, pagination.totalJobs)}</strong> to{' '}
                <strong className="text-slate-200">{Math.min((isNaN(pagination.page) ? 1 : pagination.page) * (isNaN(pagination.limit) ? 25 : pagination.limit), pagination.totalJobs)}</strong> of{' '}
                <strong className="text-slate-200">{pagination.totalJobs}</strong> leads
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Per page:</span>
                <select
                  value={isNaN(pagination.limit) || !pagination.limit ? 25 : pagination.limit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onLimitChange(isNaN(val) ? 25 : val);
                  }}
                  className="bg-slate-950/60 border border-slate-800/60 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onPageChange(isNaN(pagination.page) ? 1 : pagination.page - 1)}
                  disabled={isNaN(pagination.page) || pagination.page <= 1}
                  className="p-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-2 font-mono text-xs text-slate-300">
                  Page {isNaN(pagination.page) ? 1 : pagination.page} / {isNaN(pagination.totalPages) ? 1 : pagination.totalPages}
                </span>

                <button
                  onClick={() => onPageChange(isNaN(pagination.page) ? 1 : pagination.page + 1)}
                  disabled={isNaN(pagination.page) || isNaN(pagination.totalPages) || pagination.page >= pagination.totalPages}
                  className="p-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
