'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  Clock,
  Zap,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  PieChart,
  Calendar,
  Filter,
  Layers,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { AnalyticsSummary, ClientConfig, CampaignConfig } from '../../lib/types';

interface AnalyticsViewProps {
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
}

export default function AnalyticsView({ clients, campaigns }: AnalyticsViewProps) {
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('ALL');
  const [selectedCampaignCode, setSelectedCampaignCode] = useState<string>('ALL');
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
      console.error('Error fetching analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [daysFilter, selectedClientCode, selectedCampaignCode]);

  if (isLoading || !analytics) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading platform analytics & usage metrics...</div>;
  }

  const availableCampaigns =
    selectedClientCode !== 'ALL'
      ? campaigns.filter((c) => c.clientCode.toUpperCase() === selectedClientCode.toUpperCase())
      : campaigns;

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-slate-100">Analytics & API Usage Monitor</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setDaysFilter(1)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                daysFilter === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDaysFilter(7)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                daysFilter === 7 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDaysFilter(30)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                daysFilter === 30 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDaysFilter(0)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                daysFilter === 0 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
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
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
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
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Campaigns</option>
            {availableCampaigns.map((cmp) => (
              <option key={cmp.id} value={cmp.code}>
                {cmp.name} ({cmp.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Processed</span>
          <div className="text-xl font-black text-slate-100">{analytics.totalRecordingsProcessed}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> {analytics.successPercentage}% Success
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audio Duration</span>
          <div className="text-xl font-black text-blue-400">{analytics.totalSttUsageMinutes} Min</div>
          <div className="text-[10px] text-slate-500 font-mono">{analytics.totalAudioDurationSeconds} Sec Total</div>
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gemini Tokens</span>
          <div className="text-xl font-black text-purple-400">{analytics.totalGeminiTokens.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 font-mono">
            {analytics.totalInputTokens} In / {analytics.totalOutputTokens} Out
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">STT Cost Est.</span>
          <div className="text-xl font-black text-emerald-400">${analytics.estimatedSttCost.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">$0.016 / Audio Min</div>
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gemini Cost Est.</span>
          <div className="text-xl font-black text-purple-400">${analytics.estimatedGeminiCost.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">Gemini 3.6 Flash Rates</div>
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Processing Est.</span>
          <div className="text-xl font-black text-amber-400">${analytics.totalEstimatedCost.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">Avg {analytics.avgProcessingDurationSeconds}s / call</div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Daily Activity & Transcript Types */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Daily Call Activity & Transcript Volume
            </h4>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-800/80">
            {analytics.rawVsEdited.map((item, idx) => {
              const maxVal = Math.max(...analytics.rawVsEdited.map((i) => i.raw || 1), 5);
              const heightPercent = Math.round((item.raw / maxVal) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-8 bg-slate-800 text-[10px] text-slate-200 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {item.date}: {item.raw} Raw, {item.edited} Edited
                  </div>

                  <div className="w-full max-w-[28px] bg-slate-800/80 rounded-t flex flex-col justify-end overflow-hidden h-36">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{item.date.slice(5)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Raw STT Transcripts
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block" /> Gemini Edited Transcripts
            </span>
          </div>
        </div>

        {/* Chart 2: Client-Wise Breakdown */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Client-Wise Call Volume & Qualification Rates
            </h4>
          </div>

          <div className="space-y-4 pt-2">
            {analytics.clientAnalytics.map((client) => {
              const maxCount = Math.max(...analytics.clientAnalytics.map((c) => c.count), 1);
              const percent = Math.round((client.count / maxCount) * 100);

              return (
                <div key={client.clientCode} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {client.clientName} ({client.clientCode})
                    </span>
                    <span className="text-slate-400 font-mono">
                      {client.count} Calls ({client.qualifiedCount} Qualified)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden flex">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Credits & Provider Cost Tracking Details */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            API Usage & Provider Billing Breakdown
          </h4>
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> Configurable Provider Pricing Model
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Speech-to-Text Cost Metrics */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Google Speech-to-Text API
              </span>
              <span className="text-emerald-400 font-mono">${analytics.estimatedSttCost.toFixed(4)}</span>
            </div>

            <div className="space-y-1.5 text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Total Audio Processed:</span>
                <span className="text-slate-200">{analytics.totalSttUsageMinutes} minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Configured Model Rate:</span>
                <span className="text-slate-200">$0.016 / minute</span>
              </div>
              <div className="flex justify-between">
                <span>Diarization Overhead:</span>
                <span className="text-slate-200">Included</span>
              </div>
            </div>
          </div>

          {/* Gemini AI Cost Metrics */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Google Gemini API
              </span>
              <span className="text-purple-400 font-mono">${analytics.estimatedGeminiCost.toFixed(4)}</span>
            </div>

            <div className="space-y-1.5 text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Prompt Input Tokens:</span>
                <span className="text-slate-200">{analytics.totalInputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Completion Output Tokens:</span>
                <span className="text-slate-200">{analytics.totalOutputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Configured Model Rates:</span>
                <span className="text-slate-200">$0.075/1M Input, $0.30/1M Output</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
