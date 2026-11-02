// Cola de acciones sin conexión (p. ej. Seguridad registra salidas/regresos sin señal). Cada acción lleva un id único (cid)
// y la hora real (at), así el servidor no la duplica y la guarda con la hora en que ocurrió.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { api, ApiError, getOnline, subscribeOnline } from '@/lib/api';

type Item = { cid: string; path: string; method: string; body: Record<string, unknown>; at: number; etiqueta?: string };
export type Descartado = { etiqueta: string; error: string };
const K = 'cc-cola';
const KD = 'cc-cola-descartes';
const subs = new Set<() => void>();
const avisar = () => subs.forEach((f) => f());
let volando = false;

const leer = async (k = K): Promise<any[]> => { try { return JSON.parse((await AsyncStorage.getItem(k)) ?? '[]'); } catch { return []; } };

/** Intenta enviar ya; si no hay red, la deja en la cola. Devuelve 'enviado' o 'en_cola'. Si el servidor la rechaza lanza el error. */
export async function enviarOCola(path: string, body: Record<string, unknown>, etiqueta = '', method = 'POST'): Promise<'enviado' | 'en_cola'> {
  const item: Item = { cid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), path, method, body: { ...body }, at: Date.now(), etiqueta };
  item.body.cid = item.cid; item.body.at = item.at;
  if (getOnline()) {
    try { await api(path, method, item.body); return 'enviado'; } catch (e) { if (!(e instanceof ApiError) || e.message !== 'Sin conexión con el servidor') throw e; }
  }
  await AsyncStorage.setItem(K, JSON.stringify([...(await leer()), item])); avisar();
  return 'en_cola';
}

export const pendientes = async () => (await leer()).length;
export const descartados = async (): Promise<Descartado[]> => leer(KD);
export const limpiarDescartados = async () => { await AsyncStorage.removeItem(KD); avisar(); };

/** Envía en orden lo pendiente. Si pierde la red se detiene; si el servidor rechaza una acción la pasa a «descartados» para revisarla. */
export async function vaciarCola(): Promise<void> {
  if (volando) return; volando = true;
  try {
    let q = await leer();
    while (q.length) {
      const it = q[0] as Item;
      try { await api(it.path, it.method, it.body); }
      catch (e) {
        if (!(e instanceof ApiError) || e.message === 'Sin conexión con el servidor') break;
        await AsyncStorage.setItem(KD, JSON.stringify([...(await leer(KD)), { etiqueta: it.etiqueta || it.path, error: e.message }]));
      }
      q = q.slice(1); await AsyncStorage.setItem(K, JSON.stringify(q)); avisar();
    }
  } finally { volando = false; avisar(); }
}

export function useCola() {
  const [n, setN] = useState(0); const [d, setD] = useState(0); const [online, setOnline] = useState(getOnline());
  useEffect(() => {
    const f = () => { void pendientes().then(setN); void descartados().then((x) => setD(x.length)); setOnline(getOnline()); };
    subs.add(f); const off = subscribeOnline(f); f();
    const t = setInterval(() => { if (getOnline() || true) void vaciarCola(); }, 15_000);
    return () => { subs.delete(f); off(); clearInterval(t); };
  }, []);
  return { pendientes: n, descartados: d, online, vaciar: vaciarCola };
}
