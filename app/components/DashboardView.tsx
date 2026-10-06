'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  FileCheck2,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Shield,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Activity,
  SlidersHorizontal,
  FileSpreadsheet,
} from 'lucide-react';
import { ClientConfig, CampaignConfig, AnalyticsSummary, ProcessingJobItem } from '../../lib/types';

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
  jobs?: ProcessingJobItem[];
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  selectedClientCode: string;
  setSelectedClientCode: (code: string) => void;
  selectedCampaignCode: string;
  setSelectedCampaignCode: (code: string) => void;
  statusFilter?: string;
  setStatusFilter?: (status: string) => void;
  qaFilter?: string;
  setQaFilter?: (qa: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  pagination?: any;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSelectJob?: (job: ProcessingJobItem) => void;
  onRetryJob?: (jobId: string) => void;
  isProcessingPaused?: boolean;
  onTogglePause?: () => void;
  onNavigateToAllLeads?: () => void;
  onSyncCrm?: () => void;
}

export default function DashboardView({
  stats,
  clients,
  campaigns,
  selectedClientCode,
  setSelectedClientCode,
  selectedCampaignCode,
  setSelectedCampaignCode,
  isProcessingPaused = false,
  onTogglePause,
  onNavigateToAllLeads,
  onSyncCrm,
}: DashboardViewProps) {
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/analytics', window.location.href);
      if (daysFilter > 0) url.searchParams.set('days', daysFilter.toString());
      if (selectedClientCode !== 'ALL') url.searchParams.set('clientCode', selectedClientCode);
      if (selectedCampaignCode !== 'ALL') url.searchParams.set('campaignCode', selectedCampaignCode);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Error fetching analytics for dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [daysFilter, selectedClientCode, selectedCampaignCode]);

  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((c) => c.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Analytics Controls Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
                Analytical Lead & Cost Dashboard
              </h2>
              <p className="text-xs text-slate-400">
                Daily lead velocity, weekly trends, Speech-to-Text & Gemini AI cost intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Global Analytical Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Days Timeframe Pill Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setDaysFilter(1)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                daysFilter === 1 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDaysFilter(7)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                daysFilter === 7 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDaysFilter(30)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                daysFilter === 30 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDaysFilter(0)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                daysFilter === 0 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Client Filter */}
          <select
            value={selectedClientCode}
            onChange={(e) => {
              setSelectedClientCode(e.target.value);
              setSelectedCampaignCode('ALL');
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            value={selectedCampaignCode}
            onChange={(e) => setSelectedCampaignCode(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Campaigns</option>
            {availableCampaigns.map((cmp) => (
              <option key={cmp.id} value={cmp.code}>
                {cmp.code} - {cmp.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh Analytics Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Paused Warning Banner */}
      {isProcessingPaused && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div className="text-xs">
              <strong className="text-amber-300">Continuous AI Pipeline is PAUSED:</strong> Background Speech-to-Text and Gemini AI analysis will not auto-run until resumed.
            </div>
          </div>
          {onTogglePause && (
            <button
              onClick={onTogglePause}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs shrink-0 transition-colors cursor-pointer shadow"
            >
              Start Pipeline
            </button>
          )}
        </div>
      )}

      {/* Row 1: Executive KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Card 1: Daily Leads */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Daily Leads</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              {analytics?.todayLeadsCount ?? 0}
            </span>
            {analytics && (
              <span className={`text-[11px] font-bold flex items-center ${
                analytics.todayGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {analytics.todayGrowthPercent >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {Math.abs(analytics.todayGrowthPercent)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">Vs Yesterday ({analytics?.yesterdayLeadsCount ?? 0})</p>
        </div>

        {/* Card 2: Weekly Leads */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Weekly Leads</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              {analytics?.thisWeekLeadsCount ?? stats.totalLeads}
            </span>
            {analytics && (
              <span className={`text-[11px] font-bold flex items-center ${
                analytics.weeklyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {analytics.weeklyGrowthPercent >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {Math.abs(analytics.weeklyGrowthPercent)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">7-Day Aggregated Volume</p>
        </div>

        {/* Card 3: Total Operational Spend */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total AI Spend</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">
            ${analytics?.totalEstimatedCost ? analytics.totalEstimatedCost.toFixed(3) : '0.000'}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Avg ${(analytics?.avgCostPerLead || 0).toFixed(3)} / lead
          </p>
        </div>

        {/* Card 4: Qualification Conversion Rate */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Qualification Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {analytics?.qualityDistribution?.qualifiedPercent ?? 0}%
          </div>
          <p className="text-[10px] text-slate-500">
            {analytics?.qualityDistribution?.qualified ?? stats.qualifiedLeads} Qualified Leads
          </p>
        </div>

        {/* Card 5: Audio Minutes Processed */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Audio Minutes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {analytics?.totalSttUsageMinutes ?? 0} <span className="text-xs font-normal text-slate-400">min</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Avg {analytics?.durationDistribution?.avgDurationSeconds ?? 45}s call length
          </p>
        </div>

        {/* Card 6: AI Velocity & Success */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pipeline Success</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400">
            {analytics?.successPercentage ?? 100}%
          </div>
          <p className="text-[10px] text-slate-500">
            Speed ~{analytics?.avgProcessingDurationSeconds ?? 3.5}s / call
          </p>
        </div>
      </div>

      {/* Section 1: Daily & Weekly Lead Velocity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Lead Velocity Graph */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Daily Lead Inflow & QA Velocity
              </h3>
              <p className="text-[11px] text-slate-400">Daily breakdown of Qualified vs Needs Review vs Disqualified leads</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {analytics?.dailyLeadVelocity?.length || 0} Days Tracked
            </span>
          </div>

          {/* Custom SVG / HTML Bar Chart */}
          <div className="h-64 flex items-end justify-between gap-2 pt-8 px-2 border-b border-slate-800/80 overflow-x-auto">
            {analytics?.dailyLeadVelocity && analytics.dailyLeadVelocity.length > 0 ? (
              analytics.dailyLeadVelocity.map((item, idx) => {
                const maxVal = Math.max(...analytics.dailyLeadVelocity.map((i) => i.totalLeads || 1), 5);
                const heightPercent = Math.round((item.totalLeads / maxVal) * 100);
                const qualifiedPercent = item.totalLeads > 0 ? (item.qualified / item.totalLeads) * 100 : 0;
                const reviewPercent = item.totalLeads > 0 ? (item.needsReview / item.totalLeads) * 100 : 0;

                return (
                  <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center gap-2 group relative">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-14 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 p-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                      <div className="font-bold text-slate-100">{item.date} ({item.dayName})</div>
                      <div className="text-blue-400 font-semibold">Total: {item.totalLeads} leads</div>
                      <div className="text-emerald-400">Qualified: {item.qualified}</div>
                      <div className="text-amber-400">Needs Review: {item.needsReview}</div>
                      <div className="text-purple-400">Est. Cost: ${item.cost.toFixed(3)}</div>
                    </div>

                    <div className="w-full max-w-[36px] bg-slate-950/80 rounded-t-lg flex flex-col justify-end overflow-hidden h-48 border border-slate-800/60">
                      <div style={{ height: `${heightPercent}%` }} className="w-full flex flex-col justify-end rounded-t transition-all duration-300">
                        {/* Stacked Bars */}
                        <div style={{ height: `${100 - qualifiedPercent - reviewPercent}%` }} className="w-full bg-slate-700/60" />
                        <div style={{ height: `${reviewPercent}%` }} className="w-full bg-amber-500" />
                        <div style={{ height: `${qualifiedPercent}%` }} className="w-full bg-gradient-to-t from-emerald-600 to-teal-400" />
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono font-medium">
                      {item.date.slice(5)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full py-16 text-center text-xs text-slate-500">
                No daily lead activity recorded for selected period.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-2">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 inline-block" /> Qualified Leads
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Needs Review
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" /> Pending / Disqualified
            </span>
          </div>
        </div>

        {/* Weekly Leads Volume & Growth Matrix */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Weekly Trends & Velocity
              </h3>
              <span className="text-[10px] font-mono text-slate-500">7-Day Aggregates</span>
            </div>

            <div className="space-y-3.5 pt-3">
              {analytics?.weeklyLeadVelocity && analytics.weeklyLeadVelocity.length > 0 ? (
                analytics.weeklyLeadVelocity.map((wItem, idx) => {
                  const maxWeek = Math.max(...analytics.weeklyLeadVelocity.map((w) => w.totalLeads || 1), 1);
                  const widthPercent = Math.round((wItem.totalLeads / maxWeek) * 100);

                  return (
                    <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{wItem.weekLabel}</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {wItem.totalLeads} Leads ({wItem.qualified} Qual)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                        <div
                          style={{ width: `${widthPercent}%` }}
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Spend: ${wItem.cost.toFixed(3)}</span>
                        <span>{wItem.needsReview} Needs Review</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No weekly trend data available yet.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs space-y-1">
            <div className="font-bold text-blue-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Weekly Growth Insight
            </div>
            <p className="text-[11px] text-slate-400">
              Current weekly velocity is running at <strong className="text-slate-200">{analytics?.thisWeekLeadsCount ?? 0} leads</strong>. 
              Average cost per qualified lead is <strong className="text-emerald-400">${(analytics?.avgCostPerQualifiedLead || 0).toFixed(3)}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Financial & API Billing Unit Economics */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Financial Cost Analytics & Provider Unit Economics
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live consumption breakdown of Google Speech-to-Text audio billing and Gemini 3.8 Flash LLM token usage.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-mono bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            Total Operational Cost: <strong className="text-emerald-400">${(analytics?.totalEstimatedCost || 0).toFixed(4)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Google STT Cost */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200 text-xs">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Google Speech-to-Text
              </span>
              <span className="text-emerald-400 font-mono text-sm">${(analytics?.estimatedSttCost || 0).toFixed(4)}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Audio Processed:</span>
                <span className="text-slate-200">{analytics?.totalSttUsageMinutes || 0} minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Rate per Audio Min:</span>
                <span className="text-slate-200">$0.016 / min</span>
              </div>
              <div className="flex justify-between">
                <span>Diarization & Phone Model:</span>
                <span className="text-slate-200">Included</span>
              </div>
            </div>
          </div>

          {/* Card 2: Google Gemini AI Cost */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200 text-xs">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Gemini 3.8 Flash AI
              </span>
              <span className="text-purple-400 font-mono text-sm">${(analytics?.estimatedGeminiCost || 0).toFixed(4)}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Prompt Input Tokens:</span>
                <span className="text-slate-200">{(analytics?.totalInputTokens || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Completion Tokens:</span>
                <span className="text-slate-200">{(analytics?.totalOutputTokens || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Configured Rates:</span>
                <span className="text-slate-200">$0.075 / 1M In, $0.30 / 1M Out</span>
              </div>
            </div>
          </div>

          {/* Card 3: Unit Economics */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200 text-xs">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" /> Lead Unit Economics
              </span>
              <span className="text-amber-400 font-mono text-sm">${(analytics?.avgCostPerLead || 0).toFixed(4)} / lead</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Cost / Qualified Lead:</span>
                <span className="text-emerald-400 font-bold">${(analytics?.avgCostPerQualifiedLead || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Call Duration:</span>
                <span className="text-slate-200">{analytics?.durationDistribution?.avgDurationSeconds || 45} seconds</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Monthly Proj:</span>
                <span className="text-slate-200">${((analytics?.totalEstimatedCost || 0) * 30 / Math.max(daysFilter, 1)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Client & Campaign Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Performance Analytical Matrix */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Client Performance & Conversion Matrix
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {analytics?.clientPerformance?.length || clients.length} Active Clients
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3 text-center">Total Leads</th>
                  <th className="py-2.5 px-3 text-center">Qualified</th>
                  <th className="py-2.5 px-3 text-center">Conversion Rate</th>
                  <th className="py-2.5 px-3 text-center">STT Mins</th>
                  <th className="py-2.5 px-3 text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-slate-300 font-mono">
                {analytics?.clientPerformance && analytics.clientPerformance.length > 0 ? (
                  analytics.clientPerformance.map((cPerf) => (
                    <tr key={cPerf.clientCode} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-sans font-bold text-slate-200">
                        {cPerf.clientName} <span className="text-[10px] text-slate-500 font-mono">({cPerf.clientCode})</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-100">{cPerf.totalLeads}</td>
                      <td className="py-3 px-3 text-center text-emerald-400 font-bold">{cPerf.qualifiedCount}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {cPerf.conversionRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300">{cPerf.sttMinutes} min</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-400">${cPerf.estimatedCost.toFixed(3)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No client data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campaign Breakdown & Quality Distribution */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-400" />
              QA Quality Distribution
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Status Percentages</span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Segment Progress Bars */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Qualified Leads
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {analytics?.qualityDistribution?.qualified ?? stats.qualifiedLeads} ({analytics?.qualityDistribution?.qualifiedPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div style={{ width: `${analytics?.qualityDistribution?.qualifiedPercent ?? 0}%` }} className="h-full bg-emerald-400 rounded-full" />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Needs Review
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {analytics?.qualityDistribution?.needsReview ?? stats.needsReviewLeads} ({analytics?.qualityDistribution?.needsReviewPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div style={{ width: `${analytics?.qualityDistribution?.needsReviewPercent ?? 0}%` }} className="h-full bg-amber-400 rounded-full" />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Pending QA / In Queue
                </span>
                <span className="font-mono text-blue-400 font-bold">
                  {analytics?.qualityDistribution?.pending ?? stats.pendingJobs} ({analytics?.qualityDistribution?.pendingPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div style={{ width: `${analytics?.qualityDistribution?.pendingPercent ?? 0}%` }} className="h-full bg-blue-400 rounded-full" />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Disqualified / Rejected
                </span>
                <span className="font-mono text-rose-400 font-bold">
                  {analytics?.qualityDistribution?.rejected ?? stats.failedJobs} ({analytics?.qualityDistribution?.rejectedPercent ?? 0}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div style={{ width: `${analytics?.qualityDistribution?.rejectedPercent ?? 0}%` }} className="h-full bg-rose-400 rounded-full" />
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Hub */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            {onNavigateToAllLeads && (
              <button
                onClick={onNavigateToAllLeads}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Open Full Leads Database</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            )}

            {onSyncCrm && (
              <button
                onClick={onSyncCrm}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Live CRM Leads</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
