// Piezas compartidas de coordinación: fechas, confirmación, aviso con texto, selector de jugadora.
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Avatar, Button, Group, Icon, Row, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Jugadora = {
  id: number; clave: string; nombre: string; nacimiento: string; menor: boolean; habitacion?: string; tutor_nombre?: string; tutor_tel?: string;
  emergencia_nombre?: string; emergencia_tel?: string; alergias?: string; notas_medicas?: string; activa: boolean; qr: string; categoria?: string | null; nivel?: string | null; telefono?: string | null;
  disponibilidad?: string | null; disp_nota?: string | null; sangre?: string | null; seguro?: string | null;
};

/** Aviso entre pantallas: la hoja de «persona autorizada» avisa a la ficha para recargar. */
export const recogenBus = new Set<() => void>();

export type Disp = 'disponible' | 'recuperacion' | 'descanso';
export const DISP: Record<Disp, string> = { disponible: 'Disponible', recuperacion: 'En recuperación', descanso: 'Descanso' };
/** null/'' = disponible */
export const dispDe = (j: { disponibilidad?: string | null }): Disp => (j.disponibilidad === 'recuperacion' || j.disponibilidad === 'descanso' ? j.disponibilidad : 'disponible');
export const noDisp = (j: { disponibilidad?: string | null }) => dispDe(j) !== 'disponible';

/** Chips horizontales de selección (categorías, sugerencias). */
export function Chips({ opts, value, onChange }: { opts: readonly (readonly [string, string])[]; value: string; onChange: (k: string) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s }} keyboardShouldPersistTaps="handled">
      {opts.map(([k, l]) => (
        <Pressable key={k} onPress={() => { tap(); onChange(k); }} accessibilityRole="button" accessibilityLabel={l} accessibilityState={{ selected: value === k }}
          style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: value === k ? t.tint : t.fill }}>
          <T v="sub" color={value === k ? (t.bg === '#000000' ? '#071647' : '#fff') : t.label} style={{ fontWeight: '600' }}>{l}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const dt = (ms: number) => new Date(ms).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export const hm = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
export const mins = (ms: number) => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
export const telUrl = (s: string) => `tel:${s.replace(/[^\d+]/g, '')}`;

/** Confirmación de acción destructiva (Alert no funciona en web) */
export function confirmar(title: string, msg: string, ok: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n${msg}`));
  return new Promise((res) => Alert.alert(title, msg, [{ text: 'Cancelar', style: 'cancel', onPress: () => res(false) }, { text: ok, style: 'destructive', onPress: () => res(true) }], { cancelable: true, onDismiss: () => res(false) }));
}

/** Diálogo con un campo de texto (Alert.prompt solo existe en iOS) */
export function PromptDialog({ visible, title, label, placeholder, required = true, ok = 'Aceptar', onSubmit, onCancel }: {
  visible: boolean; title: string; label: string; placeholder?: string; required?: boolean; ok?: string; onSubmit: (s: string) => void | Promise<void>; onCancel: () => void;
}) {
  const t = useTheme();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onShow={() => setV('')}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Space.xl }}>
        <View style={{ backgroundColor: t.surface, borderRadius: Radius.l, padding: Space.l, gap: Space.m, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <T v="headline">{title}</T>
          <T v="sub" dim>{label}</T>
          <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={t.label3} autoFocus multiline accessibilityLabel={label}
            style={{ color: t.label, fontSize: 17, backgroundColor: t.fill, borderRadius: Radius.s, padding: Space.m, minHeight: 72, textAlignVertical: 'top' }} />
          <Button title={ok} loading={busy} disabled={required && !v.trim()} onPress={async () => { setBusy(true); try { await onSubmit(v.trim()); } finally { setBusy(false); } }} />
          <Button title="Cancelar" kind="plain" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

/** Selector de jugadora con búsqueda. Muestra la elegida o las coincidencias. */
export function JugadoraPicker({ jugadoras, value, onChange }: { jugadoras: Jugadora[]; value: number | null; onChange: (id: number) => void }) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const sel = jugadoras.find((j) => j.id === value);
  const hits = jugadoras.filter((j) => j.activa && (!q.trim() || j.nombre.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 6);
  return (
    <View style={{ gap: Space.s }}>
      {sel && !q ? (
        <Group header="Jugadora">
          <Row title={sel.nombre} subtitle={sel.habitacion ? `Hab. ${sel.habitacion}` : undefined} leading={<Avatar name={sel.nombre} size={36} />} trailing={<Icon sf="checkmark" ion="checkmark" size={20} />} />
        </Group>
      ) : null}
      <TextInput value={q} onChangeText={setQ} placeholder={sel ? 'Cambiar jugadora…' : 'Buscar jugadora por nombre'} placeholderTextColor={t.label3} accessibilityLabel="Buscar jugadora"
        style={{ color: t.label, fontSize: 17, backgroundColor: t.surface, borderRadius: Radius.m, paddingHorizontal: Space.l, minHeight: 48 }} />
      {q || !sel ? (
        <Group>
          {hits.length ? hits.map((j) => (
            <Row key={j.id} title={j.nombre} subtitle={j.habitacion ? `Hab. ${j.habitacion}` : undefined} leading={<Avatar name={j.nombre} size={36} />} minHeight={52} onPress={() => { onChange(j.id); setQ(''); }} />
          )) : <Row title="Sin resultados" />}
        </Group>
      ) : null}
    </View>
  );
}

