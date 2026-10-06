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
      alert(`Error toggling pipeline pause: ${err.message}`);
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
  const fetchQueueData = useCallback(async () => {
    try {
      const url = new URL('/api/queue', window.location.href);
      url.searchParams.set('tab', queueTab);
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
      const url = new URL('/api/jobs', window.location.href);
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
    fetchConfigurations();
    fetchPauseStatus();
    updateQueueBadge();
  }, [fetchConfigurations, fetchPauseStatus, updateQueueBadge]);

  useEffect(() => {
    fetchJobs();
    updateQueueBadge();
  }, [fetchJobs, updateQueueBadge]);

  // UI Live Polling Interval (Refreshes data every 10 seconds)
  const fetchJobsRef = React.useRef(fetchJobs);
  const updateBadgeRef = React.useRef(updateQueueBadge);

  useEffect(() => {
    fetchJobsRef.current = fetchJobs;
    updateBadgeRef.current = updateQueueBadge;
  }, [fetchJobs, updateQueueBadge]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobsRef.current();
      updateBadgeRef.current();
    }, 10000);

    return () => clearInterval(interval);
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
      } else {
        console.warn(`CRM Sync warning: ${data.error}`);
      }
    } catch (err: any) {
      console.warn(`CRM Sync network issue: ${err.message}`);
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
        await fetchJobs();
        await updateQueueBadge();
      } else {
        alert(`Pipeline Worker Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Pipeline Worker Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
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
        alert(`Retry Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Retry Error: ${err.message}`);
    }
  };

  // Save Manual Transcript Edit
  const handleSaveManualEdit = async (jobId: string, editedTranscript: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedTranscript, reviewedBy: 'Admin User' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
      } else {
        alert(`Error saving transcript edit: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error saving transcript edit: ${err.message}`);
    }
  };

  // Override QA Qualification Status
  const handleOverrideQaStatus = async (
    jobId: string,
    manualOverrideStatus: 'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED',
    manualOverrideNotes: string
  ) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualOverrideStatus,
          manualOverrideNotes,
          reviewedBy: 'Admin QA Lead',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
      } else {
        alert(`Error overriding QA status: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error overriding QA status: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Persistent Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        queueCount={queueStats.activeCount}
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
        />

        <main className="flex-1 transition-all duration-300 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
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
          onSaveManualEdit={handleSaveManualEdit}
          onOverrideQaStatus={handleOverrideQaStatus}
        />
      )}
    </div>
  );
}
