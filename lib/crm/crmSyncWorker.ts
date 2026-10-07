import { dbStore } from '../db/store';
import { decryptCredential } from '../security/encryption';
import { crmClient } from './crmClient';
import { jobWorker } from '../jobs/jobWorker';
import {
  CrmSyncMetricsState,
  ClientSyncMetrics,
  CrmLeadItem,
  ProcessingJobItem,
  CampaignConfig,
} from '../types';

export class CrmSyncWorkerService {
  private static instance: CrmSyncWorkerService;

  private isSyncing = false;
  private clientLocks = new Map<string, boolean>();

  private fastSyncTimer: NodeJS.Timeout | null = null;
  private reconciliationSyncTimer: NodeJS.Timeout | null = null;

  // Configurable sync parameters
  private currentIntervalMs = 15 * 60 * 1000;
  private consecutiveFailures = 0;

  private lastFastSyncAt?: string;
  private lastReconciliationSyncAt?: string;

  private metricsState: CrmSyncMetricsState = {
    globalStatus: 'IDLE',
    currentSyncIntervalMinutes: 15,
    consecutiveFailures: 0,
    activeClientCodes: [],
    clientMetrics: {},
  };

  private constructor() {}

  public static getInstance(): CrmSyncWorkerService {
    if (!CrmSyncWorkerService.instance) {
      CrmSyncWorkerService.instance = new CrmSyncWorkerService();
    }
    return CrmSyncWorkerService.instance;
  }

  /**
   * Starts fast sync on the interval from Settings, plus a 6-hour full reconcile.
   */
  public ensureAutoSyncStarted(): void {
    if (this.fastSyncTimer) {
      return; // Already initialized
    }

    const minutes = Math.min(120, Math.max(1, dbStore.getSettings().autoSyncInterval || 15));
    this.currentIntervalMs = minutes * 60 * 1000;
    console.log(`[CRM Sync Worker] Fast sync every ${minutes} minutes.`);
    
    // Initial sync run on server start after 5 seconds delay
    setTimeout(() => {
      this.runFastSync().catch((err) => console.error('[CRM Sync Worker] Initial sync error:', err));
    }, 5000);

    // Schedule Fast Sync (every 2 minutes)
    this.scheduleNextFastSync();

    // Schedule Reconciliation Sync (every 6 hours = 21,600,000 ms)
    this.reconciliationSyncTimer = setInterval(() => {
      this.runReconciliationSync().catch((err) =>
        console.error('[CRM Sync Worker] Reconciliation sync error:', err)
      );
    }, 6 * 60 * 60 * 1000);
  }

  public rescheduleFromSettings(): void {
    if (!this.fastSyncTimer) return;
    this.scheduleNextFastSync();
  }

  private delayForNextSync(): number {
    if (this.consecutiveFailures >= 3) return 10 * 60 * 1000;
    if (this.consecutiveFailures === 2) return 5 * 60 * 1000;
    if (this.consecutiveFailures === 1) return 2 * 60 * 1000;
    const minutes = Math.min(120, Math.max(1, dbStore.getSettings().autoSyncInterval || 15));
    return minutes * 60 * 1000;
  }

  private scheduleNextFastSync(): void {
    if (this.fastSyncTimer) {
      clearTimeout(this.fastSyncTimer);
    }
    this.currentIntervalMs = this.delayForNextSync();
    this.metricsState.currentSyncIntervalMinutes = Math.round(this.currentIntervalMs / 60000);
    this.fastSyncTimer = setTimeout(() => {
      this.runFastSync()
        .then(() => this.scheduleNextFastSync())
        .catch((err) => {
          console.error('[CRM Sync Worker] Fast Sync execution error:', err);
          this.scheduleNextFastSync();
        });
    }, this.currentIntervalMs);
  }

  /**
   * Triggers FAST SYNC across all active clients (2-minute creation window).
   */
  public async runFastSync(): Promise<CrmSyncMetricsState> {
    this.lastFastSyncAt = new Date().toISOString();
    const lookbackMinutes = Math.max(dbStore.getSettings().autoSyncInterval || 15, 60);
    const from = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    return this.executeSyncPass('FAST', from.toISOString().slice(0, 10));
  }

  /**
   * Triggers RECONCILIATION SYNC across all active clients (fetches all leads).
   */
  public async runReconciliationSync(): Promise<CrmSyncMetricsState> {
    this.lastReconciliationSyncAt = new Date().toISOString();
    return this.executeSyncPass('RECONCILIATION', '');
  }

