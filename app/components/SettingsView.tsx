'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  Mic,
  Sparkles,
  Save,
  History,
  Lock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Key,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { AuditLogItem } from '../../lib/types';

interface SettingsData {
  gemini: {
    configured: boolean;
    maskedKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    updatedAt?: string;
    lastTestedAt?: string;
    lastTestStatus?: string;
  };
  googleStt: {
    configured: boolean;
    maskedKey: string;
    projectId: string;
    gcsBucket: string;
    clientEmail: string;
    hasPrivateKey: boolean;
    updatedAt?: string;
    lastTestedAt?: string;
    lastTestStatus?: string;
  };
  assemblyAi: {
    configured: boolean;
    maskedKey: string;
    updatedAt?: string;
    lastTestedAt?: string;
    lastTestStatus?: string;
  };
  crm: {
    configured: boolean;
    endpoint: string;
    maskedApiKey: string;
    writebackUrl?: string;
    webhookConfigured?: boolean;
  };
  defaultSttProvider: string;
  defaultEditingProvider: string;
  maxConcurrency: number;
  autoSyncInterval: number;
  autoGenerateTranscripts: boolean;
  autoQaEvaluation: boolean;
  audioRetentionDays: number;
  updatedAt?: string;
}

interface SettingsViewProps {
  onSettingsUpdated: () => void;
  onSyncCrm: () => void;
}

