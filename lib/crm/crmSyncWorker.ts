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
  private lastSuccessfulAutoSyncAt?: string; // Tracks last successful scheduled sync timestamp

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
    // First run is treated as auto so it uses the lastSuccessfulAutoSyncAt if available.
    setTimeout(() => {
      this.runFastSync(undefined, true).catch((err) => console.error('[CRM Sync Worker] Initial sync error:', err));
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
      this.runFastSync(undefined, true)  // isAutoSync=true: skip already-fetched leads
        .then(() => this.scheduleNextFastSync())
        .catch((err) => {
          console.error('[CRM Sync Worker] Fast Sync execution error:', err);
          this.scheduleNextFastSync();
        });
    }, this.currentIntervalMs);
  }

  /**
   * Triggers FAST SYNC across all active clients.
   *
   * - AUTO sync (isAutoSync=true, called by scheduler):
   *     Only fetches leads created/updated SINCE the last successful auto-sync.
   *     Leads already in the DB that haven't changed are never re-fetched from the CRM API.
   *
   * - MANUAL sync (isAutoSync=false, default, called by the sync button):
   *     Fetches ALL pending QA leads with no date restriction to catch everything.
   *
   * @param customDateFrom  Override the date filter (optional, used for testing).
   * @param isAutoSync      Pass true when called from the scheduler (default: false).
   */
  public async runFastSync(customDateFrom?: string, isAutoSync = false): Promise<CrmSyncMetricsState> {
    this.lastFastSyncAt = new Date().toISOString();

    let dateFromStr: string;
    if (customDateFrom !== undefined) {
      // Explicit override (e.g. from tests or API body)
      dateFromStr = customDateFrom;
    } else if (isAutoSync && this.lastSuccessfulAutoSyncAt) {
      // Auto-sync: only fetch leads touched since the last successful run.
      dateFromStr = this.lastSuccessfulAutoSyncAt.slice(0, 10);
    } else {
      // Manual sync: default recent-leads window to last 14 days so we don't
      // re-download tens of thousands of months-old closed leads on every click.
      // Note: All "Pending" QA leads across ALL time are still fetched without date limits!
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dateFromStr = fourteenDaysAgo;
    }

    return this.executeSyncPass('FAST', dateFromStr, isAutoSync);
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
   * @param isAutoSync  When true, stamps lastSuccessfulAutoSyncAt on completion so the next
   *                    scheduled run can use it as a date filter to skip already-fetched leads.
   */
  private async executeSyncPass(
    syncType: 'FAST' | 'RECONCILIATION',
    dateFromStr: string,
    isAutoSync = false
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
      const knownCodes = ['1020', '1010', '1030'];
      const dbClients = dbStore.getClients();
      const inactiveCodes = new Set(dbClients.filter((c) => !c.isActive).map((c) => c.code.trim()));
      const activeClientCodes = Array.from(
        new Set([
          ...dbClients.filter((c) => c.isActive).map((c) => c.code.trim()),
          ...knownCodes,
        ])
      ).filter((code) => !inactiveCodes.has(code));
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
        const clientObj = dbClients.find((c) => c.code.trim() === clientCode);
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
          let leads: any[] = [];
          let pagesProcessed = 0;

          if (syncType === 'RECONCILIATION') {
            const res = await this.fetchClientLeadsPaginated(
              crmEndpoint,
              decryptCredential(settings.crmApiKey),
              clientCode,
              ''
            );
            leads = res.leads;
            pagesProcessed = res.pagesProcessed;
          } else {
            // FAST SYNC – two strategies depending on who triggered the sync:
            //
            // AUTO-SYNC (isAutoSync=true):
            //   dateFromStr = last-successful-sync date → only fetch leads created/updated
            //   SINCE that date. Leads already in the DB are not re-fetched.
            //   Both the "pending" call and the "recent" call use the same date filter so
            //   the CRM API does the heavy lifting of filtering on its side.
            //
            // MANUAL SYNC (isAutoSync=false, button click or first run):
            //   dateFromStr = '' → no date filter, fetch everything so nothing is missed.
            //
            // In both cases we still combine a qa_status=Pending call (to catch pending
            // leads that might be missed by date alone) with a general recent-leads call.

            const pendingFetch = this.fetchClientLeadsPaginated(
              crmEndpoint,
              decryptCredential(settings.crmApiKey),
              clientCode,
              dateFromStr || undefined, // Use date filter for auto-sync; no filter for manual
              'Pending'
            );

            // General recent fetch: same date window, no status filter (catches status changes)
            const recentFetch = this.fetchClientLeadsPaginated(
              crmEndpoint,
              decryptCredential(settings.crmApiKey),
              clientCode,
              dateFromStr || undefined
            );

            const [pendingRes, recentRes] = await Promise.all([pendingFetch, recentFetch]);

            const merged = new Map<string, any>();
            for (const l of [...pendingRes.leads, ...recentRes.leads]) {
              const key = (l.id || l.lead_reference_number || l.lead_id || Math.random()).toString();
              merged.set(key, l);
            }
            leads = Array.from(merged.values());
            pagesProcessed = pendingRes.pagesProcessed + recentRes.pagesProcessed;
          }

          clientMetric.recordsFetched = leads.length;
          clientMetric.pagesProcessed = pagesProcessed;

          // Process and batch upsert leads into DB (1 disk write instead of N writes!)
          const leadsToUpsert: CrmLeadItem[] = [];
          const newJobsToEnqueue: ProcessingJobItem[] = [];

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
            let effectiveLead = parsedLead;

            if (!existingLead) {
              // New Lead Insertion
              leadsToUpsert.push(parsedLead);
              clientMetric.recordsInserted++;
            } else {
              // Check if CRM-owned fields have changed
              const hasChanged = this.hasCrmFieldsChanged(existingLead, parsedLead);

              if (hasChanged) {
                // Update ONLY CRM-owned fields without resetting DemandArm processing fields!
                effectiveLead = {
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
                leadsToUpsert.push(effectiveLead);
                clientMetric.recordsUpdated++;
              } else {
                clientMetric.recordsSkipped++;
              }
            }

            // Evaluate Queue Eligibility (Pending QA + Recording Present + No Finished/Active Job)
            const existingJob = dbStore.getJobById(parsedLead.leadRef);
            if (dbStore.isQueueEligible(effectiveLead, existingJob)) {
              if (!existingJob) {
                const newJob: ProcessingJobItem = {
                  id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  leadId: effectiveLead.id,
                  leadRef: effectiveLead.leadRef,
                  status: 'PENDING',
                  attempts: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                newJobsToEnqueue.push(newJob);
                clientMetric.newJobsCreated++;
                totalEnqueuedJobs++;
              } else if (existingJob.status === 'SKIPPED') {
                existingJob.status = 'PENDING';
                existingJob.updatedAt = new Date().toISOString();
                dbStore.saveJob(existingJob);
                clientMetric.newJobsCreated++;
                totalEnqueuedJobs++;
              }
            }
          }

          // Batch commit all new/modified leads and jobs for this client in 1 call!
          if (leadsToUpsert.length > 0 || newJobsToEnqueue.length > 0) {
            dbStore.upsertLeadsAndSyncJobs(leadsToUpsert, newJobsToEnqueue);
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

      // Ensure all existing pending QA leads in DB that are queue eligible also get enqueued (in one batch)
      const allDbLeads = dbStore.getLeads();
      const backlogJobs: ProcessingJobItem[] = [];
      const backlogLeads: CrmLeadItem[] = [];

      for (const lead of allDbLeads) {
        const existingJob = dbStore.getJobById(lead.leadRef);
        if (dbStore.isQueueEligible(lead, existingJob) && !existingJob) {
          const newJob: ProcessingJobItem = {
            id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            leadId: lead.id,
            leadRef: lead.leadRef,
            status: 'PENDING',
            attempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          backlogJobs.push(newJob);
          backlogLeads.push(lead);
          totalEnqueuedJobs++;
        }
      }

      if (backlogJobs.length > 0) {
        dbStore.upsertLeadsAndSyncJobs(backlogLeads, backlogJobs);
      }

      this.consecutiveFailures = 0;
      this.currentIntervalMs = this.delayForNextSync();
      this.metricsState.consecutiveFailures = 0;
      this.metricsState.currentSyncIntervalMinutes = Math.round(this.currentIntervalMs / 60000);
      this.metricsState.globalStatus = 'IDLE';

      // Stamp the last-successful-auto-sync time so the next scheduled run only
      // fetches leads created/updated after this point (skips already-fetched leads).
      if (isAutoSync && syncType === 'FAST') {
        this.lastSuccessfulAutoSyncAt = new Date().toISOString();
        console.log(`[CRM Sync Worker] lastSuccessfulAutoSyncAt updated to ${this.lastSuccessfulAutoSyncAt}`);
      }

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
    dateFromStr?: string,
    qaStatus?: string
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
      if (qaStatus) {
        url.searchParams.set('qa_status', qaStatus);
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
    let rawLeadData: Record<string, any> = {};
    if (typeof raw.raw_lead_data === 'string') {
      try {
        rawLeadData = JSON.parse(raw.raw_lead_data);
      } catch {
        rawLeadData = {};
      }
    } else if (raw.raw_lead_data && typeof raw.raw_lead_data === 'object') {
      rawLeadData = { ...raw.raw_lead_data };
    } else {
      rawLeadData = { ...raw };
    }

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
      rawLeadData.contact_name ||
      'CRM Contact';

    const leadRef = (
      raw.lead_reference_number ||
      raw.lead_id ||
      rawLeadData.lead_code ||
      rawLeadData.lead_reference_number ||
      `LD-${raw.id}` ||
      `LEAD-${Date.now()}`
    ).toString().trim();

    let recordingUrl = raw.recording_url || (rawRecordings.length > 0 ? rawRecordings[0].url : '') || rawLeadData.recording_file_path || '';
    const recordingPath = raw.recording_path || rawLeadData.recording_path || (rawRecordings.length > 0 ? rawRecordings[0].file_path : undefined);

    if (!recordingUrl && recordingPath) {
      recordingUrl = `https://app.tarajglobal.com/demandflowbridge/api/get_recording.php?file=${encodeURIComponent(recordingPath)}`;
    }

    const qaStatusCrm = raw.qa_status || raw.quality_status || rawLeadData.qa_status || rawLeadData.quality_status || undefined;
    const createdAt = raw.created_at || rawLeadData.created_at || rawLeadData.created_at_utc || new Date().toISOString();

    if (!rawLeadData.created_at_utc) {
      rawLeadData.created_at_utc = createdAt;
    }

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
      recordingPath,
      qaStatusCrm,
      durationSeconds: raw.duration_seconds || 45,
      rawLeadData,
      syncedAt: new Date().toISOString(),
      createdAt,
      updatedAt: raw.updated_at || new Date().toISOString(),
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
      lastSuccessfulAutoSyncAt: this.lastSuccessfulAutoSyncAt,
    };
  }
}

export const crmSyncWorker = CrmSyncWorkerService.getInstance();
