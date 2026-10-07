'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  Sliders,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sun,
  Moon,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'all-leads' | 'queue' | 'configuration' | 'analytics' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  queueCount?: number;
  pipelineRunning?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
  queueCount = 0,
  pipelineRunning = false,
  theme = 'dark',
  onToggleTheme,
}: SidebarProps) {
  const mainNavItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number; shortcut: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, shortcut: '1' },
    { id: 'all-leads', label: 'All Leads', icon: <Users className="w-4 h-4" />, shortcut: '2' },
    { id: 'queue', label: 'Queue', icon: <Layers className="w-4 h-4" />, badge: queueCount, shortcut: '3' },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" />, shortcut: '4' },
    { id: 'configuration', label: 'Configuration', icon: <Sliders className="w-4 h-4" />, shortcut: '5' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, shortcut: '6' },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[rgba(15,23,42,0.72)] backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`flex h-16 items-center justify-between border-b border-white/10 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 p-1.5 text-white shadow-lg shadow-indigo-600/30">
              <Shield className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="text-sm font-extrabold tracking-tight text-slate-50">DemandArm AI</h1>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Call QA console</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-ghost hidden lg:flex"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {mainNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                title={`${item.label}  (${item.shortcut})`}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/80 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                {isActive && <span className="absolute left-0 h-5 w-1 rounded-r-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)]" />}
                <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                {!isCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!isCollapsed && (
                  <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">{item.shortcut}</kbd>
                )}
                {item.badge !== undefined && item.badge > 0 && !isCollapsed && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                    {pipelineRunning && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          {!isCollapsed && (
            <p className="px-1 text-[10px] text-slate-500">Ctrl/Cmd + K opens search. Keys 1–6 switch pages.</p>
          )}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`btn-secondary w-full ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <span className={`inline-flex transition-transform duration-300 ${theme === 'light' ? 'rotate-180' : ''}`}>
                {theme === 'light' ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-300" />}
              </span>
              {!isCollapsed && <span>{theme === 'light' ? 'Dark theme' : 'Light theme'}</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
