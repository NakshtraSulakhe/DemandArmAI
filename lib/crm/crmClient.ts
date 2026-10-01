import { dbStore } from '../db/store';
import { CrmLeadItem, ProcessingJobItem, CrmRecordingItem, CampaignConfig } from '../types';

export interface CrmSyncResult {
  fetchedCount: number;
  newLeadsCount: number;
  updatedLeadsCount: number;
  newJobsCount: number;
  activeClientCodes: string[];
  clientSyncDetails: { clientCode: string; count: number; pages: number; error?: string }[];
  timestamp: string;
}

export class CrmClient {
  private lastSyncTime = 0;
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  public ensureAutoSyncStarted(): void {
    if (this.autoSyncTimer) return;

    const settings = dbStore.getSettings();
    const intervalMs = Math.max((settings.autoSyncInterval || 15) * 1000, 10000);

    console.log(`[CrmClient] Starting server-side background auto-sync timer every ${intervalMs / 1000}s...`);

    // Trigger initial background sync
    this.syncLeads().catch((err) => console.error('[CrmClient] Initial background sync error:', err));

    this.autoSyncTimer = setInterval(() => {
      this.syncLeads()
        .then(() => {
          try {
            const { jobWorker } = require('../jobs/jobWorker');
            jobWorker.processQueue(10).catch((err: any) => console.error('[CrmClient] Auto-worker error:', err));
          } catch (e) {
            console.error('[CrmClient] Failed to invoke job worker:', e);
          }
        })
        .catch((err) => console.error('[CrmClient] Background auto-sync error:', err));
    }, intervalMs);
  }

