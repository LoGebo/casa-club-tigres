import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, limpiarCache, setOnExpire, setToken, store, type Session } from '@/lib/api';

type Ctx = { session: Session | null; ready: boolean; login: (usuario: string, pin: string) => Promise<void>; registrar: (datos: Record<string, string>) => Promise<string>; pinCambiado: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => { await limpiarCache(); setToken(null); setSession(null); await store.set(null); }, []);
  const pinCambiado = useCallback(async () => { setSession((s) => { if (!s) return s; const n = { ...s, cambiar_pin: false }; void store.set(n); return n; }); }, []);

  useEffect(() => {
    setOnExpire(() => { void logout(); });
    store.get().then((s) => { if (s) { setToken(s.token); setSession(s); } setReady(true); });
  }, [logout]);

  const login = useCallback(async (usuario: string, pin: string) => {
    const s = await api<Session>('/login', 'POST', { usuario, pin });
    setToken(s.token); setSession(s); await store.set(s);
  }, []);

  const registrar = useCallback(async (datos: Record<string, string>) => {
    const { clave, ...s } = await api<Session & { clave: string }>('/registro', 'POST', datos);
    setToken(s.token); setSession(s); await store.set(s);
    return clave;
  }, []);

  const value = useMemo(() => ({ session, ready, login, registrar, pinCambiado, logout }), [session, ready, login, registrar, pinCambiado, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
