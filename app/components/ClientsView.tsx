'use client';

import React, { useState } from 'react';
import { Plus, Shield, CheckCircle2, XCircle, Edit, Trash2, Code, Layers } from 'lucide-react';
import { ClientConfig } from '../../lib/types';

interface ClientsViewProps {
  clients: ClientConfig[];
  onRefresh: () => void;
}

export default function ClientsView({ clients, onRefresh }: ClientsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<ClientConfig> | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [qualificationCriteria, setQualificationCriteria] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setName('');
    setCode('');
    setGlobalPrompt(
      `You are an expert sales call transcript editor. Format speaker turns clearly, remove filler words like "um" and "uh" without altering meaning, and preserve all verbatim customer commitments and pricing.`
    );
    setQualificationCriteria(
      `1. Company name and prospect title confirmed.\n2. Key product needs discussed.\n3. Implementation timeline established.\n4. Follow-up meeting scheduled.`
    );
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: ClientConfig) => {
    setEditingClient(client);
    setName(client.name);
    setCode(client.code);
    setGlobalPrompt(client.globalPrompt);
    setQualificationCriteria(client.qualificationCriteria);
    setIsActive(client.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        id: editingClient?.id,
        name,
        code: code.toUpperCase().trim(),
        globalPrompt,
        qualificationCriteria,
        isActive,
      };

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Error saving client: ${err.error}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (clientCode: string) => {
    if (!confirm(`Are you sure you want to deactivate/remove client ${clientCode}?`)) return;
    try {
      const res = await fetch(`/api/clients?code=${encodeURIComponent(clientCode)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e: any) {
      alert(`Error deactivating client: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Client Configuration Module
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure global AI editing prompts and qualification standards per client organization.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Client</span>
        </button>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clients.map((client) => (
          <div key={client.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100">{client.name}</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {client.code}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Campaigns count: {client.campaigns?.length || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                    client.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {client.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>

                <button
                  onClick={() => handleOpenEdit(client)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Edit Client Settings"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(client.code)}
                  className="p-1.5 rounded-lg text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                  title="Deactivate Client"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Global AI Editing Prompt Preview */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-blue-400" /> Global AI Prompt Directives
              </h4>
              <p className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 font-mono leading-relaxed line-clamp-4">
                {client.globalPrompt}
              </p>
            </div>

            {/* Qualification Criteria */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Qualification Criteria
              </h4>
              <p className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {client.qualificationCriteria}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create / Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">
              {editingClient ? 'Edit Client Configuration' : 'Create New Client'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TechCorp Enterprise"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Unique Client Code (Uppercase identifier)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TECH_CORP"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingClient}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Global AI Editing Prompt (Applies to all child campaigns)
                </label>
                <textarea
                  rows={4}
                  required
                  value={globalPrompt}
                  onChange={(e) => setGlobalPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Client Qualification Criteria Standards
                </label>
                <textarea
                  rows={4}
                  required
                  value={qualificationCriteria}
                  onChange={(e) => setQualificationCriteria(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clientActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
                <label htmlFor="clientActive" className="text-slate-300 font-medium">
                  Client is Active (Eligible for CRM synchronization & processing)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Client Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
