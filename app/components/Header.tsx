'use client';

import React, { useEffect, useState } from 'react';
import { Menu, RefreshCw, Play, Sun, Moon, Pause } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  onSyncCrm: () => void;
  onProcessQueue: () => void;
  isSyncing: boolean;
  isProcessing: boolean;
  isProcessingPaused?: boolean;
  onTogglePause?: () => void;
  setMobileOpen: (open: boolean) => void;
  isCollapsed?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  lastSyncedAt?: Date | null;
}

const pageTitles: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Calls scored, and what still needs a person.' },
  'all-leads': { title: 'All leads', subtitle: 'Search a lead, play the recording, and review the score.' },
  queue: { title: 'Processing queue', subtitle: 'Leads waiting for transcription, editing, or a retry.' },
  configuration: { title: 'Clients and campaigns', subtitle: 'Prompts and the rules each campaign is scored against.' },
  analytics: { title: 'Analytics', subtitle: 'Volume, scores, and cost from recorded pipeline usage.' },
  settings: { title: 'Settings', subtitle: 'CRM connection, model keys, and how the queue runs.' },
};

function relativeSync(value: Date | null | undefined, now: number) {
  if (!value) return 'Not synced this session';
  const mins = Math.max(0, Math.round((now - value.getTime()) / 60000));
  if (mins < 1) return 'Last synced: just now';
  if (mins === 1) return 'Last synced: 1 min ago';
  if (mins < 60) return `Last synced: ${mins} mins ago`;
  const hours = Math.round(mins / 60);
  return `Last synced: ${hours} hr ago`;
}

export default function Header({
  activeTab,
  onSyncCrm,
  onProcessQueue,
  isSyncing,
  isProcessing,
  isProcessingPaused = false,
  onTogglePause,
  setMobileOpen,
  theme = 'dark',
  onToggleTheme,
  lastSyncedAt,
}: HeaderProps) {
  const current = pageTitles[activeTab];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[rgba(7,9,14,0.72)] px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setMobileOpen(true)} className="btn-ghost lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-50">{current.title}</h2>
          <p className="hidden text-xs text-slate-400 sm:block">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="btn-ghost"
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          <span className={`inline-flex transition-transform duration-300 ${theme === 'light' ? '-rotate-90' : 'rotate-0'}`}>
            {theme === 'light' ? <Moon className="h-4 w-4 text-indigo-300" /> : <Sun className="h-4 w-4 text-amber-300" />}
          </span>
        </button>

        {onTogglePause && (
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              isProcessingPaused
                ? 'border-amber-400/30 bg-amber-500/12 text-amber-200'
                : 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isProcessingPaused ? 'bg-amber-400' : 'animate-pulse bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`} />
            <span className="hidden sm:inline">{isProcessingPaused ? 'Pipeline paused' : 'Pipeline running'}</span>
            <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[10px]">
              {isProcessingPaused ? 'Resume' : 'Pause'}
            </span>
            {isProcessingPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        )}

        <div className="flex flex-col items-end">
          <button onClick={onSyncCrm} disabled={isSyncing} className="btn-secondary" title="Synchronize leads from the CRM">
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-sky-300' : ''}`} />
            <span className="hidden md:inline">{isSyncing ? 'Syncing' : 'Sync CRM'}</span>
          </button>
          <span className="mt-0.5 hidden text-[10px] text-slate-500 lg:block">{relativeSync(lastSyncedAt, now)}</span>
        </div>

        <button
          onClick={onProcessQueue}
          disabled={isProcessing || isProcessingPaused}
          className="btn-primary"
          title={isProcessingPaused ? 'Resume the pipeline before running the queue.' : 'Run the queue now'}
        >
          <Play className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : 'fill-white'}`} />
          <span>{isProcessing ? 'Starting' : 'Run queue'}</span>
        </button>
      </div>
    </header>
  );
}
