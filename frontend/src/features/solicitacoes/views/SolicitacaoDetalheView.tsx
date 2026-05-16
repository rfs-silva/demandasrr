import clsx from 'clsx';
import {
  ArrowLeft,
  ClipboardList,
  History,
  MapPin,
  NotebookPen,
  Pencil,
  User as UserIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type { SolicitacaoEvento, StatusSolicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import PageHeader from '@shared/components/PageHeader';
import { useToast } from '@shared/components/ToastHost';
import { PERFIS_OPERACIONAIS } from '@shared/constants/perfis';
import { AREA_LABEL, STATUS_LABEL } from '@shared/constants/solicitacao';
import { formatDateTimeBR } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';
import AnexoList from '@features/anexos/components/AnexoList';
import { useAnexosQuery } from '@features/anexos/queries/use-anexos';

import SolicitacaoEditarDialog from '../components/SolicitacaoEditarDialog';
import SolicitacaoTimeline from '../components/SolicitacaoTimeline';
import StatusBadge from '../components/StatusBadge';
import StatusChanger from '../components/StatusChanger';
import StatusUpdateDialog from '../components/StatusUpdateDialog';
import {
  useSolicitacaoEventosQuery,
  useSolicitacaoQuery,
  useUpdateStatusMutation,
} from '../queries/use-solicitacoes';

type MobileSection = 'demanda' | 'timeline' | 'notas';

const MOBILE_SECTIONS: Array<{
  key: MobileSection;
  label: string;
  icon: typeof ClipboardList;
}> = [
  { key: 'demanda', label: 'Demanda', icon: ClipboardList },
  { key: 'timeline', label: 'Linha do tempo', icon: History },
  { key: 'notas', label: 'Notas', icon: NotebookPen },
];

function RegistroTecnicoCard({ evento }: { evento: SolicitacaoEvento }) {
  const isParecer =
    evento.tipo === 'status_alterado'
    && (evento.para_status === 'indeferida' || evento.para_status === 'cancelada');

  return (
    <article className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-xs dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {isParecer
            ? `Parecer de ${STATUS_LABEL[evento.para_status as StatusSolicitacao]}`
            : 'Nota técnica'}
        </span>
        <span className="min-w-0 truncate font-medium text-ink">
          {evento.usuario.nome}
        </span>
        <span className="w-full sm:w-auto" title={formatDateTimeBR(evento.created_at)}>
          {formatDateTimeBR(evento.created_at)}
        </span>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/50">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Descrição
        </p>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-700 dark:text-slate-200">
          {evento.comentario}
        </p>
      </div>
    </article>
  );
}

export default function SolicitacaoDetalheView() {
  const { id = '' } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: solicitacao, isLoading, error } = useSolicitacaoQuery(id);
  const { data: eventos, isLoading: loadingEventos } = useSolicitacaoEventosQuery(id);
  const { data: anexos, isLoading: loadingAnexos } = useAnexosQuery(id);

  const statusMut = useUpdateStatusMutation();
  const podeAlterarStatus = !!me && PERFIS_OPERACIONAIS.has(me.perfil);
  const podeReabrirCancelada = !!me && (
    me.perfil === 'administrador'
    || (me.perfil === 'suporte' && me.pode_reabrir_solicitacoes)
  );
  const podeEditar =
    !!solicitacao &&
    !!me &&
    solicitacao.usuario.id === me.id &&
    solicitacao.status === 'cadastrada';

  const ehProprioAutor =
    !!solicitacao &&
    solicitacao.pessoa.nome.trim().toLowerCase() ===
      solicitacao.usuario.nome.trim().toLowerCase();

  const [editarOpen, setEditarOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<StatusSolicitacao | null>(null);
  const [mobileSection, setMobileSection] = useState<MobileSection>('demanda');

  const registrosTecnicos = useMemo(
    () =>
      (eventos ?? []).filter(
        (evento) =>
          !!evento.comentario
          && (
            evento.tipo === 'comentario'
            || (
              evento.tipo === 'status_alterado'
              && (evento.para_status === 'indeferida' || evento.para_status === 'cancelada')
            )
          ),
      ),
    [eventos],
  );

  async function onStatusChange(next: StatusSolicitacao): Promise<void> {
    setNextStatus(next);
  }

  async function confirmarStatus(parecer: string): Promise<void> {
    if (!solicitacao || !nextStatus) return;
    try {
      await statusMut.mutateAsync({
        id: solicitacao.id,
        status: nextStatus,
        parecer: parecer || undefined,
      });
      toast.success('Status atualizado.');
      setNextStatus(null);
    } catch (e) {
      toast.error(messageFor(e));
    }
  }

  function transicoesPermitidas(status: StatusSolicitacao): StatusSolicitacao[] {
    if (status === 'cancelada' && !podeReabrirCancelada) return [];
    if (status === 'cancelada') return ['em_analise'];
    if (status === 'cadastrada') return ['em_analise', 'cancelada'];
    if (status === 'em_analise') return ['atendida', 'indeferida', 'cancelada'];
    return [];
  }

  function voltar(): void {
    if (window.history.length > 1) navigate(-1);
    else navigate('/solicitacoes', { replace: true });
  }

  return (
    <section className="pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Solicitação"
        title={solicitacao ? solicitacao.titulo : 'Carregando…'}
        description={
          solicitacao
            ? `${solicitacao.codigo} · Aberta em ${formatDateTimeBR(solicitacao.data_solicitacao)}`
            : undefined
        }
        actions={
          <>
            <BaseButton variant="secondary" size="sm" onClick={voltar}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </BaseButton>
            {podeEditar && (
              <BaseButton size="sm" onClick={() => setEditarOpen(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </BaseButton>
            )}
          </>
        }
      />

      {error ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-300">{messageFor(error)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ============ Coluna principal (2/3) ============ */}
          <div
            className={clsx(
              'space-y-4 lg:col-span-2',
              mobileSection !== 'demanda' && 'hidden lg:block',
            )}
          >
            <article className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {solicitacao && (
                    <p className="section-eyebrow">Código {solicitacao.codigo}</p>
                  )}
                  <p className="section-eyebrow">Status</p>
                  <div className="mt-1.5">
                    {podeAlterarStatus && solicitacao ? (
                      <StatusChanger
                        status={solicitacao.status}
                        transitions={transicoesPermitidas(solicitacao.status)}
                        getOptionLabel={(next) =>
                          solicitacao.status === 'cancelada' && next === 'em_analise'
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
                        onChange={onStatusChange}
                      />
                    ) : solicitacao ? (
                      <StatusBadge status={solicitacao.status} />
                    ) : (
                      <BaseSkeleton width="6rem" height="1.5rem" />
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="section-eyebrow">Área</p>
                  <p className="mt-1.5 font-medium text-ink">
                    {solicitacao ? AREA_LABEL[solicitacao.area] : <BaseSkeleton width="8rem" />}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="section-eyebrow">Descrição</p>
                {solicitacao ? (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-ink">
                    {solicitacao.descricao}
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    <BaseSkeleton />
                    <BaseSkeleton width="80%" />
                  </div>
                )}
              </div>

              {/* Solicitante + Aberto por (se diferente) */}
              {solicitacao && (
                <div
                  className={`mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 ${ehProprioAutor ? '' : 'sm:grid-cols-2'}`}
                >
                  <div className="flex items-start gap-3 rounded-lg p-2 -m-2">
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      aria-hidden
                    >
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-2xs uppercase tracking-wider text-ink-muted">
                        Solicitante
                      </p>
                      <p className="truncate text-sm font-medium text-ink">
                        {solicitacao.pessoa.nome}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        <MapPin className="inline h-3 w-3" aria-hidden /> {solicitacao.municipio}
                      </p>
                    </div>
                  </div>

                  {!ehProprioAutor && (
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                        aria-hidden
                      >
                        {solicitacao.usuario.nome
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-2xs uppercase tracking-wider text-ink-muted">
                          Aberto por
                        </p>
                        <p className="truncate text-sm font-medium text-ink">
                          {solicitacao.usuario.nome}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          @{solicitacao.usuario.login}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>

            {/* Anexos */}
            <article className="card p-5">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  Anexos
                </h3>
                {anexos && anexos.length > 0 && (
                  <span className="text-xs text-ink-muted">
                    {anexos.length} {anexos.length === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                )}
              </header>
              {solicitacao && (
                <AnexoList
                  solicitacaoId={solicitacao.id}
                  anexos={anexos}
                  loading={loadingAnexos}
                />
              )}
            </article>
          </div>

          <article
            className={clsx(
              'card overflow-hidden p-0 lg:hidden',
              mobileSection !== 'timeline' && 'hidden',
            )}
          >
            <div className="p-4">
              <SolicitacaoTimeline
                eventos={eventos}
                loading={isLoading || loadingEventos}
              />
            </div>
          </article>

          <article
            className={clsx(
              'card p-4 lg:hidden',
              mobileSection !== 'notas' && 'hidden',
            )}
          >
            <header className="mb-3">
              <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                Notas técnicas e pareceres
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                Registros internos relacionados a esta solicitação.
              </p>
            </header>
            {loadingEventos ? (
              <div className="space-y-2">
                <BaseSkeleton />
                <BaseSkeleton width="80%" />
              </div>
            ) : registrosTecnicos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-center text-sm text-ink-muted">
                Nenhuma nota técnica ou parecer registrado até o momento.
              </p>
            ) : (
              <div className="space-y-3">
                {registrosTecnicos.map((evento) => (
                  <RegistroTecnicoCard key={evento.id} evento={evento} />
                ))}
              </div>
            )}
          </article>

          {/* ============ Coluna lateral (1/3) — Timeline ============ */}
          <aside className="hidden lg:sticky lg:top-[4.5rem] lg:self-start lg:block">
            <div className="space-y-4">
              <article className="card p-4 sm:p-5 lg:order-2">
                <header className="mb-3">
                  <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                    Notas técnicas e pareceres
                  </h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    Registros internos relacionados a esta solicitação.
                  </p>
                </header>
                {loadingEventos ? (
                  <div className="space-y-2">
                    <BaseSkeleton />
                    <BaseSkeleton width="80%" />
                  </div>
                ) : registrosTecnicos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-center text-sm text-ink-muted">
                    Nenhuma nota técnica ou parecer registrado até o momento.
                  </p>
                ) : (
                  <div className="space-y-3 lg:max-h-[24rem] lg:overflow-y-auto lg:pr-1">
                    {registrosTecnicos.map((evento) => (
                      <RegistroTecnicoCard key={evento.id} evento={evento} />
                    ))}
                  </div>
                )}
              </article>

              <article className="card overflow-hidden p-0 lg:order-1">
                <div className="p-4 sm:p-5 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                  <SolicitacaoTimeline
                    eventos={eventos}
                    loading={isLoading || loadingEventos}
                  />
                </div>
              </article>
            </div>
          </aside>
        </div>
      )}

      <StatusUpdateDialog
        open={!!nextStatus}
        currentStatus={solicitacao?.status ?? null}
        nextStatus={nextStatus}
        loading={statusMut.isPending}
        onClose={() => setNextStatus(null)}
        onConfirm={confirmarStatus}
      />

      <SolicitacaoEditarDialog
        open={editarOpen}
        solicitacao={solicitacao ?? null}
        onClose={() => setEditarOpen(false)}
      />

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
          {MOBILE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = mobileSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setMobileSection(section.key)}
                className={clsx(
                  'flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-2xs font-semibold transition',
                  active
                    ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                    : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                )}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
