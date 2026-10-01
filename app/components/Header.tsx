'use client';

import React from 'react';
import { Menu, RefreshCw, Play, Shield, Activity } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  onSyncCrm: () => void;
  onProcessQueue: () => void;
  isSyncing: boolean;
  isProcessing: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
}

const pageTitles: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'Real-time sales call transcription status, evidence QA scores, and activity feeds.',
  },
  'all-leads': {
    title: 'CRM Sales Leads Directory',
    subtitle: 'Browse, filter, listen to recordings, view raw STT, and inspect Gemini AI transcripts.',
  },
  configuration: {
    title: 'Client & Campaign AI Configuration',
    subtitle: 'Manage administrative global client prompts, campaign assets, and qualification rules.',
  },
  analytics: {
    title: 'Platform Analytics & Cost Tracking',
    subtitle: 'Track recording audio volume, Gemini token consumption, and API usage breakdown.',
  },
  settings: {
    title: 'Global Administrative Settings',
    subtitle: 'Configure CRM endpoints, Google Speech-to-Text models, Gemini API keys, and security parameters.',
  },
};

export default function Header({
  activeTab,
  onSyncCrm,
  onProcessQueue,
  isSyncing,
  isProcessing,
  setMobileOpen,
  isCollapsed,
}: HeaderProps) {
  const current = pageTitles[activeTab];

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md transition-all duration-300 ${
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-bold text-slate-100">{current.title}</h2>
          <p className="text-xs text-slate-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-slate-400 font-medium">Auto-Sync (15s):</span>
          <span className="font-bold text-emerald-400">Active</span>
        </div>

        <button
          onClick={onSyncCrm}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all disabled:opacity-50"
          title="Synchronize matching leads from CRM REST API"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
          <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync CRM Leads'}</span>
        </button>

        <button
          onClick={onProcessQueue}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          title="Run background job worker queue"
        >
          <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : 'fill-white'}`} />
          <span>{isProcessing ? 'Processing...' : 'Run Pipeline'}</span>
        </button>
      </div>
    </header>
  );
}
