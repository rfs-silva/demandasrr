import { AlertTriangle } from 'lucide-react';
import { create } from 'zustand';

import BaseButton from './BaseButton';
import BaseModal from './BaseModal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingState extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

interface ConfirmStore {
  pending: PendingState | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  pending: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { ...opts, resolve } });
    }),
  resolve: (v) => {
    const p = get().pending;
    if (p) {
      p.resolve(v);
      set({ pending: null });
    }
  },
}));

/** Hook ergonômico — usa await confirm({...}) em qualquer handler. */
export function useConfirm() {
  return {
    confirm: useConfirmStore((s) => s.ask),
  };
}

/** Renderizado uma única vez na raiz do app. */
export default function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending);
  const resolve = useConfirmStore((s) => s.resolve);

  return (
    <BaseModal
      open={!!pending}
      onClose={() => resolve(false)}
      title={pending?.title ?? 'Confirmar ação'}
      size="sm"
      closeOnBackdrop={true}
      footer={
        <>
          <BaseButton variant="secondary" onClick={() => resolve(false)}>
            {pending?.cancelLabel ?? 'Cancelar'}
          </BaseButton>
          <BaseButton
            variant={pending?.danger ? 'danger' : 'primary'}
            onClick={() => resolve(true)}
          >
            {pending?.confirmLabel ?? 'Confirmar'}
          </BaseButton>
        </>
      }
    >
      <div className="flex gap-3">
        {pending?.danger && (
          <span
            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
        )}
        <p className="text-sm leading-relaxed text-ink">{pending?.message}</p>
      </div>
    </BaseModal>
  );
}
