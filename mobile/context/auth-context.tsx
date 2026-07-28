import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, jsonBody } from '@/lib/api';
import { AuthTokens, tokenStorage } from '@/lib/storage';
import type { Profile } from '@/types/api';

type RegistrationValues = {
  username: string;
  email: string;
  password: string;
  password2: string;
  legal_consent: boolean;
};

type AuthContextValue = {
  user: Profile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (values: RegistrationValues) => Promise<{ message: string; masked_email: string }>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<Profile | null>;
  clearAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(async () => {
    await tokenStorage.clear();
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    try {
      const profile = await api<Profile>('/profile/');
      setUser(profile);
      return profile;
    } catch {
      await clearAuth();
      return null;
    }
  }, [clearAuth]);

  useEffect(() => {
    (async () => {
      const tokens = await tokenStorage.get();
      if (tokens) await reloadUser();
      setLoading(false);
    })();
  }, [reloadUser]);

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await api<AuthTokens>('/auth/login/', {
      method: 'POST',
      body: jsonBody({ username, password }),
      authenticated: false,
    });
    await tokenStorage.set(tokens);
    const profile = await api<Profile>('/profile/');
    setUser(profile);
  }, []);

  const register = useCallback((values: RegistrationValues) => api<{ message: string; masked_email: string }>('/auth/register/', {
    method: 'POST', body: jsonBody(values), authenticated: false,
  }), []);

  const logout = useCallback(async () => {
    const tokens = await tokenStorage.get();
    try {
      if (tokens?.refresh) await api('/auth/logout/', { method: 'POST', body: jsonBody({ refresh: tokens.refresh }) });
    } finally {
      await clearAuth();
    }
  }, [clearAuth]);

  const value = useMemo(() => ({ user, loading, login, register, logout, reloadUser, clearAuth }), [user, loading, login, register, logout, reloadUser, clearAuth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
