'use client';

import React from 'react';
import { JobStatus } from '../../../lib/types';

export function progressForStatus(status: string): { percent: number; label: string } {
  switch (status) {
    case 'AUDIO_RETRIEVED':
      return { percent: 18, label: 'Recording ready' };
    case 'TRANSCRIBING':
      return { percent: 42, label: 'Transcribing call' };
    case 'AI_EDITING':
      return { percent: 68, label: 'Cleaning transcript' };
    case 'QA_EVALUATING':
      return { percent: 88, label: 'Writing agent feedback' };
    case 'COMPLETED':
      return { percent: 100, label: 'Finished' };
    case 'FAILED':
    case 'CONFIGURATION_REQUIRED':
    case 'CAMPAIGN_CONFIGURATION_REQUIRED':
      return { percent: 100, label: 'Needs attention' };
    default:
      return { percent: 8, label: 'Starting' };
  }
}

const LIVE_STATUSES: JobStatus[] = ['AUDIO_RETRIEVED', 'TRANSCRIBING', 'AI_EDITING', 'QA_EVALUATING'];

export function isLiveStatus(status: string) {
  return LIVE_STATUSES.includes(status as JobStatus);
}

export default function JobProgress({ status, detail, compact = false }: { status: string; detail?: string; compact?: boolean }) {
  const { percent, label } = progressForStatus(status);
  const radius = 15;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`job-progress ${compact ? 'job-progress-compact' : ''}`} title={detail || label}>
      <svg viewBox="0 0 40 40" className={compact ? 'h-6 w-6 shrink-0' : 'h-10 w-10 shrink-0'} aria-label={`${percent} percent, ${label}`}>
        <circle cx="20" cy="20" r={radius} className="job-progress-track" strokeWidth="3.5" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          className="job-progress-value"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="23" textAnchor="middle" className="job-progress-text">
          {percent}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold text-slate-100">{label}</div>
        <div className="job-progress-bar mt-1">
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
