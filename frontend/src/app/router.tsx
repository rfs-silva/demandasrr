import { lazy, type ReactNode } from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
  Navigate,
  useRouteError,
  useLocation,
} from 'react-router-dom';

import type { Me } from '@shared/api/types';
import AuthLayout from '@shared/layouts/AuthLayout';
import MainLayout from '@shared/layouts/MainLayout';
import { useAuthStore } from '@features/auth/store';

const LoginView = lazy(() => import('@features/auth/views/LoginView'));
const TrocarSenhaView = lazy(() => import('@features/auth/views/TrocarSenhaView'));
const PerfilView = lazy(() => import('@features/auth/views/PerfilView'));
const HomeView = lazy(() => import('@features/dashboard/HomeView'));
const SolicitacoesView = lazy(
  () => import('@features/solicitacoes/views/SolicitacoesView'),
);
const SolicitacaoDetalheView = lazy(
  () => import('@features/solicitacoes/views/SolicitacaoDetalheView'),
);
const UsuariosView = lazy(() => import('@features/usuarios/views/UsuariosView'));
const GerencialView = lazy(
  () => import('@features/solicitacoes/views/GerencialView'),
);
const LocalizarDemandaView = lazy(
  () => import('@features/solicitacoes/views/LocalizarDemandaView'),
);
const AuditoriaView = lazy(
  () => import('@features/auditoria/views/AuditoriaView'),
);
const PessoasView = lazy(() => import('@features/pessoas/views/PessoasView'));
const PessoaDetalheView = lazy(
  () => import('@features/pessoas/views/PessoaDetalheView'),
);

/* -------- Guard de rota protegida -------- */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const accessToken = useAuthStore((s) => s.accessToken);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return <FullPageLoading />;
  }
  if (!accessToken || !me) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (me.must_change_password && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }
  return <>{children}</>;
}

/* -------- Guard só de autenticação (sem chrome) — usado pelo /trocar-senha -------- */
function AuthedOnly({ children }: { children: ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const accessToken = useAuthStore((s) => s.accessToken);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) return <FullPageLoading />;
  if (!accessToken || !me) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

/* -------- Guard pra rotas públicas (login) — se já logado, vai pra home -------- */
function PublicOnly({ children }: { children: ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const accessToken = useAuthStore((s) => s.accessToken);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) return <FullPageLoading />;
  if (accessToken && me) {
    if (me.perfil === 'gestor_solicitante') return <Navigate to="/solicitacoes" replace />;
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/* -------- Redireciona home para gestor solicitante -------- */
function HomeRedirect() {
  const me = useAuthStore((s) => s.me);
  if (me?.perfil === 'gestor_solicitante') {
    return <Navigate to="/solicitacoes" replace />;
  }
  return <HomeView />;
}

/* -------- Gate de RBAC parametrizável (perfil + flags do `me`). -------- */
function RoleGate({
  check,
  children,
}: {
  check: (me: Me) => boolean;
  children: ReactNode;
}) {
  const me = useAuthStore((s) => s.me);
  if (!me) return null;
  if (!check(me)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-surface">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
      </div>
    </div>
  );
}

function NotFoundView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-surface p-8 shadow-pop">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
          Erro 404
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
          Pagina nao encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          O endereco acessado nao existe ou nao esta mais disponivel.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
            Ir para o inicio
          </Link>
          <Link to="/login" className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted">
            Voltar ao login
          </Link>
        </div>
      </section>
    </div>
  );
}

function RouteErrorView() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (notFound) {
    return <NotFoundView />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-surface p-8 shadow-pop">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          Erro 500
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
          Algo saiu do esperado
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Nao foi possivel carregar esta tela agora. Atualize a pagina ou tente novamente em instantes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
            Voltar ao sistema
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
          >
            Tentar novamente
          </button>
        </div>
      </section>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    errorElement: <RouteErrorView />,
    element: (
      <PublicOnly>
        <AuthLayout />
      </PublicOnly>
    ),
    children: [{ index: true, element: <LoginView /> }],
  },
  {
    // /trocar-senha vive no AuthLayout (centralizado, sem chrome do MainLayout)
    // para que o primeiro acesso e a troca voluntária tenham a mesma estética
    // do login.
    path: '/trocar-senha',
    errorElement: <RouteErrorView />,
    element: (
      <AuthedOnly>
        <AuthLayout />
      </AuthedOnly>
    ),
    children: [{ index: true, element: <TrocarSenhaView /> }],
  },
  {
    path: '/',
    errorElement: <RouteErrorView />,
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'perfil', element: <PerfilView /> },
      { path: 'solicitacoes', element: <SolicitacoesView /> },
      { path: 'solicitacoes/:id', element: <SolicitacaoDetalheView /> },
      {
        path: 'gerencial',
        element: (
          <RoleGate
            check={(me) =>
              me.perfil === 'administrador'
              || me.perfil === 'suporte'
              || me.perfil === 'governador'
            }
          >
            <GerencialView />
          </RoleGate>
        ),
      },
      {
        path: 'admin/localizar-demanda',
        element: (
          <RoleGate check={(me) => me.perfil === 'administrador'}>
            <LocalizarDemandaView />
          </RoleGate>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <RoleGate
            check={(me) =>
              me.perfil === 'administrador'
              || me.perfil === 'suporte'
              || (me.perfil === 'governador' && me.pode_criar_usuarios)
            }
          >
            <UsuariosView />
          </RoleGate>
        ),
      },
      {
        path: 'pessoas',
        element: (
          <RoleGate check={(me) => me.perfil === 'administrador'}>
            <PessoasView />
          </RoleGate>
        ),
      },
      {
        path: 'pessoas/:id',
        element: (
          <RoleGate check={(me) => me.perfil === 'administrador'}>
            <PessoaDetalheView />
          </RoleGate>
        ),
      },
      {
        path: 'auditoria',
        element: (
          <RoleGate check={(me) => me.perfil === 'administrador'}>
            <AuditoriaView />
          </RoleGate>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundView /> },
]);
