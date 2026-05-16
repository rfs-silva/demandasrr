import clsx from 'clsx';
import {
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Clock,
  FilePieChart,
  History,
  Inbox,
  ListChecks,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type { Me, Solicitacao } from '@shared/api/types';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import {
  PERFIS_LEITURA_GERAL,
  PERFIS_OPERACIONAIS,
  podeAcessarUsuarios,
} from '@shared/constants/perfis';
import { AREA_LABEL } from '@shared/constants/solicitacao';
import { tempoRelativo } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';

import { useSolicitacoesQuery } from '@features/solicitacoes/queries/use-solicitacoes';
import { useStatusCountsQuery } from '@features/solicitacoes/queries/use-status-counts';

interface KpiTile {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  description: string;
  to: string;
}

interface ShortcutCard {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  visible: (me: Me) => boolean;
}

const SHORTCUTS: ShortcutCard[] = [
  {
    to: '/solicitacoes',
    title: 'Solicitações',
    description: 'Abra uma nova solicitação ou acompanhe as em andamento.',
    icon: ClipboardList,
    visible: () => true,
  },
  {
    to: '/gerencial',
    title: 'Painel gerencial',
    description: 'Filtre, altere status e exporte CSV para análises.',
    icon: FilePieChart,
    visible: (me) =>
      PERFIS_OPERACIONAIS.has(me.perfil) || PERFIS_LEITURA_GERAL.has(me.perfil),
  },
  {
    to: '/pessoas',
    title: 'Pessoas',
    description: 'Consulte ou cadastre pessoas atendidas pelos programas.',
    icon: Users,
    visible: (me) => me.perfil === 'administrador',
  },
  {
    to: '/usuarios',
    title: 'Usuários',
    description: 'Administre acessos e perfis da equipe.',
    icon: UsersRound,
    visible: (me) => podeAcessarUsuarios(me),
  },
  {
    to: '/auditoria',
    title: 'Auditoria',
    description: 'Quem fez o quê e quando — log de ações sensíveis.',
    icon: History,
    visible: (me) => me.perfil === 'administrador',
  },
];

export default function HomeView() {
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();

  const counts = useStatusCountsQuery({});
  const fila = useSolicitacoesQuery({
    page: 1,
    page_size: 5,
    status: 'cadastrada',
  });

  const tiles = useMemo<KpiTile[]>(
    () => [
      {
        label: 'Total de solicitações',
        value: counts.data?.todas ?? 0,
        icon: Inbox,
        iconClass:
          'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
        description: 'Considera todos os status.',
        to: '/gerencial',
      },
      {
        label: 'Cadastradas',
        value: counts.data?.cadastrada ?? 0,
        icon: ClipboardList,
        iconClass:
          'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-100',
        description: 'Aguardando análise.',
        to: '/gerencial?status=cadastrada',
      },
      {
        label: 'Em análise',
        value: counts.data?.em_analise ?? 0,
        icon: Clock,
        iconClass:
          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
        description: 'Trabalho em andamento.',
        to: '/gerencial?status=em_analise',
      },
      {
        label: 'Atendidas',
        value: counts.data?.atendida ?? 0,
        icon: ListChecks,
        iconClass:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
        description: 'Concluídas com sucesso.',
        to: '/gerencial?status=atendida',
      },
    ],
    [counts.data],
  );

  if (!me) return null;
  const visibleShortcuts = SHORTCUTS.filter((s) => s.visible(me));
  const filaItems: Solicitacao[] = fila.data?.data ?? [];
  const filaTotal = fila.data?.meta?.total ?? 0;
  const primeiroNome = me.nome.split(' ')[0] ?? '';

  function abrirSol(s: Solicitacao): void {
    navigate(`/solicitacoes/${s.id}`);
  }

  return (
    <section>
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${primeiroNome}.`}
        description="Acompanhe rapidamente o estado das solicitações e acesse os módulos disponíveis para o seu perfil."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => navigate(t.to)}
              className="card card-interactive flex flex-col gap-2 p-5 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-muted">{t.label}</span>
                <span
                  className={clsx('grid h-9 w-9 place-items-center rounded-lg', t.iconClass)}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              {counts.isLoading ? (
                <BaseSkeleton width="40%" height="2rem" />
              ) : (
                <p className="font-display text-3xl font-bold tracking-tightest tabular-nums text-ink">
                  {t.value.toLocaleString('pt-BR')}
                </p>
              )}
              <p className="text-xs text-ink-subtle">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Aguardando atendimento */}
      <section className="mt-10">
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Aguardando atendimento
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Solicitações com status <strong>Cadastrada</strong>, ordenadas pelas mais recentes.
            </p>
          </div>
          {filaTotal > 0 && (
            <Link
              to="/gerencial?status=cadastrada"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Ver todas
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </header>

        <div className="card overflow-hidden">
          {fila.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`fsk-${i}`}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
              >
                <BaseSkeleton width="2.5rem" height="2.5rem" rounded="full" />
                <div className="flex-1 space-y-2">
                  <BaseSkeleton width="60%" />
                  <BaseSkeleton width="40%" />
                </div>
              </div>
            ))
          ) : fila.error ? (
            <p className="p-6 text-center text-sm text-red-600 dark:text-red-300">
              {messageFor(fila.error)}
            </p>
          ) : filaItems.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nada para atender agora"
              description="Você está em dia. Quando uma nova solicitação for registrada, ela aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filaItems.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted"
                    onClick={() => abrirSol(s)}
                  >
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                      aria-hidden
                    >
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="truncate font-medium text-ink">{s.pessoa.nome}</p>
                        <span className="text-2xs text-ink-subtle">·</span>
                        <p className="text-xs text-ink-muted">{AREA_LABEL[s.area]}</p>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">
                        {s.titulo}
                      </p>
                      <p className="mt-1 text-2xs text-ink-subtle">
                        {s.municipio} · {tempoRelativo(s.data_solicitacao)}
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 flex-none text-ink-subtle"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Atalhos */}
      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Acesso rápido
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Os atalhos abaixo refletem as áreas disponíveis para o seu perfil.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleShortcuts.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="card card-interactive group relative overflow-hidden p-5"
              >
                <div className="flex items-start gap-4">
                  <span
                    className="grid h-11 w-11 flex-none place-items-center rounded-lg bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-200"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold tracking-tight text-ink">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">{card.description}</p>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 flex-none text-ink-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600"
                    aria-hidden
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