export default function SettingsView({ onSettingsUpdated, onSyncCrm }: SettingsViewProps) {
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showAdvancedGcp, setShowAdvancedGcp] = useState(false);

  // Key replacement toggles
  const [replaceGeminiKey, setReplaceGeminiKey] = useState(false);
  const [replaceGoogleSttKey, setReplaceGoogleSttKey] = useState(false);
  const [replaceAssemblyAiKey, setReplaceAssemblyAiKey] = useState(false);
  const [replaceCrmKey, setReplaceCrmKey] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Form input buffers
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash');
  const [geminiTemp, setGeminiTemp] = useState(0.2);
  const [geminiMaxTokens, setGeminiMaxTokens] = useState(8192);

  const [newGoogleSttKey, setNewGoogleSttKey] = useState('');
  const [gcpProjectId, setGcpProjectId] = useState('demandarm-ai-qa');
  const [gcsBucketName, setGcsBucketName] = useState('qtranscript-recordings');
  const [gcpClientEmail, setGcpClientEmail] = useState('');
  const [gcpPrivateKey, setGcpPrivateKey] = useState('');

  const [newAssemblyAiKey, setNewAssemblyAiKey] = useState('');

  const [defaultSttProvider, setDefaultSttProvider] = useState('gemini');
  const [crmEndpoint, setCrmEndpoint] = useState('');
  const [newCrmApiKey, setNewCrmApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [crmWritebackUrl, setCrmWritebackUrl] = useState('');

  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [autoSyncInterval, setAutoSyncInterval] = useState(15);
  const [autoGenerateTranscripts, setAutoGenerateTranscripts] = useState(true);
  const [autoQaEvaluation, setAutoQaEvaluation] = useState(true);
  const [audioRetentionDays, setAudioRetentionDays] = useState(90);

  // Test Connection status states
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ target: string; success: boolean; message: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const settingsRes = await fetch('/api/settings');
      const data = await settingsRes.json();
      if (data.success && data.settings) {
        const s: SettingsData = data.settings;
        setSettingsData(s);
        setGeminiModel(s.gemini?.model || 'gemini-3.8-flash');
        setGeminiTemp(s.gemini?.temperature ?? 0.2);
        setGeminiMaxTokens(s.gemini?.maxTokens || 8192);

        setGcpProjectId(s.googleStt?.projectId || '');
        setGcsBucketName(s.googleStt?.gcsBucket || 'qtranscript-recordings');
        setGcpClientEmail(s.googleStt?.clientEmail || '');

        setDefaultSttProvider(s.defaultSttProvider || 'gemini');
        setCrmEndpoint(s.crm?.endpoint || '');
        setCrmWritebackUrl(s.crm?.writebackUrl || '');

        setMaxConcurrency(s.maxConcurrency || 3);
        setAutoSyncInterval(s.autoSyncInterval || 15);
        setAutoGenerateTranscripts(s.autoGenerateTranscripts ?? true);
        setAutoQaEvaluation(s.autoQaEvaluation ?? true);
        setAudioRetentionDays(s.audioRetentionDays || 90);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }

    try {
      const logsRes = await fetch('/api/audit-logs?limit=50');
      const logsData = await logsRes.json();
      if (logsData.success && Array.isArray(logsData.logs)) {
        setAuditLogs(logsData.logs);
      }
    } catch (logErr) {
      console.warn('Error fetching audit logs:', logErr);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const payload: Record<string, any> = {
        geminiModel,
        geminiTemperature: geminiTemp,
        geminiMaxTokens,
        gcpProjectId,
        gcsBucketName,
        gcpClientEmail,
        defaultSttProvider,
        crmEndpoint,
        maxConcurrency,
        autoSyncInterval,
        autoGenerateTranscripts,
        autoQaEvaluation,
        audioRetentionDays,
        crmWritebackUrl,
      };

      if (webhookSecret.trim()) {
        payload.webhookSecret = webhookSecret.trim();
      }

      if (newGeminiKey.trim()) {
        payload.geminiApiKey = newGeminiKey.trim();
      }
      if (newGoogleSttKey.trim()) {
        payload.googleSttApiKey = newGoogleSttKey.trim();
      }
      if (newAssemblyAiKey.trim()) {
        payload.assemblyAiApiKey = newAssemblyAiKey.trim();
      }
      if (newCrmApiKey.trim()) {
        payload.crmApiKey = newCrmApiKey.trim();
      }
      if (gcpPrivateKey.trim()) {
        payload.gcpPrivateKey = gcpPrivateKey.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setSettingsData(data.settings);
        setNewGeminiKey('');
        setNewGoogleSttKey('');
        setNewAssemblyAiKey('');
        setNewCrmApiKey('');
        setReplaceGeminiKey(false);
        setReplaceGoogleSttKey(false);
        setReplaceAssemblyAiKey(false);
        setReplaceCrmKey(false);
        onSettingsUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error || 'Settings were not saved to the database.');
      }
    } catch (e: any) {
      setSaveError(e.message || 'Settings were not saved to the database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (target: 'gemini' | 'googleStt' | 'assemblyAi' | 'crm') => {
    setTestingTarget(target);
    setTestResult(null);

    try {
      const payload: Record<string, any> = { target, geminiModel, gcpProjectId, gcsBucketName, gcpClientEmail, crmEndpoint };
      if (newGeminiKey.trim()) payload.geminiApiKey = newGeminiKey.trim();
      if (newGoogleSttKey.trim()) payload.sttApiKey = newGoogleSttKey.trim();
      if (gcpPrivateKey.trim()) payload.gcpPrivateKey = gcpPrivateKey.trim();
      if (newAssemblyAiKey.trim()) payload.assemblyAiApiKey = newAssemblyAiKey.trim();
      if (newCrmApiKey.trim()) payload.crmApiKey = newCrmApiKey.trim();

      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestResult({
        target: data.target || target,
        success: !!data.success,
        message: data.message || data.error || 'Connection test finished with no details.',
      });
      // Refresh status metadata
      fetchSettings();
    } catch (err: any) {
      setTestResult({ target, success: false, message: `Test connection error: ${err.message}` });
    } finally {
      setTestingTarget(null);
    }
  };

  if (isLoading || !settingsData) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading API Credentials & Configuration...</div>;
  }

  const gemini = settingsData.gemini;
  const googleStt = settingsData.googleStt;
  const assemblyAi = settingsData.assemblyAi;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-400" />
          API Credentials & Secure Provider Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage, test, and rotate API keys for Gemini Multimodal AI, Speech-to-Text providers, and CRM endpoints dynamically.
        </p>
      </div>

      {/* Connection Test Banner Notification */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${testResult.success
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wider block mb-0.5">
              Provider Test Result ({(testResult.target || 'connection').toUpperCase()})
            </span>
            <span>{testResult.message}</span>
          </div>
        </div>
      )}

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gemini Status Card */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Gemini AI Engine
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${gemini.configured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${gemini.configured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {gemini.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Model: <span className="text-purple-300 font-semibold">{gemini.model}</span></div>
            <div>Key: {gemini.configured ? gemini.maskedKey : 'None'}</div>
            {gemini.lastTestedAt && (
              <div className="text-[10px] text-slate-500 font-sans">
                Tested: {new Date(gemini.lastTestedAt).toLocaleTimeString()} ({gemini.lastTestStatus})
              </div>
            )}
          </div>
        </div>

        {/* Google STT Status Card */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-emerald-400" />
              Google Cloud STT
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${googleStt.configured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${googleStt.configured ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {googleStt.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Project: <span className="text-emerald-300 font-semibold">{googleStt.projectId || 'Default'}</span></div>
            <div>Bucket: {googleStt.gcsBucket || 'Default'}</div>
            {googleStt.lastTestedAt && (
              <div className="text-[10px] text-slate-500 font-sans">
                Tested: {new Date(googleStt.lastTestedAt).toLocaleTimeString()} ({googleStt.lastTestStatus})
              </div>
            )}
          </div>
        </div>

        {/* AssemblyAI Status Card */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-400" />
              AssemblyAI
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${assemblyAi.configured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${assemblyAi.configured ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {assemblyAi.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Key: {assemblyAi.configured ? assemblyAi.maskedKey : 'Not Configured'}</div>
            {assemblyAi.lastTestedAt && (
              <div className="text-[10px] text-slate-500 font-sans">
                Tested: {new Date(assemblyAi.lastTestedAt).toLocaleTimeString()} ({assemblyAi.lastTestStatus})
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SECTION 1: Gemini API Credentials */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Gemini API Credentials (STT & Editing)
              </h3>
              <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowSecrets((current) => !current)} className="btn-ghost text-[11px] font-semibold">
                {showSecrets ? 'Hide keys' : 'Show keys'}
              </button>

              <button
                type="button"
                onClick={() => handleTestConnection('gemini')}
                disabled={testingTarget === 'gemini'}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {testingTarget === 'gemini' ? 'Testing...' : 'Test Gemini'}
              </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Gemini API Key</label>
                {gemini.configured && !replaceGeminiKey ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-200">Configured: {gemini.maskedKey}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplaceGeminiKey(true)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline"
                    >
                      Replace API Key
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="Enter new Gemini API Key..."
                      value={newGeminiKey}
                      onChange={(e) => setNewGeminiKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                    />
                    {gemini.configured && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceGeminiKey(false);
                          setNewGeminiKey('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 mt-1 block"
                      >
                        ← Cancel replacement
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  Used by Gemini Multimodal Speech-to-Text, AI Transcript Editing, and Quality Assurance Evaluation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gemini Model</label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended)</option>
                    <option value="gemini-3.5-transcribe">gemini-3.5-transcribe (STT Dedicated)</option>
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Temperature ({geminiTemp})</label>
                  <input
                    type="range"
                    step="0.05"
                    min={0}
                    max={1}
                    value={geminiTemp}
                    onChange={(e) => setGeminiTemp(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Speech-to-Text Providers */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                Speech-to-Text Providers
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection('googleStt')}
                  disabled={testingTarget === 'googleStt'}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {testingTarget === 'googleStt' ? 'Testing...' : 'Test Google STT'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTestConnection('assemblyAi')}
                  disabled={testingTarget === 'assemblyAi'}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {testingTarget === 'assemblyAi' ? 'Testing...' : 'Test AssemblyAI'}
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Default STT Provider</label>
                <select
                  value={defaultSttProvider}
                  onChange={(e) => setDefaultSttProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold text-xs"
                >
                  <option value="gemini">Gemini Multimodal STT (Recommended — Verbatim & Speaker Diarized)</option>
                  <option value="gcp">Google Cloud Speech-to-Text (Telephony Enhanced)</option>
                  <option value="assemblyai">AssemblyAI Speech Recognition Engine</option>
                </select>
              </div>

              {/* Google STT Input */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Google Speech-to-Text API Key</label>
                {googleStt.configured && !replaceGoogleSttKey ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-200">Configured: {googleStt.maskedKey}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplaceGoogleSttKey(true)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
                    >
                      Replace API Key
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="Enter Google STT API Key..."
                      value={newGoogleSttKey}
                      onChange={(e) => setNewGoogleSttKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    {googleStt.configured && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceGoogleSttKey(false);
                          setNewGoogleSttKey('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 mt-1 block"
                      >
                        ← Cancel replacement
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Google Cloud Project ID</label>
                  <input
                    type="text"
                    value={gcpProjectId}
                    onChange={(e) => setGcpProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">GCS Bucket Name</label>
                  <input
                    type="text"
                    value={gcsBucketName}
                    onChange={(e) => setGcsBucketName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* AssemblyAI Input */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">AssemblyAI API Key</label>
                {assemblyAi.configured && !replaceAssemblyAiKey ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-200">Configured: {assemblyAi.maskedKey}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplaceAssemblyAiKey(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline"
                    >
                      Replace API Key
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="Enter AssemblyAI API Key..."
                      value={newAssemblyAiKey}
                      onChange={(e) => setNewAssemblyAiKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                    {assemblyAi.configured && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceAssemblyAiKey(false);
                          setNewAssemblyAiKey('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 mt-1 block"
                      >
                        ← Cancel replacement
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: CRM Integration */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                CRM REST Endpoint Integration
              </h3>

              <button
                type="button"
                onClick={() => handleTestConnection('crm')}
                disabled={testingTarget === 'crm'}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {testingTarget === 'crm' ? 'Testing...' : 'Test CRM API'}
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">CRM REST Endpoint Base URL</label>
                <input
                  type="text"
                  value={crmEndpoint}
                  onChange={(e) => setCrmEndpoint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">CRM Secret Bearer Token</label>
                {settingsData.crm?.configured && !replaceCrmKey ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-200">Configured: {settingsData.crm.maskedApiKey}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplaceCrmKey(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline"
                    >
                      Replace Token
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      placeholder="Enter CRM Secret Token..."
                      value={newCrmApiKey}
                      onChange={(e) => setNewCrmApiKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                    {settingsData.crm?.configured && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceCrmKey(false);
                          setNewCrmApiKey('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 mt-1 block"
                      >
                        ← Cancel replacement
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] text-slate-500">Fast sync uses this interval. A full reconcile still runs every 6 hours.</p>
                <label className="block text-slate-400 font-semibold mb-1">Auto Sync Interval (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={isNaN(autoSyncInterval) ? 15 : autoSyncInterval}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setAutoSyncInterval(isNaN(v) ? 15 : v);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Webhook secret</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={settingsData?.crm?.webhookConfigured ? 'Configured. Enter a new secret to replace it.' : 'Required before CRM can post leads'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Send this value in the x-webhook-secret header. Requests without it are rejected.</p>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">CRM write-back URL</label>
                <input
                  type="text"
                  placeholder="Optional. POST the QA decision here when a lead is scored."
                  value={crmWritebackUrl}
                  onChange={(e) => setCrmWritebackUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Pipeline Policy */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-amber-400" />
              Pipeline & Execution Policy
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Jobs processed at once ({isNaN(maxConcurrency) ? 3 : maxConcurrency})</label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={isNaN(maxConcurrency) ? 3 : maxConcurrency}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setMaxConcurrency(isNaN(v) ? 1 : Math.min(8, Math.max(1, v)));
                  }}
                  className="w-full accent-amber-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">The queue runs this many leads in parallel. The pipeline also picks up waiting jobs about every 20 seconds.</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-300 font-medium">Automatic transcription</label>
                  <p className="text-[11px] text-slate-500">Off skips speech-to-text and editing until you turn it back on and retry.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoGenerateTranscripts}
                  onChange={(e) => setAutoGenerateTranscripts(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-slate-300 font-medium">Automatic QA</label>
                  <p className="text-[11px] text-slate-500">Off keeps the edited transcript and waits for you to retry scoring.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoQaEvaluation}
                  onChange={(e) => setAutoQaEvaluation(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Audio retention (days)</label>
                <p className="text-[11px] text-slate-500 mb-1">Clears stored cloud audio pointers after this many days. The CRM recording link stays available for playback.</p>
                <input
                  type="number"
                  value={isNaN(audioRetentionDays) ? 90 : audioRetentionDays}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setAudioRetentionDays(isNaN(v) ? 90 : v);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Controls */}
        <div className="flex items-center justify-between glass-panel p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Credentials are server-encrypted (AES-256-GCM) and dynamically resolved without restarts.</span>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-400">
                Saved to the database.
              </span>
            )}
            {saveError && (
              <span className="text-xs font-semibold text-rose-300 max-w-md">{saveError}</span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Encrypting & Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Global Audit Log */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <History className="w-4 h-4 text-blue-400" />
          System Execution & Security Audit Logs
        </h3>

        <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto font-mono text-[11px]">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-slate-500 shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className="font-bold text-blue-400 shrink-0">{log.action}:</span>
                <span className="text-slate-300">{log.details}</span>
              </div>
              {log.jobId && <span className="text-slate-500 shrink-0">Job: {log.jobId}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
