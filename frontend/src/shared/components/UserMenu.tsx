import clsx from 'clsx';
import {
  ChevronDown,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@features/auth/store';
import { PERFIL_LABEL } from '@shared/constants/perfis';
import { useToast } from './ToastHost';

export default function UserMenu() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Fecha ao clicar fora ou Esc.
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

  if (!me) return null;

  const iniciais =
    me.nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  const perfilLabel = PERFIL_LABEL[me.perfil] ?? '';

  async function fazerLogout(): Promise<void> {
    await logout();
    toast.info('Você saiu da sua conta.');
    navigate('/login', { replace: true });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="group inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu de ${me.nome}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-xs"
          aria-hidden
        >
          {iniciais}
        </span>
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-sm font-medium text-ink">{me.nome}</span>
          <span className="block text-2xs text-ink-muted">{perfilLabel}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-muted sm:block" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-xl border border-border bg-surface py-1 shadow-pop focus:outline-none"
        >
          {/* Header */}
          <div className="border-b border-border px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-ink">{me.nome}</p>
            <p className="truncate text-xs text-ink-muted">@{me.login}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-ink-muted">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {perfilLabel}
              {me.eh_root && (
                <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  root
                </span>
              )}
            </div>
          </div>

          <div className="py-1">
            <MenuButton
              icon={User}
              label="Meu perfil"
              onClick={() => {
                setOpen(false);
                navigate('/perfil');
              }}
            />
            <MenuButton
              icon={KeyRound}
              label="Trocar senha"
              onClick={() => {
                setOpen(false);
                navigate('/trocar-senha');
              }}
            />
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              role="menuitem"
              className={clsx(
                'flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition',
                'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-900/30 dark:hover:text-red-200',
              )}
              onClick={fazerLogout}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
