export interface ClientPromptVersion {
  id: string;
  clientId: string;
  clientCode: string;
  promptType: 'TRANSCRIPT_EDITING' | 'PRE_EDIT_QA' | 'POST_EDIT_QA';
  promptText: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ClientConfig {
  id: string;
  name: string;
  code: string;
  globalPrompt: string;
  qualificationCriteria: string;
  isActive: boolean;
  autoSyncEnabled?: boolean;
  autoProcessingEnabled?: boolean;
  allowClientPromptFallback?: boolean;
  promptVersion?: number;
  createdAt: string;
  updatedAt: string;
  campaigns?: CampaignConfig[];
  promptVersions?: ClientPromptVersion[];
}

export interface CampaignConfig {
  id: string;
  name: string;
  code: string;
  clientCode: string;
  assetTitle: string;
  valueProps: string[]; // parsed array
  additionalEditingInstructions: string;
  qualificationRulesOverride?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmRecordingItem {
  id: string;
  lead_id: string;
  file_path: string;
  uploaded_at: string;
  url: string;
  download_url: string;
}

export interface CrmLeadItem {
  id: string; // CRM unique ID
  crmLeadId?: string;
  leadRef: string;
  clientCode: string;
  campaignCode: string;
  campaignId?: string;
  campaignName?: string;
  agentId?: string;
  agentName?: string;
  contactName: string;
  companyName: string;
  companySize?: string;
  industry?: string;
  country?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  recordingUrl: string;
  recordingPath?: string;
  recordings?: CrmRecordingItem[];
  qaStatusCrm?: string;
  configurationStatus?: 'CONFIGURED' | 'CAMPAIGN_NOT_CONFIGURED';
  durationSeconds?: number;
  formData?: Record<string, any>;
  rawLeadData?: Record<string, any>;
  syncedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpeakerUtterance {
  speakerTag: number;
  speakerName: string;
  startTime: string;
  endTime: string;
  transcript: string;
}

export interface RawTranscriptData {
  fullText: string;
  utterances: SpeakerUtterance[];
  confidence: number;
  languageCode: string;
  durationSeconds: number;
}

export interface QaChecklistItem {
  id: string;
  requirement: string;
  isMet: boolean;
  evidence: string;
  notes?: string;
}

export interface QaResultData {
  qualificationStatus: 'QUALIFIED' | 'NEEDS_REVIEW' | 'UNQUALIFIED';
  overallScore: number; // 0 - 100
  checklist: QaChecklistItem[];
  supportingEvidence: string[];
  missingRequirements: string[];
  reviewReasons: string[];
  evaluatedAt: string;
  metadata: Record<string, any>;
}

export type JobStatus =
  | 'PENDING'
  | 'AUDIO_RETRIEVED'
  | 'TRANSCRIBING'
  | 'AI_EDITING'
  | 'QA_EVALUATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CONFIGURATION_REQUIRED'
  | 'CAMPAIGN_CONFIGURATION_REQUIRED';

export interface ProcessingJobItem {
  id: string;
  leadId: string;
  leadRef: string;
  status: JobStatus;
  stepError?: string;
  gcsAudioUri?: string;
  rawTranscript?: RawTranscriptData;
  editedTranscript?: string;
  promptVersionUsed?: string;
  qaStatus?: 'QUALIFIED' | 'NEEDS_REVIEW' | 'UNQUALIFIED';
  qaResultJson?: QaResultData;
  manualOverrideStatus?: 'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
  manualOverrideNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  // Token & Usage metrics for Analytics
  promptTokens?: number;
  completionTokens?: number;
  audioDurationSeconds?: number;
  processingDurationMs?: number;
  lead?: CrmLeadItem;
  client?: ClientConfig;
  campaign?: CampaignConfig;
  auditLogs?: AuditLogItem[];
}

export interface AuditLogItem {
  id: string;
  jobId?: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface ProviderMetadataItem {
  updatedAt?: string;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'untested';
}

export interface ProviderMetadata {
  gemini?: ProviderMetadataItem;
  googleStt?: ProviderMetadataItem;
  assemblyAi?: ProviderMetadataItem;
}

export interface SystemSettingsConfig {
  id: string;
  crmEndpoint: string;
  crmApiKey: string;
  sttProvider?: string;
  sttApiKey?: string;
  assemblyAiApiKey?: string;
  defaultSttProvider?: string;
  defaultEditingProvider?: string;
  providerMetadata?: ProviderMetadata;
  gcsBucketName: string;
  gcpProjectId: string;
  gcpClientEmail: string;
  gcpPrivateKey: string;
  sttLanguageCode: string;
  sttModel: string;
  sttDiarizationEnabled: boolean;
  geminiApiKey: string;
  geminiModel: string;
  geminiTemperature: number;
  geminiMaxTokens: number;
  maxConcurrency: number;
  autoSyncInterval: number;
  autoGenerateTranscripts: boolean;
  autoQaEvaluation: boolean;
  isProcessingPaused?: boolean;
  audioRetentionDays: number;
  sttCostPerMinute: number;
  geminiInputCostPer1M: number;
  geminiOutputCostPer1M: number;
  updatedAt: string;
}

export interface AnalyticsSummary {
  totalRecordingsProcessed: number;
  totalRawTranscripts: number;
  totalEditedTranscripts: number;
  totalAudioDurationSeconds: number;
  totalSttUsageMinutes: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalGeminiTokens: number;
  estimatedSttCost: number;
  estimatedGeminiCost: number;
  totalEstimatedCost: number;
  avgProcessingDurationSeconds: number;
  successPercentage: number;
  dailyActivity: { date: string; count: number }[];
  rawVsEdited: { date: string; raw: number; edited: number }[];
  recordingDurationOverTime: { date: string; durationMinutes: number }[];
  apiUsageOverTime: { date: string; sttMinutes: number; tokens: number }[];
  clientAnalytics: { clientCode: string; clientName: string; count: number; qualifiedCount: number }[];
  campaignAnalytics: { campaignCode: string; campaignName: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
}