  /**
   * Performs live CRM synchronization with parallel API pagination across all active client codes:
   * 1. Retrieves all active Client codes from the local database.
   * 2. Calls CRM API with dynamic client_code and page pagination parameters.
   * 3. Auto-registers newly discovered CRM campaigns under parent client codes.
   * 4. Maps fields, detects recording URLs, and preserves lead metadata.
   * 5. Enqueues pending transcription jobs for leads with accessible recordings.
   */
  public async syncLeads(): Promise<CrmSyncResult> {
    if (this.isSyncing) {
      return {
        fetchedCount: 0,
        newLeadsCount: 0,
        updatedLeadsCount: 0,
        newJobsCount: 0,
        activeClientCodes: [],
        clientSyncDetails: [],
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    try {
      const settings = dbStore.getSettings();
      const activeClients = dbStore.getClients().filter((c) => c.isActive);
      const activeClientCodes = activeClients.map((c) => c.code.trim());

      if (activeClientCodes.length === 0) {
        return {
          fetchedCount: 0,
          newLeadsCount: 0,
          updatedLeadsCount: 0,
          newJobsCount: 0,
          activeClientCodes: [],
          clientSyncDetails: [],
          timestamp: new Date().toISOString(),
        };
      }

    const crmBaseUrl =
      settings.crmEndpoint ||
      'https://app.tarajglobal.com/demandflowbridge/api/get_leads.php';

    let totalFetchedCount = 0;
    let newLeadsCount = 0;
    let updatedLeadsCount = 0;
    let newJobsCount = 0;
    const clientSyncDetails: { clientCode: string; count: number; pages: number; error?: string }[] = [];

    const syncedLeadsMap = new Map<string, CrmLeadItem>();
    const syncedJobsMap = new Map<string, ProcessingJobItem>();

    // Process every active client code dynamically
    for (const clientCode of activeClientCodes) {
      try {
        const { leads: clientLeads, totalPages } = await this.fetchAllPagesForClient(
          crmBaseUrl,
          settings.crmApiKey,
          clientCode
        );

        clientSyncDetails.push({
          clientCode,
          count: clientLeads.length,
          pages: totalPages,
        });

        // Filter and save ONLY QA status = "pending" leads
        for (const rawLead of clientLeads) {
          const rawStatus = (
            rawLead.qa_status ||
            rawLead.quality_status ||
            rawLead.raw_lead_data?.qa_status ||
            rawLead.raw_lead_data?.quality_status ||
            ''
          )
            .toString()
            .trim()
            .toLowerCase();

          // Strictly filter only qa_status = "pending"
          if (rawStatus !== 'pending') {
            continue;
          }

          totalFetchedCount++;
          const parsedLead = this.mapRawLeadToCrmLeadItem(rawLead, clientCode);

          // Auto-register campaign if missing in local database
          let matchingCampaign = dbStore.getCampaignByCode(parsedLead.campaignCode);
          if (!matchingCampaign && parsedLead.campaignCode) {
            const newCampaignData: Partial<CampaignConfig> = {
              name: parsedLead.campaignName || `Campaign ${parsedLead.campaignCode}`,
              code: parsedLead.campaignCode,
              clientCode: parsedLead.clientCode,
              assetTitle: `${parsedLead.campaignName || parsedLead.campaignCode} Briefing`,
              valueProps: ['Enterprise Quality Software Solution', '24/7 Premium Support SLA'],
              additionalEditingInstructions: 'Ensure accurate preservation of customer feature requirements and timelines.',
              isActive: true,
            };
            matchingCampaign = dbStore.saveCampaign(newCampaignData, false);
          }

          if (matchingCampaign) {
            parsedLead.configurationStatus = 'CONFIGURED';
          } else {
            parsedLead.configurationStatus = 'CAMPAIGN_NOT_CONFIGURED';
          }

          if (!syncedLeadsMap.has(parsedLead.leadRef)) {
            syncedLeadsMap.set(parsedLead.leadRef, parsedLead);
            newLeadsCount++;
          }

          // Enqueue automatic STT + AI editing job for QA Pending leads with recordings
          if (parsedLead.recordingUrl || (parsedLead.recordings && parsedLead.recordings.length > 0)) {
            if (!syncedJobsMap.has(parsedLead.leadRef)) {
              const newJob: ProcessingJobItem = {
                id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                leadId: parsedLead.id,
                leadRef: parsedLead.leadRef,
                status: 'PENDING',
                attempts: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              syncedJobsMap.set(parsedLead.leadRef, newJob);
              newJobsCount++;
            }
          }
        }
      } catch (err: any) {
        console.warn(`Error synchronizing CRM leads for client code ${clientCode}:`, err.message);
        clientSyncDetails.push({
          clientCode,
          count: 0,
          pages: 0,
          error: err.message,
        });
      }
    }

    // Atomically swap in the fresh pending leads and jobs without UI downtime
    dbStore.replacePendingLeadsAndJobs(
      Array.from(syncedLeadsMap.values()),
      Array.from(syncedJobsMap.values())
    );

    return {
      fetchedCount: totalFetchedCount,
      newLeadsCount,
      updatedLeadsCount,
      newJobsCount,
      activeClientCodes,
      clientSyncDetails,
      timestamp: new Date().toISOString(),
    };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fast Parallel Paginated CRM API Fetcher:
   * Queries page 1, reads total_pages, and fetches remaining pages in parallel.
   */
  private async fetchAllPagesForClient(
    baseUrl: string,
    apiKey: string,
    clientCode: string
  ): Promise<{ leads: any[]; totalPages: number }> {
    const page1Url = new URL(baseUrl);
    page1Url.searchParams.set('client_code', clientCode);
    page1Url.searchParams.set('page', '1');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res1 = await fetch(page1Url.toString(), {
      method: 'GET',
      headers,
    });

    if (!res1.ok) {
      throw new Error(`CRM API HTTP Error ${res1.status}: ${res1.statusText}`);
    }

    const data1 = await res1.json();
    let allLeads: any[] = data1.leads || data1.data || [];
    const totalPages = data1.total_pages || 1;

    // Fetch up to 20 pages per client per sync pass in parallel for high speed
    const pagesToFetch: number[] = [];
    const maxPages = Math.min(totalPages, 20);
    for (let p = 2; p <= maxPages; p++) {
      pagesToFetch.push(p);
    }

    if (pagesToFetch.length > 0) {
      const pagePromises = pagesToFetch.map(async (p) => {
        try {
          const url = new URL(baseUrl);
          url.searchParams.set('client_code', clientCode);
          url.searchParams.set('page', p.toString());
          const res = await fetch(url.toString(), { method: 'GET', headers });
          if (res.ok) {
            const text = await res.text();
            try {
              const data = JSON.parse(text);
              return data.leads || data.data || [];
            } catch {
              // Server returned non-JSON HTML/error payload (e.g. rate limit/db error)
              return [];
            }
          }
        } catch (e) {
          console.warn(`Error fetching page ${p} for client ${clientCode}:`, e);
        }
        return [];
      });

      const pagesResults = await Promise.all(pagePromises);
      pagesResults.forEach((pLeads) => {
        allLeads = allLeads.concat(pLeads);
      });
    }

    // Deduplicate leads by id or lead_reference_number
    const uniqueMap = new Map<string, any>();
    allLeads.forEach((l) => {
      const key = (l.id || l.lead_reference_number || l.lead_id || Math.random()).toString();
      uniqueMap.set(key, l);
    });

    return {
      leads: Array.from(uniqueMap.values()),
      totalPages,
    };
  }

  /**
   * Maps raw CRM API lead object into local CrmLeadItem structure
   */
  private mapRawLeadToCrmLeadItem(raw: any, fallbackClientCode: string): CrmLeadItem {
    const rawLeadData = raw.raw_lead_data || {};
    const rawRecordings = Array.isArray(raw.recordings) ? raw.recordings : [];

    const parsedRecordings: CrmRecordingItem[] = rawRecordings.map((rec: any) => ({
      id: (rec.id || Math.random()).toString(),
      lead_id: (rec.lead_id || raw.id || '').toString(),
      file_path: rec.file_path || raw.recording_path || '',
      uploaded_at: rec.uploaded_at || raw.created_at || new Date().toISOString(),
      url: rec.url || raw.recording_url || '',
      download_url: rec.download_url || rec.url || raw.recording_url || '',
    }));

    // Extract Campaign Code
    const campaignCode =
      rawLeadData.campaign_code ||
      raw.campaign_code ||
      (raw.campaign_id ? `CMP_${raw.campaign_id}` : 'GENERAL');

    // Extract Client Code
    const clientCode =
      raw.client_code ||
      raw.client?.client_code ||
      rawLeadData.client_code ||
      fallbackClientCode;

    // Contact name
    const contactName =
      raw.full_name ||
      `${raw.first_name || ''} ${raw.last_name || ''}`.trim() ||
      'CRM Contact';

    const leadRef = raw.lead_reference_number || raw.lead_id || `LD-${raw.id}` || `LEAD-${Date.now()}`;

    // Main recording URL & Path
    const recordingPath =
      raw.recording_path ||
      raw.recording_file_path ||
      rawLeadData.recording_file_path ||
      rawLeadData.recording_path ||
      (parsedRecordings.length > 0 ? parsedRecordings[0].file_path : '');

    let recordingUrl =
      raw.recording_url ||
      (parsedRecordings.length > 0 ? parsedRecordings[0].url : '');

    if (!recordingUrl && recordingPath) {
      recordingUrl = `https://app.tarajglobal.com/demandflowbridge/api/get_recording.php?file=${encodeURIComponent(recordingPath)}`;
    }

    return {
      id: raw.id ? raw.id.toString() : leadRef,
      crmLeadId: raw.lead_id ? raw.lead_id.toString() : raw.id ? raw.id.toString() : leadRef,
      leadRef,
      clientCode: clientCode.toString().trim(),
      campaignCode: campaignCode.toString().trim(),
      campaignId: raw.campaign_id ? raw.campaign_id.toString() : undefined,
      campaignName: raw.campaign_name || rawLeadData.campaign_name || undefined,
      agentId: raw.agent_id ? raw.agent_id.toString() : undefined,
      agentName: raw.agent_name || undefined,
      contactName,
      companyName: raw.company_name || 'Prospect Company',
      companySize: raw.company_size || raw.form_data?.employee_size || undefined,
      industry: raw.industry || undefined,
      country: raw.country || raw.form_data?.country || undefined,
      jobTitle: raw.job_title || undefined,
      email: raw.email || undefined,
      phone: raw.phone || raw.contact_phone || undefined,
      recordingUrl,
      recordingPath: raw.recording_path || undefined,
      recordings: parsedRecordings,
      qaStatusCrm: raw.qa_status || raw.quality_status || undefined,
      durationSeconds: raw.duration_seconds || 45,
      formData: raw.form_data || undefined,
      rawLeadData: raw.raw_lead_data || undefined,
      syncedAt: new Date().toISOString(),
      createdAt: raw.created_at || new Date().toISOString(),
      updatedAt: raw.updated_at || new Date().toISOString(),
    };
  }
}

export const crmClient = new CrmClient();
