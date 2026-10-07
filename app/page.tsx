'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar, { NavTab } from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import AllLeadsView from './components/AllLeadsView';
import QueueView from './components/QueueView';
import ClientsView from './components/ClientsView';
import CampaignsView from './components/CampaignsView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import LeadDetailModal from './components/LeadDetailModal';
import ToastStack, { ToastItem } from './components/ui/Toast';
import SignInGate from './components/SignInGate';
import { ClientConfig, CampaignConfig, ProcessingJobItem } from '../lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
      } else {
        document.documentElement.classList.remove('light-mode');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([]);
  const [jobs, setJobs] = useState<ProcessingJobItem[]>([]);
  const [queueTab, setQueueTab] = useState<'active' | 'failed' | 'completed'>('active');

  const [stats, setStats] = useState({
    totalLeads: 0,
    totalJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    qualifiedLeads: 0,
    needsReviewLeads: 0,
  });

  const [queueStats, setQueueStats] = useState({
    waitingCount: 0,
    processingCount: 0,
    failedCount: 0,
    completedTodayCount: 0,
    activeCount: 0,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [paginationInfo, setPaginationInfo] = useState({
    page: 1,
    limit: 25,
    totalJobs: 0,
    totalPages: 1,
  });

  // Filters state
  const [selectedClientCode, setSelectedClientCode] = useState('ALL');
  const [selectedCampaignCode, setSelectedCampaignCode] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qaFilter, setQaFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected detail modal
  const [selectedJob, setSelectedJob] = useState<ProcessingJobItem | null>(null);

  // Syncing / Processing loaders
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingPaused, setIsProcessingPaused] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [reviewerName, setReviewerName] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [showOpenBanner, setShowOpenBanner] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const notify = useCallback((tone: ToastItem['tone'], message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  // Fetch initial pipeline pause status
  const fetchPauseStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/toggle-pause');
      const data = await res.json();
      if (data.success) {
        setIsProcessingPaused(!!data.isProcessingPaused);
      }
    } catch (err) {
      console.error('Error fetching pipeline pause status:', err);
    }
  }, []);

  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/jobs/toggle-pause', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsProcessingPaused(!!data.isProcessingPaused);
        fetchJobs();
      }
    } catch (err: any) {
      notify('warning', `Could not change the pipeline: ${err.message}`);
    }
  };

  // Load clients & campaigns
  const fetchConfigurations = useCallback(async () => {
    try {
      const clientsRes = await fetch('/api/clients');
      const clientsData = await clientsRes.json();
      if (clientsData.success) {
        setClients(clientsData.clients);
      }

      const campaignsRes = await fetch('/api/campaigns');
      const campaignsData = await campaignsRes.json();
      if (campaignsData.success) {
        setCampaigns(campaignsData.campaigns);
      }
    } catch (err) {
      console.error('Error fetching configurations:', err);
    }
  }, []);

  // Fetch Queue data
  const fetchQueueData = useCallback(async (tabOverride?: 'active' | 'failed' | 'completed') => {
    try {
      const targetTab = tabOverride || queueTab;
      const url = new URL('/api/queue', window.location.href);
      url.searchParams.set('tab', targetTab);
      if (selectedClientCode !== 'ALL') url.searchParams.set('clientCode', selectedClientCode);
      if (selectedCampaignCode !== 'ALL') url.searchParams.set('campaignCode', selectedCampaignCode);
      if (searchQuery) url.searchParams.set('search', searchQuery);
      url.searchParams.set('page', currentPage.toString());
      url.searchParams.set('limit', pageSize.toString());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
        if (typeof data.isProcessingPaused === 'boolean') {
          setIsProcessingPaused(data.isProcessingPaused);
        }
        if (data.queueStats) {
          setQueueStats(data.queueStats);
        }
        if (data.pagination) {
          setPaginationInfo(data.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching queue data:', err);
    }
  }, [queueTab, selectedClientCode, selectedCampaignCode, searchQuery, currentPage, pageSize]);

  // Load jobs & dashboard stats
  const fetchJobs = useCallback(async () => {
    if (activeTab === 'queue') {
      return fetchQueueData();
    }
    try {
      const url = new URL(activeTab === 'all-leads' ? '/api/leads' : '/api/jobs', window.location.href);
      if (selectedClientCode !== 'ALL') url.searchParams.set('clientCode', selectedClientCode);
      if (selectedCampaignCode !== 'ALL') url.searchParams.set('campaignCode', selectedCampaignCode);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);
      if (qaFilter !== 'ALL') url.searchParams.set('qaStatus', qaFilter);
      if (searchQuery) url.searchParams.set('search', searchQuery);
      url.searchParams.set('page', currentPage.toString());
      url.searchParams.set('limit', pageSize.toString());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
        setStats(data.stats);
        if (typeof data.isProcessingPaused === 'boolean') {
          setIsProcessingPaused(data.isProcessingPaused);
        }
        if (data.pagination) {
          setPaginationInfo(data.pagination);
        }

        setSelectedJob((prevSelected) => {
          if (!prevSelected) return null;
          const updated = data.jobs.find((j: ProcessingJobItem) => j.id === prevSelected.id);
          return updated || prevSelected;
        });
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  }, [activeTab, fetchQueueData, selectedClientCode, selectedCampaignCode, statusFilter, qaFilter, searchQuery, currentPage, pageSize]);

  // Fetch queue stats independently to keep sidebar badge updated
  const updateQueueBadge = useCallback(async () => {
    try {
      const res = await fetch('/api/queue?tab=active&limit=1');
      const data = await res.json();
      if (data.success && data.queueStats) {
        setQueueStats(data.queueStats);
        if (typeof data.isProcessingPaused === 'boolean') {
          setIsProcessingPaused(data.isProcessingPaused);
        }
      }
    } catch (err) {
      console.error('Error updating queue badge:', err);
    }
  }, []);

  // Reset page to 1 when filters change
  const handleClientCodeChange = (code: string) => {
    setSelectedClientCode(code);
    setCurrentPage(1);
  };
  const handleCampaignCodeChange = (code: string) => {
    setSelectedCampaignCode(code);
    setCurrentPage(1);
  };
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };
  const handleQaFilterChange = (qa: string) => {
    setQaFilter(qa);
    setCurrentPage(1);
  };
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  useEffect(() => {
    const savedReviewer = localStorage.getItem('qa-reviewer-name') || '';
    setReviewerName(savedReviewer);
    fetch('/api/health').catch(() => undefined);
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        setSignInRequired(!!data.required && !data.authenticated);
        setShowOpenBanner(!data.required && sessionStorage.getItem('hide-open-banner') !== '1');
      })
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
    fetchConfigurations();
    fetchPauseStatus();
    updateQueueBadge();
  }, [fetchConfigurations, fetchPauseStatus, updateQueueBadge]);

  useEffect(() => {
    fetchJobs();
    updateQueueBadge();
  }, [fetchJobs, updateQueueBadge, queueTab, activeTab]);

  // UI Live Polling Interval (Refreshes data every 10 seconds)
  const fetchJobsRef = React.useRef(fetchJobs);
  const updateBadgeRef = React.useRef(updateQueueBadge);

  useEffect(() => {
    fetchJobsRef.current = fetchJobs;
    updateBadgeRef.current = updateQueueBadge;
  }, [fetchJobs, updateQueueBadge]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchJobsRef.current();
      updateBadgeRef.current();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const tabs: Record<string, NavTab> = {
        '1': 'dashboard',
        '2': 'all-leads',
        '3': 'queue',
        '4': 'analytics',
        '5': 'configuration',
        '6': 'settings',
      };
      if (tabs[event.key]) setActiveTab(tabs[event.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sync CRM Leads Action
  const handleSyncCrm = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/crm/sync', { method: 'POST' });
      if (!res.ok) {
        console.warn(`CRM Sync HTTP error: ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
        await updateQueueBadge();
        setLastSyncedAt(new Date());
        notify('success', 'CRM sync finished. New leads will show up in the queue.');
      } else {
        notify('warning', data.error || 'CRM sync did not finish.');
      }
    } catch (err: any) {
      notify('warning', `CRM sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Run Pipeline Queue Worker Action
  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/jobs/process', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        notify('info', 'Queue started. This page updates as each lead finishes.');
        await fetchJobs();
        await updateQueueBadge();
      } else {
        notify('warning', data.error || 'The queue did not start.');
      }
    } catch (err: any) {
      notify('warning', `The queue did not start: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJobFinished = async (job: ProcessingJobItem) => {
    await fetchJobs();
    await updateQueueBadge();
    setSelectedJob(job);
    if (job.status === 'FAILED' || job.stepError) {
      notify('warning', job.stepError || 'This lead did not finish.');
      return;
    }
    const summary = job.qaResultJson?.agentCoaching?.summary;
    notify('success', summary || 'This call is scored. Open the lead to read the agent coaching.');
  };

  // Retry Single Job
  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
        await updateQueueBadge();
      } else {
        notify('warning', data.error || 'Retry failed.');
      }
    } catch (err: any) {
      notify('warning', `Retry failed: ${err.message}`);
    }
  };

  // Save Manual Transcript Edit
  const handleSaveManualEdit = async (jobId: string, editedTranscript: string, reviewedBy: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedTranscript, reviewedBy }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Transcript saved.');
        await fetchJobs();
      } else {
        notify('warning', data.error || 'Could not save the transcript.');
      }
    } catch (err: any) {
      notify('warning', `Could not save the transcript: ${err.message}`);
    }
  };

  // Override QA Qualification Status
  const handleOverrideQaStatus = async (
    jobId: string,
    manualOverrideStatus: 'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED',
    manualOverrideNotes: string,
    reviewedBy: string
  ) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualOverrideStatus,
          manualOverrideNotes,
          reviewedBy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', `Saved ${manualOverrideStatus.replace(/_/g, ' ')} by ${reviewedBy}.`);
        await fetchJobs();
      } else {
        notify('warning', data.error || 'Could not save the decision.');
      }
    } catch (err: any) {
      notify('warning', `Could not save the decision: ${err.message}`);
    }
  };

  if (!authReady) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (signInRequired) {
    return <SignInGate onSuccess={() => setSignInRequired(false)} />;
  }

  return (
    <div className="min-h-screen flex bg-transparent text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Persistent Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        queueCount={queueStats.activeCount}
        pipelineRunning={!isProcessingPaused}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main App Content Layout */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
      }`}>
        <Header
          activeTab={activeTab}
          onSyncCrm={handleSyncCrm}
          onProcessQueue={handleProcessQueue}
          isSyncing={isSyncing}
          isProcessing={isProcessing}
          isProcessingPaused={isProcessingPaused}
          onTogglePause={handleTogglePause}
          setMobileOpen={setMobileOpen}
          isCollapsed={isCollapsed}
          theme={theme}
          onToggleTheme={toggleTheme}
          lastSyncedAt={lastSyncedAt}
        />

        <main className="flex-1 transition-all duration-300 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {showOpenBanner && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
              <p>Anyone who can open this address can use the console. Set ADMIN_PASSWORD on the server to require a sign-in.</p>
              <button
                type="button"
                className="shrink-0 font-semibold"
                onClick={() => {
                  sessionStorage.setItem('hide-open-banner', '1');
                  setShowOpenBanner(false);
                }}
              >
                Dismiss
              </button>
            </div>
          )}
          {/* TAB 1: Analytical Dashboard */}
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              clients={clients}
              campaigns={campaigns}
              selectedClientCode={selectedClientCode}
              setSelectedClientCode={handleClientCodeChange}
              selectedCampaignCode={selectedCampaignCode}
              setSelectedCampaignCode={handleCampaignCodeChange}
              isProcessingPaused={isProcessingPaused}
              onTogglePause={handleTogglePause}
              onNavigateToAllLeads={() => setActiveTab('all-leads')}
              onSyncCrm={handleSyncCrm}
            />
          )}

          {/* TAB 2: Dedicated All Leads Database */}
          {activeTab === 'all-leads' && (
            <AllLeadsView
              stats={stats}
              jobs={jobs}
              clients={clients}
              campaigns={campaigns}
              selectedClientCode={selectedClientCode}
              setSelectedClientCode={handleClientCodeChange}
              selectedCampaignCode={selectedCampaignCode}
              setSelectedCampaignCode={handleCampaignCodeChange}
              statusFilter={statusFilter}
              setStatusFilter={handleStatusFilterChange}
              qaFilter={qaFilter}
              setQaFilter={handleQaFilterChange}
              searchQuery={searchQuery}
              setSearchQuery={handleSearchQueryChange}
              pagination={paginationInfo}
              onPageChange={(page) => setCurrentPage(page)}
              onLimitChange={(limit) => {
                setPageSize(limit);
                setCurrentPage(1);
              }}
              onSelectJob={(job) => setSelectedJob(job)}
              onRetryJob={handleRetryJob}
              onJobFinished={handleJobFinished}
              onActionError={(message) => notify('warning', message)}
              isProcessingPaused={isProcessingPaused}
              onTogglePause={handleTogglePause}
            />
          )}

          {/* TAB 3: Dedicated Queue View */}
          {activeTab === 'queue' && (
            <QueueView
              queueStats={queueStats}
              jobs={jobs}
              clients={clients}
              campaigns={campaigns}
              selectedTab={queueTab}
              onTabChange={(tab) => {
                setQueueTab(tab);
                setCurrentPage(1);
                fetchQueueData(tab);
              }}
              selectedClientCode={selectedClientCode}
              setSelectedClientCode={handleClientCodeChange}
              selectedCampaignCode={selectedCampaignCode}
              setSelectedCampaignCode={handleCampaignCodeChange}
              searchQuery={searchQuery}
              setSearchQuery={handleSearchQueryChange}
              pagination={paginationInfo}
              onPageChange={(page) => setCurrentPage(page)}
              onSelectJob={(job) => setSelectedJob(job)}
              onRetryJob={handleRetryJob}
              onJobFinished={handleJobFinished}
              onActionError={(message) => notify('warning', message)}
              onProcessQueue={handleProcessQueue}
              isProcessing={isProcessing}
              isProcessingPaused={isProcessingPaused}
              onTogglePause={handleTogglePause}
            />
          )}

          {/* TAB 4: Configuration (Clients & Campaigns) */}
          {activeTab === 'configuration' && (
            <div className="space-y-12">
              <ClientsView
                clients={clients}
                onRefresh={() => {
                  fetchConfigurations();
                  fetchJobs();
                }}
              />
              <CampaignsView
                clients={clients}
                campaigns={campaigns}
                onRefresh={() => {
                  fetchConfigurations();
                  fetchJobs();
                }}
              />
            </div>
          )}

          {/* TAB 5: Analytics Page */}
          {activeTab === 'analytics' && (
            <AnalyticsView clients={clients} campaigns={campaigns} />
          )}

          {/* TAB 6: Settings Page */}
          {activeTab === 'settings' && (
            <SettingsView
              onSettingsUpdated={() => {
                fetchConfigurations();
                fetchJobs();
              }}
              onSyncCrm={handleSyncCrm}
            />
          )}
        </main>
      </div>

      {/* Lead Details Modal / Drawer */}
      {selectedJob && (
        <LeadDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRetryJob={handleRetryJob}
          reviewerName={reviewerName}
          onReviewerNameChange={(name) => {
            setReviewerName(name);
            localStorage.setItem('qa-reviewer-name', name);
          }}
          onSaveManualEdit={handleSaveManualEdit}
          onOverrideQaStatus={handleOverrideQaStatus}
        />
      )}
      {commandOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/70 px-4 pt-24 backdrop-blur-sm" onClick={() => setCommandOpen(false)}>
          <div className="glass-panel w-full max-w-lg rounded-2xl p-4" onClick={(event) => event.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Search leads</p>
            <input
              autoFocus
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearchQuery(commandQuery);
                  setActiveTab('all-leads');
                  setCommandOpen(false);
                }
                if (event.key === 'Escape') setCommandOpen(false);
              }}
              placeholder="Company, contact, or lead reference"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[rgba(10,15,29,0.65)] px-3 py-2 text-sm text-slate-100 focus:outline-none"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['dashboard', 'all-leads', 'queue', 'analytics', 'configuration', 'settings'] as NavTab[]).map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className="btn-secondary justify-between"
                  onClick={() => {
                    setActiveTab(tab);
                    setCommandOpen(false);
                  }}
                >
                  <span className="capitalize">{tab.replace('-', ' ')}</span>
                  <span className="text-[10px] text-slate-500">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}
