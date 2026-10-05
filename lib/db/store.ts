import fs from 'fs';
import path from 'path';
import {
  ClientConfig,
  CampaignConfig,
  CrmLeadItem,
  ProcessingJobItem,
  AuditLogItem,
  SystemSettingsConfig,
  ClientPromptVersion,
} from '../types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'db_store.json');

interface LocalStoreData {
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  leads: CrmLeadItem[];
  jobs: ProcessingJobItem[];
  auditLogs: AuditLogItem[];
  clientPrompts?: ClientPromptVersion[];
  settings: SystemSettingsConfig;
}

const DEFAULT_SETTINGS: SystemSettingsConfig = {
  id: 'global',
  crmEndpoint: 'https://app.tarajglobal.com/demandflowbridge/api/get_leads.php',
  crmApiKey: 'crm_sec_demandarm_live_2026',
  sttProvider: 'gemini',
  sttApiKey: '',
  gcsBucketName: 'qtranscript-recordings',
  gcpProjectId: 'demandarm-ai-qa',
  gcpClientEmail: '',
  gcpPrivateKey: '',
  sttLanguageCode: 'en-US',
  sttModel: 'telephony',
  sttDiarizationEnabled: true,
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  geminiTemperature: 0.2,
  geminiMaxTokens: 4096,
  maxConcurrency: 3,
  autoSyncInterval: 15,
  autoGenerateTranscripts: true,
  autoQaEvaluation: true,
  isProcessingPaused: false,
  audioRetentionDays: 90,
  sttCostPerMinute: 0.016,
  geminiInputCostPer1M: 0.075,
  geminiOutputCostPer1M: 0.30,
  updatedAt: new Date().toISOString(),
};

