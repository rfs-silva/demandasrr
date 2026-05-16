import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { StatusSolicitacao } from '@shared/api/types';
import { STATUS_LABEL, STATUS_TRANSITIONS } from '@shared/constants/solicitacao';

import StatusBadge from './StatusBadge';

interface Props {
  status: StatusSolicitacao;
  disabled?: boolean;
  transitions?: StatusSolicitacao[];
  getOptionLabel?: (next: StatusSolicitacao) => string;
  onChange: (next: StatusSolicitacao) => void;
}

/**
 * Dropdown próprio (sem HeadlessUI) para mudança de status.
 * Implementação simples e estável — não tem o bug `slots of undefined`
 * que vimos no Vue 1.7. Click-fora, Escape, ARIA correto.
 */
export default function StatusChanger({
  status,
  disabled,
  transitions,
  getOptionLabel,
  onChange,
}: Props) {
  const next = useMemo(
    () => transitions ?? STATUS_TRANSITIONS[status],
    [status, transitions],
  );
  const terminal = next.length === 0;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, 176);
      const left = Math.max(8, rect.right - width);
      setMenuStyle({
        top: rect.bottom + 6,
        left,
        width,
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (!open) return;
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (terminal) {
    return <StatusBadge status={status} />;
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 hover:border-border hover:bg-surface-muted"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Alterar status (atual: ${STATUS_LABEL[status]})`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <StatusBadge status={status} />
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-muted transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="fixed z-[80] origin-top-right rounded-md border border-border bg-surface py-1 shadow-pop focus:outline-none"
          style={menuStyle ? {
            top: `${menuStyle.top}px`,
            left: `${menuStyle.left}px`,
            width: `${menuStyle.width}px`,
          } : undefined}
        >
          <p className="px-3 py-1 text-2xs uppercase tracking-wide text-ink-subtle">
            Mover para
          </p>
          {next.map((n) => (
            <button
              key={n}
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange(n);
                setOpen(false);
              }}
            >
              <span>{getOptionLabel ? getOptionLabel(n) : STATUS_LABEL[n]}</span>
              <Check className="h-4 w-4 text-brand-600 opacity-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
