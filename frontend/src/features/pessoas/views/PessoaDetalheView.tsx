import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ClipboardList,
  IdCard,
  MapPin,
  Pencil,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type { Pessoa, Solicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { AREA_LABEL } from '@shared/constants/solicitacao';
import { calcularIdade, formatDateBR, tempoRelativo } from '@shared/utils/date';
import { useSolicitacoesQuery } from '@features/solicitacoes/queries/use-solicitacoes';
import StatusBadge from '@features/solicitacoes/components/StatusBadge';

import PessoaFormDialog from '../components/PessoaFormDialog';
import { usePessoaQuery } from '../queries/use-pessoas';

export default function PessoaDetalheView() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pessoa, isLoading, error } = usePessoaQuery(id);
  const [editarOpen, setEditarOpen] = useState(false);

  const idade = useMemo(() => calcularIdade(pessoa?.data_nascimento), [pessoa]);
  const municipioLabel = pessoa
    ? pessoa.municipio.eh_outros && pessoa.localidade
      ? `${pessoa.municipio.nome} — ${pessoa.localidade}`
      : pessoa.municipio.nome
    : '';

  const iniciais = pessoa
    ? pessoa.nome
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'P'
    : 'P';

  function voltar(): void {
    if (window.history.length > 1) navigate(-1);
    else navigate('/pessoas', { replace: true });
  }

  return (
    <section>
      <PageHeader
        eyebrow="Pessoa"
        title={pessoa ? pessoa.nome : 'Carregando…'}
        description={
          pessoa ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <IdCard className="h-4 w-4 text-ink-subtle" aria-hidden />
              {pessoa.cpf}
            </span>
          ) : undefined
        }
        actions={
          <>
            <BaseButton variant="secondary" size="sm" onClick={voltar}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </BaseButton>
            {pessoa && (
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
          {/* Dados (2/3) */}
          <article className="card p-5 lg:col-span-2">
            <header className="mb-4 flex items-center gap-3">
              <span
                className="grid h-12 w-12 flex-none place-items-center rounded-full bg-brand-100 text-base font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                aria-hidden
              >
                {iniciais}
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold tracking-tight text-ink">
                  {pessoa ? pessoa.nome : <BaseSkeleton width="12rem" />}
                </p>
                {pessoa && (
                  <p className="text-xs text-ink-muted">
                    {pessoa.situacao === 'ativo' ? 'Ativa' : 'Inativa'}
                  </p>
                )}
              </div>
            </header>

            <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <IdCard className="h-3.5 w-3.5" aria-hidden />
                  CPF
                </dt>
                <dd className="mt-0.5 font-medium text-ink tabular-nums">
                  {pessoa ? pessoa.cpf : <BaseSkeleton width="8rem" />}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  Nome
                </dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {pessoa ? pessoa.nome : <BaseSkeleton width="10rem" />}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Município
                </dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {pessoa ? municipioLabel || '—' : <BaseSkeleton width="10rem" />}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  Nascimento
                </dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {pessoa?.data_nascimento ? (
                    <>
                      {formatDateBR(pessoa.data_nascimento)}
                      {idade !== null && (
                        <span className="font-normal text-ink-muted"> ({idade} anos)</span>
                      )}
                    </>
                  ) : pessoa ? (
                    'Não informado'
                  ) : (
                    <BaseSkeleton width="8rem" />
                  )}
                </dd>
              </div>
            </dl>
          </article>

          {/* Solicitações da pessoa (1/3) */}
          <aside className="space-y-3">
            <SolicitacoesDaPessoa pessoa={pessoa} loadingPessoa={isLoading} />
          </aside>
        </div>
      )}

      <PessoaFormDialog
        open={editarOpen}
        editing={pessoa ?? null}
        onClose={() => setEditarOpen(false)}
      />
    </section>
  );
}

function SolicitacoesDaPessoa({
  pessoa,
  loadingPessoa,
}: {
  pessoa: Pessoa | undefined;
  loadingPessoa: boolean;
}) {
  const navigate = useNavigate();
  // Backend não filtra por pessoa_id na lista — busca pelo nome.
  const { data, isLoading } = useSolicitacoesQuery({
    page: 1,
    page_size: 5,
    search: pessoa?.nome,
  });
  const items: Solicitacao[] = useMemo(
    () => (data?.data ?? []).filter((s) => s.pessoa.id === pessoa?.id),
    [data, pessoa],
  );

  return (
    <article className="card overflow-hidden p-0">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold tracking-tight text-ink">
          Solicitações
        </h3>
        {items.length > 0 && (
          <span className="text-2xs text-ink-subtle">
            {items.length} mais recente{items.length === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {loadingPessoa || isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
          >
            <BaseSkeleton width="2.25rem" height="2.25rem" rounded="full" />
            <div className="flex-1 space-y-2">
              <BaseSkeleton width="60%" />
              <BaseSkeleton width="35%" />
            </div>
          </div>
        ))
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sem solicitações"
          description="Esta pessoa ainda não tem solicitações registradas."
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted"
                onClick={() => navigate(`/solicitacoes/${s.id}`)}
              >
                <StatusBadge status={s.status} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-ink">
                    {s.titulo}
                  </p>
                  <p className="mt-0.5 text-2xs text-ink-subtle">
                    {AREA_LABEL[s.area]} · {tempoRelativo(s.data_solicitacao)}
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
    </article>
  );
}
