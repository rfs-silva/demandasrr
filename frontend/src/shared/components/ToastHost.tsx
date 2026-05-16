import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';

/** Variantes visuais. */
type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  variant: ToastVariant;
  message: ReactNode;
  /** Duração em ms (default 4000). 0 = persistente até fechar. */
  duration: number;
}

interface ToastStore {
  items: Toast[];
  push: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
}

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ items: [...s.items, { id, ...t }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/**
 * Hook ergonômico — espelha a API do useToast do Vue:
 *   toast.success('OK'), toast.error('Erro'), etc.
 */
export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);
  return {
    show: (message: ReactNode, variant: ToastVariant = 'info', duration = 4000) =>
      push({ message, variant, duration }),
    info: (message: ReactNode, duration = 4000) =>
      push({ message, variant: 'info', duration }),
    success: (message: ReactNode, duration = 3500) =>
      push({ message, variant: 'success', duration }),
    warning: (message: ReactNode, duration = 5000) =>
      push({ message, variant: 'warning', duration }),
    error: (message: ReactNode, duration = 6000) =>
      push({ message, variant: 'error', duration }),
    dismiss,
  };
}

const ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const COLORS: Record<ToastVariant, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const Icon = ICONS[t.variant];
  useEffect(() => {
    if (t.duration <= 0) return;
    const handle = window.setTimeout(onDismiss, t.duration);
    return () => window.clearTimeout(handle);
  }, [t.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3 shadow-pop',
        COLORS[t.variant],
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden />
      <div className="flex-1 text-sm leading-snug">{t.message}</div>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onDismiss}
        className="rounded p-0.5 text-current/70 transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-4 sm:left-auto sm:right-4 sm:top-auto sm:items-end">
      {items.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
