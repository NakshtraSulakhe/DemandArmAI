'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type PopupTone = 'danger' | 'default' | 'success' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface MessageOptions {
  title: string;
  message: string;
  tone?: 'success' | 'warning' | 'info';
}

interface DialogState {
  title: string;
  message: string;
  tone: PopupTone;
  confirmLabel: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

const PopupContext = createContext<{
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  message: (options: MessageOptions) => Promise<void>;
} | null>(null);

export function usePopup() {
  const popup = useContext(PopupContext);
  if (!popup) {
    throw new Error('Popup is not available on this screen.');
  }
  return popup;
}

export default function PopupProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [queue, setQueue] = useState<DialogState[]>([]);
  const dialogRef = useRef<DialogState | null>(null);

  const show = useCallback((next: DialogState | null) => {
    dialogRef.current = next;
    setDialog(next);
  }, []);

  useEffect(() => {
    if (dialog || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    show(next);
  }, [dialog, queue, show]);

  const open = useCallback((next: DialogState) => {
    if (dialogRef.current) {
      setQueue((waiting) => [...waiting, next]);
      return;
    }
    show(next);
  }, [show]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      open({
        title: options.title,
        message: options.message,
        tone: options.tone || 'default',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        resolve,
      });
    });
  }, [open]);

  const message = useCallback((options: MessageOptions) => {
    return new Promise<void>((resolve) => {
      open({
        title: options.title,
        message: options.message,
        tone: options.tone || 'info',
        confirmLabel: 'OK',
        resolve: () => resolve(),
      });
    });
  }, [open]);

  const close = (accepted: boolean) => {
    const current = dialogRef.current;
    show(null);
    current?.resolve(accepted);
  };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  return (
    <PopupContext.Provider value={{ confirm, message }}>
      {children}
      {dialog && (
        <div className="app-popup-backdrop" onClick={() => close(false)}>
          <div
            className={`app-popup app-popup-${dialog.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="app-popup-title">{dialog.title}</h3>
            <p>{dialog.message}</p>
            <div className="app-popup-actions">
              {dialog.cancelLabel && (
                <button type="button" className="app-popup-cancel" onClick={() => close(false)} autoFocus>
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                type="button"
                className={dialog.tone === 'danger' ? 'app-popup-danger' : 'app-popup-ok'}
                onClick={() => close(true)}
                autoFocus={!dialog.cancelLabel}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}
