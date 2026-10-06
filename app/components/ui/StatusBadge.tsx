'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Zap } from 'lucide-react';

export type StatusVariant =
  | 'qualified'
  | 'needs-review'
  | 'pending'
  | 'disqualified'
  | 'failed'
  | 'active'
  | 'stopped'
  | 'configured'
  | 'processing';

interface StatusBadgeProps {
  status: string | StatusVariant;
  customLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  customLabel,
  size = 'md',
  showDot = true,
  className = '',
}: StatusBadgeProps) {
  const norm = (status || '').toString().trim().toLowerCase();

  let variant: StatusVariant = 'pending';
  let label = customLabel || status;

  if (norm.includes('qualified') && !norm.includes('unqualified') && !norm.includes('disqualified')) {
    variant = 'qualified';
    if (!customLabel) label = 'Qualified';
  } else if (norm.includes('review')) {
    variant = 'needs-review';
    if (!customLabel) label = 'Needs Review';
  } else if (norm.includes('disqualified') || norm.includes('unqualified') || norm.includes('rejected')) {
    variant = 'disqualified';
    if (!customLabel) label = 'Disqualified';
  } else if (norm.includes('failed') || norm.includes('error')) {
    variant = 'failed';
    if (!customLabel) label = 'Failed';
  } else if (norm.includes('transcribing') || norm.includes('editing') || norm.includes('evaluating') || norm.includes('processing')) {
    variant = 'processing';
    if (!customLabel) label = 'Processing';
  } else if (norm.includes('active') || norm.includes('live')) {
    variant = 'active';
    if (!customLabel) label = 'Active';
  } else if (norm.includes('stopped') || norm.includes('paused') || norm.includes('lock')) {
    variant = 'stopped';
    if (!customLabel) label = 'Stopped';
  } else if (norm.includes('configured')) {
    variant = 'configured';
    if (!customLabel) label = 'Configured';
  } else {
    variant = 'pending';
    if (!customLabel) label = 'Pending QA';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-[11px]',
    lg: 'px-3 py-1.5 text-xs',
  };

  const styleMap: Record<StatusVariant, string> = {
    qualified:
      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 light-mode:bg-emerald-50 light-mode:text-emerald-700 light-mode:border-emerald-200',
    'needs-review':
      'bg-amber-500/15 text-amber-400 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 light-mode:bg-amber-50 light-mode:text-amber-700 light-mode:border-amber-200',
    pending:
      'bg-blue-500/15 text-blue-400 border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30 light-mode:bg-blue-50 light-mode:text-blue-700 light-mode:border-blue-200',
    disqualified:
      'bg-rose-500/15 text-rose-400 border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 light-mode:bg-rose-50 light-mode:text-rose-700 light-mode:border-rose-200',
    failed:
      'bg-rose-500/15 text-rose-400 border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 light-mode:bg-rose-50 light-mode:text-rose-700 light-mode:border-rose-200',
    processing:
      'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30 light-mode:bg-indigo-50 light-mode:text-indigo-700 light-mode:border-indigo-200',
    active:
      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 light-mode:bg-emerald-50 light-mode:text-emerald-700 light-mode:border-emerald-200',
    stopped:
      'bg-amber-500/15 text-amber-400 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 light-mode:bg-amber-50 light-mode:text-amber-700 light-mode:border-amber-200',
    configured:
      'bg-blue-500/15 text-blue-400 border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30 light-mode:bg-blue-50 light-mode:text-blue-700 light-mode:border-blue-200',
  };

  const dotColors: Record<StatusVariant, string> = {
    qualified: 'bg-emerald-400',
    'needs-review': 'bg-amber-400',
    pending: 'bg-blue-400 animate-pulse',
    disqualified: 'bg-rose-400',
    failed: 'bg-rose-400',
    processing: 'bg-indigo-400 animate-spin',
    active: 'bg-emerald-400',
    stopped: 'bg-amber-400',
    configured: 'bg-blue-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${sizeClasses[size]} ${styleMap[variant]} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      <span className="truncate">{label}</span>
    </span>
  );
}
