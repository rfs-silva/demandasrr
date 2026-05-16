import clsx from 'clsx';
import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Pessoa } from '@shared/api/types';
import { useDebounce } from '@shared/hooks/useDebounce';

import { usePessoasQuery } from '../queries/use-pessoas';

interface Props {
  modelValue: string | null;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (id: string | null, pessoa?: Pessoa | null) => void;
}

/**
 * Autocomplete async de Pessoa — busca pelo nome/CPF com debounce.
 * Implementado direto (sem HeadlessUI) para evitar os bugs de transição que
 * vimos no Vue. Mostra a pessoa selecionada como "chip" no campo.
 */
export default function PessoaAutocomplete({
  modelValue,
  label,
  required,
  disabled,
  error,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filter = useMemo(
    () => ({
      page: 1,
      page_size: 10,
      search: debouncedSearch.trim() || undefined,
      situacao: 'ativo' as const,
    }),
    [debouncedSearch],
  );

  const { data, isFetching } = usePessoasQuery(filter);
  const opcoes = data?.data ?? [];

  // Pessoa selecionada (mostrada como chip).
  const [selecionada, setSelecionada] = useState<Pessoa | null>(null);

  // Quando trocar o modelValue externamente, sincroniza (apenas mantém o chip
  // se a pessoa estiver na lista mais recente).
  useEffect(() => {
    if (!modelValue) {
      setSelecionada(null);
      return;
    }
    const found = opcoes.find((p) => p.id === modelValue);
    if (found) setSelecionada(found);
  }, [modelValue, opcoes]);

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

  function escolher(p: Pessoa): void {
    setSelecionada(p);
    setSearch('');
    setOpen(false);
    onChange(p.id, p);
  }

  function limpar(): void {
    setSelecionada(null);
    setSearch('');
    onChange(null, null);
  }

  return (
    <div className="w-full" ref={rootRef}>
      {label ? (
        <p className="field-label">
          {label}
          {required ? <span className="text-red-600">&nbsp;*</span> : null}
        </p>
      ) : null}

      {selecionada ? (
        <div
          className={clsx(
            'flex items-center justify-between gap-2 rounded-md border bg-surface px-3 py-2 shadow-sm',
            error ? 'border-red-300' : 'border-border',
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{selecionada.nome}</p>
            <p className="truncate text-2xs text-ink-muted">{selecionada.cpf}</p>
          </div>
          <button
            type="button"
            aria-label="Trocar pessoa"
            disabled={disabled}
            onClick={limpar}
            className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por nome ou CPF…"
            disabled={disabled}
            aria-invalid={!!error}
            className={clsx(
              'block w-full rounded-md border bg-surface py-2 pl-9 pr-9 text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
                : 'border-border focus:border-brand-500 focus:ring-brand-500/30',
              disabled && 'cursor-not-allowed bg-surface-muted',
            )}
          />
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />

          {open && (
            <div
              role="listbox"
              className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-pop focus:outline-none"
            >
              {isFetching && (
                <p className="px-3 py-2 text-xs text-ink-muted">Buscando…</p>
              )}
              {!isFetching && opcoes.length === 0 && (
                <p className="px-3 py-2 text-xs text-ink-muted">
                  Nenhuma pessoa encontrada.
                </p>
              )}
              {opcoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-muted"
                  onClick={() => escolher(p)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.nome}</p>
                    <p className="truncate text-2xs text-ink-muted">
                      {p.cpf} · {p.municipio.nome}
                      {p.localidade ? ` — ${p.localidade}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
