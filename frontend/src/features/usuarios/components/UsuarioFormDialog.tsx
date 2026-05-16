import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { messageFor } from '@shared/api/error-messages';
import { isApiError } from '@shared/api/errors';
import type { Perfil, Situacao, Usuario } from '@shared/api/types';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseModal from '@shared/components/BaseModal';
import BaseSelect from '@shared/components/BaseSelect';
import { useToast } from '@shared/components/ToastHost';
import { PERFIS, perfisPermitidosPara } from '@shared/constants/perfis';
import { digitsOnly, maskCpfWhileTyping } from '@shared/utils/cpf';
import { useAuthStore } from '@features/auth/store';
import MunicipioPicker from '@features/municipios/components/MunicipioPicker';

import {
  useCreateUsuarioMutation,
  useUpdateUsuarioMutation,
} from '../queries/use-usuarios';
import {
  usuarioCreateSchema,
  usuarioUpdateSchema,
  type UsuarioCreateInput,
  type UsuarioUpdateInput,
} from '../schemas';

interface Props {
  open: boolean;
  editing: Usuario | null;
  onClose: () => void;
  onSaved?: () => void;
}

const SITUACOES: { value: Situacao; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

export default function UsuarioFormDialog({
  open,
  editing,
  onClose,
  onSaved,
}: Props) {
  const me = useAuthStore((s) => s.me);
  const toast = useToast();
  const createMut = useCreateUsuarioMutation();
  const updateMut = useUpdateUsuarioMutation();

  const isEdit = !!editing;
  const [formError, setFormError] = useState<string | null>(null);
  const [senhaTemp, setSenhaTemp] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<string | null>(null);

  const ehAdminEditor = me?.perfil === 'administrador';

  // Perfis que o usuário logado pode atribuir.
  const perfisDisponiveis = (() => {
    if (!me) return [];
    const permitidos = perfisPermitidosPara(me.perfil, me.pode_criar_usuarios);
    return PERFIS.filter((p) => permitidos.includes(p.value)).map((p) => ({
      value: p.value,
      label: p.label,
    }));
  })();

  function mostrarFlags(perfil: Perfil | undefined): boolean {
    if (!ehAdminEditor || !perfil) return false;
    return perfil === 'suporte' || perfil === 'governador';
  }
  function mostrarFlagsSolicitante(perfil: Perfil | undefined): boolean {
    if (!ehAdminEditor || !perfil) return false;
    return perfil === 'gestor_solicitante';
  }

  /* ---------- Form CREATE ---------- */
  const cForm = useForm<UsuarioCreateInput>({
    resolver: zodResolver(usuarioCreateSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      municipio_id: '',
      perfil: 'gestor_solicitante',
      localidade: '',
      contato: '',
      data_nascimento: '',
      pode_criar_usuarios: false,
      pode_criar_solicitacoes: false,
      pode_reabrir_solicitacoes: false,
      ver_status_solicitacao: false,
    },
  });

  /* ---------- Form UPDATE ---------- */
  const uForm = useForm<UsuarioUpdateInput>({
    resolver: zodResolver(usuarioUpdateSchema),
    defaultValues: {
      nome: '',
      perfil: 'gestor_solicitante',
      situacao: 'ativo',
      contato: '',
      data_nascimento: '',
      pode_criar_usuarios: false,
      pode_criar_solicitacoes: false,
      pode_reabrir_solicitacoes: false,
      ver_status_solicitacao: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setSenhaTemp(null);
    setCreatedLogin(null);
    if (editing) {
      uForm.reset({
        nome: editing.nome,
        perfil: editing.perfil,
        situacao: editing.situacao,
        contato: editing.contato ?? '',
        data_nascimento: editing.data_nascimento ?? '',
        pode_criar_usuarios: editing.pode_criar_usuarios,
        pode_criar_solicitacoes: editing.pode_criar_solicitacoes,
        pode_reabrir_solicitacoes: editing.pode_reabrir_solicitacoes,
        ver_status_solicitacao: editing.ver_status_solicitacao,
      });
    } else {
      cForm.reset({
        nome: '',
        cpf: '',
        municipio_id: '',
        perfil: 'gestor_solicitante',
        localidade: '',
        contato: '',
        data_nascimento: '',
        pode_criar_usuarios: false,
        pode_criar_solicitacoes: false,
        pode_reabrir_solicitacoes: false,
        ver_status_solicitacao: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function copiarSenha(): Promise<void> {
    if (!senhaTemp) return;
    try {
      await navigator.clipboard.writeText(senhaTemp);
      toast.success('Senha copiada.');
    } catch {
      toast.warning('Não foi possível copiar automaticamente.');
    }
  }

  /* ---------- Submit CREATE ---------- */
  const onCreate = cForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const flags = {
        ...(mostrarFlags(values.perfil as Perfil)
          ? {
              pode_criar_usuarios: !!values.pode_criar_usuarios,
              pode_criar_solicitacoes: !!values.pode_criar_solicitacoes,
              pode_reabrir_solicitacoes: !!values.pode_reabrir_solicitacoes,
            }
          : {}),
        ...(mostrarFlagsSolicitante(values.perfil as Perfil)
          ? { ver_status_solicitacao: !!values.ver_status_solicitacao }
          : {}),
      };
      const r = await createMut.mutateAsync({
        nome: values.nome,
        login: digitsOnly(values.cpf),
        cpf: digitsOnly(values.cpf),
        municipio_id: values.municipio_id,
        perfil: values.perfil as Perfil,
        localidade: values.localidade || null,
        contato: values.contato || null,
        data_nascimento: values.data_nascimento || null,
        ...flags,
      });
      toast.success('Usuário criado.');
      setSenhaTemp(r.senha_temporaria);
      setCreatedLogin(r.usuario.login);
      onSaved?.();
    } catch (err) {
      setFormError(messageFor(err));
      if (isApiError(err) && err.code === 'CPF_DUPLICADO') {
        cForm.setError('cpf', { message: 'CPF já em uso.' });
      }
    }
  });

  /* ---------- Submit UPDATE ---------- */
  const onUpdate = uForm.handleSubmit(async (values) => {
    if (!editing) return;
    setFormError(null);
    try {
      const flags = {
        ...(mostrarFlags(values.perfil as Perfil)
          ? {
              pode_criar_usuarios: !!values.pode_criar_usuarios,
              pode_criar_solicitacoes: !!values.pode_criar_solicitacoes,
              pode_reabrir_solicitacoes: !!values.pode_reabrir_solicitacoes,
            }
          : {}),
        ...(mostrarFlagsSolicitante(values.perfil as Perfil)
          ? { ver_status_solicitacao: !!values.ver_status_solicitacao }
          : {}),
      };
      await updateMut.mutateAsync({
        id: editing.id,
        payload: {
          nome: values.nome,
          perfil: values.perfil as Perfil,
          situacao: values.situacao,
          contato: values.contato || null,
          data_nascimento: values.data_nascimento || undefined,
          ...flags,
        },
      });
      toast.success('Usuário atualizado.');
      onSaved?.();
      onClose();
    } catch (err) {
      setFormError(messageFor(err));
    }
  });

  const submitting = cForm.formState.isSubmitting || uForm.formState.isSubmitting;
  const cPerfil = cForm.watch('perfil');
  const uPerfil = uForm.watch('perfil');
  const ehRoot = editing?.eh_root ?? false;

  const title = senhaTemp ? 'Usuário criado' : isEdit ? 'Editar usuário' : 'Novo usuário';
  const description = senhaTemp
    ? 'Anote a senha temporária — o usuário será obrigado a trocá-la no primeiro acesso.'
    : isEdit
      ? 'CPF e login são imutáveis. Para resetar a senha, use o botão dedicado na linha.'
      : 'O login do usuário será o próprio CPF. A senha temporária é gerada automaticamente.';

  return (
    <BaseModal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={title}
      description={description}
      size="md"
      closeOnBackdrop={!senhaTemp && !submitting}
      footer={
        senhaTemp ? (
          <BaseButton onClick={onClose}>Concluir</BaseButton>
        ) : (
          <>
            <BaseButton
              variant="secondary"
              disabled={submitting}
              onClick={onClose}
            >
              Cancelar
            </BaseButton>
            <BaseButton
              type="submit"
              form="usuario-form"
              loading={submitting}
            >
              {isEdit ? 'Salvar' : 'Criar usuário'}
            </BaseButton>
          </>
        )
      }
    >
      {senhaTemp ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900/60 dark:bg-brand-950/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-800 dark:text-brand-200">
              Senha temporária
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="font-mono text-lg font-bold text-brand-900 dark:text-brand-100">
                {senhaTemp}
              </code>
              <BaseButton variant="secondary" size="sm" onClick={copiarSenha}>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </BaseButton>
            </div>
            <p className="mt-3 text-xs text-brand-800 dark:text-brand-200">
              {createdLogin ? (
                <>
                  Login inicial: <strong>{createdLogin}</strong>. No primeiro acesso ele é
                  obrigado a trocar a senha por uma pessoal.
                </>
              ) : (
                'No primeiro acesso ele é obrigado a trocar a senha por uma pessoal.'
              )}
            </p>
          </div>
        </div>
      ) : isEdit ? (
        <form id="usuario-form" className="space-y-4" noValidate onSubmit={onUpdate}>
          <BaseInput
            label="Nome completo"
            required
            error={uForm.formState.errors.nome?.message}
            disabled={submitting}
            {...uForm.register('nome')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={uForm.control}
              name="perfil"
              render={({ field, fieldState }) => (
                <BaseSelect
                  label="Perfil"
                  options={perfisDisponiveis}
                  required
                  disabled={submitting || ehRoot}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? 'gestor_solicitante')}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={uForm.control}
              name="situacao"
              render={({ field, fieldState }) => (
                <BaseSelect
                  label="Situação"
                  options={SITUACOES}
                  required
                  disabled={submitting || ehRoot}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange((v as Situacao) ?? 'ativo')}
                  error={fieldState.error?.message}
                />
              )}
            />
            <BaseInput
              label="Contato (opcional)"
              placeholder="Telefone, e-mail…"
              disabled={submitting}
              error={uForm.formState.errors.contato?.message}
              {...uForm.register('contato')}
            />
            <BaseInput
              label="Data de nascimento (opcional)"
              type="date"
              disabled={submitting}
              error={uForm.formState.errors.data_nascimento?.message}
              {...uForm.register('data_nascimento')}
            />
          </div>

          {/* Flags suporte/governador (admin) */}
          {mostrarFlags(uPerfil as Perfil) && !ehRoot && (
            <fieldset className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Permissões especiais
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...uForm.register('pode_criar_solicitacoes')}
                />
                <span>
                  <span className="font-medium text-ink">Pode abrir solicitações</span>
                  <span className="block text-xs text-ink-muted">
                    Libera o botão de "Nova solicitação" para este usuário.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...uForm.register('pode_criar_usuarios')}
                />
                <span>
                  <span className="font-medium text-ink">Pode cadastrar usuários</span>
                  <span className="block text-xs text-ink-muted">
                    Dá acesso ao módulo de Usuários (perfis ≤ suporte).
                  </span>
                </span>
              </label>
              {(uPerfil as Perfil) === 'suporte' && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                    disabled={submitting}
                    {...uForm.register('pode_reabrir_solicitacoes')}
                  />
                  <span>
                    <span className="font-medium text-ink">Pode reabrir solicitações canceladas</span>
                    <span className="block text-xs text-ink-muted">
                      Libera a mudança de cancelada para em análise.
                    </span>
                  </span>
                </label>
              )}
            </fieldset>
          )}

          {/* Flag de visibilidade de status (gestor_solicitante) */}
          {mostrarFlagsSolicitante(uPerfil as Perfil) && (
            <fieldset className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Acompanhamento
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...uForm.register('ver_status_solicitacao')}
                />
                <span>
                  <span className="font-medium text-ink">Ver status real da solicitação</span>
                  <span className="block text-xs text-ink-muted">
                    Por padrão, o solicitante vê todas as suas solicitações como
                    <em> Cadastrada</em>. Ative para que ele acompanhe a evolução real.
                  </span>
                </span>
              </label>
              {(cPerfil as Perfil) === 'suporte' && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                    disabled={submitting}
                    {...cForm.register('pode_reabrir_solicitacoes')}
                  />
                  <span>
                    <span className="font-medium text-ink">Pode reabrir solicitações canceladas</span>
                    <span className="block text-xs text-ink-muted">
                      Libera a mudança de cancelada para em análise.
                    </span>
                  </span>
                </label>
              )}
            </fieldset>
          )}

          {ehRoot && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Esta é a conta administrador root — perfil e situação não podem ser alterados.
            </p>
          )}

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
            >
              {formError}
            </p>
          )}
        </form>
      ) : (
        <form id="usuario-form" className="space-y-4" noValidate onSubmit={onCreate}>
          <BaseInput
            label="Nome completo"
            required
            error={cForm.formState.errors.nome?.message}
            disabled={submitting}
            {...cForm.register('nome')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={cForm.control}
              name="cpf"
              render={({ field, fieldState }) => (
                <BaseInput
                  label="Login"
                  hint="O login é o CPF do usuário, apenas com números."
                  inputMode="numeric"
                  maxLength={14}
                  required
                  disabled={submitting}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(maskCpfWhileTyping((e.target as HTMLInputElement).value))
                  }
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={cForm.control}
              name="perfil"
              render={({ field, fieldState }) => (
                <BaseSelect
                  label="Perfil"
                  options={perfisDisponiveis}
                  required
                  disabled={submitting}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? 'gestor_solicitante')}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>

          <Controller
            control={cForm.control}
            name="municipio_id"
            render={({ field, fieldState }) => (
              <MunicipioPicker
                municipioId={field.value || null}
                localidade={cForm.watch('localidade') ?? null}
                required
                disabled={submitting}
                onChange={(id, loc) => {
                  field.onChange(id ?? '');
                  cForm.setValue('localidade', loc ?? '', { shouldValidate: true });
                }}
                error={{
                  municipio_id: fieldState.error?.message ?? null,
                  localidade: cForm.formState.errors.localidade?.message ?? null,
                }}
              />
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BaseInput
              label="Contato (opcional)"
              placeholder="Telefone, e-mail…"
              disabled={submitting}
              error={cForm.formState.errors.contato?.message}
              {...cForm.register('contato')}
            />
            <BaseInput
              label="Data de nascimento (opcional)"
              type="date"
              disabled={submitting}
              error={cForm.formState.errors.data_nascimento?.message}
              {...cForm.register('data_nascimento')}
            />
          </div>

          {mostrarFlags(cPerfil as Perfil) && (
            <fieldset className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Permissões especiais
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...cForm.register('pode_criar_solicitacoes')}
                />
                <span>
                  <span className="font-medium text-ink">Pode abrir solicitações</span>
                  <span className="block text-xs text-ink-muted">
                    Libera o botão de "Nova solicitação" para este usuário.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...cForm.register('pode_criar_usuarios')}
                />
                <span>
                  <span className="font-medium text-ink">Pode cadastrar usuários</span>
                  <span className="block text-xs text-ink-muted">
                    Dá acesso ao módulo de Usuários (perfis ≤ suporte).
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          {mostrarFlagsSolicitante(cPerfil as Perfil) && (
            <fieldset className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Acompanhamento
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={submitting}
                  {...cForm.register('ver_status_solicitacao')}
                />
                <span>
                  <span className="font-medium text-ink">Ver status real da solicitação</span>
                  <span className="block text-xs text-ink-muted">
                    Por padrão, o solicitante vê suas solicitações sempre como
                    <em> Cadastrada</em>. Ative para liberar o acompanhamento real.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <p className="text-xs text-ink-muted">
            A senha temporária será exibida após o cadastro. Padrão:{' '}
            <code className="font-mono">&lt;4 últimos dígitos do CPF&gt;</code>.
          </p>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
            >
              {formError}
            </p>
          )}
        </form>
      )}
    </BaseModal>
  );
}
