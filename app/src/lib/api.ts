// Cliente del backend (Node + Express). En web usa el mismo origen; en teléfono usa EXPO_PUBLIC_API_URL.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const BASE: string = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'http://localhost:3000');

export type Session = { token: string; rol: 'jugadora' | 'seguridad' | 'coordinacion'; nombre: string; cambiar_pin?: boolean };

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
      if (Platform.OS === 'web') { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); }
      else if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s)); else await SecureStore.deleteItemAsync(KEY);
    } catch {}
  },
};

let token: string | null = null;
let onExpire: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const setOnExpire = (f: () => void) => { onExpire = f; };

// ---- estado de conexión (para el aviso «Sin conexión») y caché de lecturas ----
let online = true;
const subs = new Set<() => void>();
export const getOnline = () => online;
export const subscribeOnline = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const setOnline = (v: boolean) => { if (v !== online) { online = v; subs.forEach((f) => f()); } };
const CK = 'cc-cache:';
const NO_CACHE = /^\/(fotos|qr|offline)/;
const ckey = (path: string) => CK + (token ?? '').slice(-16) + ':' + path;
export async function limpiarCache() { try { const ks = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CK) || k.startsWith('cc-offline') || k.startsWith('cc-cola') || k.startsWith('cc-abordaje')); if (ks.length) await AsyncStorage.multiRemove(ks); } catch {} }

export class ApiError extends Error {}

/** Las lecturas (GET) se guardan; si no hay internet se devuelve la última copia guardada. Las escrituras fallan con aviso. */
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    setOnline(false);
    if (method === 'GET' && !NO_CACHE.test(path)) {
      try { const c = await AsyncStorage.getItem(ckey(path)); if (c) return JSON.parse(c) as T; } catch {}
    }
    throw new ApiError('Sin conexión con el servidor');
  }
  setOnline(true);
  const raw = await r.text();
  let j: any = {};
  try { j = raw ? JSON.parse(raw) : {}; } catch {}
  if (r.status === 401 && token) { onExpire(); throw new ApiError('Tu sesión expiró. Entra de nuevo.'); }
  if (!r.ok) throw new ApiError(j.error || 'Algo salió mal');
  if (method === 'GET' && token && !NO_CACHE.test(path) && raw.length < 400_000) void AsyncStorage.setItem(ckey(path), raw).catch(() => {});
  return j as T;
}

/** SVG del QR (el backend lo genera) */
export const qrUrl = (d: string) => `${BASE}/api/qr?d=${encodeURIComponent(d)}`;
/** Las fotos llegan con un enlace firmado (/api/fotos/ID?k=…): basta anteponer el servidor. */
export const fotoSrc = (url?: string | null) => (url ? `${BASE}${url}` : undefined);
