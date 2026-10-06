import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
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

const INITIAL_CLIENTS: ClientConfig[] = [];
const INITIAL_CAMPAIGNS: CampaignConfig[] = [];
const INITIAL_LEADS: CrmLeadItem[] = [];
const INITIAL_JOBS: ProcessingJobItem[] = [];
const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

function safeParseJson<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function safeStringify(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

async function withDbTimeout<T>(promise: Promise<T>, timeoutMs: number = 2500): Promise<T | null> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    return res;
  } catch (e) {
    console.warn('Prisma DB connection timeout or error:', e);
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

export class LocalDbStore {
  private static instance: LocalDbStore;

  private data: LocalStoreData = {
    clients: [],
    campaigns: [],
    leads: [],
    jobs: [],
    auditLogs: [],
    clientPrompts: [],
    settings: DEFAULT_SETTINGS,
  };

  private isDbInitialized = false;

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
        const raw = fs.readFileSync(STORE_FILE, 'utf-8').trim();
        if (raw) {
          this.data = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.error('Local JSON init fallback error:', e);
    }

    // Hydrate & Sync asynchronously from Prisma DB with timeout protection
    this.syncFromDb().catch((err) => {
      console.warn('Failed async initial DB sync:', err);
    });
  }

  public async syncFromDb(): Promise<void> {
    try {
      // System Settings
      const dbSettings = await withDbTimeout(prisma.systemSettings.findUnique({ where: { id: 'global' } }));
      if (dbSettings) {
        this.data.settings = {
          id: dbSettings.id,
          crmEndpoint: dbSettings.crmEndpoint,
          crmApiKey: dbSettings.crmApiKey,
          sttProvider: 'gemini',
          sttApiKey: '',
          gcsBucketName: dbSettings.gcsBucketName,
          gcpProjectId: dbSettings.gcpProjectId,
          gcpClientEmail: dbSettings.gcpClientEmail,
          gcpPrivateKey: dbSettings.gcpPrivateKey,
          sttLanguageCode: dbSettings.sttLanguageCode,
          sttModel: dbSettings.sttModel,
          sttDiarizationEnabled: dbSettings.sttDiarizationEnabled,
          geminiApiKey: dbSettings.geminiApiKey,
          geminiModel: dbSettings.geminiModel,
          geminiTemperature: dbSettings.geminiTemperature,
          geminiMaxTokens: dbSettings.geminiMaxTokens,
          maxConcurrency: dbSettings.maxConcurrency,
          autoSyncInterval: dbSettings.autoSyncInterval,
          autoGenerateTranscripts: dbSettings.autoGenerateTranscripts,
          autoQaEvaluation: dbSettings.autoQaEvaluation,
          isProcessingPaused: false,
          audioRetentionDays: dbSettings.audioRetentionDays,
          sttCostPerMinute: dbSettings.sttCostPerMinute,
          geminiInputCostPer1M: dbSettings.geminiInputCostPer1M,
          geminiOutputCostPer1M: dbSettings.geminiOutputCostPer1M,
          updatedAt: dbSettings.updatedAt.toISOString(),
        };
      }

      // Clients
      const dbClients = await withDbTimeout(prisma.client.findMany({ include: { campaigns: true } }));
      if (dbClients && dbClients.length > 0) {
        this.data.clients = dbClients.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          globalPrompt: c.globalPrompt,
          qualificationCriteria: c.qualificationCriteria,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));
      }

      // Campaigns
      const dbCampaigns = await withDbTimeout(prisma.campaign.findMany());
      if (dbCampaigns && dbCampaigns.length > 0) {
        this.data.campaigns = dbCampaigns.map((cmp) => ({
          id: cmp.id,
          name: cmp.name,
          code: cmp.code,
          clientCode: cmp.clientCode,
          assetTitle: cmp.assetTitle,
          valueProps: safeParseJson<string[]>(cmp.valueProps, []),
          additionalEditingInstructions: cmp.additionalEditingInstructions,
          qualificationRulesOverride: cmp.qualificationRulesOverride || '',
          isActive: cmp.isActive,
          createdAt: cmp.createdAt.toISOString(),
          updatedAt: cmp.updatedAt.toISOString(),
        }));
      } else if (INITIAL_CAMPAIGNS.length > 0) {
        for (const cmp of INITIAL_CAMPAIGNS) {
          await this.persistCampaignToDb(cmp);
        }
      }

      // Client Prompt Versions
      const dbPrompts = await withDbTimeout(prisma.clientPromptVersion.findMany());
      if (dbPrompts && dbPrompts.length > 0) {
        this.data.clientPrompts = dbPrompts.map((p) => ({
          id: p.id,
          clientId: p.clientCode,
          clientCode: p.clientCode,
          promptType: 'TRANSCRIPT_EDITING' as const,
          promptText: p.promptText,
          qualificationCriteria: p.qualificationCriteria,
          version: p.version,
          createdBy: p.createdBy,
          createdAt: p.createdAt.toISOString(),
          isActive: true,
        }));
      }

      // CRM Leads
      const dbLeads = await withDbTimeout(prisma.crmLead.findMany());
      if (dbLeads) {
        this.data.leads = dbLeads.map((l) => ({
          id: l.id,
          leadRef: l.leadRef,
          clientCode: l.clientCode,
          campaignCode: l.campaignCode,
          campaignName: l.campaignName || '',
          agentId: l.agentId || '',
          agentName: l.agentName || '',
          contactName: l.contactName,
          companyName: l.companyName,
          companySize: l.companySize || '',
          industry: l.industry || '',
          country: l.country || '',
          jobTitle: l.jobTitle || '',
          email: l.email || '',
          phone: l.phone || '',
          recordingUrl: l.recordingUrl,
          qaStatusCrm: l.qaStatusCrm || 'Pending',
          rawLeadData: safeParseJson<any>(l.rawLeadData, null),
          syncedAt: l.syncedAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        }));
      }

      // Processing Jobs
      const dbJobs = await withDbTimeout(prisma.processingJob.findMany());
      if (dbJobs) {
        this.data.jobs = dbJobs.map((j) => ({
          id: j.id,
          leadId: j.leadId,
          leadRef: j.leadRef,
          status: j.status as any,
          stepError: j.stepError || undefined,
          gcsAudioUri: j.gcsAudioUri || undefined,
          rawTranscript: safeParseJson<any>(j.rawTranscript, j.rawTranscript || undefined),
          editedTranscript: safeParseJson<any>(j.editedTranscript, j.editedTranscript || undefined),
          promptVersionUsed: j.promptVersionUsed || undefined,
          qaStatus: (j.qaStatus as any) || undefined,
          qaResultJson: safeParseJson<any>(j.qaResultJson, j.qaResultJson || undefined),
          manualOverrideStatus: (j.manualOverrideStatus as any) || undefined,
          manualOverrideNotes: j.manualOverrideNotes || undefined,
          reviewedBy: j.reviewedBy || undefined,
          reviewedAt: j.reviewedAt ? j.reviewedAt.toISOString() : undefined,
          attempts: j.attempts,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        }));
      }

      // Audit Logs
      const dbAuditLogs = await withDbTimeout(prisma.auditLog.findMany({ take: 300, orderBy: { timestamp: 'desc' } }));
      if (dbAuditLogs) {
        this.data.auditLogs = dbAuditLogs.map((a) => ({
          id: a.id,
          jobId: a.jobId || undefined,
          action: a.action,
          details: a.details,
          timestamp: a.timestamp.toISOString(),
        }));
      }

      this.isDbInitialized = true;
      this.persistLocalFile();
    } catch (err) {
      console.error('Error syncing store from Prisma database:', err);
    }
  }

  private persistLocalFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing store file backup:', e);
    }
  }

  private persist() {
    this.persistLocalFile();
  }

  // Database Persistence Helpers
  private async persistSettingsToDb(settings: SystemSettingsConfig): Promise<void> {
    try {
      await prisma.systemSettings.upsert({
        where: { id: 'global' },
        update: {
          crmEndpoint: settings.crmEndpoint,
          crmApiKey: settings.crmApiKey,
          gcsBucketName: settings.gcsBucketName,
          gcpProjectId: settings.gcpProjectId,
          gcpClientEmail: settings.gcpClientEmail,
          gcpPrivateKey: settings.gcpPrivateKey,
          sttLanguageCode: settings.sttLanguageCode,
          sttModel: settings.sttModel,
          sttDiarizationEnabled: settings.sttDiarizationEnabled,
          geminiApiKey: settings.geminiApiKey,
          geminiModel: settings.geminiModel,
          geminiTemperature: settings.geminiTemperature,
          geminiMaxTokens: settings.geminiMaxTokens,
          maxConcurrency: settings.maxConcurrency,
          autoSyncInterval: settings.autoSyncInterval,
          autoGenerateTranscripts: settings.autoGenerateTranscripts,
          autoQaEvaluation: settings.autoQaEvaluation,
          audioRetentionDays: settings.audioRetentionDays,
          sttCostPerMinute: settings.sttCostPerMinute,
          geminiInputCostPer1M: settings.geminiInputCostPer1M,
          geminiOutputCostPer1M: settings.geminiOutputCostPer1M,
        },
        create: {
          id: 'global',
          crmEndpoint: settings.crmEndpoint,
          crmApiKey: settings.crmApiKey,
          gcsBucketName: settings.gcsBucketName,
          gcpProjectId: settings.gcpProjectId,
          gcpClientEmail: settings.gcpClientEmail,
          gcpPrivateKey: settings.gcpPrivateKey,
          sttLanguageCode: settings.sttLanguageCode,
          sttModel: settings.sttModel,
          sttDiarizationEnabled: settings.sttDiarizationEnabled,
          geminiApiKey: settings.geminiApiKey,
          geminiModel: settings.geminiModel,
          geminiTemperature: settings.geminiTemperature,
          geminiMaxTokens: settings.geminiMaxTokens,
          maxConcurrency: settings.maxConcurrency,
          autoSyncInterval: settings.autoSyncInterval,
          autoGenerateTranscripts: settings.autoGenerateTranscripts,
          autoQaEvaluation: settings.autoQaEvaluation,
          audioRetentionDays: settings.audioRetentionDays,
          sttCostPerMinute: settings.sttCostPerMinute,
          geminiInputCostPer1M: settings.geminiInputCostPer1M,
          geminiOutputCostPer1M: settings.geminiOutputCostPer1M,
        },
      });
    } catch (e) {
      console.error('Prisma persistSettings error:', e);
    }
  }

  private async persistClientToDb(client: ClientConfig): Promise<void> {
    try {
      await prisma.client.upsert({
        where: { code: client.code },
        update: {
          name: client.name,
          globalPrompt: client.globalPrompt,
          qualificationCriteria: client.qualificationCriteria,
          isActive: client.isActive,
        },
        create: {
          id: client.id,
          name: client.name,
          code: client.code,
          globalPrompt: client.globalPrompt,
          qualificationCriteria: client.qualificationCriteria,
          isActive: client.isActive,
        },
      });
    } catch (e) {
      console.error('Prisma persistClient error:', e);
    }
  }

  private async persistCampaignToDb(cmp: CampaignConfig): Promise<void> {
    try {
      await prisma.campaign.upsert({
        where: { code: cmp.code },
        update: {
          name: cmp.name,
          clientCode: cmp.clientCode,
          assetTitle: cmp.assetTitle,
          valueProps: safeStringify(cmp.valueProps),
          additionalEditingInstructions: cmp.additionalEditingInstructions,
          qualificationRulesOverride: cmp.qualificationRulesOverride || null,
          isActive: cmp.isActive,
        },
        create: {
          id: cmp.id,
          name: cmp.name,
          code: cmp.code,
          clientCode: cmp.clientCode,
          assetTitle: cmp.assetTitle,
          valueProps: safeStringify(cmp.valueProps),
          additionalEditingInstructions: cmp.additionalEditingInstructions,
          qualificationRulesOverride: cmp.qualificationRulesOverride || null,
          isActive: cmp.isActive,
        },
      });
    } catch (e) {
      console.error('Prisma persistCampaign error:', e);
    }
  }

  private async persistLeadToDb(lead: CrmLeadItem): Promise<void> {
    try {
      await prisma.crmLead.upsert({
        where: { leadRef: lead.leadRef },
        update: {
          clientCode: lead.clientCode,
          campaignCode: lead.campaignCode,
          campaignName: lead.campaignName || null,
          agentId: lead.agentId || null,
          agentName: lead.agentName || null,
          contactName: lead.contactName,
          companyName: lead.companyName,
          companySize: lead.companySize || null,
          industry: lead.industry || null,
          country: lead.country || null,
          jobTitle: lead.jobTitle || null,
          email: lead.email || null,
          phone: lead.phone || null,
          recordingUrl: lead.recordingUrl || '',
          qaStatusCrm: lead.qaStatusCrm || null,
          rawLeadData: lead.rawLeadData ? safeStringify(lead.rawLeadData) : null,
          syncedAt: new Date(lead.syncedAt || Date.now()),
        },
        create: {
          id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          leadRef: lead.leadRef,
          clientCode: lead.clientCode,
          campaignCode: lead.campaignCode,
          campaignName: lead.campaignName || null,
          agentId: lead.agentId || null,
          agentName: lead.agentName || null,
          contactName: lead.contactName,
          companyName: lead.companyName,
          companySize: lead.companySize || null,
          industry: lead.industry || null,
          country: lead.country || null,
          jobTitle: lead.jobTitle || null,
          email: lead.email || null,
          phone: lead.phone || null,
          recordingUrl: lead.recordingUrl || '',
          qaStatusCrm: lead.qaStatusCrm || null,
          rawLeadData: lead.rawLeadData ? safeStringify(lead.rawLeadData) : null,
          syncedAt: new Date(lead.syncedAt || Date.now()),
        },
      });
    } catch (e) {
      console.error('Prisma persistLead error:', e);
    }
  }

  private async persistJobToDb(job: ProcessingJobItem): Promise<void> {
    try {
      await prisma.processingJob.upsert({
        where: { id: job.id },
        update: {
          leadId: job.leadId,
          leadRef: job.leadRef,
          status: job.status,
          stepError: job.stepError || null,
          gcsAudioUri: job.gcsAudioUri || null,
          rawTranscript: job.rawTranscript ? safeStringify(job.rawTranscript) : null,
          editedTranscript: job.editedTranscript ? safeStringify(job.editedTranscript) : null,
          promptVersionUsed: job.promptVersionUsed || null,
          qaStatus: job.qaStatus || null,
          qaResultJson: job.qaResultJson ? safeStringify(job.qaResultJson) : null,
          manualOverrideStatus: job.manualOverrideStatus || null,
          manualOverrideNotes: job.manualOverrideNotes || null,
          reviewedBy: job.reviewedBy || null,
          reviewedAt: job.reviewedAt ? new Date(job.reviewedAt) : null,
          attempts: job.attempts || 0,
        },
        create: {
          id: job.id,
          leadId: job.leadId,
          leadRef: job.leadRef,
          status: job.status,
          stepError: job.stepError || null,
          gcsAudioUri: job.gcsAudioUri || null,
          rawTranscript: job.rawTranscript ? safeStringify(job.rawTranscript) : null,
          editedTranscript: job.editedTranscript ? safeStringify(job.editedTranscript) : null,
          promptVersionUsed: job.promptVersionUsed || null,
          qaStatus: job.qaStatus || null,
          qaResultJson: job.qaResultJson ? safeStringify(job.qaResultJson) : null,
          manualOverrideStatus: job.manualOverrideStatus || null,
          manualOverrideNotes: job.manualOverrideNotes || null,
          reviewedBy: job.reviewedBy || null,
          reviewedAt: job.reviewedAt ? new Date(job.reviewedAt) : null,
          attempts: job.attempts || 0,
        },
      });
    } catch (e) {
      console.error('Prisma persistJob error:', e);
    }
  }

  private async persistAuditLogToDb(log: AuditLogItem): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: log.id,
          jobId: log.jobId || null,
          action: log.action,
          details: log.details,
          timestamp: new Date(log.timestamp),
        },
      });
    } catch (e) {
      console.error('Prisma persistAuditLog error:', e);
    }
  }

  private async persistPromptVersionToDb(pv: ClientPromptVersion): Promise<void> {
    try {
      await prisma.clientPromptVersion.create({
        data: {
          id: pv.id,
          clientCode: pv.clientCode,
          version: pv.version || 1,
          promptText: pv.promptText,
          qualificationCriteria: pv.qualificationCriteria || '',
          createdBy: pv.createdBy || 'System Admin',
          createdAt: new Date(pv.createdAt || Date.now()),
        },
      });
    } catch (e) {
      console.error('Prisma persistPromptVersion error:', e);
    }
  }

  // System Settings
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
    this.persistSettingsToDb(this.data.settings).catch(console.error);
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

      this.data.clientPrompts.forEach((cp) => {
        if (cp.clientId === clientId || cp.clientCode === code) {
          cp.isActive = false;
        }
      });

      const newPv: ClientPromptVersion = {
        id: `cpv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clientId,
        clientCode: code,
        promptType: 'TRANSCRIPT_EDITING',
        promptText: newPromptText,
        qualificationCriteria: clientData.qualificationCriteria || existingClient?.qualificationCriteria || '',
        version: currentPromptVersion,
        isActive: true,
        createdBy,
        createdAt: new Date().toISOString(),
      };
      this.data.clientPrompts.push(newPv);
      this.persistPromptVersionToDb(newPv).catch(console.error);
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
    this.persistClientToDb(updated).catch(console.error);

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
    prisma.client.deleteMany({ where: { code: code.trim().toUpperCase() } }).catch(console.error);
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
    if (autoPersist) {
      this.persist();
      this.persistCampaignToDb(updated).catch(console.error);
    }
    return updated;
  }

  public deleteCampaign(code: string): boolean {
    const initialLen = this.data.campaigns.length;
    this.data.campaigns = this.data.campaigns.filter((cmp) => cmp.code.trim().toUpperCase() !== code.trim().toUpperCase());
    this.persist();
    prisma.campaign.deleteMany({ where: { code: code.trim().toUpperCase() } }).catch(console.error);
    return this.data.campaigns.length < initialLen;
  }

  // CRM Leads
  public getLeads(): CrmLeadItem[] {
    return this.data.leads;
  }

  public saveLead(lead: CrmLeadItem): CrmLeadItem {
    this.upsertLeadsAndSyncJobs([lead], []);
    return lead;
  }

  public clearLeadsAndJobs(autoPersist: boolean = true): void {
    this.data.leads = [];
    this.data.jobs = [];
    if (autoPersist) {
      this.persist();
      prisma.processingJob.deleteMany({}).catch(console.error);
      prisma.crmLead.deleteMany({}).catch(console.error);
    }
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

    newLeads.forEach((nl) => {
      const existing = existingLeadsMap.get(nl.leadRef);
      const mergedLead: CrmLeadItem = existing
        ? {
            ...existing,
            ...nl,
            recordings: (nl.recordings && nl.recordings.length > 0) ? nl.recordings : existing.recordings,
            syncedAt: new Date().toISOString(),
          }
        : nl;
      existingLeadsMap.set(nl.leadRef, mergedLead);
      this.persistLeadToDb(mergedLead).catch(console.error);
    });

    newJobs.forEach((nj) => {
      const existingJob = existingJobsMap.get(nj.leadRef);
      if (!existingJob) {
        existingJobsMap.set(nj.leadRef, nj);
        this.persistJobToDb(nj).catch(console.error);
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
    return this.data.leads.find((l) => l.leadRef === leadRef);
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
    if (autoPersist) {
      this.persist();
      this.persistJobToDb(cleanJob).catch(console.error);
    }
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
    if (autoPersist) {
      this.persist();
      this.persistAuditLogToDb(log).catch(console.error);
    }
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

    let qualifiedCount = 0;
    let needsReviewCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    let under1Min = 0;
    let oneTo3Min = 0;
    let threeTo5Min = 0;
    let over5Min = 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
    const sevenDaysAgoCutoff = Date.now() - 7 * 86400000;
    const fourteenDaysAgoCutoff = Date.now() - 14 * 86400000;

    let todayLeadsCount = 0;
    let yesterdayLeadsCount = 0;
    let thisWeekLeadsCount = 0;
    let lastWeekLeadsCount = 0;

    jobs.forEach((j) => {
      const duration = j.rawTranscript?.durationSeconds || j.lead?.durationSeconds || 45;
      totalAudioDurationSeconds += duration;

      const pTokens = j.promptTokens || Math.round(duration * 12);
      const cTokens = j.completionTokens || Math.round(duration * 4);
      totalInputTokens += pTokens;
      totalOutputTokens += cTokens;
      totalProcessingDurationMs += j.processingDurationMs || (duration > 0 ? duration * 100 : 3500);

      const effectiveQa = (j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm || 'PENDING').toUpperCase();
      if (effectiveQa.includes('QUALIFIED')) {
        qualifiedCount++;
      } else if (effectiveQa.includes('REVIEW')) {
        needsReviewCount++;
      } else if (effectiveQa.includes('REJECTED') || effectiveQa.includes('DISQUALIFIED') || effectiveQa.includes('UNQUALIFIED')) {
        rejectedCount++;
      } else {
        pendingCount++;
      }

      if (duration < 60) under1Min++;
      else if (duration < 180) oneTo3Min++;
      else if (duration < 300) threeTo5Min++;
      else over5Min++;

      const createdAtMs = new Date(j.createdAt).getTime();
      const jobDateStr = j.createdAt.slice(0, 10);
      if (jobDateStr === todayStr) todayLeadsCount++;
      if (jobDateStr === yesterdayStr) yesterdayLeadsCount++;
      if (createdAtMs >= sevenDaysAgoCutoff) thisWeekLeadsCount++;
      else if (createdAtMs >= fourteenDaysAgoCutoff) lastWeekLeadsCount++;
    });

    const totalSttUsageMinutes = Number((totalAudioDurationSeconds / 60).toFixed(2));
    const totalGeminiTokens = totalInputTokens + totalOutputTokens;

    const sttRate = settings.sttCostPerMinute || 0.016;
    const geminiInRate = settings.geminiInputCostPer1M || 0.075;
    const geminiOutRate = settings.geminiOutputCostPer1M || 0.30;

    const estimatedSttCost = Number((totalSttUsageMinutes * sttRate).toFixed(4));
    const estimatedGeminiCost = Number(
      (
        (totalInputTokens / 1_000_000) * geminiInRate +
        (totalOutputTokens / 1_000_000) * geminiOutRate
      ).toFixed(4)
    );
    const totalEstimatedCost = Number((estimatedSttCost + estimatedGeminiCost).toFixed(4));

    const completedJobsCount = jobs.filter((j) => j.status === 'COMPLETED').length;
    const successPercentage = totalRecordingsProcessed > 0 ? Number(((completedJobsCount / totalRecordingsProcessed) * 100).toFixed(1)) : 100;
    const avgProcessingDurationSeconds = totalRecordingsProcessed > 0 ? Number((totalProcessingDurationMs / totalRecordingsProcessed / 1000).toFixed(1)) : 0;

    const todayGrowthPercent = yesterdayLeadsCount > 0 ? Number((((todayLeadsCount - yesterdayLeadsCount) / yesterdayLeadsCount) * 100).toFixed(1)) : todayLeadsCount > 0 ? 100 : 0;
    const weeklyGrowthPercent = lastWeekLeadsCount > 0 ? Number((((thisWeekLeadsCount - lastWeekLeadsCount) / lastWeekLeadsCount) * 100).toFixed(1)) : thisWeekLeadsCount > 0 ? 100 : 0;

    const avgCostPerLead = totalRecordingsProcessed > 0 ? Number((totalEstimatedCost / totalRecordingsProcessed).toFixed(4)) : 0;
    const avgCostPerQualifiedLead = qualifiedCount > 0 ? Number((totalEstimatedCost / qualifiedCount).toFixed(4)) : 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateMap: Record<string, {
      raw: number;
      edited: number;
      durationSeconds: number;
      tokens: number;
      qualified: number;
      needsReview: number;
      pending: number;
      disqualified: number;
      pTokens: number;
      cTokens: number;
    }> = {};

    jobs.forEach((j) => {
      const dateKey = j.createdAt.slice(0, 10);
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          raw: 0,
          edited: 0,
          durationSeconds: 0,
          tokens: 0,
          qualified: 0,
          needsReview: 0,
          pending: 0,
          disqualified: 0,
          pTokens: 0,
          cTokens: 0,
        };
      }
      dateMap[dateKey].raw++;
      if (j.editedTranscript) dateMap[dateKey].edited++;
      const dur = j.rawTranscript?.durationSeconds || j.lead?.durationSeconds || 45;
      dateMap[dateKey].durationSeconds += dur;
      const pT = j.promptTokens || Math.round(dur * 12);
      const cT = j.completionTokens || Math.round(dur * 4);
      dateMap[dateKey].pTokens += pT;
      dateMap[dateKey].cTokens += cT;
      dateMap[dateKey].tokens += (pT + cT);

      const effectiveQa = (j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm || 'PENDING').toUpperCase();
      if (effectiveQa.includes('QUALIFIED')) dateMap[dateKey].qualified++;
      else if (effectiveQa.includes('REVIEW')) dateMap[dateKey].needsReview++;
      else if (effectiveQa.includes('REJECTED') || effectiveQa.includes('DISQUALIFIED') || effectiveQa.includes('UNQUALIFIED')) dateMap[dateKey].disqualified++;
      else dateMap[dateKey].pending++;
    });

    const sortedDates = Object.keys(dateMap).sort();
    const dailyActivity = sortedDates.map((d) => ({ date: d, count: dateMap[d].raw }));
    const rawVsEdited = sortedDates.map((d) => ({ date: d, raw: dateMap[d].raw, edited: dateMap[d].edited }));
    const recordingDurationOverTime = sortedDates.map((d) => ({ date: d, durationMinutes: Number((dateMap[d].durationSeconds / 60).toFixed(1)) }));
    const apiUsageOverTime = sortedDates.map((d) => ({ date: d, sttMinutes: Number((dateMap[d].durationSeconds / 60).toFixed(1)), tokens: dateMap[d].tokens }));

    const dailyLeadVelocity = sortedDates.map((d) => {
      const dt = new Date(d);
      const dayName = isNaN(dt.getTime()) ? 'Day' : dayNames[dt.getDay()];
      const sttMins = dateMap[d].durationSeconds / 60;
      const daySttCost = sttMins * sttRate;
      const dayGeminiCost = (dateMap[d].pTokens / 1_000_000) * geminiInRate + (dateMap[d].cTokens / 1_000_000) * geminiOutRate;
      return {
        date: d,
        dayName,
        totalLeads: dateMap[d].raw,
        qualified: dateMap[d].qualified,
        needsReview: dateMap[d].needsReview,
        pending: dateMap[d].pending,
        disqualified: dateMap[d].disqualified,
        cost: Number((daySttCost + dayGeminiCost).toFixed(4)),
        sttMinutes: Number(sttMins.toFixed(1)),
      };
    });

    const weekMap: Record<string, { startDate: string; endDate: string; totalLeads: number; qualified: number; needsReview: number; durationSeconds: number; pTokens: number; cTokens: number }> = {};
    sortedDates.forEach((d) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return;
      const dayOfWeek = dt.getDay();
      const sunday = new Date(dt);
      sunday.setDate(dt.getDate() - dayOfWeek);
      const sundayStr = sunday.toISOString().slice(0, 10);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      const saturdayStr = saturday.toISOString().slice(0, 10);

      const weekKey = `Week (${sundayStr.slice(5)} - ${saturdayStr.slice(5)})`;
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          startDate: sundayStr,
          endDate: saturdayStr,
          totalLeads: 0,
          qualified: 0,
          needsReview: 0,
          durationSeconds: 0,
          pTokens: 0,
          cTokens: 0,
        };
      }
      weekMap[weekKey].totalLeads += dateMap[d].raw;
      weekMap[weekKey].qualified += dateMap[d].qualified;
      weekMap[weekKey].needsReview += dateMap[d].needsReview;
      weekMap[weekKey].durationSeconds += dateMap[d].durationSeconds;
      weekMap[weekKey].pTokens += dateMap[d].pTokens;
      weekMap[weekKey].cTokens += dateMap[d].cTokens;
    });

    const weeklyLeadVelocity = Object.keys(weekMap).map((wKey) => {
      const item = weekMap[wKey];
      const sttMins = item.durationSeconds / 60;
      const wSttCost = sttMins * sttRate;
      const wGeminiCost = (item.pTokens / 1_000_000) * geminiInRate + (item.cTokens / 1_000_000) * geminiOutRate;
      return {
        weekLabel: wKey,
        startDate: item.startDate,
        endDate: item.endDate,
        totalLeads: item.totalLeads,
        qualified: item.qualified,
        needsReview: item.needsReview,
        cost: Number((wSttCost + wGeminiCost).toFixed(4)),
      };
    });

    const totalQaEvaluated = qualifiedCount + needsReviewCount + rejectedCount + pendingCount;
    const qualityDistribution = {
      qualified: qualifiedCount,
      needsReview: needsReviewCount,
      pending: pendingCount,
      rejected: rejectedCount,
      qualifiedPercent: totalQaEvaluated > 0 ? Number(((qualifiedCount / totalQaEvaluated) * 100).toFixed(1)) : 0,
      needsReviewPercent: totalQaEvaluated > 0 ? Number(((needsReviewCount / totalQaEvaluated) * 100).toFixed(1)) : 0,
      pendingPercent: totalQaEvaluated > 0 ? Number(((pendingCount / totalQaEvaluated) * 100).toFixed(1)) : 0,
      rejectedPercent: totalQaEvaluated > 0 ? Number(((rejectedCount / totalQaEvaluated) * 100).toFixed(1)) : 0,
    };

    const durationDistribution = {
      under1Min,
      oneTo3Min,
      threeTo5Min,
      over5Min,
      avgDurationSeconds: totalRecordingsProcessed > 0 ? Math.round(totalAudioDurationSeconds / totalRecordingsProcessed) : 0,
    };

    const clientMap: Record<string, { name: string; count: number; qualifiedCount: number; needsReviewCount: number; durationSeconds: number; pTokens: number; cTokens: number }> = {};
    jobs.forEach((j) => {
      const code = j.lead?.clientCode || 'UNKNOWN';
      const name = j.client?.name || code;
      if (!clientMap[code]) {
        clientMap[code] = { name, count: 0, qualifiedCount: 0, needsReviewCount: 0, durationSeconds: 0, pTokens: 0, cTokens: 0 };
      }
      clientMap[code].count++;
      const dur = j.rawTranscript?.durationSeconds || j.lead?.durationSeconds || 45;
      clientMap[code].durationSeconds += dur;
      clientMap[code].pTokens += (j.promptTokens || dur * 12);
      clientMap[code].cTokens += (j.completionTokens || dur * 4);

      const effectiveQa = (j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm || 'PENDING').toUpperCase();
      if (effectiveQa.includes('QUALIFIED')) clientMap[code].qualifiedCount++;
      if (effectiveQa.includes('REVIEW')) clientMap[code].needsReviewCount++;
    });

    const clientAnalytics = Object.keys(clientMap).map((code) => ({
      clientCode: code,
      clientName: clientMap[code].name,
      count: clientMap[code].count,
      qualifiedCount: clientMap[code].qualifiedCount,
    }));

    const clientPerformance = Object.keys(clientMap).map((code) => {
      const item = clientMap[code];
      const sttMins = item.durationSeconds / 60;
      const cSttCost = sttMins * sttRate;
      const cGeminiCost = (item.pTokens / 1_000_000) * geminiInRate + (item.cTokens / 1_000_000) * geminiOutRate;
      return {
        clientCode: code,
        clientName: item.name,
        totalLeads: item.count,
        qualifiedCount: item.qualifiedCount,
        needsReviewCount: item.needsReviewCount,
        conversionRate: item.count > 0 ? Number(((item.qualifiedCount / item.count) * 100).toFixed(1)) : 0,
        sttMinutes: Number(sttMins.toFixed(1)),
        estimatedCost: Number((cSttCost + cGeminiCost).toFixed(4)),
      };
    });

    const campaignMap: Record<string, { name: string; clientCode: string; count: number; qualifiedCount: number }> = {};
    jobs.forEach((j) => {
      const code = j.lead?.campaignCode || 'UNKNOWN';
      const name = j.campaign?.name || code;
      const clientCode = j.lead?.clientCode || 'UNKNOWN';
      if (!campaignMap[code]) campaignMap[code] = { name, clientCode, count: 0, qualifiedCount: 0 };
      campaignMap[code].count++;
      const effectiveQa = (j.manualOverrideStatus || j.qaStatus || j.lead?.qaStatusCrm || 'PENDING').toUpperCase();
      if (effectiveQa.includes('QUALIFIED')) campaignMap[code].qualifiedCount++;
    });

    const campaignAnalytics = Object.keys(campaignMap).map((code) => ({
      campaignCode: code,
      campaignName: campaignMap[code].name,
      count: campaignMap[code].count,
    }));

    const campaignPerformance = Object.keys(campaignMap).map((code) => {
      const item = campaignMap[code];
      return {
        campaignCode: code,
        campaignName: item.name,
        clientCode: item.clientCode,
        totalLeads: item.count,
        qualifiedCount: item.qualifiedCount,
        conversionRate: item.count > 0 ? Number(((item.qualifiedCount / item.count) * 100).toFixed(1)) : 0,
      };
    });

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

      todayLeadsCount,
      yesterdayLeadsCount,
      todayGrowthPercent,
      thisWeekLeadsCount,
      lastWeekLeadsCount,
      weeklyGrowthPercent,
      avgCostPerLead,
      avgCostPerQualifiedLead,

      dailyActivity,
      rawVsEdited,
      recordingDurationOverTime,
      apiUsageOverTime,

      dailyLeadVelocity,
      weeklyLeadVelocity,
      qualityDistribution,
      durationDistribution,
      clientPerformance,
      campaignPerformance,

      clientAnalytics,
      campaignAnalytics,
      statusDistribution,
    };
  }
}

export const dbStore = LocalDbStore.getInstance();
