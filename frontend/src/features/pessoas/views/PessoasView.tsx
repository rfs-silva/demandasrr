import { ChevronRight, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import type { Pessoa, Situacao } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BasePagination from '@shared/components/BasePagination';
import BaseSelect from '@shared/components/BaseSelect';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import EmptyState from '@shared/components/EmptyState';
import PageHeader from '@shared/components/PageHeader';
import { useConfirm } from '@shared/components/ConfirmHost';
import { useToast } from '@shared/components/ToastHost';
import { useDebounce } from '@shared/hooks/useDebounce';
import { formatDateBR } from '@shared/utils/date';

import PessoaFormDialog from '../components/PessoaFormDialog';
import {
  useDeletePessoaMutation,
  usePessoasQuery,
} from '../queries/use-pessoas';

const SITUACAO_OPTS: { value: Situacao; label: string }[] = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
];

export default function PessoasView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filter = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      situacao: situacao ?? undefined,
    }),
    [page, debouncedSearch, situacao],
  );

  const { data, isLoading, isFetching, error, refetch } = usePessoasQuery(filter);
  const rows: Pessoa[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);

  function abrirNovo(): void {
    setEditing(null);
    setFormOpen(true);
  }
  function abrirEdicao(p: Pessoa): void {
    setEditing(p);
    setFormOpen(true);
  }
  function abrirDetalhe(p: Pessoa): void {
    navigate(`/pessoas/${p.id}`);
  }

  const deleteMut = useDeletePessoaMutation();
  async function pedirInativacao(p: Pessoa): Promise<void> {
    const ok = await confirm({
      title: 'Inativar pessoa',
      message: `Confirma a inativação de ${p.nome}? Ela não poderá receber novas solicitações.`,
      confirmLabel: 'Inativar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success('Pessoa inativada.');
    } catch (err) {
      toast.error(messageFor(err));
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Administração"
        title="Pessoas"
        description="Cadastro de pessoas atendidas pelos programas. CPF imutável após o cadastro."
        actions={
          <BaseButton onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Nova pessoa
          </BaseButton>
        }
      />

      {/* Filtros */}
      <div className="card p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-8">
            <label htmlFor="p-search" className="field-label">Buscar</label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <input
                id="p-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome ou CPF"
                className="block w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>
          <div className="sm:col-span-4">
            <BaseSelect
              label="Situação"
              placeholder="Todas"
              options={SITUACAO_OPTS}
              value={situacao}
              onChange={(v) => {
                setSituacao(v as Situacao | null);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-muted text-left text-2xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">CPF</th>
                <th className="px-4 py-2 font-medium">Município</th>
                <th className="px-4 py-2 font-medium">Nascimento</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="w-px px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <BaseSkeleton />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
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
                  <td colSpan={6} className="py-6">
                    <EmptyState
                      icon={Users}
                      title="Nenhuma pessoa encontrada"
                      description="Ajuste a busca ou cadastre uma nova pessoa."
                    >
                      <BaseButton onClick={abrirNovo}>
                        <Plus className="h-4 w-4" />
                        Nova pessoa
                      </BaseButton>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition hover:bg-surface-muted"
                    onClick={() => abrirDetalhe(p)}
                    style={{ opacity: p.situacao === 'inativo' ? 0.7 : 1 }}
                  >
                    <td className="px-4 py-3 font-medium text-ink">{p.nome}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {p.cpf}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {p.municipio.eh_outros && p.localidade
                        ? `${p.municipio.nome} — ${p.localidade}`
                        : p.municipio.nome}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {formatDateBR(p.data_nascimento)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          p.situacao === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-surface-subtle text-ink-muted',
                        ].join(' ')}
                      >
                        {p.situacao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                          aria-label={`Editar ${p.nome}`}
                          onClick={() => abrirEdicao(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {p.situacao === 'ativo' && (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`Inativar ${p.nome}`}
                            onClick={() => pedirInativacao(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden />
                      </div>
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

      {isFetching && !isLoading && (
        <p className="text-xs text-ink-muted" aria-live="polite">
          Atualizando…
        </p>
      )}

      <PessoaFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />
    </section>
  );
}
