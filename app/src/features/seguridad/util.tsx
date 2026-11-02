// Tipos y utilidades compartidas de las pantallas de Seguridad.
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Badge, Icon, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { textoEdad } from '@/features/seguridad/offline';

export type Permiso = { id: number; destino: string; acompanante: string; ubicacion?: string; salida_at: number; regreso_at: number; metodo_auth?: string };
export type Situacion = {
  id: number; nombre: string; habitacion?: string; estado: 'autorizada' | 'fuera' | 'sin_permiso'; accion: 'salida' | 'regreso' | null;
  permiso?: Permiso; proximo?: Permiso | null; emergencia?: { nombre?: string; tel?: string; alergias?: string };
};
export type Guardia = { id: number; nombre: string; habitacion?: string; estado: 'salio' | 'autorizado' | null; destino?: string; acompanante?: string; salida_at?: number; regreso_at?: number };
export type Movimiento = { at: number; tipo: 'salida' | 'regreso' | 'entrada'; nombre: string; detalle?: string; con_quien?: string; staff?: string; quien: 'jugadora' | 'visita' };
export type Cfg = { tel_coordinacion?: string; gracia_min?: number | string };

export const hm = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
export const dt = (ms: number) => new Date(ms).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export const mins = (ms: number) => { const m = Math.max(1, Math.round(ms / 6e4)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
export const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Clase = 'tarde' | 'fuera' | 'habilitada' | 'proximo' | 'dentro';
export const clasif = (x: Guardia, graciaMin = 30): Clase => {
  const now = Date.now();
  if (x.estado === 'salio') return (x.regreso_at ?? 0) < now ? 'tarde' : 'fuera';
  if (x.estado === 'autorizado') return (x.salida_at ?? 0) - graciaMin * 6e4 <= now ? 'habilitada' : 'proximo';
  return 'dentro';
};
export const PRI: Record<Clase, number> = { tarde: 0, fuera: 1, habilitada: 2, proximo: 3, dentro: 4 };
export const BADGE: Record<Clase, ['neutral' | 'ok' | 'warn' | 'bad' | 'gold', string]> = {
  tarde: ['bad', 'Atrasada'], fuera: ['gold', 'Afuera'], habilitada: ['ok', 'Puede salir'], proximo: ['warn', 'Permiso próximo'], dentro: ['neutral', 'Dentro'],
};
export const linea = (x: Guardia, c: Clase) =>
  c === 'tarde' || c === 'fuera' ? `${x.destino} · con ${x.acompanante} · regresa ${hm(x.regreso_at!)}`
    : c === 'habilitada' || c === 'proximo' ? `${x.destino} · con ${x.acompanante} · ${dt(x.salida_at!)} → ${hm(x.regreso_at!)}`
      : 'Dentro de Casa Club · sin permiso';

/** Configuración del club (tel. de Coordinación, gracia) */
export function useCfg(): Cfg {
  const [c, setC] = useState<Cfg>({});
  useEffect(() => { api<Cfg>('/config').then(setC).catch(() => {}); }, []);
  return c;
}

export function MovRow({ m }: { m: Movimiento }) {
  const v = m.quien === 'visita';
  const lbl = v ? (m.tipo === 'entrada' ? 'Entrada de visita' : 'Salida de visita') : m.tipo === 'salida' ? 'Salida' : 'Regreso';
  const sub = [m.detalle, m.con_quien ? `${v ? 'doc. ' : 'con '}${m.con_quien}` : '', m.staff ? `registró ${m.staff}` : ''].filter(Boolean).join(' · ');
  return (
    <Row
      title={m.nombre}
      subtitle={sub ? <T v="caption" dim numberOfLines={2}>{sub}</T> : undefined}
      trailing={<Badge text={`${lbl} · ${hm(m.at)}`} tone={m.tipo === 'salida' ? 'gold' : 'ok'} />}
    />
  );
}


/** Campo de búsqueda estilo iOS */
export function SearchBox({ value, onChangeText, placeholder = 'Buscar jugadora' }: { value: string; onChangeText: (s: string) => void; placeholder?: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.fill, borderRadius: 10, paddingHorizontal: Space.m, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon sf="magnifyingglass" ion="search" size={16} color={t.label3} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.label3} autoCorrect={false} clearButtonMode="while-editing"
        accessibilityLabel={placeholder} style={{ flex: 1, color: t.label, fontSize: 17, paddingVertical: 8 }} />
    </View>
  );
}

/** «Sin conexión · datos de hace N min» */
export function ChipOffline({ edad }: { edad: number }) {
  const t = useTheme();
  return (
    <View accessibilityRole="text" style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.warnWeak, borderRadius: 999, paddingHorizontal: 12, minHeight: 30 }}>
      <Icon sf="wifi.slash" ion="cloud-offline-outline" size={14} color={t.warn} />
      <T v="caption" color={t.warn} style={{ fontWeight: '600' }}>{`Sin conexión · datos de hace ${textoEdad(edad)}`}</T>
    </View>
  );
}
