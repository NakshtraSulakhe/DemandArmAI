'use client';

import React from 'react';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3 animate-pulse p-4">
      <div className="h-9 bg-slate-800/60 rounded-xl w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-900/40 border border-slate-800/40 rounded-xl w-full flex items-center justify-between px-4 gap-4">
          <div className="h-4 bg-slate-800 rounded w-12" />
          <div className="h-4 bg-slate-800 rounded w-28" />
          <div className="h-4 bg-slate-800 rounded w-48" />
          <div className="h-4 bg-slate-800 rounded w-36" />
          <div className="h-4 bg-slate-800 rounded w-24" />
          <div className="h-6 bg-slate-800 rounded-full w-20" />
          <div className="h-8 bg-slate-800 rounded-xl w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/60 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-slate-800 rounded w-24" />
        <div className="h-4 w-4 bg-slate-800 rounded" />
      </div>
      <div className="h-7 bg-slate-800 rounded w-16" />
      <div className="h-2.5 bg-slate-800/60 rounded w-32" />
    </div>
  );
}
