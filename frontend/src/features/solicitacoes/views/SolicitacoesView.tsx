import clsx from 'clsx';
import {
  ChevronRight,
  ClipboardList,
  Paperclip,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type { Solicitacao, StatusSolicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BasePagination from '@shared/components/BasePagination';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { AREA_LABEL, STATUS_STRIPE } from '@shared/constants/solicitacao';
import { podeCriarSolicitacao } from '@shared/constants/perfis';
import { formatDateTimeBR, tempoRelativo } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';

import SolicitacaoFormDialog from '../components/SolicitacaoFormDialog';
import StatusBadge from '../components/StatusBadge';
import { useSolicitacoesQuery } from '../queries/use-solicitacoes';

const STATUS_EM_ABERTO: StatusSolicitacao[] = ['cadastrada', 'em_analise'];
const STATUS_CONCLUIDAS: StatusSolicitacao[] = ['atendida', 'indeferida', 'cancelada'];

type Aba = 'todas' | 'em_aberto' | 'concluidas';

export default function SolicitacoesView() {
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [aba, setAba] = useState<Aba>('todas');
  const [formOpen, setFormOpen] = useState(false);

  const filter = useMemo(
    () => ({ page, page_size: pageSize }),
    [page, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useSolicitacoesQuery(filter);
  const rows: Solicitacao[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const ehSolicitante = me?.perfil === 'gestor_solicitante';
  const podeCriar = !!me && podeCriarSolicitacao(me);

  // Hora local + saudação contextual (só pra solicitante, no header).
  const hour = new Date().getHours();
  const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = me?.nome.split(' ')[0] ?? '';

  // Filtragem por aba (em cima do que veio da página atual).
  const filtradas = useMemo(() => {
    if (aba === 'em_aberto') return rows.filter((r) => STATUS_EM_ABERTO.includes(r.status));
    if (aba === 'concluidas') return rows.filter((r) => STATUS_CONCLUIDAS.includes(r.status));
    return rows;
  }, [rows, aba]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      aberto: rows.filter((r) => STATUS_EM_ABERTO.includes(r.status)).length,
      concluidas: rows.filter((r) => STATUS_CONCLUIDAS.includes(r.status)).length,
    }),
    [rows],
  );

  function abrir(s: Solicitacao): void {
    navigate(`/solicitacoes/${s.id}`);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow={
          ehSolicitante ? (
            <span className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
              {saudacao}
            </span>
          ) : (
            'Atendimento'
          )
        }
        title={
          ehSolicitante
            ? `Olá, ${primeiroNome}.`
            : 'Solicitações'
        }
        description={
          ehSolicitante
            ? 'Aqui estão as suas solicitações. Clique em uma delas para ver os detalhes.'
            : 'Todas as solicitações, ordenadas pelas mais recentes.'
        }
        actions={
          podeCriar ? (
            <BaseButton onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova solicitação
            </BaseButton>
          ) : null
        }
      />

      {rows.length > 0 && (
        <nav
          className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm"
          aria-label="Filtrar por status"
        >
          {(
            [
              { key: 'todas' as const, label: 'Todas', count: counts.total },
              { key: 'em_aberto' as const, label: 'Em aberto', count: counts.aberto },
              { key: 'concluidas' as const, label: 'Concluídas', count: counts.concluidas },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={aba === t.key}
              onClick={() => setAba(t.key)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500',
                aba === t.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
              <span
                className={clsx(
                  'rounded-full px-1.5 text-2xs tabular-nums',
                  aba === t.key
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-muted text-ink-muted',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* ============ DESKTOP: tabela ============ */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-muted text-left text-2xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Data</th>
                {!ehSolicitante && (
                  <th scope="col" className="px-4 py-2.5 font-semibold">Pessoa</th>
                )}
                <th scope="col" className="px-4 py-2.5 font-semibold">Município</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Área</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Título</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="w-px px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: ehSolicitante ? 6 : 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <BaseSkeleton />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={ehSolicitante ? 6 : 7} className="px-4 py-8 text-center">
                    <p className="text-sm text-red-600 dark:text-red-300">
                      {messageFor(error)}
                    </p>
                    <BaseButton
                      className="mt-2"
                      variant="secondary"
                      size="sm"
                      onClick={() => refetch()}
                    >
                      Tentar novamente
                    </BaseButton>
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={ehSolicitante ? 6 : 7} className="py-4">
                    <EmptyState
                      icon={ClipboardList}
                      title={
                        rows.length === 0
                          ? 'Nenhuma solicitação ainda'
                          : `Nenhuma solicitação ${aba === 'em_aberto' ? 'em aberto' : aba === 'concluidas' ? 'concluída' : 'encontrada'}.`
                      }
                      description={
                        rows.length === 0 && podeCriar
                          ? "Clique em 'Nova solicitação' para registrar a primeira."
                          : undefined
                      }
                    >
                      {rows.length === 0 && podeCriar && (
                        <BaseButton size="lg" onClick={() => setFormOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Cadastrar minha primeira solicitação
                        </BaseButton>
                      )}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                filtradas.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer transition hover:bg-surface-muted"
                    onClick={() => abrir(s)}
                  >
                    <td className="relative whitespace-nowrap px-4 py-3 text-ink-muted">
                      <span
                        className={clsx('absolute inset-y-0 left-0 w-1', STATUS_STRIPE[s.status])}
                        aria-hidden
                      />
                      <p title={formatDateTimeBR(s.data_solicitacao)}>
                        {tempoRelativo(s.data_solicitacao)}
                      </p>
                      <p className="text-2xs text-ink-subtle">
                        {formatDateTimeBR(s.data_solicitacao)}
                      </p>
                    </td>
                    {!ehSolicitante && (
                      <td className="px-4 py-3 font-medium text-ink">
                        <div className="min-w-0">
                          <p className="truncate">{s.pessoa.nome}</p>
                          <p className="truncate text-xs text-ink-muted">{s.pessoa.cpf}</p>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-ink-muted">{s.municipio}</td>
                    <td className="px-4 py-3 text-ink-muted">{AREA_LABEL[s.area]}</td>
                    <td className="max-w-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                            {s.codigo}
                          </p>
                          <p className="line-clamp-1 font-medium text-ink">{s.titulo}</p>
                        </div>
                        {s.qtd_anexos > 0 && (
                          <span
                            className="inline-flex flex-none items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-medium text-ink-muted"
                            title={`${s.qtd_anexos} ${s.qtd_anexos === 1 ? 'anexo' : 'anexos'}`}
                          >
                            <Paperclip className="h-3 w-3" aria-hidden />
                            {s.qtd_anexos}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-xs text-ink-muted">{s.descricao}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border bg-surface-muted px-4">
          <BasePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* ============ MOBILE: cards ============ */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`m-sk-${i}`} className="card space-y-2 p-4">
              <BaseSkeleton width="40%" />
              <BaseSkeleton width="80%" />
              <BaseSkeleton width="60%" />
            </div>
          ))
        ) : error ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-300">{messageFor(error)}</p>
            <BaseButton className="mt-2" variant="secondary" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </BaseButton>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={ClipboardList}
              title={
                rows.length === 0
                  ? 'Nenhuma solicitação ainda'
                  : 'Nada por aqui.'
              }
              description={
                rows.length === 0 && podeCriar
                  ? "Toque em 'Nova solicitação' para registrar a primeira."
                  : undefined
              }
            >
              {rows.length === 0 && podeCriar && (
                <BaseButton size="lg" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Cadastrar minha primeira solicitação
                </BaseButton>
              )}
            </EmptyState>
          </div>
        ) : (
          filtradas.map((s) => (
            <button
              key={`m-${s.id}`}
              type="button"
              className="card card-interactive relative w-full overflow-hidden p-4 pl-5 text-left"
              onClick={() => abrir(s)}
            >
              <span
                className={clsx('absolute inset-y-0 left-0 w-1', STATUS_STRIPE[s.status])}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-2">
                <StatusBadge status={s.status} />
                <span className="whitespace-nowrap text-2xs text-ink-subtle">
                  {tempoRelativo(s.data_solicitacao)}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 font-display font-semibold tracking-tight text-ink">
                <span className="mr-2 text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {s.codigo}
                </span>
                {s.titulo}
              </p>
              <p className="line-clamp-1 text-xs text-ink-muted">
                {AREA_LABEL[s.area]} · {s.municipio}
                {!ehSolicitante && ` · ${s.pessoa.nome}`}
              </p>
              <div className="mt-2 flex items-center justify-between">
                {s.qtd_anexos > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-medium text-ink-muted">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    {s.qtd_anexos}
                  </span>
                ) : (
                  <span />
                )}
                <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden />
              </div>
            </button>
          ))
        )}
        <div className="card p-2">
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

      <SolicitacaoFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </section>
  );
}
