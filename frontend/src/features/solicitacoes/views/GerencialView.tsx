import clsx from 'clsx';
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  Paperclip,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type {
  AreaSolicitacao,
  Solicitacao,
  StatusSolicitacao,
  UsuarioResumo,
} from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BasePagination from '@shared/components/BasePagination';
import BaseSelect from '@shared/components/BaseSelect';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { useToast } from '@shared/components/ToastHost';
import { AREAS, AREA_LABEL, STATUS_STRIPE } from '@shared/constants/solicitacao';
import { useDebounce } from '@shared/hooks/useDebounce';
import { formatDateTimeBR, tempoRelativo } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';

import { exportSolicitacoesCsv } from '../api/solicitacoes-api';
import StatusBadge from '../components/StatusBadge';
import StatusChanger from '../components/StatusChanger';
import StatusUpdateDialog from '../components/StatusUpdateDialog';
import {
  useSolicitacoesQuery,
  useUpdateStatusMutation,
} from '../queries/use-solicitacoes';
import { useStatusCountsQuery } from '../queries/use-status-counts';

const STATUS_TABS: { key: StatusSolicitacao | 'todas'; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'cadastrada', label: 'Cadastradas' },
  { key: 'em_analise', label: 'Em análise' },
  { key: 'atendida', label: 'Atendidas' },
  { key: 'indeferida', label: 'Indeferidas' },
  { key: 'cancelada', label: 'Canceladas' },
];

const STATUS_TAB_KEYS = new Set<StatusSolicitacao | 'todas'>(
  STATUS_TABS.map((tab) => tab.key),
);

type Periodo = 'hoje' | 'semana' | 'mes' | null;

/** YYYY-MM-DD no fuso local, sem cair na armadilha de toISOString() (UTC). */
function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function intervaloHoje(): { de: string; ate: string } {
  const hoje = toIsoDateLocal(new Date());
  return { de: hoje, ate: hoje };
}

function intervaloSemana(): { de: string; ate: string } {
  // Semana começa na segunda — convenção mais usada em pt-BR institucional.
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  const segunda = new Date(now);
  segunda.setDate(now.getDate() - offset);
  return { de: toIsoDateLocal(segunda), ate: toIsoDateLocal(now) };
}

function intervaloMes(): { de: string; ate: string } {
  const now = new Date();
  const primeiroDia = new Date(now.getFullYear(), now.getMonth(), 1);
  return { de: toIsoDateLocal(primeiroDia), ate: toIsoDateLocal(now) };
}

function periodoAtivo(de: string, ate: string): Periodo {
  if (!de || !ate) return null;
  const hoje = intervaloHoje();
  if (de === hoje.de && ate === hoje.ate) return 'hoje';
  const semana = intervaloSemana();
  if (de === semana.de && ate === semana.ate) return 'semana';
  const mes = intervaloMes();
  if (de === mes.de && ate === mes.ate) return 'mes';
  return null;
}

