import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { messageFor } from '@shared/api/error-messages';
import BaseButton from '@shared/components/BaseButton';
import BaseInput from '@shared/components/BaseInput';
import BasePasswordInput from '@shared/components/BasePasswordInput';
import { useAuthStore } from '@features/auth/store';

const loginSchema = z.object({
  login: z.string().trim().min(3, 'Informe seu login'),
  senha: z.string().min(1, 'Informe sua senha'),
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginView() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', senha: '' },
  });

  async function onSubmit(values: LoginInput): Promise<void> {
    setFormError(null);
    try {
      await login(values.login.trim(), values.senha);
      const next = params.get('next') || '/';
      navigate(next, { replace: true });
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
          Entrar
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Use suas credenciais para acessar o sistema.
        </p>
      </div>

      <div className="space-y-4">
        <BaseInput
          label="Login"
          placeholder="Seu login"
          inputMode="text"
          autoComplete="username"
          autoFocus
          required
          error={errors.login?.message}
          disabled={isSubmitting}
          {...register('login')}
        />

        <BasePasswordInput
          label="Senha"
          placeholder="Sua senha"
          autoComplete="current-password"
          required
          error={errors.senha?.message}
          disabled={isSubmitting}
          {...register('senha')}
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
          <LogIn className="h-4 w-4" />
          Entrar
        </BaseButton>
      </div>
    </form>
  );
}
