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
  Volume2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ClientConfig, CampaignConfig, ProcessingJobItem } from '../../lib/types';

interface DashboardViewProps {
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
}

export default function DashboardView({
  stats,
  jobs,
  clients,
  campaigns,
  selectedClientCode,
  setSelectedClientCode,
  selectedCampaignCode,
  setSelectedCampaignCode,
  statusFilter,
  setStatusFilter,
  qaFilter,
  setQaFilter,
  searchQuery,
  setSearchQuery,
  pagination,
  onPageChange,
  onLimitChange,
  onSelectJob,
  onRetryJob,
}: DashboardViewProps) {
  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((c) => c.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total CRM Leads */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">CRM Leads</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{stats.totalLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">Synchronized Live</p>
        </div>

        {/* Transcribed / Completed */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transcribed</span>
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{stats.completedJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">STT + AI Edited</p>
        </div>

        {/* Qualified Leads */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Qualified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{stats.qualifiedLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">Passes all criteria</p>
        </div>

        {/* Needs Review */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">{stats.needsReviewLeads}</div>
          <p className="text-[10px] text-slate-500 mt-1">Requires QA Audit</p>
        </div>

        {/* Processing Jobs */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Jobs</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2">{stats.pendingJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">In processing queue</p>
        </div>

        {/* Failed Jobs */}
        <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed Jobs</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">{stats.failedJobs}</div>
          <p className="text-[10px] text-slate-500 mt-1">Retry supported</p>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search lead ref, company, contact name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Client Filter */}
          <select
            value={selectedClientCode}
            onChange={(e) => {
              setSelectedClientCode(e.target.value);
              setSelectedCampaignCode('ALL');
            }}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            value={selectedCampaignCode}
            onChange={(e) => setSelectedCampaignCode(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Campaigns</option>
            {availableCampaigns.map((cmp) => (
              <option key={cmp.id} value={cmp.code}>
                {cmp.name} ({cmp.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Job Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="TRANSCRIBING">TRANSCRIBING</option>
            <option value="AI_EDITING">AI EDITING</option>
            <option value="QA_EVALUATING">QA EVALUATING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
          </select>

          {/* QA Qualification Filter */}
          <select
            value={qaFilter}
            onChange={(e) => setQaFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All QA Statuses</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="NEEDS_REVIEW">NEEDS REVIEW</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Leads & Jobs Data Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="py-3.5 px-4">Lead Reference</th>
                <th className="py-3.5 px-4">Customer Contact</th>
                <th className="py-3.5 px-4">Company & Title</th>
                <th className="py-3.5 px-4">Client / Campaign</th>
                <th className="py-3.5 px-4">Recording</th>
                <th className="py-3.5 px-4">Raw STT</th>
                <th className="py-3.5 px-4">AI Edited</th>
                <th className="py-3.5 px-4">QA Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {jobs.length > 0 ? (
                jobs.map((job) => {
                  const effectiveQa = job.manualOverrideStatus || job.qaStatus || 'NEEDS_REVIEW';
                  const hasRecording = !!(job.lead?.recordingUrl || job.lead?.recordings?.length);
                  const isNotConfigured = job.lead?.configurationStatus === 'CAMPAIGN_NOT_CONFIGURED';

                  return (
                    <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Lead Reference */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          {job.leadRef}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          ID: {job.lead?.crmLeadId || job.leadId}
                        </div>
                      </td>

                      {/* Customer Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{job.lead?.contactName}</div>
                        <div className="text-[10px] text-slate-400">{job.lead?.email || job.lead?.phone || 'N/A'}</div>
                      </td>

                      {/* Company & Title */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{job.lead?.companyName}</div>
                        <div className="text-[10px] text-slate-400">{job.lead?.jobTitle || 'Executive'}</div>
                      </td>

                      {/* Client / Campaign Codes */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              CL: {job.lead?.clientCode}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              CMP: {job.lead?.campaignCode}
                            </span>
                          </div>
                          {isNotConfigured && (
                            <span className="text-[9px] font-bold text-amber-400">
                              Campaign Not Configured
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Recording Available Badge */}
                      <td className="py-3.5 px-4">
                        {hasRecording ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Volume2 className="w-3 h-3" /> Audio Ready
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No Audio</span>
                        )}
                      </td>

                      {/* Raw STT Status */}
                      <td className="py-3.5 px-4">
                        {job.rawTranscript ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Completed
                          </span>
                        ) : job.status === 'TRANSCRIBING' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                            Transcribing
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Pending</span>
                        )}
                      </td>

                      {/* AI Edited Status */}
                      <td className="py-3.5 px-4">
                        {job.editedTranscript ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            Edited (Gemini)
                          </span>
                        ) : job.status === 'AI_EDITING' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 animate-pulse">
                            Editing
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Pending</span>
                        )}
                      </td>

                      {/* QA Qualification Result */}
                      <td className="py-3.5 px-4">
                        {effectiveQa === 'QUALIFIED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> QUALIFIED
                          </span>
                        )}
                        {effectiveQa === 'NEEDS_REVIEW' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" /> NEEDS REVIEW
                          </span>
                        )}
                        {effectiveQa === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> REJECTED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectJob(job)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => onRetryJob(job.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            title="Retry Pipeline processing"
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
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    No leads found matching current filters. Click &ldquo;Sync CRM Leads&rdquo; above to import live CRM records!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {pagination && pagination.totalJobs > 0 && (
          <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-200">{Math.min(( (isNaN(pagination.page) ? 1 : pagination.page) - 1) * (isNaN(pagination.limit) ? 25 : pagination.limit) + 1, pagination.totalJobs)}</strong> to{' '}
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
                  className="bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(isNaN(pagination.page) ? 1 : pagination.page - 1)}
                  disabled={isNaN(pagination.page) || pagination.page <= 1}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
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
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
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
