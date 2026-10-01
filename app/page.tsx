'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar, { NavTab } from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
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

  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([]);
  const [jobs, setJobs] = useState<ProcessingJobItem[]>([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    qualifiedLeads: 0,
    needsReviewLeads: 0,
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

  // Load jobs & dashboard stats
  const fetchJobs = useCallback(async () => {
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
        if (data.pagination) {
          setPaginationInfo(data.pagination);
        }

        // Keep selected modal job updated if currently open without re-opening if closed
        setSelectedJob((prevSelected) => {
          if (!prevSelected) return null;
          const updated = data.jobs.find((j: ProcessingJobItem) => j.id === prevSelected.id);
          return updated || prevSelected;
        });
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  }, [selectedClientCode, selectedCampaignCode, statusFilter, qaFilter, searchQuery, currentPage, pageSize]);

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
    handleSyncCrm();
  }, [fetchConfigurations]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Keep fetchJobs reference updated for the persistent UI polling timer
  const fetchJobsRef = React.useRef(fetchJobs);
  useEffect(() => {
    fetchJobsRef.current = fetchJobs;
  }, [fetchJobs]);

  // UI Live Polling Interval (Refreshes data every 10 seconds while background server auto-sync runs)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobsRef.current();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Sync CRM Leads Action (Manual / Triggered)
  const handleSyncCrm = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/crm/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchJobs();
      } else {
        alert(`CRM Sync Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`CRM Sync Error: ${err.message}`);
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
      />

      {/* Main App Content Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onSyncCrm={handleSyncCrm}
          onProcessQueue={handleProcessQueue}
          isSyncing={isSyncing}
          isProcessing={isProcessing}
          setMobileOpen={setMobileOpen}
          isCollapsed={isCollapsed}
        />

        <main className={`flex-1 transition-all duration-300 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}>
          {/* TAB 1 & TAB 2: Dashboard & All Leads */}
          {(activeTab === 'dashboard' || activeTab === 'all-leads') && (
            <DashboardView
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
            />
          )}

          {/* TAB 3: Configuration (Clients & Campaigns) */}
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

          {/* TAB 4: Analytics Page */}
          {activeTab === 'analytics' && (
            <AnalyticsView clients={clients} campaigns={campaigns} />
          )}

          {/* TAB 5: Settings Page */}
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
      <LeadDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onRetryJob={handleRetryJob}
        onSaveManualEdit={handleSaveManualEdit}
        onOverrideQaStatus={handleOverrideQaStatus}
      />
    </div>
  );
}
