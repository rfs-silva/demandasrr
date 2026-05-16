import {
  ArrowRight,
  FilePlus2,
  History,
  Lock,
  MessageSquareText,
  Paperclip,
  Pencil,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import type { SolicitacaoEvento, TipoEventoSolicitacao } from '@shared/api/types';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import { STATUS_BADGE, STATUS_LABEL } from '@shared/constants/solicitacao';
import { formatDateTimeBR, tempoRelativo } from '@shared/utils/date';

interface Props {
  eventos: SolicitacaoEvento[] | undefined;
  loading?: boolean;
}

const ICON_MAP: Record<TipoEventoSolicitacao, LucideIcon> = {
  criada: FilePlus2,
  status_alterado: RefreshCw,
  editada: Pencil,
  comentario: MessageSquareText,
  anexo_adicionado: Paperclip,
  anexo_removido: Trash2,
};

const DOT_MAP: Record<TipoEventoSolicitacao, string> = {
  criada: 'bg-brand-600 text-white ring-brand-100 dark:ring-brand-900/40',
  status_alterado:
    'bg-amber-500 text-white ring-amber-100 dark:ring-amber-900/40',
  editada: 'bg-violet-500 text-white ring-violet-100 dark:ring-violet-900/40',
  comentario:
    'bg-slate-500 text-white ring-slate-100 dark:ring-slate-700/40',
  anexo_adicionado:
    'bg-sky-500 text-white ring-sky-100 dark:ring-sky-900/40',
  anexo_removido:
    'bg-rose-500 text-white ring-rose-100 dark:ring-rose-900/40',
};

function dotClassFor(ev: SolicitacaoEvento): string {
  if (ev.tipo === 'status_alterado' && ev.para_status === 'atendida') {
    return 'bg-sky-500 text-white ring-sky-100 dark:ring-sky-900/40';
  }
  return DOT_MAP[ev.tipo];
}

function verboFor(tipo: TipoEventoSolicitacao): string {
  switch (tipo) {
    case 'criada':
      return 'criou a solicitação';
    case 'status_alterado':
      return 'atualizou o status';
    case 'editada':
      return 'editou a solicitação';
    case 'comentario':
      return 'comentou';
    case 'anexo_adicionado':
      return 'anexou um arquivo';
    case 'anexo_removido':
      return 'removeu um arquivo';
  }
}

export default function SolicitacaoTimeline({ eventos, loading }: Props) {
  const items = eventos ?? [];
  return (
    <div>
      <header className="mb-5 flex items-baseline justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight text-ink">
          <History className="h-4 w-4 text-ink-subtle" aria-hidden />
          Linha do tempo
        </h3>
        {!loading && items.length > 0 && (
          <span className="text-2xs font-medium uppercase tracking-wider text-ink-subtle">
            {items.length} {items.length === 1 ? 'evento' : 'eventos'}
          </span>
        )}
      </header>

      {loading ? (
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <BaseSkeleton width="2.125rem" height="2.125rem" rounded="full" />
              <div className="flex-1 space-y-2 pt-1.5">
                <BaseSkeleton width="65%" />
                <BaseSkeleton width="35%" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-center">
          <History
            className="mx-auto mb-2 h-6 w-6 text-ink-subtle"
            aria-hidden
          />
          <p className="text-sm text-ink-muted">Nenhum evento registrado ainda.</p>
        </div>
      ) : (
        <ol className="relative">
          <span
            className="absolute left-[1.0625rem] top-2 bottom-2 w-px bg-border"
            aria-hidden
          />
          {items.map((ev) => {
            const Icon = ICON_MAP[ev.tipo];
            return (
              <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0">
                <span
                  className={`relative z-10 grid h-[2.125rem] w-[2.125rem] flex-none place-items-center rounded-full shadow-sm ring-4 ${dotClassFor(ev)}`}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm leading-tight text-ink">
                      <span
                        className="font-semibold"
                        title={`${ev.usuario.nome} (@${ev.usuario.login})`}
                      >
                        {ev.usuario.nome}
                      </span>
                      <span className="text-ink-muted">{` ${verboFor(ev.tipo)}`}</span>
                    </p>
                    <p
                      className="whitespace-nowrap text-2xs text-ink-subtle"
                      title={formatDateTimeBR(ev.created_at)}
                    >
                      · {tempoRelativo(ev.created_at)}
                    </p>
                    {ev.interno && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        title="Visível apenas para a equipe interna"
                      >
                        <Lock className="h-2.5 w-2.5" aria-hidden />
                        Interno
                      </span>
                    )}
                  </div>

                  {ev.tipo === 'status_alterado' && ev.de_status && ev.para_status ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[ev.de_status]}`}>
                        {STATUS_LABEL[ev.de_status]}
                      </span>
                      <ArrowRight className="h-3 w-3 text-ink-subtle" aria-hidden />
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[ev.para_status]}`}>
                        {STATUS_LABEL[ev.para_status]}
                      </span>
                    </div>
                  ) : ev.tipo === 'criada' && ev.para_status ? (
                    <div className="mt-2 text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[ev.para_status]}`}>
                        {STATUS_LABEL[ev.para_status]}
                      </span>
                    </div>
                  ) : null}

                  {(ev.tipo === 'anexo_adicionado' || ev.tipo === 'anexo_removido')
                    && ev.comentario ? (
                    <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-border-subtle bg-surface-muted/60 px-2 py-1 text-xs text-ink">
                      <Paperclip className="h-3 w-3 flex-none text-ink-subtle" aria-hidden />
                      <span className="truncate font-mono">{ev.comentario}</span>
                    </div>
                  ) : ev.comentario ? (
                    <div className="mt-2 rounded-lg border border-border-subtle bg-surface-muted/60 px-3 py-2 text-sm leading-relaxed text-ink">
                      <p className="whitespace-pre-line">{ev.comentario}</p>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
