import {
  AtSign,
  Check,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { messageFor } from '@shared/api/error-messages';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BaseSkeleton from '@shared/components/BaseSkeleton';
import PageHeader from '@shared/components/PageHeader';
import { useToast } from '@shared/components/ToastHost';
import { PERFIL_LABEL } from '@shared/constants/perfis';
import { calcularIdade, formatDateBR } from '@shared/utils/date';
import { useAuthStore } from '@features/auth/store';
import MunicipioPicker from '@features/municipios/components/MunicipioPicker';
import { usePessoaQuery } from '@features/pessoas/queries/use-pessoas';

export default function PerfilView() {
  const me = useAuthStore((s) => s.me);
  const updateOwnProfile = useAuthStore((s) => s.updateOwnProfile);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();

  const pessoaId = me?.pessoa_id ?? '';
  const { data: pessoa, refetch: refetchPessoa } = usePessoaQuery(pessoaId);

  const idade = calcularIdade(pessoa?.data_nascimento);
  const municipioLabel = pessoa
    ? pessoa.municipio.eh_outros && pessoa.localidade
      ? `${pessoa.municipio.nome} — ${pessoa.localidade}`
      : pessoa.municipio.nome
    : '';

  const iniciais =
    (me?.nome ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U';

  // ----- modo edição -----
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fNome, setFNome] = useState('');
  const [fMunicipioId, setFMunicipioId] = useState<string | null>(null);
  const [fLocalidade, setFLocalidade] = useState<string | null>(null);
  const [fContato, setFContato] = useState('');
  const [fDataNasc, setFDataNasc] = useState('');

  function carregarForm(): void {
    setFNome(me?.nome ?? '');
    setFMunicipioId(pessoa?.municipio.id ?? null);
    setFLocalidade(pessoa?.localidade ?? null);
    setFContato(me?.contato ?? '');
    setFDataNasc(pessoa?.data_nascimento ?? '');
  }

  useEffect(() => {
    if (editing) carregarForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa]);

  function startEdit(): void {
    carregarForm();
    setFormError(null);
    setEditing(true);
  }
  function cancelEdit(): void {
    setEditing(false);
    setFormError(null);
  }

  async function salvar(): Promise<void> {
    if (!fNome.trim() || fNome.trim().length < 3) {
      setFormError('Nome deve ter ao menos 3 caracteres.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateOwnProfile({
        nome: fNome.trim(),
        municipio_id: fMunicipioId || undefined,
        localidade: fLocalidade || null,
        contato: fContato.trim() || null,
        data_nascimento: fDataNasc || null,
      });
      await refetchPessoa();
      setEditing(false);
      toast.success('Perfil atualizado.');
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  async function fazerLogout(): Promise<void> {
    await logout();
    toast.info('Você saiu da sua conta.');
    navigate('/login', { replace: true });
  }

  return (
    <section>
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Dados pessoais e ações da sua conta."
        actions={
          <BaseButton variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Voltar
          </BaseButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cabeçalho com avatar */}
        <article className="card p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="grid h-16 w-16 flex-none place-items-center rounded-full bg-brand-600 text-xl font-semibold text-white"
              aria-hidden
            >
              {iniciais}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                {me?.nome}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  {me?.perfil ? PERFIL_LABEL[me.perfil] : ''}
                </span>
                {me?.eh_root && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Conta root
                  </span>
                )}
              </div>
            </div>
          </div>
        </article>

        {/* Dados pessoais (2/3) */}
        <article className="card p-5 lg:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="section-eyebrow">Dados pessoais</h3>
            {!editing && (
              <BaseButton variant="secondary" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </BaseButton>
            )}
          </header>

          {!editing ? (
            <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <AtSign className="h-3.5 w-3.5" aria-hidden />
                  Login
                </dt>
                <dd className="mt-0.5 font-medium text-ink tabular-nums">
                  {me ? me.login : <BaseSkeleton width="8rem" />}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Município
                </dt>
                <dd className="mt-0.5 font-medium text-ink">{municipioLabel || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Data de nascimento</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {pessoa?.data_nascimento
                    ? (
                      <>
                        {formatDateBR(pessoa.data_nascimento)}{' '}
                        {idade !== null && (
                          <span className="font-normal text-ink-muted">({idade} anos)</span>
                        )}
                      </>
                    )
                    : 'Não informado'}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Contato
                </dt>
                <dd className="mt-0.5 font-medium text-ink">{me?.contato || '—'}</dd>
              </div>
            </dl>
          ) : (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void salvar();
              }}
            >
              <BaseInput
                label="Nome completo"
                maxLength={150}
                required
                disabled={saving}
                value={fNome}
                onChange={(e) => setFNome(e.target.value)}
              />
              <MunicipioPicker
                municipioId={fMunicipioId}
                localidade={fLocalidade}
                disabled={saving}
                onChange={(id, loc) => {
                  setFMunicipioId(id);
                  setFLocalidade(loc);
                }}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BaseInput
                  label="Contato (telefone ou e-mail)"
                  maxLength={50}
                  disabled={saving}
                  value={fContato}
                  onChange={(e) => setFContato(e.target.value)}
                />
                <BaseInput
                  label="Data de nascimento"
                  type="date"
                  disabled={saving}
                  value={fDataNasc}
                  onChange={(e) => setFDataNasc(e.target.value)}
                />
              </div>
              {formError && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
                >
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <BaseButton
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </BaseButton>
                <BaseButton type="submit" loading={saving}>
                  <Check className="h-4 w-4" />
                  Salvar alterações
                </BaseButton>
              </div>
            </form>
          )}
        </article>

        {/* Ações da conta (1/3) */}
        <aside className="space-y-4">
          <article className="card p-5">
            <h3 className="section-eyebrow mb-3">Segurança</h3>
            <BaseButton block variant="secondary" onClick={() => navigate('/trocar-senha')}>
              <KeyRound className="h-4 w-4" />
              Trocar senha
            </BaseButton>
            <p className="mt-2 text-xs text-ink-muted">
              Recomendamos trocar a senha a cada 90 dias.
            </p>
          </article>
          <article className="card p-5">
            <h3 className="section-eyebrow mb-3">Sessão</h3>
            <BaseButton block variant="danger" onClick={fazerLogout}>
              <LogOut className="h-4 w-4" />
              Sair da conta
            </BaseButton>
            <p className="mt-2 text-xs text-ink-muted">
              Ao sair, será necessário entrar novamente.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}
