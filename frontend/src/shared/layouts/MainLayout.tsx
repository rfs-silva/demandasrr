import clsx from 'clsx';
import {
  BellRing,
  ClipboardList,
  FilePieChart,
  History,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Search,
  ShieldCheck,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@features/auth/store';
import { useStatusCountsQuery } from '@features/solicitacoes/queries/use-status-counts';
import type { Me } from '@shared/api/types';
import {
  podeAcessarUsuarios,
} from '@shared/constants/perfis';
import UserMenu from '@shared/components/UserMenu';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Se omitido → visível para qualquer autenticado. */
  visible?: (me: Me) => boolean;
}

const operacionalOuAcima = (p: Me['perfil']): boolean =>
  p === 'suporte' || p === 'governador' || p === 'administrador';

const SECTIONS: ReadonlyArray<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operação',
    items: [
      {
        to: '/',
        label: 'Início',
        icon: LayoutDashboard,
        visible: (me) => me.perfil !== 'gestor_solicitante',
      },
      { to: '/solicitacoes', label: 'Solicitações', icon: ClipboardList },
      {
        to: '/pessoas',
        label: 'Pessoas',
        icon: Users,
        visible: (me) => me.perfil === 'administrador',
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      {
        to: '/gerencial',
        label: 'Painel gerencial',
        icon: FilePieChart,
        visible: (me) => operacionalOuAcima(me.perfil),
      },
      {
        to: '/admin/localizar-demanda',
        label: 'Localizar demanda',
        icon: Search,
        visible: (me) => me.perfil === 'administrador',
      },
      {
        to: '/usuarios',
        label: 'Usuários',
        icon: UsersRound,
        visible: (me) => podeAcessarUsuarios(me),
      },
      {
        to: '/auditoria',
        label: 'Auditoria',
        icon: History,
        visible: (me) => me.perfil === 'administrador',
      },
    ],
  },
];

export default function MainLayout() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const mostrarAlertaDemandas = me?.perfil === 'suporte' || me?.perfil === 'administrador';
  const counts = useStatusCountsQuery({}, mostrarAlertaDemandas);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Fecha drawer ao navegar.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  if (!me) return null;

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.visible || i.visible(me)),
  })).filter((s) => s.items.length > 0);

  const breadcrumbTitle = location.pathname === '/' ? 'Início' : '';
  const pendentes = counts.data?.cadastrada ?? 0;

  return (
    <div className="min-h-screen bg-surface-muted lg:grid lg:grid-cols-[260px_1fr]">
      {/* ============ Sidebar desktop (sticky) ============ */}
      <aside className="hidden border-r border-border bg-surface lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
        <div className="flex h-16 flex-none items-center gap-3 border-b border-border px-5">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-xs"
            aria-hidden
          >
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display font-semibold text-ink">Demandas RR</p>
            <p className="text-2xs text-ink-subtle">Gestão de Solicitações</p>
          </div>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
          aria-label="Menu principal"
        >
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              <p className="section-eyebrow mb-2 px-2">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100'
                            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex-none border-t border-border px-3 py-2">
          <p className="px-2 text-2xs text-ink-subtle">
            © {new Date().getFullYear()} · Governo de RR
          </p>
        </div>
      </aside>

      {/* ============ Conteúdo ============ */}
      <div className="flex min-h-screen flex-col">
        {/* Topbar */}
        <header
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-8"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <nav aria-label="Trilha de navegação" className="min-w-0">
              <ol className="flex items-center gap-2 text-sm">
                <li className="hidden text-ink-subtle sm:block">Demandas RR</li>
                <li className="hidden text-ink-subtle sm:block" aria-hidden>
                  /
                </li>
                <li className="truncate font-medium text-ink">
                  {breadcrumbTitle || ''}
                </li>
              </ol>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {mostrarAlertaDemandas && pendentes > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-100"
                onClick={() => navigate('/gerencial?status=cadastrada')}
                aria-label={`${pendentes} demandas aguardando atendimento`}
                title={`${pendentes} demandas aguardando atendimento`}
              >
                <span className="relative inline-flex">
                  <BellRing className="h-4 w-4" aria-hidden />
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                </span>
                <span className="hidden sm:inline">
                  {pendentes} {pendentes === 1 ? 'demanda aguardando' : 'demandas aguardando'}
                </span>
                <span className="sm:hidden">{pendentes}</span>
              </button>
            )}
            <UserMenu />
          </div>
        </header>

        {/* Drawer mobile */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface lg:hidden">
              <div className="flex h-16 items-center justify-between border-b border-border px-5">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"
                    aria-hidden
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <p className="font-display font-semibold">Demandas RR</p>
                </div>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-surface-muted"
                  aria-label="Fechar menu"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                {visibleSections.map((section) => (
                  <div key={section.title} className="mb-5 last:mb-0">
                    <p className="section-eyebrow mb-2 px-2">{section.title}</p>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                              clsx(
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                                isActive
                                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100'
                                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                              )
                            }
                          >
                            <item.icon className="h-4 w-4" aria-hidden />
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
              <div className="border-t border-border p-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
                  onClick={async () => {
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </aside>
          </>
        )}

        <main
          className="flex-1 px-4 py-6 lg:px-8 lg:py-8"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
