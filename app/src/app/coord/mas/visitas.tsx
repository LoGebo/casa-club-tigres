import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { AskBox, dt, useOnChanged } from '@/features/coord-mas/util';

type Visita = { id: number; visitante: string; relacion?: string; jugadora: string; estado: string; fecha_at: number };
const ETQ: Record<string, [string, 'warn' | 'ok' | 'bad' | 'gold' | 'neutral']> = {
  pendiente: ['Pendiente', 'warn'], autorizada: ['Autorizada', 'ok'], rechazada: ['Rechazada', 'bad'], dentro: ['Dentro', 'gold'], salio: ['Salió', 'neutral'],
};

export default function Visitas() {
  const t = useTheme();
  const [vs, setVs] = useState<Visita[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rechazando, setRechazando] = useState<number | null>(null);
  const load = useCallback(async () => { const r = await run(() => api<Visita[]>('/visitas')); if (r) setVs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useOnChanged(load);

  const decide = async (id: number, a: 'autorizar' | 'rechazar', nota = '') => {
    const r = await run(() => api(`/visitas/${id}/${a}`, 'POST', { nota }));
    if (r) { notify(a === 'autorizar' ? 'Visita autorizada' : 'Visita rechazada'); setRechazando(null); await load(); }
  };

  const seccion = (header: string, estados: string[], vacio: string) => {
    const l = (vs ?? []).filter((v) => estados.includes(v.estado));
    return (
      <View key={header} style={{ gap: Space.s }}>
        {l.length ? (
          <Group header={header}>
            {l.map((v) => (
              <View key={v.id}>
                <Row minHeight={64} title={v.visitante} subtitle={`Visita a ${v.jugadora}${v.relacion ? ' · ' + v.relacion : ''} · ${dt(v.fecha_at)}`} trailing={<Badge text={ETQ[v.estado]?.[0] ?? v.estado} tone={ETQ[v.estado]?.[1]} />} />
                {v.estado === 'pendiente' ? (
                  <View style={{ paddingHorizontal: Space.l, paddingBottom: Space.m, gap: Space.s }}>
                    {rechazando === v.id ? (
                      <AskBox label="Motivo (opcional)" ok="Rechazar" danger onCancel={() => setRechazando(null)} onOk={(n) => decide(v.id, 'rechazar', n)} />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: Space.s }}>
                        <View style={{ flex: 1 }}><Button small kind="tinted" title="Autorizar" onPress={() => decide(v.id, 'autorizar')} /></View>
                        <View style={{ flex: 1 }}><Button small kind="danger" title="Rechazar" onPress={() => setRechazando(v.id)} /></View>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            ))}
          </Group>
        ) : (
          <><T v="caption" dim style={{ marginLeft: Space.l, textTransform: 'uppercase' }}>{header}</T><T v="sub" dim style={{ marginLeft: Space.l }}>{vacio}</T></>
        )}
      </View>
    );
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Visitas' }} />
      {!vs ? <Loading /> : (
        <>
          <Button title="Registrar visita autorizada" onPress={() => router.push('/visita-coord-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
          {seccion('Por autorizar', ['pendiente'], 'Sin solicitudes')}
          {seccion('Autorizadas y en curso', ['autorizada', 'dentro'], 'Ninguna')}
          {seccion('Historial reciente', ['salio', 'rechazada'], 'Ninguna')}
          {!vs.length ? <Empty sf="person.badge.key" ion="key-outline" title="Sin visitas" /> : null}
        </>
      )}
    </Screen>
  );
}
