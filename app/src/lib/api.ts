// Cliente del backend (Node + Express). En web usa el mismo origen; en teléfono usa EXPO_PUBLIC_API_URL.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const BASE: string = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'http://localhost:3000');

export type Session = { token: string; rol: 'jugadora' | 'seguridad' | 'coordinacion'; nombre: string };

const KEY = 'cc-session';
export const store = {
  async get(): Promise<Session | null> {
    try {
      const raw = Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  async set(s: Session | null) {
    try {
      if (Platform.OS === 'web') s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
      else s ? await SecureStore.setItemAsync(KEY, JSON.stringify(s)) : await SecureStore.deleteItemAsync(KEY);
    } catch {}
  },
};

let token: string | null = null;
let onExpire: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const setOnExpire = (f: () => void) => { onExpire = f; };

export class ApiError extends Error {}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Sin conexión con el servidor');
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { onExpire(); throw new ApiError('Tu sesión expiró. Entra de nuevo.'); }
  if (!r.ok) throw new ApiError(j.error || 'Algo salió mal');
  return j as T;
}

/** SVG del QR (el backend lo genera) */
export const qrUrl = (d: string) => `${BASE}/api/qr?d=${encodeURIComponent(d)}`;