  /**
   * Main synchronization pass execution engine with locking, load protection, and adaptive backoff.
   */
  private async executeSyncPass(
    syncType: 'FAST' | 'RECONCILIATION',
    dateFromStr: string
  ): Promise<CrmSyncMetricsState> {
    // 1. Check Global Lock
    if (this.isSyncing) {
      console.log(`[CRM Sync Worker] Lock Active: Skipping ${syncType} sync pass (previous pass still running).`);
      return this.getSyncMetrics();
    }

    this.isSyncing = true;
    this.metricsState.globalStatus = 'RUNNING';
    const startTime = Date.now();

    try {
      const settings = dbStore.getSettings();
      let activeClients = dbStore.getClients().filter((c) => c.isActive);
      let activeClientCodes = activeClients.map((c) => c.code.trim());

      // If no active clients in DB, fallback to known CRM client codes to discover all leads
      if (activeClientCodes.length === 0) {
        activeClientCodes = ['1020', '1010', '1030'];
      }
      this.metricsState.activeClientCodes = activeClientCodes;

      const crmEndpoint =
        settings.crmEndpoint ||
        'https://app.tarajglobal.com/demandflowbridge/api/get_leads.php';

      let totalEnqueuedJobs = 0;

      // 2. Sequential Client Sync Execution (1 client at a time for load protection)
      for (const clientCode of activeClientCodes) {
        // Per-client lock check
        if (this.clientLocks.get(clientCode)) {
          console.log(`[CRM Sync Worker] Per-client lock active for ${clientCode}. Skipping.`);
          continue;
        }

        this.clientLocks.set(clientCode, true);
        const clientObj = activeClients.find((c) => c.code.trim() === clientCode);
        const clientName = clientObj?.name || `Client ${clientCode}`;

        const clientMetric: ClientSyncMetrics = {
          clientCode,
          clientName,
          status: 'RUNNING',
          lastSyncType: syncType,
          lastStartedAt: new Date().toISOString(),
          recordsFetched: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          newJobsCreated: 0,
          pagesProcessed: 0,
          durationMs: 0,
        };

        const clientStartTime = Date.now();

        try {
          // Fetch paginated leads from CRM API
          const { leads, pagesProcessed } = await this.fetchClientLeadsPaginated(
            crmEndpoint,
            decryptCredential(settings.crmApiKey),
            clientCode,
            dateFromStr
          );

          clientMetric.recordsFetched = leads.length;
          clientMetric.pagesProcessed = pagesProcessed;

          // Process and upsert each lead into local MySQL database
          for (const rawLead of leads) {
            const parsedLead = this.mapRawLeadToCrmLeadItem(rawLead, clientCode);

            // Auto-register client if missing
            let matchingClient = dbStore.getClientByCode(parsedLead.clientCode);
            if (!matchingClient && parsedLead.clientCode) {
              const newClientData = {
                name: `Client ${parsedLead.clientCode}`,
                code: parsedLead.clientCode,
                globalPrompt: '',
                qualificationCriteria: '',
                isActive: true,
              };
              matchingClient = dbStore.saveClient(newClientData);
            }

            // Auto-register campaign if missing
            let matchingCampaign = dbStore.getCampaignByCode(parsedLead.campaignCode);
            if (!matchingCampaign && parsedLead.campaignCode) {
              const newCampaignData: Partial<CampaignConfig> = {
                name: parsedLead.campaignName || `Campaign ${parsedLead.campaignCode}`,
                code: parsedLead.campaignCode,
                clientCode: parsedLead.clientCode,
                assetTitle: `${parsedLead.campaignName || parsedLead.campaignCode} Briefing`,
                valueProps: ['Software & Enterprise Solutions'],
                additionalEditingInstructions: 'Preserve timelines, seat counts, and objections verbatim.',
                isActive: true,
              };
              matchingCampaign = dbStore.saveCampaign(newCampaignData, false);
            }

            parsedLead.configurationStatus = matchingCampaign ? 'CONFIGURED' : 'CAMPAIGN_NOT_CONFIGURED';

            // Check existing lead in DB
            const existingLead = dbStore.getLeadByRef(parsedLead.leadRef);

            if (!existingLead) {
              // New Lead Insertion
              dbStore.saveLead(parsedLead);
              clientMetric.recordsInserted++;
            } else {
              // Check if CRM-owned fields have changed
              const hasChanged = this.hasCrmFieldsChanged(existingLead, parsedLead);

              if (hasChanged) {
                // Update ONLY CRM-owned fields without resetting DemandArm processing fields!
                const updatedLead: CrmLeadItem = {
                  ...existingLead,
                  contactName: parsedLead.contactName || existingLead.contactName,
                  companyName: parsedLead.companyName || existingLead.companyName,
                  jobTitle: parsedLead.jobTitle || existingLead.jobTitle,
                  email: parsedLead.email || existingLead.email,
                  phone: parsedLead.phone || existingLead.phone,
                  recordingUrl: parsedLead.recordingUrl || existingLead.recordingUrl,
                  recordingPath: parsedLead.recordingPath || existingLead.recordingPath,
                  qaStatusCrm: parsedLead.qaStatusCrm || existingLead.qaStatusCrm,
                  rawLeadData: parsedLead.rawLeadData || existingLead.rawLeadData,
                  syncedAt: new Date().toISOString(),
                };
                dbStore.saveLead(updatedLead);
                clientMetric.recordsUpdated++;
              } else {
                clientMetric.recordsSkipped++;
              }
            }

            // Evaluate Queue Eligibility (Pending QA + Recording Present + No Finished/Active Job)
            const existingJob = dbStore.getJobById(parsedLead.leadRef);
            if (dbStore.isQueueEligible(parsedLead, existingJob)) {
              if (!existingJob) {
                const newJob: ProcessingJobItem = {
                  id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  leadId: parsedLead.id,
                  leadRef: parsedLead.leadRef,
                  status: 'PENDING',
                  attempts: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                dbStore.upsertLeadsAndSyncJobs([parsedLead], [newJob]);
                clientMetric.newJobsCreated++;
                totalEnqueuedJobs++;
              }
            }
          }

          clientMetric.status = 'SUCCESS';
          clientMetric.lastCompletedAt = new Date().toISOString();
          clientMetric.lastSuccessAt = new Date().toISOString();
          clientMetric.durationMs = Date.now() - clientStartTime;
        } catch (clientErr: any) {
          clientMetric.status = 'FAILED';
          clientMetric.lastError = clientErr.message || 'Error syncing client';
          clientMetric.lastErrorAt = new Date().toISOString();
          clientMetric.durationMs = Date.now() - clientStartTime;
          console.warn(`[CRM Sync Worker] Error syncing client ${clientCode}:`, clientErr.message);
        } finally {
          this.clientLocks.delete(clientCode);
          this.metricsState.clientMetrics[clientCode] = clientMetric;
        }
      }

      this.consecutiveFailures = 0;
      this.currentIntervalMs = this.delayForNextSync();
      this.metricsState.consecutiveFailures = 0;
      this.metricsState.currentSyncIntervalMinutes = Math.round(this.currentIntervalMs / 60000);
      this.metricsState.globalStatus = 'IDLE';

      dbStore.addAuditLog(
        undefined,
        'CRM_NEAR_REALTIME_SYNC_COMPLETED',
        `${syncType} sync pass completed in ${Date.now() - startTime}ms. Processed ${activeClientCodes.length} active clients. Enqueued ${totalEnqueuedJobs} new jobs.`
      );

      // Trigger background job worker if new jobs were enqueued
      if (totalEnqueuedJobs > 0 && !jobWorker.isPaused()) {
        jobWorker.processQueue(10).catch((err) => console.error('[CRM Sync Worker Worker Trigger Error]:', err));
      }
    } catch (passErr: any) {
      console.error(`[CRM Sync Worker] ${syncType} sync pass failed:`, passErr.message);
      this.consecutiveFailures++;
      this.metricsState.consecutiveFailures = this.consecutiveFailures;

      // Adaptive Load Protection & Exponential Backoff:
      // 1 failure -> 2 min, 2 failures -> 5 min, 3+ failures -> 10 min max
      if (this.consecutiveFailures === 1) {
        this.currentIntervalMs = 2 * 60 * 1000;
      } else if (this.consecutiveFailures === 2) {
        this.currentIntervalMs = 5 * 60 * 1000;
      } else {
        this.currentIntervalMs = 10 * 60 * 1000;
      }

      this.metricsState.currentSyncIntervalMinutes = Math.round(this.currentIntervalMs / 60000);
      this.metricsState.globalStatus = 'BACKOFF';

      dbStore.addAuditLog(
        undefined,
        'CRM_SYNC_FAILED_BACKOFF',
        `Sync pass failed (${passErr.message}). Consecutive failures: ${this.consecutiveFailures}. Adaptive interval adjusted to ${this.metricsState.currentSyncIntervalMinutes} minutes.`
      );
    } finally {
      this.isSyncing = false;
    }

    return this.getSyncMetrics();
  }

  /**
   * Fetch leads from CRM API page by page until empty or total pages reached.
   */
  private async fetchClientLeadsPaginated(
    baseUrl: string,
    apiKey: string,
    clientCode: string,
    dateFromStr: string
  ): Promise<{ leads: any[]; pagesProcessed: number }> {
    let allLeads: any[] = [];
    let page = 1;
    let totalPages = 1;
    let maxSafetyPages = 50;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    while (page <= totalPages && page <= maxSafetyPages) {
      const url = new URL(baseUrl);
      url.searchParams.set('client_code', clientCode);
      if (dateFromStr) {
        url.searchParams.set('date_from', dateFromStr);
      }
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', '500');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`CRM API HTTP Error ${res.status}: ${res.statusText}`);
        }

        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`CRM API returned non-JSON body: ${text.slice(0, 80)}`);
        }

