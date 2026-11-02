import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setOnExpire, setToken, store, type Session } from '@/lib/api';

type Ctx = { session: Session | null; ready: boolean; login: (usuario: string, pin: string) => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => { setToken(null); setSession(null); await store.set(null); }, []);

  useEffect(() => {
    setOnExpire(() => { void logout(); });
    store.get().then((s) => { if (s) { setToken(s.token); setSession(s); } setReady(true); });
  }, [logout]);

  const login = useCallback(async (usuario: string, pin: string) => {
    const s = await api<Session>('/login', 'POST', { usuario, pin });
    setToken(s.token); setSession(s); await store.set(s);
  }, []);

  const value = useMemo(() => ({ session, ready, login, logout }), [session, ready, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
