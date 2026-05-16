import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { messageFor } from '@shared/api/error-messages';
import type { Perfil, Usuario } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BasePagination from '@shared/components/BasePagination';
import BaseSelect from '@shared/components/BaseSelect';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import PageHeader from '@shared/components/PageHeader';
import { useConfirm } from '@shared/components/ConfirmHost';
import { useToast } from '@shared/components/ToastHost';
import { PERFIL_LABEL, PERFIS, perfisPermitidosPara } from '@shared/constants/perfis';
import { useDebounce } from '@shared/hooks/useDebounce';
import { formatDateTimeBR } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';

import SenhaDialog from '../components/SenhaDialog';
import UsuarioFormDialog from '../components/UsuarioFormDialog';
import {
  useDeleteUsuarioMutation,
  useUsuariosQuery,
} from '../queries/use-usuarios';

export default function UsuariosView() {
  const toast = useToast();
  const me = useAuthStore((s) => s.me);
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [perfilFilter, setPerfilFilter] = useState<Perfil | null>(null);
  const [incluirInativos, setIncluirInativos] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filter = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      perfil: perfilFilter ?? undefined,
      incluir_inativos: incluirInativos,
    }),
    [page, debouncedSearch, perfilFilter, incluirInativos],
  );

  const { data, isLoading, isFetching, error, refetch } = useUsuariosQuery(filter);
  const rows: Usuario[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const perfisVisiveis = useMemo(
    () => PERFIS.filter((perfil) => me?.perfil === 'administrador' || perfil.value !== 'administrador'),
    [me],
  );

  // ---- modais ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaTarget, setSenhaTarget] = useState<Usuario | null>(null);

  function abrirNovo(): void {
    setEditing(null);
    setFormOpen(true);
  }
  function abrirEdicao(u: Usuario): void {
    setEditing(u);
    setFormOpen(true);
  }
  function abrirSenha(u: Usuario): void {
    setSenhaTarget(u);
    setSenhaOpen(true);
  }

  // ---- soft delete ----
  const deleteMut = useDeleteUsuarioMutation();
  async function pedirInativacao(u: Usuario): Promise<void> {
    const ok = await confirm({
      title: 'Inativar usuário',
      message: `Confirma a inativação de ${u.nome}? As sessões abertas dele serão derrubadas.`,
      confirmLabel: 'Inativar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(u.id);
      toast.success('Usuário inativado.');
    } catch (err) {
      toast.error(messageFor(err));
    }
  }

  function ehProprio(u: Usuario): boolean {
    return me?.id === u.id;
  }
  function podeMexer(u: Usuario): boolean {
    if (!me) return false;
    if (u.eh_root && me.id !== u.id) return false;
    const permitidos = perfisPermitidosPara(me.perfil, me.pode_criar_usuarios);
    if (!permitidos.includes(u.perfil) && me.id !== u.id) return false;
    return true;
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Crie, edite perfis e administre senhas. Inativar um usuário revoga as sessões abertas."
        actions={me?.perfil === 'administrador' ? (
          <BaseButton onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo usuário
          </BaseButton>
        ) : null}
      />

      {/* Filtros */}
      <div className="card p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="u-search" className="field-label">
              Buscar
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <input
                id="u-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome ou login"
                className="block w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>
          <div className="sm:col-span-4">
            <BaseSelect
              label="Perfil"
              placeholder="Todos"
              options={perfisVisiveis.map((p) => ({ value: p.value, label: p.label }))}
              value={perfilFilter}
              onChange={(v) => {
                setPerfilFilter(v as Perfil | null);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={incluirInativos}
                onChange={(e) => {
                  setIncluirInativos(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
              />
              Mostrar inativos
            </label>
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
                <th className="px-4 py-2 font-medium">Login</th>
                <th className="px-4 py-2 font-medium">Perfil</th>
                <th className="px-4 py-2 font-medium">Situação</th>
                <th className="px-4 py-2 font-medium">Último login</th>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.id}
                    className="transition hover:bg-surface-muted"
                    style={{ opacity: u.situacao === 'inativo' ? 0.7 : 1 }}
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {u.nome}
                      {ehProprio(u) && (
                        <span className="ml-1 text-xs text-ink-muted">(você)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{u.login}</td>
                    <td className="px-4 py-3 text-ink-muted">{PERFIL_LABEL[u.perfil]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          u.situacao === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-surface-subtle text-ink-muted',
                        ].join(' ')}
                      >
                        {u.situacao}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {u.ultimo_login ? formatDateTimeBR(u.ultimo_login) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(podeMexer(u) || ehProprio(u)) && (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                            aria-label={`Editar ${u.nome}`}
                            onClick={() => abrirEdicao(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {(podeMexer(u) || ehProprio(u)) && (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                            aria-label={`Trocar senha de ${u.nome}`}
                            onClick={() => abrirSenha(u)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        {u.situacao === 'ativo' && !ehProprio(u) && podeMexer(u) && (
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`Inativar ${u.nome}`}
                            onClick={() => pedirInativacao(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

      <UsuarioFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />

      <SenhaDialog
        open={senhaOpen}
        target={senhaTarget}
        onClose={() => setSenhaOpen(false)}
      />
    </section>
  );
}
