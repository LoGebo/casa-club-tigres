import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { AskBox, useOnChanged } from '@/features/coord-mas/util';

type Staff = { id: number; usuario: string; nombre: string; rol: string; activo: boolean };
const CAMPOS = ['nombre_club', 'toque_queda', 'gracia_min', 'tolerancia_min', 'max_pendientes', 'tel_coordinacion'] as const;
type Cfg = Record<(typeof CAMPOS)[number], string>;

export default function Equipo() {
  const t = useTheme();
  const [sf, setSf] = useState<Staff[] | null>(null);
  const [c, setC] = useState<Cfg | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Staff[]>('/staff'), api<Record<string, unknown>>('/config')]));
    if (r) { setSf(r[0]); setC(Object.fromEntries(CAMPOS.map((k) => [k, String(r[1][k] ?? '')])) as Cfg); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useOnChanged(load);

  if (!sf || !c) return <Screen><Stack.Screen options={{ title: 'Equipo y reglas' }} /><Loading /></Screen>;
  const set = (k: keyof Cfg) => (v: string) => setC({ ...c, [k]: v });
  const guardar = async () => {
    setSaving(true);
    if (await run(() => api('/config', 'PUT', c))) notify('Reglas guardadas');
    setSaving(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Equipo y reglas' }} />
      <Group header="Personal">
        {sf.map((x) => (
          <View key={x.id}>
            <Row minHeight={60} title={x.nombre} subtitle={`Usuario: ${x.usuario}`} trailing={<Badge text={`${x.rol === 'coordinacion' ? 'Coordinación' : 'Seguridad'}${x.activo ? '' : ' · inactivo'}`} tone={x.activo ? 'neutral' : 'bad'} />} />
            <View style={{ paddingHorizontal: Space.l, paddingBottom: Space.m, gap: Space.s }}>
              {pin === x.id ? (
                <AskBox label="Nuevo PIN (4 a 8 dígitos)" ok="Cambiar PIN" secure numeric required onCancel={() => setPin(null)}
                  onOk={async (p) => { if (await run(() => api(`/staff/${x.id}`, 'PATCH', { pin: p }))) { notify('PIN actualizado'); setPin(null); } }} />
              ) : (
                <View style={{ flexDirection: 'row', gap: Space.s }}>
                  <View style={{ flex: 1 }}><Button small kind="tinted" title="Nuevo PIN" onPress={() => setPin(x.id)} /></View>
                  <View style={{ flex: 1 }}><Button small kind={x.activo ? 'danger' : 'tinted'} title={x.activo ? 'Desactivar' : 'Activar'} onPress={async () => { if (await run(() => api(`/staff/${x.id}`, 'PATCH', { activo: !x.activo }))) await load(); }} /></View>
                </View>
              )}
            </View>
          </View>
        ))}
        <Row title="Agregar personal" leading={<Icon sf="plus.circle.fill" ion="add-circle" />} onPress={() => router.push('/staff-nuevo')} chevron />
      </Group>

      <Group header="Reglas del club" footer="Tolerancia: minutos de margen al regresar. Anticipación: cuántos minutos antes de su hora puede salir.">
        <TextField label="Nombre del club" value={c.nombre_club} onChangeText={set('nombre_club')} />
        <TextField label="Toque de queda (HH:MM)" value={c.toque_queda} onChangeText={set('toque_queda')} placeholder="22:00" keyboardType="numbers-and-punctuation" />
        <TextField label="Puede salir X min antes" value={c.gracia_min} onChangeText={set('gracia_min')} keyboardType="number-pad" />
        <TextField label="Tolerancia de regreso (min)" value={c.tolerancia_min} onChangeText={set('tolerancia_min')} keyboardType="number-pad" />
        <TextField label="Máx. solicitudes en espera" value={c.max_pendientes} onChangeText={set('max_pendientes')} keyboardType="number-pad" />
        <TextField label="Teléfono de Coordinación (para Seguridad)" value={c.tel_coordinacion} onChangeText={set('tel_coordinacion')} keyboardType="phone-pad" />
      </Group>
      <Button title="Guardar reglas" loading={saving} onPress={guardar} />
      <T v="caption" dim style={{ textAlign: 'center', color: t.label2 }}>Los cambios aplican de inmediato a todo el club.</T>
    </Screen>
  );
}
