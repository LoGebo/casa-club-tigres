// Utilidades de Coordinación › Más: formato, aviso de cambios entre pantallas y piezas pequeñas compartidas.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { notify } from '@/components/notify';
import { Button, Icon, T, tap } from '@/components/ui';
import { TextField } from '@/components/form';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

export const dt = (ms: number) => new Date(ms).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const hm = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
export const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const hoyStr = () => dayKey(Date.now());
export const addDays = (key: string, n: number) => { const d = new Date(key + 'T12:00'); d.setDate(d.getDate() + n); return dayKey(d.getTime()); };
export const largaDia = (key: string) => new Date(key + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

// Los modales avisan aquí cuando guardan algo; las listas se recargan.
const subs = new Set<() => void>();
export const changed = () => subs.forEach((f) => f());
export function useOnChanged(fn: () => void) { useEffect(() => { subs.add(fn); return () => { subs.delete(fn); }; }, [fn]); }

export function confirmar(title: string, msg: string, ok: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n${msg}`));
  return new Promise((res) => Alert.alert(title, msg, [{ text: 'Cancelar', style: 'cancel', onPress: () => res(false) }, { text: ok, style: 'destructive', onPress: () => res(true) }], { cancelable: true, onDismiss: () => res(false) }));
}

/** Selector de día con flechas (sin dependencias, igual en iOS, Android y web) */
export function DayStepper({ label, value, onChange }: { label?: string; value: string; onChange: (k: string) => void }) {
  const t = useTheme();
  const btn = { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ backgroundColor: t.surface, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.s }}>
      <Pressable style={btn} onPress={() => { tap(); onChange(addDays(value, -1)); }} accessibilityLabel="Día anterior"><Icon sf="chevron.left" ion="chevron-back" size={18} /></Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {label ? <T v="caption" dim>{label}</T> : null}
        <T v="headline" style={{ textTransform: 'capitalize' }}>{largaDia(value)}</T>
      </View>
      <Pressable style={btn} onPress={() => { tap(); onChange(addDays(value, 1)); }} accessibilityLabel="Día siguiente"><Icon sf="chevron.right" ion="chevron-forward" size={18} /></Pressable>
    </View>
  );
}

/** Caja de texto en línea para pedir una nota antes de confirmar (resolución, respuesta, PIN, motivo) */
export function AskBox({ label, ok, danger, secure, numeric, required, onCancel, onOk }: {
  label: string; ok: string; danger?: boolean; secure?: boolean; numeric?: boolean; required?: boolean; onCancel: () => void; onOk: (v: string) => void | Promise<void>;
}) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: Space.s }}>
      <View style={{ borderRadius: 10, overflow: 'hidden' }}>
        <TextField label={label} value={v} onChangeText={setV} secure={secure} keyboardType={numeric ? 'number-pad' : undefined} multiline={!secure} />
      </View>
      <View style={{ flexDirection: 'row', gap: Space.s }}>
        <View style={{ flex: 1 }}><Button small kind="tinted" title="Cancelar" onPress={onCancel} /></View>
        <View style={{ flex: 1 }}><Button small kind={danger ? 'danger' : 'filled'} title={ok} loading={busy} disabled={required && !v.trim()} onPress={async () => { setBusy(true); try { await onOk(v.trim()); } finally { setBusy(false); } }} /></View>
      </View>
    </View>
  );
}

export type Jug = { id: number; nombre: string; activa: boolean; habitacion?: string };

/** Carga un GET al enfocar la pantalla (y cuando un modal avisa de cambios). Conserva lo anterior mientras recarga. */
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api<T>(path)); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cargar'); }
  }, [path]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useOnChanged(load);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  return { data, err, load, refresh, refreshing };
}

/** Error con reintento (cuando no hay datos que mostrar) */
export function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: Space.m, padding: Space.xl }}>
      <T v="headline">No se pudo cargar</T>
      <T v="sub" dim style={{ textAlign: 'center' }}>{text}</T>
      <Button small kind="tinted" title="Reintentar" onPress={onRetry} />
    </View>
  );
}

/** Fichas horizontales para filtrar (Todas / categorías) */
export function Chips<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s, paddingRight: Space.l }} accessibilityRole="tablist">
      {options.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(k); }}
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.pill, justifyContent: 'center', backgroundColor: on ? t.tint : t.fill }}>
            <Text style={{ color: on ? (t.bg === '#000000' ? '#071647' : '#FFFFFF') : t.label, fontSize: 15, fontWeight: '600' }}>{l}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Barra de progreso simple (pct 0 a 1) */
export function Bar({ pct, color, height = 8 }: { pct: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.fill, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? t.tint }} />
    </View>
  );
}

const DIAS = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' } as Record<string, string>;
export const DIAS_SEM = [['lun', 'L'], ['mar', 'M'], ['mie', 'X'], ['jue', 'J'], ['vie', 'V'], ['sab', 'S'], ['dom', 'D']] as const;
/** Etiqueta de repetición de una actividad */
export const repLabel = (r?: string | null) => (!r ? '' : r === 'diario' ? 'Diario' : r === 'lv' ? 'Lun–Vie' : r.split(',').map((x) => DIAS[x] ?? x).join(', '));

/** Compartir texto (hoja del sistema; en web, compartir del navegador o copiar al portapapeles) */
export async function compartir(text: string, title: string) {
  try {
    if (Platform.OS === 'web') {
      const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
      if (nav.share) await nav.share({ title, text });
      else { await navigator.clipboard.writeText(text); notify('Resumen copiado'); }
    } else await Share.share({ title, message: text });
  } catch { /* el usuario cerró la hoja */ }
}

/** Lunes de la semana de un día 'AAAA-MM-DD' */
export const lunesDe = (key: string) => addDays(key, -((new Date(key + 'T12:00').getDay() + 6) % 7));
export const TIPOS_COMIDA = [['desayuno', 'Desayuno'], ['comida', 'Comida'], ['cena', 'Cena'], ['colacion', 'Colación']] as const;
export const NOMBRE_COMIDA: Record<string, string> = Object.fromEntries(TIPOS_COMIDA);
