import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { messageFor } from '@shared/api/error-messages';
import type { Solicitacao, StatusSolicitacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { useToast } from '@shared/components/ToastHost';
import { AREA_LABEL, STATUS, STATUS_LABEL, STATUS_STRIPE } from '@shared/constants/solicitacao';
import { formatDateTimeBR } from '@shared/utils/date';

import { listSolicitacoes } from '../api/solicitacoes-api';
import StatusBadge from '../components/StatusBadge';
import StatusChanger from '../components/StatusChanger';
import StatusUpdateDialog from '../components/StatusUpdateDialog';
import { useUpdateStatusMutation } from '../queries/use-solicitacoes';

function normalizarCodigo(value: string): string {
  return value.trim().toUpperCase();
}

export default function LocalizarDemandaView() {
  const toast = useToast();
  const statusMut = useUpdateStatusMutation();

  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [codigoBusca, setCodigoBusca] = useState('');
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    current: StatusSolicitacao;
    next: StatusSolicitacao;
  } | null>(null);

  const buscaAtiva = normalizarCodigo(codigoBusca);

  const query = useQuery({
    queryKey: ['solicitacoes', 'buscar-por-codigo', buscaAtiva] as const,
    queryFn: () =>
      listSolicitacoes({
        page: 1,
        page_size: 10,
        search: buscaAtiva,
      }),
    enabled: !!buscaAtiva,
  });

  const rows = useMemo(() => {
    const encontrados = query.data?.data ?? [];
    if (!buscaAtiva) return [];
    return encontrados.filter((item) => normalizarCodigo(item.codigo) === buscaAtiva);
  }, [query.data, buscaAtiva]);

  function buscarPorCodigo(): void {
    const codigo = normalizarCodigo(codigoDigitado);
    setCodigoBusca(codigo);
  }

  function transicoesPermitidas(status: StatusSolicitacao): StatusSolicitacao[] {
    return STATUS
      .map((option) => option.value)
      .filter((option) => option !== status);
  }

  function onStatusChange(id: string, current: StatusSolicitacao, next: StatusSolicitacao): void {
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
      toast.success('Status atualizado por patch. Nenhum outro campo da demanda foi alterado.');
      setPendingStatus(null);
    } catch (error) {
      toast.error(messageFor(error));
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Administração"
        title="Localizar demanda"
        description="Busque somente pelo código da demanda. Ao encontrar, o administrador pode mover a demanda para qualquer status por patch, sem atualizar título, área ou descrição."
      />

      <div className="card p-4 sm:p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            buscarPorCodigo();
          }}
        >
          <BaseInput
            label="Código da demanda"
            placeholder="Ex.: DM-1234567890AB"
            value={codigoDigitado}
            onChange={(event) => setCodigoDigitado(event.target.value.toUpperCase())}
            className="sm:flex-1"
            autoComplete="off"
            spellCheck={false}
          />
          <BaseButton type="submit" disabled={!normalizarCodigo(codigoDigitado)}>
            <Search className="h-4 w-4" />
            Buscar
          </BaseButton>
        </form>
      </div>

      <div className="card overflow-hidden">
        {!buscaAtiva ? (
          <EmptyState
            icon={Search}
            title="Informe o código da demanda"
            description="A busca desta tela é exclusiva por código. Quando localizar a demanda, o resultado aparecerá abaixo para alteração de status."
          />
        ) : query.isLoading ? (
          <div className="space-y-3 p-4">
            <BaseSkeleton />
            <BaseSkeleton />
            <BaseSkeleton />
          </div>
        ) : query.error ? (
          <div className="p-4">
            <p className="text-sm text-red-600 dark:text-red-300">{messageFor(query.error)}</p>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Demanda não encontrada"
            description={`Nenhuma demanda foi encontrada com o código ${buscaAtiva}.`}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full table-fixed divide-y divide-border text-sm">
                <thead className="bg-surface-muted text-left text-2xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="w-[14%] px-4 py-3 font-semibold">Código</th>
                    <th className="w-[34%] px-4 py-3 font-semibold">Solicitação</th>
                    <th className="w-[16%] px-4 py-3 font-semibold">Pessoa</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Área</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Status atual</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Alterar status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {rows.map((item) => (
                    <ResultadoRow
                      key={item.id}
                      item={item}
                      loading={statusMut.isPending}
                      onStatusChange={onStatusChange}
                      transicoesPermitidas={transicoesPermitidas}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {rows.map((item) => (
                <article
                  key={item.id}
                  className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 pl-5"
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${STATUS_STRIPE[item.status]}`}
                    aria-hidden
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                        {item.codigo}
                      </p>
                      <h2 className="line-clamp-1 font-display text-base font-semibold tracking-tight text-ink">
                        {item.titulo}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-muted">
                        {item.descricao}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-ink-muted sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg bg-surface-muted/50 px-3 py-2">
                      <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Pessoa</dt>
                      <dd className="mt-1 truncate text-ink">{item.pessoa.nome}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-muted/50 px-3 py-2">
                      <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Área</dt>
                      <dd className="mt-1 text-ink">{AREA_LABEL[item.area]}</dd>
                    </div>
                    <div className="rounded-lg bg-surface-muted/50 px-3 py-2 sm:col-span-2">
                      <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Data</dt>
                      <dd className="mt-1 text-ink">{formatDateTimeBR(item.data_solicitacao)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <StatusChanger
                      status={item.status}
                      transitions={transicoesPermitidas(item.status)}
                      disabled={statusMut.isPending}
                      getOptionLabel={(next) =>
                        item.status === 'cancelada' && next === 'em_analise'
                          ? 'Reabrir (em análise)'
                          : STATUS_LABEL[next]
                      }
                      onChange={(next) => onStatusChange(item.id, item.status, next)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

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

function ResultadoRow({
  item,
  loading,
  onStatusChange,
  transicoesPermitidas,
}: {
  item: Solicitacao;
  loading: boolean;
  onStatusChange: (id: string, current: StatusSolicitacao, next: StatusSolicitacao) => void;
  transicoesPermitidas: (status: StatusSolicitacao) => StatusSolicitacao[];
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 align-top font-semibold text-ink">{item.codigo}</td>
      <td className="px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-ink" title={item.titulo}>{item.titulo}</p>
          <p className="line-clamp-2 text-xs leading-5 text-ink-muted" title={item.descricao}>
            {item.descricao}
          </p>
          <p className="text-2xs text-ink-subtle">{formatDateTimeBR(item.data_solicitacao)}</p>
        </div>
      </td>
      <td className="px-4 py-4 align-top text-ink-muted">
        <p className="truncate" title={item.pessoa.nome}>{item.pessoa.nome}</p>
      </td>
      <td className="px-4 py-4 align-top text-ink-muted">
        <p className="line-clamp-2">{AREA_LABEL[item.area]}</p>
      </td>
      <td className="px-4 py-4 align-top">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-4 align-top">
        <StatusChanger
          status={item.status}
          transitions={transicoesPermitidas(item.status)}
          disabled={loading}
          getOptionLabel={(next) =>
            item.status === 'cancelada' && next === 'em_analise'
              ? 'Reabrir (em análise)'
              : STATUS_LABEL[next]
          }
          onChange={(next) => onStatusChange(item.id, item.status, next)}
        />
      </td>
    </tr>
  );
}