export default function GerencialView() {
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const statusMut = useUpdateStatusMutation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const initialStatus = searchParams.get('status');
  const modoAjusteStatus =
    me?.perfil === 'administrador' && searchParams.get('modo') === 'ajuste-status';
  const statusInicial = STATUS_TAB_KEYS.has(initialStatus as StatusSolicitacao | 'todas')
    ? (initialStatus as StatusSolicitacao | 'todas')
    : 'todas';

  // ---- filtros ----
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [municipio, setMunicipio] = useState('');
  const [area, setArea] = useState<AreaSolicitacao | null>(null);
  const [statusTab, setStatusTab] = useState<StatusSolicitacao | 'todas'>(statusInicial);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [solicitante, setSolicitante] = useState<UsuarioResumo | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [exporting, setExporting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    current: StatusSolicitacao;
    next: StatusSolicitacao;
  } | null>(null);

  const filtersBase = useMemo(
    () => ({
      municipio: municipio.trim() || undefined,
      area: area ?? undefined,
      data_de: dataDe || undefined,
      data_ate: dataAte || undefined,
      search: debouncedSearch || undefined,
      usuario_id: solicitante?.id,
    }),
    [municipio, area, dataDe, dataAte, debouncedSearch, solicitante],
  );

  const counts = useStatusCountsQuery(filtersBase);

  const filter = useMemo(
    () => ({
      page,
      page_size: pageSize,
      status: statusTab === 'todas' ? undefined : statusTab,
      ...filtersBase,
    }),
    [page, statusTab, filtersBase],
  );

  const { data, isLoading, isFetching, error, refetch } = useSolicitacoesQuery(filter);
  const rows: Solicitacao[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const periodo = periodoAtivo(dataDe, dataAte);

  useEffect(() => {
    if (!modoAjusteStatus) return;
    setFiltersOpen(true);
    searchInputRef.current?.focus();
  }, [modoAjusteStatus]);

  const filtrosAtivos = useMemo(
    () => [
      debouncedSearch && `Busca: ${debouncedSearch}`,
      municipio.trim() && `Município: ${municipio.trim()}`,
      area && `Área: ${AREA_LABEL[area]}`,
      dataDe && `De: ${dataDe}`,
      dataAte && `Até: ${dataAte}`,
      solicitante && `Solicitante: ${solicitante.nome}`,
    ].filter(Boolean) as string[],
    [debouncedSearch, municipio, area, dataDe, dataAte, solicitante],
  );

  function aplicarPeriodo(p: Periodo): void {
    if (p === null) {
      setDataDe('');
      setDataAte('');
    } else {
      const r =
        p === 'hoje' ? intervaloHoje() : p === 'semana' ? intervaloSemana() : intervaloMes();
      setDataDe(r.de);
      setDataAte(r.ate);
    }
    setPage(1);
  }

  function limparTudo(): void {
    setSearch('');
    setMunicipio('');
    setArea(null);
    setDataDe('');
    setDataAte('');
    setStatusTab('todas');
    setSolicitante(null);
    setPage(1);
  }

  async function onStatusChange(id: string, next: StatusSolicitacao): Promise<void> {
    const current = rows.find((row) => row.id === id)?.status;
    if (!current) return;
    setPendingStatus({ id, current, next });
  }

  async function confirmarStatus(parecer: string): Promise<void> {
    if (!pendingStatus) return;
    try {
      await statusMut.mutateAsync({
        id: pendingStatus.id,
        status: pendingStatus.next,
        parecer: parecer || undefined,
      });
      toast.success('Status atualizado.');
      setPendingStatus(null);
    } catch (e) {
      toast.error(messageFor(e));
    }
  }

  function podeReabrirCancelada(): boolean {
    return !!me && (
      me.perfil === 'administrador'
      || (me.perfil === 'suporte' && me.pode_reabrir_solicitacoes)
    );
  }

  function transicoesPermitidas(status: StatusSolicitacao): StatusSolicitacao[] {
    if (status === 'cancelada' && !podeReabrirCancelada()) return [];
    if (status === 'cancelada') return ['em_analise'];
    return status === 'cadastrada'
      ? ['em_analise', 'cancelada']
      : status === 'em_analise'
        ? ['atendida', 'indeferida', 'cancelada']
        : [];
  }

  async function exportar(): Promise<void> {
    setExporting(true);
    try {
      await exportSolicitacoesCsv({
        status: statusTab === 'todas' ? undefined : statusTab,
        ...filtersBase,
      });
      toast.success('CSV gerado.');
    } catch (e) {
      toast.error(messageFor(e));
    } finally {
      setExporting(false);
    }
  }

  function abrir(s: Solicitacao): void {
    navigate(`/solicitacoes/${s.id}`);
  }

  function countByTab(k: typeof STATUS_TABS[number]['key']): number {
    if (!counts.data) return 0;
    if (k === 'todas') return counts.data.todas;
    return counts.data[k];
  }

  const periodoChips: { key: Exclude<Periodo, null>; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mês' },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Gestão"
        title="Painel gerencial"
        description={
          modoAjusteStatus
            ? 'Pesquise pelo código ou título da demanda para corrigir ou reabrir o status.'
            : 'Filtre, atualize status inline e exporte para CSV.'
        }
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <BaseButton
              variant="secondary"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
              {filtrosAtivos.length > 0 && (
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-2xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  {filtrosAtivos.length}
                </span>
              )}
            </BaseButton>
            <BaseButton
              variant="secondary"
              loading={exporting}
              onClick={exportar}
              disabled={isLoading}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </BaseButton>
          </div>
        )}
      />

      {/* ============ Filtros ============ */}
      <div className="card p-3 sm:p-4">
        {modoAjusteStatus && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Use a busca para localizar a demanda pelo c f3digo, t edtulo, pessoa ou descri e7 e3o. Depois, altere o status na pr f3pria linha do resultado.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {solicitante && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-600 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
              {solicitante.nome}
              <button
                type="button"
                onClick={() => {
                  setSolicitante(null);
                  setPage(1);
                }}
                aria-label="Remover filtro de solicitante"
                className="-mr-1 rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800/60"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={limparTudo}
            className="ml-auto text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Limpar filtros
          </button>
        </div>

        {filtrosAtivos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filtrosAtivos.map((filtro) => (
              <span
                key={filtro}
                className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted"
              >
                {filtro}
              </span>
            ))}
          </div>
        )}

        {filtersOpen && (
          <div className="mt-2 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label htmlFor="g-search" className="field-label">Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <input
                  id="g-search"
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Código, pessoa, descrição ou título"
                  className="block w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>
            <div className="sm:col-span-3">
              <BaseInput
                label="Município"
                placeholder="Ex.: Boa Vista"
                value={municipio}
                onChange={(e) => {
                  setMunicipio(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:col-span-4">
              <BaseSelect
                label="Área"
                options={AREAS}
                placeholder="Todas"
                value={area}
                onChange={(v) => {
                  setArea(v as AreaSolicitacao | null);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="g-de" className="field-label">
                <Calendar className="mr-1 inline h-3 w-3" aria-hidden />
                Data inicial
              </label>
              <input
                id="g-de"
                type="date"
                value={dataDe}
                onChange={(e) => {
                  setDataDe(e.target.value);
                  setPage(1);
                }}
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="g-ate" className="field-label">
                <Calendar className="mr-1 inline h-3 w-3" aria-hidden />
                Data final
              </label>
              <input
                id="g-ate"
                type="date"
                value={dataAte}
                onChange={(e) => {
                  setDataAte(e.target.value);
                  setPage(1);
                }}
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-12">
              <span className="text-2xs font-medium uppercase tracking-wider text-ink-muted">
                Período:
              </span>
              {periodoChips.map((p) => {
                const ativo = periodo === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => aplicarPeriodo(ativo ? null : p.key)}
                    className={clsx(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500',
                      ativo
                        ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100'
                        : 'border-border bg-surface text-ink-muted hover:text-ink',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============ Tabs por status (com contagem) ============ */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {STATUS_TABS.map((t) => {
          const c = countByTab(t.key);
          const ativo = statusTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatusTab(t.key);
                setPage(1);
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500',
                ativo
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-border bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
              <span
                className={clsx(
                  'rounded-full px-1.5 text-2xs tabular-nums',
                  ativo ? 'bg-white/20 text-white' : 'bg-surface-muted text-ink-muted',
                )}
              >
                {counts.isLoading ? '…' : c}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============ Tabela desktop ============ */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-muted text-left text-2xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Data</th>
                <th className="px-4 py-2.5 font-semibold">Pessoa</th>
                <th className="px-4 py-2.5 font-semibold">Município</th>
                <th className="px-4 py-2.5 font-semibold">Área</th>
                <th className="px-4 py-2.5 font-semibold">Título</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-px px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <BaseSkeleton />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4">
                    <EmptyState
                      icon={ClipboardList}
                      title="Nenhuma solicitação"
                      description="Ajuste os filtros para ver outros resultados."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
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
                    <td className="px-4 py-3 font-medium text-ink">
                      <div className="min-w-0">
                        <p className="truncate">{s.pessoa.nome}</p>
                        <p className="truncate text-xs text-ink-muted">{s.pessoa.cpf}</p>
                      </div>
                    </td>
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusChanger
                        status={s.status}
                        transitions={transicoesPermitidas(s.status)}
                        getOptionLabel={(next) =>
                          s.status === 'cancelada' && next === 'em_analise'
                            ? 'Reabrir (em análise)'
                            : next === 'em_analise'
                              ? 'Em análise'
                              : next === 'indeferida'
                                ? 'Indeferir'
                                : next === 'cancelada'
                                  ? 'Cancelar'
                                  : next === 'atendida'
                                    ? 'Atender'
                                    : next
                        }
                        disabled={statusMut.isPending}
                        onChange={(n) => onStatusChange(s.id, n)}
                      />
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

      {/* ============ Cards mobile ============ */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`m-sk-${i}`} className="card space-y-2 p-4">
              <BaseSkeleton width="40%" />
              <BaseSkeleton width="80%" />
              <BaseSkeleton width="60%" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma solicitação"
              description="Ajuste os filtros para ver outros resultados."
            />
          </div>
        ) : (
          rows.map((s) => (
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
                {AREA_LABEL[s.area]} · {s.municipio} · {s.pessoa.nome}
              </p>
              <div
                className="mt-2 flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <StatusChanger
                  status={s.status}
                  transitions={transicoesPermitidas(s.status)}
                  getOptionLabel={(next) =>
                    s.status === 'cancelada' && next === 'em_analise'
                      ? 'Reabrir (em análise)'
                      : next === 'em_analise'
                        ? 'Em análise'
                        : next === 'indeferida'
                          ? 'Indeferir'
                          : next === 'cancelada'
                            ? 'Cancelar'
                            : next === 'atendida'
                              ? 'Atender'
                              : next
                  }
                  disabled={statusMut.isPending}
                  onChange={(n) => onStatusChange(s.id, n)}
                />
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

      <StatusUpdateDialog
        open={!!pendingStatus}
        currentStatus={pendingStatus?.current ?? null}
        nextStatus={pendingStatus?.next ?? null}
        loading={statusMut.isPending}
        onClose={() => setPendingStatus(null)}
        onConfirm={confirmarStatus}
      />
    </section>
  );
}