        const pageLeads: any[] = data.leads || data.data || [];
        totalPages = data.total_pages || 1;

        if (pageLeads.length === 0) {
          break;
        }

        allLeads = allLeads.concat(pageLeads);
        page++;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error(`CRM API timeout after 15s for client ${clientCode} (page ${page})`);
        }
        throw err;
      }
    }

    // Deduplicate fetched leads by ID
    const uniqueMap = new Map<string, any>();
    allLeads.forEach((l) => {
      const key = (l.id || l.lead_reference_number || l.lead_id || Math.random()).toString();
      uniqueMap.set(key, l);
    });

    return {
      leads: Array.from(uniqueMap.values()),
      pagesProcessed: Math.min(page - 1, totalPages),
    };
  }

  /**
   * Compares existing local lead vs newly fetched CRM lead to avoid unnecessary MySQL writes.
   */
  private hasCrmFieldsChanged(existing: CrmLeadItem, fetched: CrmLeadItem): boolean {
    if (existing.contactName !== fetched.contactName) return true;
    if (existing.companyName !== fetched.companyName) return true;
    if (existing.recordingUrl !== fetched.recordingUrl) return true;
    if (existing.qaStatusCrm !== fetched.qaStatusCrm) return true;
    if (existing.campaignCode !== fetched.campaignCode) return true;
    if (existing.email !== fetched.email) return true;
    if (existing.phone !== fetched.phone) return true;
    return false;
  }

  /**
   * Maps raw CRM API lead object into local CrmLeadItem structure
   */
  private mapRawLeadToCrmLeadItem(raw: any, fallbackClientCode: string): CrmLeadItem {
    const rawLeadData = raw.raw_lead_data || {};
    const rawRecordings = Array.isArray(raw.recordings) ? raw.recordings : [];

    const campaignCode = (
      rawLeadData.campaign_code ||
      raw.campaign_code ||
      (raw.campaign_id ? `CMP_${raw.campaign_id}` : 'GENERAL')
    ).toString().trim();

    const clientCode = (
      raw.client_code ||
      raw.client?.client_code ||
      rawLeadData.client_code ||
      fallbackClientCode
    ).toString().trim();

    const contactName =
      raw.full_name ||
      `${raw.first_name || ''} ${raw.last_name || ''}`.trim() ||
      'CRM Contact';

    const leadRef = (raw.lead_reference_number || raw.lead_id || `LD-${raw.id}` || `LEAD-${Date.now()}`).toString();

    let recordingUrl = raw.recording_url || (rawRecordings.length > 0 ? rawRecordings[0].url : '');

    return {
      id: raw.id ? raw.id.toString() : leadRef,
      crmLeadId: raw.lead_id ? raw.lead_id.toString() : raw.id ? raw.id.toString() : leadRef,
      leadRef,
      clientCode,
      campaignCode,
      campaignName: raw.campaign_name || rawLeadData.campaign_name || undefined,
      agentId: raw.agent_id ? raw.agent_id.toString() : undefined,
      agentName: raw.agent_name || undefined,
      contactName,
      companyName: raw.company_name || 'Prospect Company',
      jobTitle: raw.job_title || undefined,
      email: raw.email || undefined,
      phone: raw.phone || raw.contact_phone || undefined,
      recordingUrl,
      recordingPath: raw.recording_path || undefined,
      qaStatusCrm: raw.qa_status || raw.quality_status || undefined,
      durationSeconds: raw.duration_seconds || 45,
      rawLeadData: raw.raw_lead_data || undefined,
      syncedAt: new Date().toISOString(),
      createdAt: raw.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns current sync metrics state for UI settings and monitoring endpoints.
   */
  public getSyncMetrics(): CrmSyncMetricsState {
    return {
      ...this.metricsState,
      lastFastSyncAt: this.lastFastSyncAt,
      lastReconciliationSyncAt: this.lastReconciliationSyncAt,
    };
  }
}

export const crmSyncWorker = CrmSyncWorkerService.getInstance();
