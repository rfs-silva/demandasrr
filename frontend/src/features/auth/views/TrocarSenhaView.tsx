import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { messageFor } from '@shared/api/error-messages';
import BaseButton from '@shared/components/BaseButton';
import BasePasswordInput from '@shared/components/BasePasswordInput';
import { useToast } from '@shared/components/ToastHost';
import { useAuthStore } from '@features/auth/store';

const senhaForte = z
  .string()
  .min(6, 'Mínimo de 6 caracteres')
  .max(128, 'Senha muito longa')
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), {
    message: 'Inclua letras e números',
  });

const schema = z
  .object({
    senha_atual: z.string().min(1, 'Informe sua senha atual'),
    nova_senha: senhaForte,
    confirmacao: z.string(),
  })
  .refine((d) => d.nova_senha === d.confirmacao, {
    message: 'As senhas não conferem',
    path: ['confirmacao'],
  });

type Input = z.infer<typeof schema>;

export default function TrocarSenhaView() {
  const change = useAuthStore((s) => s.changeOwnPassword);
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { senha_atual: '', nova_senha: '', confirmacao: '' },
  });

  async function onSubmit(values: Input): Promise<void> {
    setFormError(null);
    try {
      await change(values.senha_atual, values.nova_senha);
      toast.success('Senha atualizada com sucesso.');
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(messageFor(err));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-2xl border border-border bg-surface p-6 shadow-pop sm:p-7"
      noValidate
    >
      <div className="mb-5 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Trocar senha
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {me?.must_change_password
            ? 'É o seu primeiro acesso. Defina uma senha pessoal para continuar.'
            : 'Defina uma nova senha de acesso.'}
        </p>
      </div>

      <div className="space-y-4">
        <BasePasswordInput
          label="Senha atual"
          autoComplete="current-password"
          required
          error={errors.senha_atual?.message}
          disabled={isSubmitting}
          {...register('senha_atual')}
        />
        <BasePasswordInput
          label="Nova senha"
          autoComplete="new-password"
          required
          hint="Mínimo 6 caracteres, incluindo letras e números."
          error={errors.nova_senha?.message}
          disabled={isSubmitting}
          {...register('nova_senha')}
        />
        <BasePasswordInput
          label="Confirmar nova senha"
          autoComplete="new-password"
          required
          error={errors.confirmacao?.message}
          disabled={isSubmitting}
          {...register('confirmacao')}
        />

        {formError && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100"
          >
            {formError}
          </p>
        )}

        <BaseButton type="submit" block size="lg" loading={isSubmitting}>
          <KeyRound className="h-4 w-4" />
          Atualizar senha
        </BaseButton>
      </div>
    </form>
  );
}
