'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { create } from 'zustand';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Duration in ms before auto-dismiss. Defaults to 5000. */
  duration?: number;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast(toast) {
    const id = `toast-${++nextId}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },

  removeToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  const toast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      return addToast({ type, message, duration });
    },
    [addToast],
  );

  return {
    toast,
    success: (message: string, duration?: number) =>
      toast('success', message, duration),
    error: (message: string, duration?: number) =>
      toast('error', message, duration),
    warning: (message: string, duration?: number) =>
      toast('warning', message, duration),
    info: (message: string, duration?: number) =>
      toast('info', message, duration),
    dismiss: removeToast,
  };
}

// ─── Style config per type ──────────────────────────────────────────────────

const typeConfig: Record<
  ToastType,
  { border: string; bg: string; text: string; icon: ReactNode }
> = {
  success: {
    border: 'border-emerald-700/50',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  error: {
    border: 'border-crimson-700/50',
    bg: 'bg-crimson-950/80',
    text: 'text-crimson-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  warning: {
    border: 'border-gold-700/50',
    bg: 'bg-gold-950/80',
    text: 'text-gold-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    border: 'border-charcoal-600/50',
    bg: 'bg-charcoal-800/80',
    text: 'text-parchment-300',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

// ─── Individual Toast Item ──────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = typeConfig[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, removeToast]);

  return (
    <div
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-card border px-4 py-3',
        'shadow-card backdrop-blur-sm',
        'animate-slide-in-right',
        config.border,
        config.bg,
        config.text,
      ].join(' ')}
      role="alert"
    >
      {/* Icon */}
      <span className="mt-0.5 shrink-0">{config.icon}</span>

      {/* Message */}
      <p className="flex-1 text-sm">{toast.message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Toast Container (render in layout) ─────────────────────────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