const INITIAL_CLIENTS: ClientConfig[] = [
  {
    id: 'cli_1020',
    name: 'Software Finder',
    code: '1020',
    globalPrompt: `You are an expert sales call transcript editor for Software Finder.
Format the edited transcript cleanly with clear speaker labels ([Sales Rep] / [Prospect Name]).
Remove filler words like "um", "uh", "you know", "like" while strictly preserving software implementation timelines, user seat counts, pricing numbers, product features, and client commitments.
Do NOT fabricate any statements. Preserve verbatim customer objections and feature requests.`,
    qualificationCriteria: `1. Verification of prospect name, company, and decision-maker role.
2. Discussion of software integration requirements or LMS implementation.
3. Target implementation timeline identified (e.g. 3-6 months, 6-12 months).
4. Follow-up action or demo agreed upon.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cli_1010',
    name: 'Enterprise Tech Solutions 1010',
    code: '1010',
    globalPrompt: `You are an enterprise sales transcript editor for Client 1010.
Ensure technical terms, Zero-Trust compliance markers, and cloud workload metrics are captured accurately.
Maintain precise numbers, budget ranges, and compliance mandates mentioned by the prospect.
Never infer consent or interest that was not explicitly voiced by the customer.`,
    qualificationCriteria: `1. Confirmed decision maker (VP / CISO / Director level).
2. Cloud infrastructure or cybersecurity need identified.
3. Implementation timeline within 6 months.
4. Demo or follow-up technical review scheduled.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cli_1030',
    name: 'Healthcare Informatics 1030',
    code: '1030',
    globalPrompt: `You are a compliance-focused transcript editor for Client 1030.
Ensure all HIPAA compliance markers, EHR integrations (Epic, Cerner), and medical software features discussed are captured accurately.
Maintain precise numbers, seats, and budget ranges.`,
    qualificationCriteria: `1. Verified prospect is a decision maker at a healthcare provider or hospital network.
2. Discussion of patient data management or EHR integration.
3. Implementation timeframe defined.
4. Next step defined with specific target timeline.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_CAMPAIGNS: CampaignConfig[] = [
  {
    id: 'cmp_tg_1020_004',
    name: 'LMS Software Campaign',
    code: 'TG-1020-004',
    clientCode: '1020',
    assetTitle: 'LMS Software Enterprise Suite',
    valueProps: [
      'Real-time LMS & HRIS Data Integration',
      'Automated Student & Employee Onboarding Tracking',
      '99.9% Uptime with SOC2 Data Compliance',
    ],
    additionalEditingInstructions: `Capitalize LMS Software, HRIS Integration, and Learning Analytics correctly. Ensure implementation timeline mentioned (e.g. 3-6 months) is accurately preserved.`,
    qualificationRulesOverride: `Prospect must manage active training or software implementation requirements.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cmp_tg_1010_001',
    name: 'CloudShield Zero Trust',
    code: 'TG-1010-001',
    clientCode: '1010',
    assetTitle: 'CloudShield Enterprise Architecture Briefing',
    valueProps: [
      'Automated Zero-Trust Micro-segmentation',
      '99.999% SLA with multi-region failover',
    ],
    additionalEditingInstructions: `Capitalize Zero-Trust Architecture and IAM Policy Engine correctly.`,
    qualificationRulesOverride: `Must confirm prospect cloud workload infrastructure fit.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cmp_tg_1030_002',
    name: 'Healthcare EHR Data Sync',
    code: 'TG-1030-002',
    clientCode: '1030',
    assetTitle: 'FinHealth Interoperability Engine',
    valueProps: [
      'Epic & Cerner HL7/FHIR Data Sync',
      'Real-time insurance verification',
    ],
    additionalEditingInstructions: `Ensure Epic, Cerner, HL7, and FHIR are capitalized properly.`,
    qualificationRulesOverride: `Prospect must manage hospital or healthcare clinic network.`,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_LEADS: CrmLeadItem[] = [];
const INITIAL_JOBS: ProcessingJobItem[] = [];
const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

export class LocalDbStore {
  private static instance: LocalDbStore;

  private data: LocalStoreData = {
    clients: [],
    campaigns: [],
    leads: [],
    jobs: [],
    auditLogs: [],
    settings: DEFAULT_SETTINGS,
  };

  private constructor() {
    this.init();
  }

  public static getInstance(): LocalDbStore {
    if (!LocalDbStore.instance) {
      LocalDbStore.instance = new LocalDbStore();
    }
    return LocalDbStore.instance;
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure default settings URL is live CRM endpoint and model is gemini-3.8-flash
        if (!this.data.settings || !this.data.settings.crmEndpoint || this.data.settings.crmEndpoint.includes('mock-server')) {
          this.data.settings = { ...DEFAULT_SETTINGS, ...(this.data.settings || {}), crmEndpoint: DEFAULT_SETTINGS.crmEndpoint };
        }
        if (this.data.settings && (!this.data.settings.geminiModel || this.data.settings.geminiModel.includes('2.5-flash') || this.data.settings.geminiModel.includes('3.6-flash') || this.data.settings.geminiModel.includes('-high'))) {
          this.data.settings.geminiModel = 'gemini-3.8-flash';
        }
        if (!Array.isArray(this.data.clientPrompts)) {
          this.data.clientPrompts = [];
        }
        // Cap audit logs to max 300 items to keep store lightweight and ultrafast
        if (Array.isArray(this.data.auditLogs) && this.data.auditLogs.length > 300) {
          this.data.auditLogs = this.data.auditLogs.slice(0, 300);
        }
        this.persist();
      } else {
        this.data = {
          clients: INITIAL_CLIENTS,
          campaigns: INITIAL_CAMPAIGNS,
          leads: INITIAL_LEADS,
          jobs: INITIAL_JOBS,
          auditLogs: INITIAL_AUDIT_LOGS,
          clientPrompts: [],
          settings: DEFAULT_SETTINGS,
        };
        this.persist();
      }
    } catch (e) {
      console.error('Error initializing store file:', e);
      this.data = {
        clients: INITIAL_CLIENTS,
        campaigns: INITIAL_CAMPAIGNS,
        leads: INITIAL_LEADS,
        jobs: INITIAL_JOBS,
        auditLogs: INITIAL_AUDIT_LOGS,
        clientPrompts: [],
        settings: DEFAULT_SETTINGS,
      };
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist db_store.json:', e);
    }
  }

  // Settings
  public getSettings(): SystemSettingsConfig {
    return this.data.settings || DEFAULT_SETTINGS;
  }

  public updateSettings(settings: Partial<SystemSettingsConfig>): SystemSettingsConfig {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.settings;
  }

  // Clients & Prompt Versions
  public getClients(): ClientConfig[] {
    return this.data.clients.map((c) => ({
      ...c,
      promptVersions: this.getClientPromptVersions(c.code),
    }));
  }

  public getClientByCode(code: string): ClientConfig | undefined {
    if (!code) return undefined;
    const client = this.data.clients.find((c) => c.code.trim().toUpperCase() === code.trim().toUpperCase());
    if (!client) return undefined;
    return {
      ...client,
      promptVersions: this.getClientPromptVersions(client.code),
    };
  }

  public getClientPromptVersions(clientCodeOrId: string): ClientPromptVersion[] {
    if (!clientCodeOrId) return [];
    const search = clientCodeOrId.trim().toUpperCase();
    const client = this.data.clients.find((c) => c.code.trim().toUpperCase() === search || c.id === clientCodeOrId);
    const targetCode = client ? client.code.trim().toUpperCase() : search;
    const targetId = client ? client.id : clientCodeOrId;

    return (this.data.clientPrompts || []).filter(
      (cp) => cp.clientId === targetId || cp.clientCode.trim().toUpperCase() === targetCode
    );
  }

  public saveClient(clientData: Partial<ClientConfig>, createdBy: string = 'Admin User'): ClientConfig {
    const code = clientData.code?.trim().toUpperCase() || 'CLIENT_' + Date.now();
    const existingIndex = this.data.clients.findIndex((c) => c.code.trim().toUpperCase() === code || (clientData.id && c.id === clientData.id));

    const existingClient = existingIndex >= 0 ? this.data.clients[existingIndex] : undefined;
    const isNew = !existingClient;

    let currentPromptVersion = existingClient?.promptVersion || 1;
    const newPromptText = clientData.globalPrompt !== undefined ? clientData.globalPrompt : (existingClient?.globalPrompt || '');

    const promptChanged = isNew || (existingClient && existingClient.globalPrompt !== newPromptText);

    const clientId = existingClient?.id || clientData.id || `cli_${Date.now()}`;

    if (!Array.isArray(this.data.clientPrompts)) {
      this.data.clientPrompts = [];
    }

    if (promptChanged && newPromptText && newPromptText.trim().length > 0) {
      if (!isNew) {
        const existingVersions = this.data.clientPrompts.filter((cp) => cp.clientId === clientId || cp.clientCode === code);
        const maxV = existingVersions.reduce((max, cp) => Math.max(max, cp.version || 1), existingClient?.promptVersion || 1);
        currentPromptVersion = maxV + 1;
      }

      // Deactivate prior versions
      this.data.clientPrompts.forEach((cp) => {
        if (cp.clientId === clientId || cp.clientCode === code) {
          cp.isActive = false;
        }
      });

      // Insert active prompt version
      this.data.clientPrompts.push({
        id: `cpv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clientId,
        clientCode: code,
        promptType: 'TRANSCRIPT_EDITING',
        promptText: newPromptText,
        version: currentPromptVersion,
        isActive: true,
        createdBy,
        createdAt: new Date().toISOString(),
      });
    }

    const updated: ClientConfig = {
      id: clientId,
      name: clientData.name || existingClient?.name || 'New Client',
      code,
      globalPrompt: newPromptText,
      qualificationCriteria: clientData.qualificationCriteria !== undefined ? clientData.qualificationCriteria : (existingClient?.qualificationCriteria || ''),
      isActive: clientData.isActive ?? existingClient?.isActive ?? true,
      autoSyncEnabled: clientData.autoSyncEnabled ?? existingClient?.autoSyncEnabled ?? true,
      autoProcessingEnabled: clientData.autoProcessingEnabled ?? existingClient?.autoProcessingEnabled ?? true,
      allowClientPromptFallback: clientData.allowClientPromptFallback ?? existingClient?.allowClientPromptFallback ?? true,
      promptVersion: currentPromptVersion,
      createdAt: existingClient?.createdAt || clientData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.data.clients[existingIndex] = updated;
    } else {
      this.data.clients.push(updated);
    }
    this.persist();
    return {
      ...updated,
      promptVersions: this.getClientPromptVersions(updated.code),
    };
  }

  public deleteClient(code: string): boolean {
    const initialLen = this.data.clients.length;
    this.data.clients = this.data.clients.filter((c) => c.code.trim().toUpperCase() !== code.trim().toUpperCase());
    this.data.campaigns = this.data.campaigns.filter((cmp) => cmp.clientCode.trim().toUpperCase() !== code.trim().toUpperCase());
    this.persist();
    return this.data.clients.length < initialLen;
  }

  // Campaigns
  public getCampaigns(clientCode?: string): CampaignConfig[] {
    if (clientCode) {
      return this.data.campaigns.filter((cmp) => cmp.clientCode.trim().toUpperCase() === clientCode.trim().toUpperCase());
    }
    return this.data.campaigns;
  }

  public getCampaignByCode(code: string): CampaignConfig | undefined {
    if (!code) return undefined;
    return this.data.campaigns.find((cmp) => cmp.code.trim().toUpperCase() === code.trim().toUpperCase());
  }

  public saveCampaign(campaignData: Partial<CampaignConfig>, autoPersist: boolean = true): CampaignConfig {
    const code = campaignData.code?.trim().toUpperCase() || 'CMP_' + Date.now();
    const existingIndex = this.data.campaigns.findIndex((cmp) => cmp.code.trim().toUpperCase() === code);

    const updated: CampaignConfig = {
      id: campaignData.id || `cmp_${Date.now()}`,
      name: campaignData.name || 'New Campaign',
      code,
      clientCode: campaignData.clientCode?.trim().toUpperCase() || '',
      assetTitle: campaignData.assetTitle || '',
      valueProps: Array.isArray(campaignData.valueProps) ? campaignData.valueProps : [],
      additionalEditingInstructions: campaignData.additionalEditingInstructions || '',
      qualificationRulesOverride: campaignData.qualificationRulesOverride || '',
      isActive: campaignData.isActive ?? true,
      createdAt: campaignData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.data.campaigns[existingIndex] = { ...this.data.campaigns[existingIndex], ...updated };
    } else {
      this.data.campaigns.push(updated);
    }
    if (autoPersist) this.persist();
    return updated;
  }

  public deleteCampaign(code: string): boolean {
    const initialLen = this.data.campaigns.length;
    this.data.campaigns = this.data.campaigns.filter((cmp) => cmp.code.trim().toUpperCase() !== code.trim().toUpperCase());
    this.persist();
    return this.data.campaigns.length < initialLen;
  }

  // CRM Leads
  public getLeads(): CrmLeadItem[] {
    return this.data.leads;
  }

  public clearLeadsAndJobs(autoPersist: boolean = true): void {
    this.data.leads = [];
    this.data.jobs = [];
    if (autoPersist) this.persist();
  }

  public upsertLeadsAndSyncJobs(newLeads: CrmLeadItem[], newJobs: ProcessingJobItem[]): void {
    const existingLeadsMap = new Map<string, CrmLeadItem>();
    this.data.leads.forEach((l) => {
      existingLeadsMap.set(l.leadRef, l);
    });

    const existingJobsMap = new Map<string, ProcessingJobItem>();
    this.data.jobs.forEach((j) => {
      existingJobsMap.set(j.leadRef, j);
    });

    // Upsert all CRM leads while preserving existing local metadata
    newLeads.forEach((nl) => {
      const existing = existingLeadsMap.get(nl.leadRef);
      if (existing) {
        existingLeadsMap.set(nl.leadRef, {
          ...existing,
          ...nl,
          recordings: (nl.recordings && nl.recordings.length > 0) ? nl.recordings : existing.recordings,
          syncedAt: new Date().toISOString(),
        });
      } else {
        existingLeadsMap.set(nl.leadRef, nl);
      }
    });

    // Sync queue jobs: only add new job if no job already exists for the lead
    newJobs.forEach((nj) => {
      const existingJob = existingJobsMap.get(nj.leadRef);
      if (!existingJob) {
        existingJobsMap.set(nj.leadRef, nj);
      }
    });

    this.data.leads = Array.from(existingLeadsMap.values());
    this.data.jobs = Array.from(existingJobsMap.values());
    this.persist();
  }

  public replacePendingLeadsAndJobs(newLeads: CrmLeadItem[], newJobs: ProcessingJobItem[]): void {
    this.upsertLeadsAndSyncJobs(newLeads, newJobs);
  }

  public isQueueEligible(lead: CrmLeadItem, job?: ProcessingJobItem): boolean {
    const rawStatus = (
      lead.qaStatusCrm ||
      lead.rawLeadData?.qa_status ||
      lead.rawLeadData?.quality_status ||
      ''
    ).toString().trim().toLowerCase();

    const isPendingQa = rawStatus.includes('pending');
    const hasRecording = !!(lead.recordingUrl || (lead.recordings && lead.recordings.length > 0));
    const isCompleted = job?.status === 'COMPLETED' || !!job?.editedTranscript;
    const isActiveOrQueued = job && ['PENDING', 'QUEUED', 'AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'].includes(job.status);

    return isPendingQa && hasRecording && !isCompleted && !isActiveOrQueued;
  }

  public getLeadByRef(leadRef: string): CrmLeadItem | undefined {
    return this.data.leads.find((l) => l.leadRef === leadRef || l.id === leadRef || l.crmLeadId === leadRef);
  }

  public saveLead(lead: CrmLeadItem, autoPersist: boolean = true): CrmLeadItem {
    const idx = this.data.leads.findIndex((l) => l.leadRef === lead.leadRef || l.id === lead.id);
    if (idx >= 0) {
      this.data.leads[idx] = { ...this.data.leads[idx], ...lead };
    } else {
      this.data.leads.push(lead);
    }
    if (autoPersist) this.persist();
    return lead;
  }

  // Processing Jobs
  public getJobs(): ProcessingJobItem[] {
    const leadsMap = new Map<string, CrmLeadItem>();
    this.data.leads.forEach((l) => {
      if (l.id) leadsMap.set(l.id, l);
      if (l.leadRef) leadsMap.set(l.leadRef, l);
    });

    const clientsMap = new Map<string, ClientConfig>();
    this.data.clients.forEach((c) => {
      clientsMap.set(c.code.trim().toUpperCase(), c);
    });

    const campaignsMap = new Map<string, CampaignConfig>();
    this.data.campaigns.forEach((cmp) => {
      campaignsMap.set(cmp.code.trim().toUpperCase(), cmp);
    });

    const mappedJobs = this.data.jobs.map((job) => {
      const lead = leadsMap.get(job.leadId) || leadsMap.get(job.leadRef);
      const client = lead ? clientsMap.get(lead.clientCode.trim().toUpperCase()) : undefined;
      const campaign = lead ? campaignsMap.get(lead.campaignCode.trim().toUpperCase()) : undefined;
      return {
        ...job,
        lead,
        client,
        campaign,
      };
    });

    return mappedJobs.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.lead?.createdAt || a.lead?.syncedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.lead?.createdAt || b.lead?.syncedAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }

  public getJobById(id: string): ProcessingJobItem | undefined {
    const rawJob = this.data.jobs.find((j) => j.id === id || j.leadRef === id || j.leadId === id);
    if (!rawJob) return undefined;

    const lead = this.data.leads.find((l) => l.id === rawJob.leadId || l.leadRef === rawJob.leadRef);
    const client = lead ? this.getClientByCode(lead.clientCode) : undefined;
    const campaign = lead ? this.getCampaignByCode(lead.campaignCode) : undefined;
    const auditLogs = this.getAuditLogs(rawJob.id);

    return {
      ...rawJob,
      lead,
      client,
      campaign,
      auditLogs,
    };
  }

  public saveJob(job: ProcessingJobItem, autoPersist: boolean = true): ProcessingJobItem {
    const idx = this.data.jobs.findIndex((j) => j.id === job.id);
    const cleanJob: ProcessingJobItem = {
      ...job,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      this.data.jobs[idx] = cleanJob;
    } else {
      this.data.jobs.push(cleanJob);
    }
    if (autoPersist) this.persist();
    return cleanJob;
  }

  // Audit Logs
  public addAuditLog(jobId: string | undefined, action: string, details: string, autoPersist: boolean = true): AuditLogItem {
    const log: AuditLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      jobId,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 300) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 300);
    }
    if (autoPersist) this.persist();
    return log;
  }

  public persistStore(): void {
    this.persist();
  }

  public getAuditLogs(jobId?: string, limit: number = 100): AuditLogItem[] {
    let logs = this.data.auditLogs;
    if (jobId) {
      logs = logs.filter((l) => l.jobId === jobId);
    }
    if (limit > 0) {
      return logs.slice(0, limit);
    }
    return logs;
  }

  // Analytics Calculation
  public getAnalytics(days?: number, clientCodeFilter?: string, campaignCodeFilter?: string) {
    const jobs = this.getJobs().filter((j) => {
      if (clientCodeFilter && clientCodeFilter !== 'ALL') {
        if (j.lead?.clientCode.trim().toUpperCase() !== clientCodeFilter.trim().toUpperCase()) return false;
      }
      if (campaignCodeFilter && campaignCodeFilter !== 'ALL') {
        if (j.lead?.campaignCode.trim().toUpperCase() !== campaignCodeFilter.trim().toUpperCase()) return false;
      }
      if (days && days > 0) {
        const cutoff = Date.now() - days * 86400000;
        if (new Date(j.createdAt).getTime() < cutoff) return false;
      }
      return true;
    });

    const settings = this.getSettings();

    const totalRecordingsProcessed = jobs.length;
    const totalRawTranscripts = jobs.filter((j) => j.rawTranscript).length;
    const totalEditedTranscripts = jobs.filter((j) => j.editedTranscript).length;

    let totalAudioDurationSeconds = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalProcessingDurationMs = 0;

    jobs.forEach((j) => {
      const duration = j.rawTranscript?.durationSeconds || j.lead?.durationSeconds || 45;
      totalAudioDurationSeconds += duration;

      const pTokens = j.promptTokens || Math.round(duration * 12);
      const cTokens = j.completionTokens || Math.round(duration * 4);
      totalInputTokens += pTokens;
      totalOutputTokens += cTokens;
      totalProcessingDurationMs += j.processingDurationMs || (duration > 0 ? duration * 100 : 3500);
    });

    const totalSttUsageMinutes = Number((totalAudioDurationSeconds / 60).toFixed(2));
    const totalGeminiTokens = totalInputTokens + totalOutputTokens;

    const estimatedSttCost = Number((totalSttUsageMinutes * (settings.sttCostPerMinute || 0.016)).toFixed(4));
    const estimatedGeminiCost = Number(
      (
        (totalInputTokens / 1_000_000) * (settings.geminiInputCostPer1M || 0.075) +
        (totalOutputTokens / 1_000_000) * (settings.geminiOutputCostPer1M || 0.30)
      ).toFixed(4)
    );
    const totalEstimatedCost = Number((estimatedSttCost + estimatedGeminiCost).toFixed(4));

    const completedJobsCount = jobs.filter((j) => j.status === 'COMPLETED').length;
    const successPercentage = totalRecordingsProcessed > 0 ? Number(((completedJobsCount / totalRecordingsProcessed) * 100).toFixed(1)) : 100;
    const avgProcessingDurationSeconds = totalRecordingsProcessed > 0 ? Number((totalProcessingDurationMs / totalRecordingsProcessed / 1000).toFixed(1)) : 0;

    // Daily breakdown
    const dateMap: Record<string, { raw: number; edited: number; durationSeconds: number; tokens: number }> = {};
    jobs.forEach((j) => {
      const dateKey = j.createdAt.slice(0, 10);
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { raw: 0, edited: 0, durationSeconds: 0, tokens: 0 };
      }
      if (j.rawTranscript) dateMap[dateKey].raw++;
      if (j.editedTranscript) dateMap[dateKey].edited++;
      const dur = j.rawTranscript?.durationSeconds || 45;
      dateMap[dateKey].durationSeconds += dur;
      dateMap[dateKey].tokens += (j.promptTokens || dur * 12) + (j.completionTokens || dur * 4);
    });

    const sortedDates = Object.keys(dateMap).sort();
    const dailyActivity = sortedDates.map((d) => ({ date: d, count: dateMap[d].raw }));
    const rawVsEdited = sortedDates.map((d) => ({ date: d, raw: dateMap[d].raw, edited: dateMap[d].edited }));
    const recordingDurationOverTime = sortedDates.map((d) => ({ date: d, durationMinutes: Number((dateMap[d].durationSeconds / 60).toFixed(1)) }));
    const apiUsageOverTime = sortedDates.map((d) => ({ date: d, sttMinutes: Number((dateMap[d].durationSeconds / 60).toFixed(1)), tokens: dateMap[d].tokens }));

    // Client Breakdown
    const clientMap: Record<string, { name: string; count: number; qualifiedCount: number }> = {};
    jobs.forEach((j) => {
      const code = j.lead?.clientCode || 'UNKNOWN';
      const name = j.client?.name || code;
      if (!clientMap[code]) clientMap[code] = { name, count: 0, qualifiedCount: 0 };
      clientMap[code].count++;
      if ((j.manualOverrideStatus || j.qaStatus) === 'QUALIFIED') {
        clientMap[code].qualifiedCount++;
      }
    });
    const clientAnalytics = Object.keys(clientMap).map((code) => ({
      clientCode: code,
      clientName: clientMap[code].name,
      count: clientMap[code].count,
      qualifiedCount: clientMap[code].qualifiedCount,
    }));

    // Campaign Breakdown
    const campaignMap: Record<string, { name: string; count: number }> = {};
    jobs.forEach((j) => {
      const code = j.lead?.campaignCode || 'UNKNOWN';
      const name = j.campaign?.name || code;
      if (!campaignMap[code]) campaignMap[code] = { name, count: 0 };
      campaignMap[code].count++;
    });
    const campaignAnalytics = Object.keys(campaignMap).map((code) => ({
      campaignCode: code,
      campaignName: campaignMap[code].name,
      count: campaignMap[code].count,
    }));

    // Status distribution
    const statusCounts: Record<string, number> = {
      COMPLETED: jobs.filter((j) => j.status === 'COMPLETED').length,
      PENDING: jobs.filter((j) => j.status === 'PENDING').length,
      TRANSCRIBING: jobs.filter((j) => j.status === 'TRANSCRIBING').length,
      AI_EDITING: jobs.filter((j) => j.status === 'AI_EDITING').length,
      QA_EVALUATING: jobs.filter((j) => j.status === 'QA_EVALUATING').length,
      FAILED: jobs.filter((j) => j.status === 'FAILED').length,
    };
    const statusDistribution = Object.keys(statusCounts).map((status) => ({
      status,
      count: statusCounts[status],
    }));

    return {
      totalRecordingsProcessed,
      totalRawTranscripts,
      totalEditedTranscripts,
      totalAudioDurationSeconds,
      totalSttUsageMinutes,
      totalInputTokens,
      totalOutputTokens,
      totalGeminiTokens,
      estimatedSttCost,
      estimatedGeminiCost,
      totalEstimatedCost,
      avgProcessingDurationSeconds,
      successPercentage,
      dailyActivity,
      rawVsEdited,
      recordingDurationOverTime,
      apiUsageOverTime,
      clientAnalytics,
      campaignAnalytics,
      statusDistribution,
    };
  }
}

export const dbStore = LocalDbStore.getInstance();
