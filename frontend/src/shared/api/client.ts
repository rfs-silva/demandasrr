import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { fromAxiosError } from './errors';

/**
 * Hooks que o store de auth registra em runtime, evitando ciclo de import.
 */
interface AuthHooks {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onAuthFailed: () => void;
}

let hooks: AuthHooks | null = null;
export function registerAuthHooks(h: AuthHooks): void {
  hooks = h;
}

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/* ----------- Request interceptor: anexa Bearer ------------ */
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = hooks?.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/* ----------- Response interceptor: 401 → refresh + retry ------------ */

let inFlightRefresh: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Cancelamentos do TanStack/AbortController não são erros reais.
    if (axios.isCancel(error)) return Promise.reject(error);

    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const data = error.response?.data as { error?: { code?: string } } | undefined;
    const code = data?.error?.code;

    const shouldTryRefresh =
      status === 401 &&
      code === 'INVALID_TOKEN' &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/logout') &&
      hooks?.refresh;

    if (shouldTryRefresh) {
      original._retry = true;
      try {
        inFlightRefresh ??= hooks!.refresh().finally(() => {
          inFlightRefresh = null;
        });
        const newToken = await inFlightRefresh;
        if (newToken) {
          original.headers?.set('Authorization', `Bearer ${newToken}`);
          return apiClient.request(original);
        }
      } catch {
        /* cai para o fluxo de falha abaixo */
      }
      hooks?.onAuthFailed();
    }

    return Promise.reject(fromAxiosError(error as AxiosError<never>));
  },
);
