'use client';

import React, { useState } from 'react';
import {
  Plus,
  Shield,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Code,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  History,
  Play,
  FileText,
  AlertTriangle,
  Sliders,
  Terminal,
  Check,
} from 'lucide-react';
import { ClientConfig, CampaignConfig, ClientPromptVersion } from '../../lib/types';

interface ClientsViewProps {
  clients: ClientConfig[];
  onRefresh: () => void;
  onSyncCrm?: () => void;
}

export default function ClientsView({ clients, onRefresh, onSyncCrm }: ClientsViewProps) {
  // Create / Edit Client State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<ClientConfig> | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [qualificationCriteria, setQualificationCriteria] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [allowClientPromptFallback, setAllowClientPromptFallback] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Dialog after creation
  const [successClientCode, setSuccessClientCode] = useState<string | null>(null);
  const [isSyncingClient, setIsSyncingClient] = useState(false);

  // Client Details Drawer & Prompt Management State
  const [selectedClient, setSelectedClient] = useState<ClientConfig | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'prompt' | 'versions' | 'campaigns' | 'test'>('overview');
  const [promptInput, setPromptInput] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Test Prompt Tool State
  const [testSampleTranscript, setTestSampleTranscript] = useState(
    `[Prospect Sarah - Austin Neurosurgical]: Hello, we are searching for an enterprise medical billing solution. We have 15 coordinator seats and must go live within 4 months.
[Sales Agent Mark]: Excellent. Does your budget support our $40k annual tier?
[Prospect Sarah]: Yes, budget is locked at $45k max, but Epic EHR integration is mandatory for us.`
  );
  const [testEffectivePrompt, setTestEffectivePrompt] = useState('');
  const [testPreviewOutput, setTestPreviewOutput] = useState('');
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setName('');
    setCode('');
    setGlobalPrompt(
      `You are an expert sales call transcript editor. Format speaker turns clearly with [Speaker Name - Role], remove filler words like "um" and "uh" without altering factual customer commitments, pricing, or timelines.`
    );
    setQualificationCriteria(
      `1. Prospect decision maker confirmed.\n2. Key software requirements identified.\n3. Implementation timeline within 6 months.\n4. Next step demo scheduled.`
    );
    setIsActive(true);
    setAllowClientPromptFallback(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: ClientConfig) => {
    setEditingClient(client);
    setName(client.name);
    setCode(client.code);
    setGlobalPrompt(client.globalPrompt || '');
    setQualificationCriteria(client.qualificationCriteria || '');
    setIsActive(client.isActive);
    setAllowClientPromptFallback(client.allowClientPromptFallback ?? true);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (client: ClientConfig) => {
    setSelectedClient(client);
    setPromptInput(client.globalPrompt || '');
    setDetailTab('overview');
    setTestEffectivePrompt('');
    setTestPreviewOutput('');
  };

  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cleanCode = code.toUpperCase().trim();
      const payload = {
        id: editingClient?.id,
        name: name.trim(),
        code: cleanCode,
        globalPrompt,
        qualificationCriteria,
        isActive,
        allowClientPromptFallback,
      };

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        onRefresh();
        if (!editingClient) {
          setSuccessClientCode(cleanCode);
        }
      } else {
        alert(`Error saving client: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error saving client: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNewPromptVersion = async () => {
    if (!selectedClient) return;
    setIsSavingPrompt(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedClient.id,
          code: selectedClient.code,
          globalPrompt: promptInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedClient(data.client);
        onRefresh();
        alert(`Prompt updated successfully! Created Prompt Version v${data.client.promptVersion || 1}.`);
      } else {
        alert(`Error updating prompt: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error updating prompt: ${e.message}`);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleRunPromptTest = async () => {
    if (!selectedClient) return;
    setIsTestingPrompt(true);
    try {
      const res = await fetch('/api/clients/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClient.code,
          promptText: promptInput || selectedClient.globalPrompt,
          sampleTranscript: testSampleTranscript,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEffectivePrompt(data.effectivePrompt);
        setTestPreviewOutput(data.previewOutput);
      } else {
        alert(`Test Prompt Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Test Prompt Error: ${err.message}`);
    } finally {
      setIsTestingPrompt(false);
    }
  };

  const handleSyncClientLeads = async (clientCode: string) => {
    setIsSyncingClient(true);
    try {
      const res = await fetch('/api/crm/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        alert(`CRM Lead Synchronization complete! Fetched matching leads for client ${clientCode}.`);
      } else {
        alert(`Sync Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Sync Error: ${e.message}`);
    } finally {
      setIsSyncingClient(false);
    }
  };

  const handleToggleActive = async (client: ClientConfig) => {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          code: client.code,
          isActive: !client.isActive,
        }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e: any) {
      alert(`Error toggling client status: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Dynamic Client & Prompt Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure dynamic client codes, versioned AI transcript editing prompts, and qualification rules.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Client</span>
        </button>
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clients.map((client) => {
          const promptConfigured = !!(client.globalPrompt && client.globalPrompt.trim().length > 0);
          const campaignCount = client.campaigns?.length || 0;
          const promptVersionTag = `v${client.promptVersion || 1}`;

          return (
            <div
              key={client.id || client.code}
              className={`relative bg-slate-900/80 border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition-all ${
                client.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono">
                      Code: {client.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-100 mt-0.5">{client.name}</h3>
                  </div>

                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                      client.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {client.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {promptConfigured ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 font-semibold">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      Prompt Configured ({promptVersionTag})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Configuration Required
                    </span>
                  )}

                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    <Layers className="w-3 h-3 text-slate-400" />
                    {campaignCount} {campaignCount === 1 ? 'Campaign' : 'Campaigns'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-3 italic font-sans bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  &ldquo;{client.globalPrompt || 'No global transcript editing prompt configured yet.'}&rdquo;
                </p>
              </div>

              {/* Card Bottom Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenDetails(client)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Manage Prompt & Tabs</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSyncClientLeads(client.code)}
                    disabled={isSyncingClient}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title={`Trigger immediate CRM lead sync for Client ${client.code}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingClient ? 'animate-spin text-blue-400' : ''}`} />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(client)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Edit Client Settings"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleActive(client)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      client.isActive
                        ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                    }`}
                    title={client.isActive ? 'Deactivate Client' : 'Activate Client'}
                  >
                    {client.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                {editingClient ? `Edit Client (${editingClient.code})` : 'Create New Dynamic Client'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitClient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Client Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Finder 1050"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Client Code (Unique) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingClient?.code}
                    placeholder="e.g. 1050"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 uppercase font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transcript Editing AI Prompt <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Define the AI transcript editing rules for this client..."
                  value={globalPrompt}
                  onChange={(e) => setGlobalPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  QA Qualification Instructions / Criteria
                </label>
                <textarea
                  rows={3}
                  placeholder="Define qualification checklist rules for call evidence scoring..."
                  value={qualificationCriteria}
                  onChange={(e) => setQualificationCriteria(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Client is Active (Participates in CRM Sync)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowClientPromptFallback}
                    onChange={(e) => setAllowClientPromptFallback(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Allow Client Prompt Fallback for missing campaigns</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Configuration...' : editingClient ? 'Update Client' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEWLY CREATED CLIENT SUCCESS DIALOG (Immediate First Sync Option) */}
      {successClientCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100">Client {successClientCode} Created!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Client configuration has been saved in the database. CRM synchronization will now automatically include client code <strong className="text-slate-200">{successClientCode}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={async () => {
                  setSuccessClientCode(null);
                  await handleSyncClientLeads(successClientCode);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Sync CRM Leads for {successClientCode} Now
              </button>

              <button
                onClick={() => setSuccessClientCode(null)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT DETAILS & PROMPT MANAGEMENT DRAWER */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {selectedClient.name}
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold border border-slate-700">
                      Code: {selectedClient.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Prompt Version: <strong className="text-blue-400 font-mono">v{selectedClient.promptVersion || 1}</strong> | Status:{' '}
                    <strong className={selectedClient.isActive ? 'text-emerald-400' : 'text-rose-400'}>
                      {selectedClient.isActive ? 'Active' : 'Inactive'}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="text-slate-400 hover:text-slate-200 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 text-xs font-semibold text-slate-400">
              <button
                onClick={() => setDetailTab('overview')}
                className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'overview' ? 'border-blue-500 text-blue-400' : 'border-transparent hover:text-slate-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setDetailTab('prompt')}
                className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'prompt' ? 'border-blue-500 text-blue-400' : 'border-transparent hover:text-slate-200'
                }`}
              >
                Transcript Prompt (v{selectedClient.promptVersion || 1})
              </button>
              <button
                onClick={() => setDetailTab('versions')}
                className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'versions' ? 'border-blue-500 text-blue-400' : 'border-transparent hover:text-slate-200'
                }`}
              >
                Prompt History
              </button>
              <button
                onClick={() => setDetailTab('campaigns')}
                className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'campaigns' ? 'border-blue-500 text-blue-400' : 'border-transparent hover:text-slate-200'
                }`}
              >
                Campaigns ({selectedClient.campaigns?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('test')}
                className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'test' ? 'border-blue-500 text-blue-400' : 'border-transparent hover:text-slate-200'
                }`}
              >
                Test & Preview Prompt
              </button>
            </div>

            {/* Drawer Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: OVERVIEW */}
              {detailTab === 'overview' && (
                <div className="space-y-6 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-medium">Client Code</div>
                      <div className="text-lg font-bold text-slate-100 font-mono mt-1">{selectedClient.code}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-medium">Active Prompt Version</div>
                      <div className="text-lg font-bold text-blue-400 font-mono mt-1">
                        v{selectedClient.promptVersion || 1}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-medium">Child Campaigns</div>
                      <div className="text-lg font-bold text-slate-100 mt-1">
                        {selectedClient.campaigns?.length || 0}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider">Active Transcript Editing Directives</h4>
                    <p className="text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedClient.globalPrompt || 'No global transcript editing prompt configured.'}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider">Qualification Checklist Instructions</h4>
                    <p className="text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedClient.qualificationCriteria || 'No specific QA qualification rules specified.'}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: EDITING PROMPT (VERSIONED) */}
              {detailTab === 'prompt' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                        Edit Client Transcript Editing Prompt
                      </h4>
                      <p className="text-slate-400 mt-0.5">
                        Saving updates will automatically increment the prompt version from <code className="text-blue-400 font-mono">v{selectedClient.promptVersion || 1}</code> to <code className="text-emerald-400 font-mono">v{(selectedClient.promptVersion || 1) + 1}</code>.
                      </p>
                    </div>

                    <button
                      onClick={handleSaveNewPromptVersion}
                      disabled={isSavingPrompt || !promptInput.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isSavingPrompt ? 'Saving Version...' : 'Save New Prompt Version'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* TAB 3: PROMPT HISTORY */}
              {detailTab === 'versions' && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-400" />
                    Prompt Versioning History ({selectedClient.code})
                  </h4>

                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    {(selectedClient.promptVersions && selectedClient.promptVersions.length > 0
                      ? selectedClient.promptVersions
                      : [
                          {
                            id: 'v1',
                            version: selectedClient.promptVersion || 1,
                            promptText: selectedClient.globalPrompt,
                            isActive: true,
                            createdBy: 'System / Admin',
                            createdAt: selectedClient.createdAt,
                          },
                        ]
                    ).map((pv: any) => (
                      <div key={pv.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-400 text-sm">
                            Version v{pv.version}
                          </span>
                          {pv.isActive ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              ACTIVE VERSION
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                              ARCHIVED
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-mono text-[11px] bg-slate-900 p-3 rounded-lg border border-slate-800/80 whitespace-pre-wrap">
                          {pv.promptText}
                        </p>
                        <div className="text-[10px] text-slate-500">
                          Created by: <strong>{pv.createdBy || 'Admin'}</strong> on {new Date(pv.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: CAMPAIGNS LIST */}
              {detailTab === 'campaigns' && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider">
                    Campaigns Associated with Client {selectedClient.code}
                  </h4>

                  <div className="space-y-3">
                    {selectedClient.campaigns?.map((cmp) => (
                      <div key={cmp.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-200 text-sm">
                            {cmp.name} ({cmp.code})
                          </div>
                          <div className="text-slate-400 mt-1">Asset: {cmp.assetTitle}</div>
                          <div className="text-slate-500 text-[11px] mt-1 italic">
                            &ldquo;{cmp.additionalEditingInstructions || 'No custom campaign instructions'}&rdquo;
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                          Configured
                        </span>
                      </div>
                    )) || <div className="text-slate-500 italic">No child campaigns registered under client {selectedClient.code}.</div>}
                  </div>
                </div>
              )}

              {/* TAB 5: TEST PROMPT TOOL */}
              {detailTab === 'test' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-400" />
                        Prompt Test & AI Output Preview Tool
                      </h4>
                      <p className="text-slate-400 mt-0.5">
                        Test your editing prompt against sample raw transcripts using Gemini AI without creating real database leads.
                      </p>
                    </div>

                    <button
                      onClick={handleRunPromptTest}
                      disabled={isTestingPrompt}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className={`w-3.5 h-3.5 ${isTestingPrompt ? 'animate-spin' : ''}`} />
                      <span>{isTestingPrompt ? 'Running AI Test...' : 'Run Test Prompt Preview'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Sample Raw Input Transcript:</label>
                      <textarea
                        rows={8}
                        value={testSampleTranscript}
                        onChange={(e) => setTestSampleTranscript(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Generated Gemini AI Preview Output:</label>
                      <div className="w-full h-[180px] p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-[11px] leading-relaxed overflow-y-auto whitespace-pre-wrap">
                        {testPreviewOutput || (isTestingPrompt ? 'Generating test response from Gemini AI...' : 'Click "Run Test Prompt Preview" to view AI output.')}
                      </div>
                    </div>
                  </div>

                  {testEffectivePrompt && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Assembled Effective Prompt Instruction:</h5>
                      <pre className="p-3 rounded-lg bg-slate-900 text-slate-400 font-mono text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {testEffectivePrompt}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
