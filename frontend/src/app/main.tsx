import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@assets/styles/main.css';
import ConfirmHost from '@shared/components/ConfirmHost';
import ToastHost from '@shared/components/ToastHost';
import { ensureAuthHooks, useAuthStore } from '@features/auth/store';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Garante hooks de auth registrados antes da primeira request.
  ensureAuthHooks();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-surface-muted">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-surface">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
            </div>
          </div>
        }
      >
        <RouterProvider router={router} />
      </Suspense>
      <ToastHost />
      <ConfirmHost />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
