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
} from 'lucide-react';
import { ProcessingJobItem, CrmRecordingItem } from '../../lib/types';

interface LeadDetailModalProps {
  job: ProcessingJobItem | null;
  onClose: () => void;
  onRetryJob: (jobId: string) => Promise<void>;
  onSaveManualEdit: (jobId: string, editedTranscript: string) => Promise<void>;
  onOverrideQaStatus: (
    jobId: string,
    status: 'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED',
    notes: string
  ) => Promise<void>;
}

export default function LeadDetailModal({
  job,
  onClose,
  onRetryJob,
  onSaveManualEdit,
  onOverrideQaStatus,
}: LeadDetailModalProps) {
  if (!job) return null;

  const [activeTab, setActiveTab] = useState<'qa' | 'raw' | 'edited' | 'audit'>('qa');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState(job.editedTranscript || '');
  const [overrideStatus, setOverrideStatus] = useState<'QUALIFIED' | 'NEEDS_REVIEW' | 'REJECTED'>(
    (job.manualOverrideStatus as any) || job.qaStatus || 'NEEDS_REVIEW'
  );
  const [overrideNotes, setOverrideNotes] = useState(job.manualOverrideNotes || '');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Selected recording selector
  const recordingsList: CrmRecordingItem[] = job.lead?.recordings?.length
    ? job.lead.recordings
    : job.lead?.recordingUrl
    ? [{ id: '1', lead_id: job.lead.id, file_path: '', uploaded_at: '', url: job.lead.recordingUrl, download_url: job.lead.recordingUrl }]
    : [];

  const [selectedRecIdx, setSelectedRecIdx] = useState(0);
  const currentRec = recordingsList[selectedRecIdx] || null;

  const audioStreamUrl = currentRec
    ? `/api/crm/proxy-audio?url=${encodeURIComponent(currentRec.url)}`
    : '';

  const effectiveQaStatus = job.manualOverrideStatus || job.qaStatus || 'NEEDS_REVIEW';

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryJob(job.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      await onSaveManualEdit(job.id, editedText);
      setIsEditingTranscript(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApplyOverride = async () => {
    setIsSubmittingOverride(true);
    try {
      await onOverrideQaStatus(job.id, overrideStatus, overrideNotes);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
                Client Code: <strong className="text-slate-200">{job.lead?.clientCode}</strong> | Campaign Code:{' '}
                <strong className="text-slate-200">{job.lead?.campaignCode}</strong>
                {job.lead?.agentName && <span> | Agent: <strong className="text-slate-200">{job.lead.agentName}</strong></span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <audio
                  controls
                  className="w-full h-8 rounded bg-slate-800 text-xs flex-1"
                  src={audioStreamUrl}
                >
                  Your browser does not support audio element.
                </audio>
                <a
                  href={currentRec.download_url || currentRec.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
              <div className="glass-card p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-100">Qualification Score</h3>
                    <span className="text-2xl font-black text-blue-400">
                      {job.qaResultJson?.overallScore ?? 0}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Evaluated against Client standard prompt & Campaign qualification overrides.
                  </p>
                </div>

                {/* Manual Override Controls */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 w-full md:w-auto">
                  <span className="text-xs font-medium text-slate-400 shrink-0 ml-1">Override:</span>
                  <select
                    value={overrideStatus}
                    onChange={(e: any) => setOverrideStatus(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="NEEDS_REVIEW">NEEDS REVIEW</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Audit reason notes..."
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 flex-1 md:w-48 focus:outline-none"
                  />

                  <button
                    onClick={handleApplyOverride}
                    disabled={isSubmittingOverride}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isSubmittingOverride ? 'Saving...' : 'Save Audit'}
                  </button>
                </div>
              </div>

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
                      <li className="text-slate-500 italic">All qualification parameters satisfied!</li>
                    )}
                  </ul>
                </div>
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
