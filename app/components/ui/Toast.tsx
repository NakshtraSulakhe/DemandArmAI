'use client';

export interface ToastItem {
  id: string;
  tone: 'info' | 'success' | 'warning';
  message: string;
}

export default function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[min(100%,22rem)] px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs shadow-none ${
            toast.tone === 'success'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-100'
              : toast.tone === 'warning'
              ? 'bg-amber-950 border-amber-700 text-amber-100'
              : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}
        >
          <p>{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-[11px] font-semibold opacity-70 hover:opacity-100"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
