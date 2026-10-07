'use client';

import React, { useState } from 'react';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Sparkles,
  ShieldCheck,
  User,
  Building,
  Edit3,
  Save,
  History,
  Volume2,
  Download,
  Music,
  ExternalLink,
  Layers,
  Columns2,
  Maximize2,
  Minimize2,
  Ban,
  MessageSquareQuote,
  Lightbulb,
} from 'lucide-react';
import { ProcessingJobItem, CrmRecordingItem } from '../../lib/types';
import CallAudioPlayer from './ui/CallAudioPlayer';
import { coachingFromScore } from '../../lib/qa/agentCoaching';

function highlightEntities(text: string, terms: string[]) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unique = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 2))];
  if (!unique.length) return escaped;
  const pattern = new RegExp(`(${unique.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark class="rounded bg-indigo-500/25 px-0.5 text-indigo-100">$1</mark>');
}

interface LeadDetailModalProps {
  job: ProcessingJobItem | null;
  onClose: () => void;
  onRetryJob: (jobId: string) => Promise<void>;
  reviewerName: string;
  onReviewerNameChange: (name: string) => void;
  onSaveManualEdit: (jobId: string, editedTranscript: string, reviewerName: string) => Promise<void>;
  onOverrideQaStatus: (
    jobId: string,
    status: 'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED',
    notes: string,
    reviewerName: string
  ) => Promise<void>;
}

export default function LeadDetailModal({
  job,
  onClose,
  onRetryJob,
  reviewerName,
  onReviewerNameChange,
  onSaveManualEdit,
  onOverrideQaStatus,
}: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'qa' | 'raw' | 'edited' | 'compare' | 'audit'>('qa');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState(job?.editedTranscript || '');
  const [overrideStatus, setOverrideStatus] = useState<'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED'>(
    (job?.manualOverrideStatus as any) || job?.qaStatus || 'NEEDS_REVIEW'
  );
  const [overrideNotes, setOverrideNotes] = useState(job?.manualOverrideNotes || '');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [selectedRecIdx, setSelectedRecIdx] = useState(0);
  const [stretched, setStretched] = useState(false);

  React.useEffect(() => {
    setStretched(localStorage.getItem('qa-preview-stretched') === '1');
  }, []);

  const toggleStretch = () => {
    setStretched((current) => {
      const next = !current;
      localStorage.setItem('qa-preview-stretched', next ? '1' : '0');
      return next;
    });
  };

  // Sync state when job changes
  React.useEffect(() => {
    if (job) {
      setEditedText(job.editedTranscript || '');
      setOverrideStatus((job.manualOverrideStatus as any) || job.qaStatus || 'NEEDS_REVIEW');
      setOverrideNotes(job.manualOverrideNotes || '');
      setSelectedRecIdx(0);
      setIsEditingTranscript(false);
      setActiveTab('qa');
    }
  }, [job]);

  React.useEffect(() => {
    if (!job) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [job, onClose]);

  if (!job) return null;

  const handleCopyTranscript = () => {
    if (job?.editedTranscript) {
      navigator.clipboard.writeText(job.editedTranscript);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    }
  };

  const handleCopyFeedback = () => {
    if (!job) return;
    const coaching = coachingFromScore(job.qaResultJson);
    const feedbackText = coaching
      ? [
          coaching.summary,
          '',
          'Avoid',
          ...coaching.avoid.map((line) => `- ${line}`),
          '',
          'Say this instead',
          ...coaching.sayInstead.map((line) => `- ${line}`),
          '',
          'How to improve the next call',
          ...coaching.improve.map((line) => `- ${line}`),
        ].join('\n')
      : job.manualOverrideNotes ||
        `QA Status: ${job.manualOverrideStatus || job.qaStatus || 'Not scored'}\nOverall Score: ${job.qaResultJson?.overallScore ?? 'Not scored'}`;
    navigator.clipboard.writeText(feedbackText);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  // Selected recording selector
  const recordingsList: CrmRecordingItem[] = job?.lead?.recordings?.length
    ? job.lead.recordings
    : job?.lead?.recordingUrl
    ? [{ id: '1', lead_id: job.lead.id, file_path: '', uploaded_at: '', url: job.lead.recordingUrl, download_url: job.lead.recordingUrl }]
    : [];

  const currentRec = recordingsList[selectedRecIdx] || null;

  const audioStreamUrl = currentRec
    ? `/api/crm/proxy-audio?url=${encodeURIComponent(currentRec.url)}`
    : '';

  const effectiveQaStatus = job?.manualOverrideStatus || job?.qaStatus || 'NEEDS_REVIEW';

  const handleRetry = async () => {
    if (!job) return;
    setIsRetrying(true);
    try {
      await onRetryJob(job.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!job) return;
    setIsSavingEdit(true);
    try {
      await onSaveManualEdit(job.id, editedText, reviewerName.trim());
      setIsEditingTranscript(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!job) return;
    if (!reviewerName.trim()) return;
    setIsSubmittingOverride(true);
    try {
      await onOverrideQaStatus(job.id, overrideStatus, overrideNotes, reviewerName.trim());
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col ${stretched ? 'h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none' : 'w-full max-w-5xl max-h-[92vh]'}`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100">{job.leadRef}</h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {job.lead?.companyName || 'CRM Lead'}
                </span>

                {job.lead?.configurationStatus === 'CAMPAIGN_NOT_CONFIGURED' ? (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Campaign Not Configured
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Configured
                  </span>
                )}

                {effectiveQaStatus === 'QUALIFIED' && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> QUALIFIED
                  </span>
                )}
                {effectiveQaStatus === 'NEEDS_REVIEW' && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW
                  </span>
                )}
                {effectiveQaStatus === 'REJECTED' && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <XCircle className="w-3.5 h-3.5" /> REJECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {job.status.replace(/_/g, ' ')}
                {' · '}
                Client Code: <strong className="text-slate-200">{job.lead?.clientCode}</strong> | Campaign Code:{' '}
                <strong className="text-slate-200">{job.lead?.campaignCode}</strong>
                {job.lead?.agentName && <span> | Agent: <strong className="text-slate-200">{job.lead.agentName}</strong></span>}
              </p>
              {job.stepError && (
                <p className="text-xs text-amber-300 mt-1">{job.stepError}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleStretch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title={stretched ? 'Restore the preview size' : 'Stretch the preview window'}
            >
              {stretched ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{stretched ? 'Restore' : 'Stretch'}</span>
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry Pipeline</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead Summary Bar & Audio Player */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400">Contact Person</div>
              <div className="text-xs font-semibold text-slate-200">
                {job.lead?.contactName} ({job.lead?.jobTitle || 'Executive'})
              </div>
              {job.lead?.email && <div className="text-[10px] text-slate-500">{job.lead.email}</div>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400">Target Company</div>
              <div className="text-xs font-semibold text-slate-200">{job.lead?.companyName}</div>
              <div className="text-[10px] text-slate-500">
                {job.lead?.industry ? `${job.lead.industry} • ` : ''}
                {job.lead?.companySize || ''}
              </div>
            </div>
          </div>

          {/* Audio Player Container */}
          <div className="flex flex-col justify-center space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Call Recording Playback
              </span>

              {recordingsList.length > 1 && (
                <select
                  value={isNaN(selectedRecIdx) ? 0 : selectedRecIdx}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSelectedRecIdx(isNaN(v) ? 0 : v);
                  }}
                  className="bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none"
                >
                  {recordingsList.map((rec, i) => (
                    <option key={rec.id || i} value={i}>
                      Rec #{i + 1} (ID: {rec.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentRec ? (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <CallAudioPlayer src={audioStreamUrl} />
                </div>
                <a
                  href={currentRec.download_url || currentRec.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="btn-ghost mt-1"
                  title="Download recording file"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">No recording audio attached.</div>
            )}
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6">
          <button
            onClick={() => setActiveTab('qa')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'qa'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            QA Qualification Criteria & Evidence
          </button>

          <button
            onClick={() => setActiveTab('edited')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'edited'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI-Edited Transcript
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'compare'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-4 h-4" />
            Side by side
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'raw'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Raw Speaker-Labeled STT
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Audit Trail Logs
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: QA QUALIFICATION */}
          {activeTab === 'qa' && (
            <div className="space-y-6">
              {/* QA Summary Banner */}
              <div className="glass-card p-4 rounded-xl flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-label={`Score ${job.qaResultJson?.overallScore ?? 0} percent`}>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="6" />
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - (job.qaResultJson?.overallScore ?? 0) / 100)}
                      transform="rotate(-90 36 36)"
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                    <text x="36" y="40" textAnchor="middle" className="fill-slate-50 text-[13px] font-bold">
                      {job.qaResultJson?.overallScore ?? 0}
                    </text>
                  </svg>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight text-slate-50">Qualification score</h3>
                    <p className="mt-1 text-xs text-slate-400">Scored against this client’s criteria and any campaign override.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={handleCopyTranscript} className="btn-secondary">
                        {copiedTranscript ? 'Copied transcript' : 'Copy transcript'}
                      </button>
                      <button type="button" onClick={handleCopyFeedback} className="btn-secondary">
                        {copiedFeedback ? 'Copied QA notes' : 'Copy QA notes'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 rounded-xl border border-white/10 bg-[rgba(10,15,29,0.65)] p-2 lg:grid-cols-[auto_1fr_auto_auto]">
                  <input
                    type="text"
                    placeholder="Reviewer name"
                    value={reviewerName}
                    onChange={(e) => onReviewerNameChange(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ['QUALIFIED', 'Qualified', 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'],
                      ['NEEDS_REVIEW', 'Needs review', 'bg-amber-500/20 text-amber-200 border-amber-400/40'],
                      ['REJECTED', 'Rejected', 'bg-rose-500/20 text-rose-300 border-rose-400/40'],
                    ] as const).map(([value, label, tone]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOverrideStatus(value)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                          overrideStatus === value ? tone : 'border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Reason for the decision"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                  <button
                    onClick={handleApplyOverride}
                    disabled={isSubmittingOverride || !reviewerName.trim()}
                    className="btn-primary"
                  >
                    {isSubmittingOverride ? 'Saving...' : 'Save decision'}
                  </button>
                </div>
              </div>

              {(() => {
                const coaching = coachingFromScore(job.qaResultJson);
                if (!coaching) return null;
                const blocks = [
                  { title: 'Avoid on this call', items: coaching.avoid, icon: <Ban className="h-4 w-4 text-rose-300" />, tone: 'border-rose-400/30' },
                  { title: 'Say this instead', items: coaching.sayInstead, icon: <MessageSquareQuote className="h-4 w-4 text-sky-300" />, tone: 'border-sky-400/30' },
                  { title: 'How to improve the next call', items: coaching.improve, icon: <Lightbulb className="h-4 w-4 text-amber-300" />, tone: 'border-amber-400/30' },
                ];
                return (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Agent coaching from this call</h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-200">{coaching.summary}</p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {blocks.map((block) => (
                        <div key={block.title} className={`rounded-xl border bg-[rgba(10,15,29,0.45)] p-3 ${block.tone}`}>
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-100">
                            {block.icon}
                            {block.title}
                          </div>
                          <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                            {block.items.length === 0 && <li>Nothing specific from this recording.</li>}
                            {block.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Checklist Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Verification Requirements Checklist
                </h4>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                  {job.qaResultJson?.checklist?.map((item) => (
                    <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {item.isMet ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{item.requirement}</div>
                          <div className="text-xs text-slate-400 mt-1 italic">
                            &ldquo;{item.evidence}&rdquo;
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          item.isMet
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.isMet ? 'PASSED' : 'MISSING'}
                      </span>
                    </div>
                  )) || (
                    <div className="p-4 text-xs text-slate-500 text-center">No checklist data available.</div>
                  )}
                </div>
              </div>

              {/* Review Reasons & Supporting Evidence Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4 rounded-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                    Supporting Transcript Evidence
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {job.qaResultJson?.supportingEvidence?.map((ev, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{ev}</span>
                      </li>
                    )) || <li className="text-slate-500 italic">None logged.</li>}
                  </ul>
                </div>

                <div className="glass-card p-4 rounded-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    Review Reasons & Missing Items
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {job.qaResultJson?.reviewReasons?.map((rr, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{rr}</span>
                      </li>
                    ))}
                    {job.qaResultJson?.missingRequirements?.map((mr, idx) => (
                      <li key={`m-${idx}`} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>Missing: {mr}</span>
                      </li>
                    ))}
                    {(!job.qaResultJson?.reviewReasons?.length &&
                      !job.qaResultJson?.missingRequirements?.length) && (
                      <li className="text-slate-500 italic">
                        {job.qaResultJson ? 'No review notes.' : 'This lead has not been scored yet.'}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[rgba(10,15,29,0.55)] p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Raw STT transcript</h3>
                <div className="space-y-2">
                  {(job.rawTranscript?.utterances || []).length === 0 && (
                    <p className="text-xs text-slate-500">No raw transcript yet.</p>
                  )}
                  {job.rawTranscript?.utterances?.map((utt, idx) => (
                    <div key={idx} className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${idx % 2 === 0 ? 'bg-slate-800 text-slate-100' : 'ml-auto bg-indigo-500/15 text-indigo-100'}`}>
                      <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">{utt.speakerName || `Speaker ${utt.speakerTag}`}</div>
                      {utt.transcript}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[rgba(10,15,29,0.55)] p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">AI cleaned transcript</h3>
                <div
                  className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200"
                  dangerouslySetInnerHTML={{
                    __html: highlightEntities(job.editedTranscript || 'No edited transcript yet.', [
                      job.lead?.contactName || '',
                      job.lead?.companyName || '',
                      job.lead?.country || '',
                    ]),
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: AI-EDITED TRANSCRIPT */}
          {activeTab === 'edited' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Cleaned & Formatted Transcript (Gemini AI)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prompt Version Tag: <code className="text-blue-400 font-mono">{job.promptVersionUsed || 'Standard v1'}</code>
                  </p>
                </div>

                {!isEditingTranscript ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyTranscript}
                      disabled={!job.editedTranscript}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{copiedTranscript ? 'Copied Transcript!' : 'Copy Edited Transcript'}</span>
                    </button>

                    <button
                      onClick={handleCopyFeedback}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{copiedFeedback ? 'Copied Feedback!' : 'Copy Agent Feedback'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditedText(job.editedTranscript || '');
                        setIsEditingTranscript(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit Manually</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingTranscript(false)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingEdit ? 'Saving...' : 'Save Manual Edit'}</span>
                    </button>
                  </div>
                )}
              </div>

              {isEditingTranscript ? (
                <textarea
                  rows={14}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full p-4 bg-slate-950 border border-blue-500/40 rounded-xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {job.editedTranscript || 'No edited transcript generated yet.'}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW SPEAKER-LABELED STT */}
          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Google Speech-to-Text Diarization & Word Offsets
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Confidence: {((job.rawTranscript?.confidence || 0.95) * 100).toFixed(1)}% | Duration:{' '}
                  {job.rawTranscript?.durationSeconds || job.lead?.durationSeconds || 0}s
                </span>
              </div>

              <div className="space-y-3">
                {job.rawTranscript?.utterances?.map((utt, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border ${
                      utt.speakerTag === 1
                        ? 'bg-blue-950/20 border-blue-900/30 text-blue-100'
                        : 'bg-indigo-950/20 border-indigo-900/30 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-blue-400">{utt.speakerName}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {utt.startTime} - {utt.endTime}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{utt.transcript}</p>
                  </div>
                )) || (
                  <div className="p-5 text-xs text-slate-500 text-center">No raw transcript available.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Processing Lifecycle & Manual Override Audit Log
              </h3>
              <div className="relative border-l-2 border-slate-800 ml-3 space-y-6 py-2">
                {job.auditLogs?.map((log) => (
                  <div key={log.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-blue-500" />
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-200">{log.action}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                  </div>
                )) || (
                  <div className="pl-6 text-xs text-slate-500">No audit logs recorded.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
