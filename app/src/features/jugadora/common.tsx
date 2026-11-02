// Utilidades compartidas de las pantallas de la jugadora.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { run } from '@/components/notify';
import { Badge } from '@/components/ui';
import { api } from '@/lib/api';

const ESTADO: Record<string, [string, 'warn' | 'ok' | 'bad' | 'gold' | 'neutral']> = {
  pendiente: ['Pendiente', 'warn'], esperando_padres: ['Esperando tutor', 'warn'], autorizado: ['Autorizado', 'ok'], rechazado: ['Rechazado', 'bad'],
  salio: ['Afuera', 'gold'], regreso: ['Regresó', 'neutral'], vencido: ['Vencido', 'bad'],
  autorizada: ['Autorizada', 'ok'], rechazada: ['Rechazada', 'bad'], dentro: ['Dentro', 'gold'],
  cancelado: ['Cancelado', 'neutral'], abierto: ['Abierto', 'warn'], en_proceso: ['En proceso', 'gold'], resuelto: ['Resuelto', 'ok'],
};
export const EstadoBadge = ({ e, visita }: { e: string; visita?: boolean }) => {
  const [text, tone] = ESTADO[visita && e === 'salio' ? 'salio_v' : e] ?? (e === 'salio_v' || (visita && e === 'salio') ? ['Salió', 'neutral'] : [e, 'neutral']);
  return <Badge text={text} tone={tone} />;
};

export const hm = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
export const dt = (ms: number) => new Date(ms).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '') + ', ' + hm(ms);

/** Carga una lista al enfocar la pantalla; `data` es null mientras carga la primera vez. */
export function useList<T>(path: string) {
  const [data, setData] = useState<T[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<T[]>(path)); if (r) setData(r); }, [path]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  return { data, refreshing, refresh };
}

export const CATEGORIAS = [['mantenimiento', 'Mantenimiento'], ['lavanderia', 'Lavandería'], ['medico', 'Médico'], ['alimentos', 'Alimentos'], ['otro', 'Otro']] as const;

/** Hora actual que se refresca sola (para cuentas regresivas). */
export function useAhora(cada = 30_000) {
  const [n, setN] = useState(Date.now);
  useEffect(() => { const i = setInterval(() => setN(Date.now()), cada); return () => clearInterval(i); }, [cada]);
  return n;
}

/** "42 min" o "1 h 05 min" */
export const duracion = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60e3));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')} min` : ''}`;
};

export const TIPOS_COMIDA = [['desayuno', 'Desayuno'], ['comida', 'Comida'], ['cena', 'Cena'], ['colacion', 'Colación']] as const;
export type TipoComida = (typeof TIPOS_COMIDA)[number][0];
