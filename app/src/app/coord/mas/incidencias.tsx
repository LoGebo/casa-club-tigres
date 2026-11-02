import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { AskBox, dt, useOnChanged } from '@/features/coord-mas/util';

type Inc = { id: number; tipo: string; severidad: 'baja' | 'media' | 'urgente'; jugadora?: string; descripcion: string; estado: string; creado_at: number; resolucion?: string };
const SEV = { urgente: 'bad', media: 'warn', baja: 'neutral' } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');

export default function Incidencias() {
  const t = useTheme();
  const [is, setIs] = useState<Inc[] | null>(null);
  const [sub, setSub] = useState<'abierta' | 'atendida'>('abierta');
  const [atendiendo, setAtendiendo] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<Inc[]>('/incidencias')); if (r) setIs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useOnChanged(load);

  const lista = (is ?? []).filter((i) => i.estado === sub);
  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Incidencias' }} />
      <Button title="Registrar incidencia" onPress={() => router.push('/incidencia-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      <Segmented options={[['abierta', `Abiertas${is ? ` (${is.filter((i) => i.estado === 'abierta').length})` : ''}`], ['atendida', 'Atendidas']] as const} value={sub} onChange={setSub} />
      {!is ? <Loading /> : lista.length === 0 ? (
        <Empty sf="checkmark.seal" ion="checkmark-circle-outline" title={sub === 'abierta' ? 'Sin incidencias abiertas' : 'Sin incidencias atendidas'} text="Se muestran las últimas dos semanas." />
      ) : (
        <Group>
          {lista.map((i) => (
            <View key={i.id}>
              <Row minHeight={72} title={`${cap(i.tipo)}${i.jugadora ? ' · ' + i.jugadora : ''}`}
                subtitle={<View style={{ gap: 2 }}><T v="sub">{i.descripcion}</T><T v="caption" dim>{dt(i.creado_at)}{i.resolucion ? ` · Resolución: ${i.resolucion}` : ''}</T></View>}
                trailing={<Badge text={cap(i.severidad)} tone={SEV[i.severidad]} />} />
              {i.estado === 'abierta' ? (
                <View style={{ paddingHorizontal: Space.l, paddingBottom: Space.m }}>
                  {atendiendo === i.id ? (
                    <AskBox label="Resolución / acciones tomadas (opcional)" ok="Marcar atendida" onCancel={() => setAtendiendo(null)}
                      onOk={async (r) => { if (await run(() => api(`/incidencias/${i.id}/atender`, 'POST', { resolucion: r }))) { notify('Incidencia atendida'); setAtendiendo(null); await load(); } }} />
                  ) : <Button small kind="tinted" title="Atender" onPress={() => setAtendiendo(i.id)} />}
                </View>
              ) : null}
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}
