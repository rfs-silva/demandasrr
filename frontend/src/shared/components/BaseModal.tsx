import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: Size;
  closeOnBackdrop?: boolean;
  children: ReactNode;
  /** Slot do rodapé (botões de ação). */
  footer?: ReactNode;
}

const SIZE: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal acessível baseado no HeadlessUI React 2.x (versão estável — sem o bug
 * de `slots of undefined` que tínhamos no Vue 1.7).
 */
export default function BaseModal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  children,
  footer,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={closeOnBackdrop ? onClose : () => undefined}
      className="relative z-50"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition duration-150 data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 z-50 flex w-screen items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={clsx(
            'card w-full transform overflow-hidden p-0 text-left shadow-pop transition duration-200',
            'data-[closed]:translate-y-2 data-[closed]:opacity-0 sm:data-[closed]:scale-95',
            'rounded-t-2xl sm:rounded-xl',
            SIZE[size],
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0 flex-1">
              {title && (
                <DialogTitle className="text-base font-semibold text-ink">
                  {title}
                </DialogTitle>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar"
              className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="max-h-[70vh] overflow-y-auto px-5 py-4 sm:max-h-none">
            {children}
          </div>

          {footer && (
            <footer className="flex flex-col-reverse items-stretch gap-2 border-t border-border bg-surface-muted px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </footer>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
