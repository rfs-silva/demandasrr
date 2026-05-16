import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { messageFor } from '@shared/api/error-messages';
import type { AcaoAudit, AuditLog, EntidadeAudit } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BasePagination from '@shared/components/BasePagination';
import BaseSelect from '@shared/components/BaseSelect';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { useDebounce } from '@shared/hooks/useDebounce';
import { formatDateTimeBR, tempoRelativo } from '@shared/utils/date';

import {
  ACAO_LABEL,
  ACAO_TONE,
  ACOES,
  ENTIDADE_LABEL,
  ENTIDADES,
  TONE_CLASSES,
} from '../constants';
import { useAuditoriaQuery } from '../queries/use-auditoria';

function iniciais(nome: string | null): string {
  if (!nome) return '·';
  return (
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '·'
  );
}

function temDetalhes(r: AuditLog): boolean {
  return !!r.detalhes && Object.keys(r.detalhes).length > 0;
}

function jsonPretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default function AuditoriaView() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [acaoFilter, setAcaoFilter] = useState<AcaoAudit | null>(null);
  const [entidadeFilter, setEntidadeFilter] = useState<EntidadeAudit | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const filter = useMemo(
    () => ({
      page,
      page_size: pageSize,
      acao: acaoFilter ?? undefined,
      entidade: entidadeFilter ?? undefined,
      search: debouncedSearch || undefined,
    }),
    [page, acaoFilter, entidadeFilter, debouncedSearch],
  );

  const { data, isLoading, isFetching, error, refetch } = useAuditoriaQuery(filter);
  const rows: AuditLog[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  function toggle(id: string): void {
    const set = new Set(expandido);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setExpandido(set);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Administração"
        title="Auditoria"
        description="Registro de ações sensíveis: login, gestão de usuários, solicitações e anexos."
        actions={
          <BaseButton
            variant="secondary"
            size="sm"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Atualizar
          </BaseButton>
        }
      />

      {/* Filtros */}
      <div className="card p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="a-search" className="field-label">
              Buscar
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <input
                id="a-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Por usuário, login ou alvo"
                className="block w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>
          <div className="sm:col-span-3">
            <BaseSelect
              label="Ação"
              placeholder="Todas"
              options={ACOES}
              value={acaoFilter}
              onChange={(v) => {
                setAcaoFilter(v as AcaoAudit | null);
                setPage(1);
              }}
            />
          </div>
          <div className="sm:col-span-3">
            <BaseSelect
              label="Entidade"
              placeholder="Todas"
              options={ENTIDADES}
              value={entidadeFilter}
              onChange={(v) => {
                setEntidadeFilter(v as EntidadeAudit | null);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
            >
              <BaseSkeleton width="2.25rem" height="2.25rem" rounded="full" />
              <div className="flex-1 space-y-2">
                <BaseSkeleton width="40%" />
                <BaseSkeleton width="70%" />
              </div>
              <BaseSkeleton width="4rem" />
            </div>
          ))
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-300">{messageFor(error)}</p>
            <BaseButton className="mt-2" variant="secondary" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </BaseButton>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum evento de auditoria"
            description="Quando ações forem realizadas, o histórico aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {rows.map((r) => {
              const aberto = expandido.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-expanded={aberto}
                    aria-controls={`audit-${r.id}`}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted focus:outline-none focus-visible:bg-surface-muted"
                    onClick={() => toggle(r.id)}
                  >
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                      aria-hidden
                    >
                      {iniciais(r.actor_nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium',
                            TONE_CLASSES[ACAO_TONE[r.acao]],
                          )}
                        >
                          {ACAO_LABEL[r.acao]}
                        </span>
                        <span className="truncate text-sm font-medium text-ink">
                          {r.actor_nome ?? 'Sistema'}
                        </span>
                        {r.actor_login && (
                          <span className="text-2xs text-ink-subtle">@{r.actor_login}</span>
                        )}
                        <span className="text-2xs text-ink-subtle">·</span>
                        <span className="text-xs text-ink-muted">
                          {ENTIDADE_LABEL[r.entidade]}
                        </span>
                        {r.entidade_label && (
                          <>
                            <span className="text-2xs text-ink-subtle">·</span>
                            <span className="truncate text-xs text-ink-muted">
                              {r.entidade_label}
                            </span>
                          </>
                        )}
                      </div>
                      <p
                        className="mt-1 text-2xs text-ink-subtle"
                        title={formatDateTimeBR(r.created_at)}
                      >
                        {tempoRelativo(r.created_at)} · {formatDateTimeBR(r.created_at)}
                        {r.ip ? ` · IP ${r.ip}` : ''}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        'mt-1 flex-none rounded-md p-1 text-ink-subtle',
                        !temDetalhes(r) && 'opacity-40',
                      )}
                      aria-hidden
                    >
                      {aberto ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                  </button>

                  {aberto && temDetalhes(r) && (
                    <div
                      id={`audit-${r.id}`}
                      className="border-t border-border-subtle bg-surface-muted/40 px-4 py-3"
                    >
                      <p className="section-eyebrow mb-2">Detalhes</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-surface p-3 text-xs text-ink">
                        {jsonPretty(r.detalhes)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border bg-surface-muted px-4">
          <BasePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {isFetching && !isLoading && (
        <p className="text-xs text-ink-muted" aria-live="polite">
          Atualizando…
        </p>
      )}
    </section>
  );
}
