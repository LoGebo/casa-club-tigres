// Utilidades de Coordinación › Más: formato, aviso de cambios entre pantallas y piezas pequeñas compartidas.
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Button, Icon, T, tap } from '@/components/ui';
import { TextField } from '@/components/form';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
