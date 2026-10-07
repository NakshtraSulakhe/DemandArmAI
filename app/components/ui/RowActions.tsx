'use client';

import React, { useEffect, useState } from 'react';
import { Eye, Play, RotateCw, Sparkles } from 'lucide-react';
import { ProcessingJobItem } from '../../../lib/types';
import JobProgress, { isLiveStatus } from './JobProgress';

interface RowActionsProps {
  job: ProcessingJobItem;
  reviewLabel?: string;
  onSelect: (job: ProcessingJobItem) => void;
  onRetry: (jobId: string) => void;
  onFinished: (job: ProcessingJobItem) => void;
  onError: (message: string) => void;
  showCompletedActions?: boolean;
}

export default function RowActions({
  job,
  reviewLabel = 'Review',
  onSelect,
  onRetry,
  onFinished,
  onError,
  showCompletedActions = false,
}: RowActionsProps) {
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

  const regenerate = () => {
    if (!confirm('Regenerate the cleaned transcript and QA score for this lead? The recording is not transcribed again.')) return;
    void runRequest(`/api/jobs/${job.id}/reprocess`, 'AI_EDITING', undefined, 'This lead could not be regenerated.');
  };

  const processAgain = () => {
    if (!confirm('Start this lead again from the recording? Transcription, cleanup, and scoring will run once more.')) return;
    void runRequest(`/api/jobs/${job.id}/process`, 'AUDIO_RETRIEVED', { restart: true }, 'This lead could not be started again.');
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

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="row-action-bar" role="group" aria-label="Lead actions">
        <button type="button" onClick={() => onSelect(job)} className="action-btn action-review action-compact" title="Open this lead">
          <Eye className="h-3.5 w-3.5" />
          <span>{reviewLabel}</span>
        </button>
        {canProcess && (
          <button type="button" onClick={startProcess} className="action-btn action-process action-compact" title="Transcribe, clean, and score this call">
            <Play className="h-3 w-3 fill-current" />
            Process
          </button>
        )}
        {canRetry && (
          <button type="button" onClick={() => onRetry(job.id)} className="action-btn action-retry action-compact" title="Retry this lead">
            <RotateCw className="h-3 w-3" />
            Retry
          </button>
        )}
        {canRegenerate && (
          <button
            type="button"
            onClick={regenerate}
            className="action-btn action-regenerate action-compact"
            title="Regenerate the cleaned transcript and QA score"
          >
            <Sparkles className="h-3 w-3" />
            Regenerate
          </button>
        )}
        {canProcessAgain && (
          <button
            type="button"
            onClick={processAgain}
            className="action-btn action-retry action-compact"
            title="Process again from the recording"
          >
            <RotateCw className="h-3 w-3" />
            Restart
          </button>
        )}
      </div>
      {showProgress && <JobProgress compact status={running ? liveStatus : job.status} detail={liveError} />}
    </div>
  );
}
