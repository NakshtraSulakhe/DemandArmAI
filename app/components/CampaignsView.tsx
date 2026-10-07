'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Layers, Shield, Edit, Trash2, Tag, FileText, CheckSquare, Minimize2, Maximize2 } from 'lucide-react';
import { ClientConfig, CampaignConfig } from '../../lib/types';

interface CampaignsViewProps {
  clients: ClientConfig[];
  campaigns: CampaignConfig[];
  onRefresh: () => void;
}

export default function CampaignsView({ clients, campaigns, onRefresh }: CampaignsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<CampaignConfig> | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientCode, setClientCode] = useState(clients[0]?.code || '');
  const [assetTitle, setAssetTitle] = useState('');
  const [valuePropsText, setValuePropsText] = useState('');
  const [additionalEditingInstructions, setAdditionalEditingInstructions] = useState('');
  const [qualificationRulesOverride, setQualificationRulesOverride] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panelSize, setPanelSize] = useState<'minimized' | 'normal' | 'maximized'>('normal');

  useEffect(() => {
    const stored = localStorage.getItem('campaign-module-size');
    if (stored === 'minimized' || stored === 'maximized') setPanelSize(stored);
  }, []);

  const setSize = (size: 'minimized' | 'normal' | 'maximized') => {
    setPanelSize(size);
    localStorage.setItem('campaign-module-size', size);
  };

  useEffect(() => {
    if (panelSize !== 'maximized' || isModalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSize('normal');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelSize, isModalOpen]);

  const handleOpenCreate = (parentCode?: string) => {
    setEditingCampaign(null);
    setName('');
    setCode('');
    setClientCode(parentCode || clients[0]?.code || '');
    setAssetTitle('');
    setValuePropsText('• Automated Zero-Trust Architecture\n• 99.999% SLA Failover\n• SOC2 & ISO27001 Certified');
    setAdditionalEditingInstructions('Capitalize key solution terms and technical acronyms correctly.');
    setQualificationRulesOverride('Prospect must manage active enterprise cloud or infrastructure workloads.');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cmp: CampaignConfig) => {
    setEditingCampaign(cmp);
    setName(cmp.name);
    setCode(cmp.code);
    setClientCode(cmp.clientCode);
    setAssetTitle(cmp.assetTitle);
    setValuePropsText(cmp.valueProps.map((vp) => `• ${vp}`).join('\n'));
    setAdditionalEditingInstructions(cmp.additionalEditingInstructions);
    setQualificationRulesOverride(cmp.qualificationRulesOverride || '');
    setIsActive(cmp.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedValueProps = valuePropsText
        .split('\n')
        .map((line) => line.replace(/^[\s•*-]+/, '').trim())
        .filter(Boolean);

      const payload = {
        id: editingCampaign?.id,
        name,
        code: code.toUpperCase().trim(),
        clientCode: clientCode.toUpperCase().trim(),
        assetTitle,
        valueProps: parsedValueProps,
        additionalEditingInstructions,
        qualificationRulesOverride,
        isActive,
      };

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Error saving campaign: ${err.error}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (campaignCode: string) => {
    if (!confirm(`Are you sure you want to deactivate/delete campaign ${campaignCode}?`)) return;
    try {
      const res = await fetch(`/api/campaigns?code=${encodeURIComponent(campaignCode)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e: any) {
      alert(`Error deleting campaign: ${e.message}`);
    }
  };

  const sizeButtonClass =
    'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors';

  return (
    <div
      className={
        panelSize === 'maximized'
          ? 'fixed inset-0 z-40 overflow-y-auto bg-[var(--background)] p-4 sm:p-6 lg:p-8'
          : ''
      }
    >
    <div className={`space-y-8 ${panelSize === 'maximized' ? 'mx-auto max-w-[1600px]' : ''}`}>
      {/* Page Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${panelSize === 'minimized' ? 'glass-panel rounded-2xl border border-slate-800 px-4 py-3' : ''}`}>
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Campaign Configuration Module
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {panelSize === 'minimized'
              ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} across ${clients.length} client${clients.length === 1 ? '' : 's'}`
              : 'Configure campaign assets, value propositions, and dynamic prompt overrides nested under parent clients.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {panelSize !== 'minimized' && (
            <button
              type="button"
              onClick={() => setSize('minimized')}
              className={sizeButtonClass}
              title="Minimize Campaign Configuration"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Minimize</span>
            </button>
          )}
          {panelSize === 'minimized' && (
            <button
              type="button"
              onClick={() => setSize('normal')}
              className={sizeButtonClass}
              title="Show Campaign Configuration"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Show</span>
            </button>
          )}
          {panelSize === 'maximized' ? (
            <button
              type="button"
              onClick={() => setSize('normal')}
              className={sizeButtonClass}
              title="Restore Campaign Configuration"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSize('maximized')}
              className={sizeButtonClass}
              title="Maximize Campaign Configuration"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Maximize</span>
            </button>
          )}
          <button
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {panelSize !== 'minimized' && (
      <>
      {/* Campaigns Grouped by Parent Client */}
      {clients.map((client) => {
        const clientCampaigns = campaigns.filter(
          (cmp) => cmp.clientCode.toUpperCase() === client.code.toUpperCase()
        );

        return (
          <div key={client.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">{client.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">Parent Client Code: {client.code}</span>
                </div>
              </div>

              <button
                onClick={() => handleOpenCreate(client.code)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Campaign to {client.code}</span>
              </button>
            </div>

            {/* Nested Campaign Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {clientCampaigns.length > 0 ? (
                clientCampaigns.map((cmp) => (
                  <div
                    key={cmp.id}
                    className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100">{cmp.name}</h4>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {cmp.code}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block italic">
                          Asset Title: {cmp.assetTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(cmp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cmp.code)}
                          className="action-btn action-retry"
                          title={`Delete campaign ${cmp.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Value Props */}
                    <div>
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Key Value Propositions
                      </h5>
                      <ul className="space-y-1 text-xs text-slate-300 pl-3 list-disc">
                        {cmp.valueProps.map((vp, idx) => (
                          <li key={idx}>{vp}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Additional Instructions */}
                    {cmp.additionalEditingInstructions && (
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                          Editing Instructions
                        </h5>
                        <p className="text-xs text-slate-400 font-mono">{cmp.additionalEditingInstructions}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  No campaigns registered under {client.name}. Click &ldquo;Add Campaign&rdquo; above to set up asset prompts.
                </div>
              )}
            </div>
          </div>
        );
      })}
      </>
      )}

      {/* Modal: Create / Edit Campaign */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">
              {editingCampaign ? 'Edit Campaign Configuration' : 'Create New Campaign'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Campaign Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CloudShield Zero Trust"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Parent Client Code</label>
                  <select
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    disabled={!!editingCampaign}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Unique Campaign Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLOUD_SHIELD_2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={!!editingCampaign}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Asset / Solution Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CloudShield Architecture Briefing"
                    value={assetTitle}
                    onChange={(e) => setAssetTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Key Value Propositions (One bullet per line)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="• Automated Zero-Trust Micro-segmentation&#10;• 99.999% SLA Failover"
                  value={valuePropsText}
                  onChange={(e) => setValuePropsText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Additional AI Editing Instructions (Campaign Specific)
                </label>
                <textarea
                  rows={2}
                  value={additionalEditingInstructions}
                  onChange={(e) => setAdditionalEditingInstructions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Qualification Rules Override (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prospect must manage at least 200 AWS or GCP cloud instances."
                  value={qualificationRulesOverride}
                  onChange={(e) => setQualificationRulesOverride(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="campaignActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-0"
                />
                <label htmlFor="campaignActive" className="text-slate-300 font-medium">
                  Campaign is Active
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
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Campaign Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
