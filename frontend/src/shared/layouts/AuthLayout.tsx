import { Outlet } from 'react-router-dom';

/**
 * Layout sem chrome — usado em /login e /trocar-senha.
 * Tela inteira com fundo decorado em verde-floresta + cartão flutuante central.
 * Preserva a identidade visual do Vue.
 */
export default function AuthLayout() {
  return (
    <div className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-surface-muted px-4 py-10 sm:px-6">
      {/* Manchas decorativas — gradiente brand bem suave, não interfere na leitura */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-surface-muted to-brand-100/60 dark:from-brand-950/40 dark:via-surface-muted dark:to-brand-900/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 -z-10 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-700/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 -z-10 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl dark:bg-brand-800/25"
      />

      <div className="w-full max-w-sm">
        <header className="mb-6 flex flex-col items-center text-center">
          <img
            src="/brasao-logo-1x.png"
            alt=""
            className="h-24 w-auto object-contain drop-shadow-md"
            aria-hidden="true"
          />
          <p className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
            Demandas RR
          </p>
          <p className="text-2xs uppercase tracking-[0.18em] text-ink-subtle">
            Gestão de Solicitações
          </p>
        </header>

        <Outlet />

        <p className="mt-6 text-center text-2xs text-ink-subtle">
          © {new Date().getFullYear()} · Governo de Roraima
        </p>
      </div>
    </div>
  );
}
