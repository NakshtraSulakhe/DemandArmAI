'use client';

import React, { useEffect, useState } from 'react';
import { Eye, Play, RotateCw, SkipForward, Trash2, Undo2, Sparkles } from 'lucide-react';
import { ProcessingJobItem } from '../../../lib/types';
import JobProgress, { isLiveStatus } from './JobProgress';
import { usePopup } from './Popup';

interface RowActionsProps {
  job: ProcessingJobItem;
  reviewLabel?: string;
  onSelect: (job: ProcessingJobItem) => void;
  onRetry: (jobId: string) => void;
  onFinished: (job: ProcessingJobItem) => void;
  onError: (message: string) => void;
  showCompletedActions?: boolean;
  allowSkip?: boolean;
  allowRestore?: boolean;
  onMoved?: (job: ProcessingJobItem) => void;
  onDeleted?: () => void;
}

export default function RowActions({
  job,
  reviewLabel = 'Review',
  onSelect,
  onRetry,
  onFinished,
  onError,
  showCompletedActions = false,
  allowSkip = false,
  allowRestore = false,
  onMoved,
  onDeleted,
}: RowActionsProps) {
  const popup = usePopup();
  const [running, setRunning] = useState(false);
  const [liveStatus, setLiveStatus] = useState(job.status);
  const [liveError, setLiveError] = useState(job.stepError || '');

  useEffect(() => {
    if (!running) {
      setLiveStatus(job.status);
      setLiveError(job.stepError || '');
    }
  }, [job.status, job.stepError, running]);

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`);
        const data = await res.json();
        if (stopped || !data.success || !data.job) return;
        setLiveStatus(data.job.status);
        setLiveError(data.job.stepError || '');
      } catch {
        /* the process request still owns the result */
      }
    };
    const timer = setInterval(poll, 1200);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [running, job.id]);

  const runRequest = async (
    url: string,
    startStatus: ProcessingJobItem['status'],
    body?: Record<string, boolean>,
    failureMessage = 'This lead could not be processed.'
  ) => {
    setRunning(true);
    setLiveStatus(startStatus);
    setLiveError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!data.success || !data.job) {
        if (data.job) onFinished(data.job);
        onError(data.error || failureMessage);
        return;
      }
      setLiveStatus(data.job.status);
      onFinished(data.job);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : failureMessage);
    } finally {
      setRunning(false);
    }
  };

  const startProcess = () => runRequest(`/api/jobs/${job.id}/process`, 'AUDIO_RETRIEVED');

  const regenerate = async () => {
    const accepted = await popup.confirm({
      title: 'Regenerate this lead',
      message: 'Regenerate the cleaned transcript and QA score for this lead? The recording is not transcribed again.',
      confirmLabel: 'Regenerate',
    });
    if (!accepted) return;
    void runRequest(`/api/jobs/${job.id}/reprocess`, 'AI_EDITING', undefined, 'This lead could not be regenerated.');
  };

  const moveLead = (restore: boolean) => {
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}/skip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restore }),
        });
        const data = await res.json();
        if (!data.success || !data.job) {
          onError(data.error || 'This lead could not be moved.');
          return;
        }
        onMoved?.(data.job);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : 'This lead could not be moved.');
      }
    })();
  };

  const processAgain = async () => {
    const accepted = await popup.confirm({
      title: 'Restart this lead',
      message: 'Start this lead again from the recording? Transcription, cleanup, and scoring will run once more.',
      confirmLabel: 'Restart',
    });
    if (!accepted) return;
    void runRequest(`/api/jobs/${job.id}/process`, 'AUDIO_RETRIEVED', { restart: true }, 'This lead could not be started again.');
  };

  const deleteLead = async () => {
    const leadName = job.lead?.companyName || job.lead?.contactName || 'this lead';
    if (running || isLiveStatus(job.status)) {
      await popup.message({
        title: 'Lead is processing',
        message: `${leadName} is still being processed. Wait until it finishes, then delete it.`,
        tone: 'warning',
      });
      return;
    }
    const accepted = await popup.confirm({
      title: 'Delete lead',
      message: `Delete ${leadName}? It leaves the queue and All Leads, and the pipeline will not pick it up again.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!accepted) return;
    try {
      const res = await fetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [job.id] }),
      });
      const data = await res.json();
      if (!data.success) {
        await popup.message({ title: 'Could not delete', message: data.error || 'This lead could not be deleted.', tone: 'warning' });
        return;
      }
      onDeleted?.();
      await popup.message({ title: 'Lead deleted', message: `${leadName} has been deleted.`, tone: 'success' });
    } catch (err: unknown) {
      await popup.message({
        title: 'Could not delete',
        message: err instanceof Error ? err.message : 'This lead could not be deleted.',
        tone: 'warning',
      });
    }
  };

  const showProgress = running || isLiveStatus(job.status);
  const canProcess = !showProgress && !String(job.id).startsWith('stored_') && (job.status === 'PENDING' || (job.status as string) === 'QUEUED');
  const canRetry =
    !showProgress &&
    (job.status === 'FAILED' ||
      job.status === 'CONFIGURATION_REQUIRED' ||
      job.status === 'CAMPAIGN_CONFIGURATION_REQUIRED');
  const canRegenerate = showCompletedActions && !showProgress && job.status === 'COMPLETED' && !!job.rawTranscript;
  const canProcessAgain = showCompletedActions && !showProgress && job.status === 'COMPLETED';
  const canSkip = allowSkip && !showProgress && !String(job.id).startsWith('stored_') && job.status !== 'COMPLETED' && job.status !== 'SKIPPED';
  const canRestore = allowRestore && !showProgress && job.status === 'SKIPPED';

  const primary = canProcess
    ? { label: 'Process', title: 'Transcribe, clean, and score this call', className: 'action-process', icon: <Play className="h-3 w-3 fill-current" />, onClick: startProcess }
    : canRetry
      ? { label: 'Retry', title: 'Retry this lead', className: 'action-retry', icon: <RotateCw className="h-3 w-3" />, onClick: () => onRetry(job.id) }
      : canRestore
        ? { label: 'Return', title: 'Return this lead to the active queue', className: 'action-restore', icon: <Undo2 className="h-3 w-3" />, onClick: () => moveLead(true) }
        : null;

  const iconButton = (label: string, className: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" onClick={onClick} className={`action-btn action-icon ${className}`} title={label} aria-label={label}>
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="row-action-bar" role="group" aria-label="Lead actions">
        {primary ? (
          <>
            <button type="button" onClick={primary.onClick} className={`action-btn action-compact ${primary.className}`} title={primary.title}>
              {primary.icon}
              {primary.label}
            </button>
            {iconButton(`${reviewLabel} this lead`, 'action-review', <Eye className="h-3.5 w-3.5" />, () => onSelect(job))}
          </>
        ) : (
          <button type="button" onClick={() => onSelect(job)} className="action-btn action-review action-compact" title="Open this lead">
            <Eye className="h-3.5 w-3.5" />
            {reviewLabel}
          </button>
        )}
        {canSkip && iconButton('Skip this lead. It moves to the Skipped tab and is not processed.', 'action-skip', <SkipForward className="h-3.5 w-3.5" />, () => moveLead(false))}
        {canRegenerate && iconButton('Regenerate the cleaned transcript and QA score', 'action-regenerate', <Sparkles className="h-3.5 w-3.5" />, () => void regenerate())}
        {canProcessAgain && iconButton('Restart from the recording', 'action-retry', <RotateCw className="h-3.5 w-3.5" />, () => void processAgain())}
        {iconButton('Delete this lead', 'action-delete', <Trash2 className="h-3.5 w-3.5" />, () => void deleteLead())}
      </div>
      {showProgress && <JobProgress compact status={running ? liveStatus : job.status} detail={liveError} />}
    </div>
  );
}
