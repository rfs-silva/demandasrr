import { create } from 'zustand';

import { apiClient, registerAuthHooks } from '@shared/api/client';
import type { ApiEnvelope, Me, Perfil, Token } from '@shared/api/types';

const SESSION_HINT_KEY = 'demandasrr.hasSession';

function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionHint(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* localStorage pode estar indisponível; a autenticação não depende disso. */
  }
}

interface AuthState {
  accessToken: string | null;
  me: Me | null;
  initialized: boolean;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  reset: () => void;
  hasRole: (...roles: Perfil[]) => boolean;
  isAuthenticated: () => boolean;
  changeOwnPassword: (atual: string, nova: string) => Promise<void>;
  updateOwnProfile: (payload: Partial<{
    nome: string;
    municipio_id: string;
    localidade: string | null;
    contato: string | null;
    data_nascimento: string | null;
  }>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  me: null,
  initialized: false,
  loading: false,

  isAuthenticated: () => !!get().accessToken && !!get().me,

  hasRole: (...roles: Perfil[]) => {
    const me = get().me;
    return !!me && roles.includes(me.perfil);
  },

  reset: () => {
    setSessionHint(false);
    set({ accessToken: null, me: null });
  },

  login: async (login, senha) => {
    set({ loading: true });
    try {
      const r = await apiClient.post<ApiEnvelope<Token>>('/auth/login', {
        login,
        senha,
      });
      const tokens = r.data.data;
      setSessionHint(true);
      set({ accessToken: tokens.access_token });
      const me = await apiClient.get<ApiEnvelope<Me>>('/auth/me');
      set({ me: me.data.data, initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      const r = await apiClient.post<ApiEnvelope<Token>>('/auth/refresh');
      const tokens = r.data.data;
      setSessionHint(true);
      set({ accessToken: tokens.access_token });
      return tokens.access_token;
    } catch {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        /* limpeza de cookie é best-effort */
      }
      get().reset();
      return null;
    }
  },

  logout: async () => {
    get().reset();
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* logout do servidor é best-effort */
    }
  },

  bootstrap: async () => {
    if (get().initialized) return;
    let t: string | null = null;
    if (hasSessionHint()) {
      t = await get().refresh();
    }
    if (t) {
      try {
        const me = await apiClient.get<ApiEnvelope<Me>>('/auth/me');
        set({ me: me.data.data });
      } catch {
        get().reset();
      }
    }
    set({ initialized: true });
  },

  changeOwnPassword: async (atual, nova) => {
    await apiClient.patch('/auth/me/senha', {
      senha_atual: atual,
      nova_senha: nova,
    });
    const me = get().me;
    if (me) set({ me: { ...me, must_change_password: false } });
  },

  updateOwnProfile: async (payload) => {
    const r = await apiClient.patch<ApiEnvelope<Me>>('/auth/me', payload);
    set({ me: r.data.data });
  },
}));

/* -------- Conecta a store ao axios client (hooks injection) -------- */
let hooksRegistered = false;
export function ensureAuthHooks(): void {
  if (hooksRegistered) return;
  registerAuthHooks({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: () => useAuthStore.getState().refresh(),
    onAuthFailed: () => useAuthStore.getState().reset(),
  });
  hooksRegistered = true;
}
