import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Loading, Row, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { api } from '@/lib/api';
import { AskBox, dt } from '@/features/coord-mas/util';

type Ticket = { id: number; categoria: string; jugadora: string; habitacion?: string; descripcion: string; estado: 'abierto' | 'en_proceso' | 'resuelto'; respuesta?: string; creado_at: number };
const CAT: Record<string, string> = { mantenimiento: 'Mantenimiento', lavanderia: 'Lavandería', medico: 'Médico', alimentos: 'Alimentos', otro: 'Otro' };
const EST = { abierto: ['Abierto', 'warn'], en_proceso: ['En proceso', 'gold'], resuelto: ['Resuelto', 'ok'] } as const;

export default function Servicios() {
  const [ts, setTs] = useState<Ticket[] | null>(null);
  const [resp, setResp] = useState<{ id: number; estado: Ticket['estado'] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<Ticket[]>('/tickets')); if (r) setTs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const cambia = async (id: number, estado: Ticket['estado'], respuesta: string) => {
    if (await run(() => api(`/tickets/${id}`, 'PATCH', { estado, respuesta }))) { notify(estado === 'resuelto' ? 'Marcada como resuelta' : 'Solicitud en proceso'); setResp(null); await load(); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Servicios' }} />
      {!ts ? <Loading /> : ts.length === 0 ? <Empty sf="wrench.and.screwdriver" ion="construct-outline" title="Sin solicitudes" text="Aquí llegan las peticiones de las jugadoras." /> : (
        <Group footer="Se muestran las abiertas y las resueltas en los últimos 7 días.">
          {ts.map((x) => (
            <View key={x.id}>
              <Row minHeight={72} title={`${CAT[x.categoria] ?? x.categoria} · ${x.jugadora}${x.habitacion ? ` (hab. ${x.habitacion})` : ''}`}
                subtitle={<View style={{ gap: 2 }}><T v="sub">{x.descripcion}</T>{x.respuesta ? <T v="caption" dim>Respuesta: {x.respuesta}</T> : null}<T v="caption" dim>{dt(x.creado_at)}</T></View>}
                trailing={<Badge text={EST[x.estado][0]} tone={EST[x.estado][1]} />} />
              {x.estado !== 'resuelto' ? (
                <View style={{ paddingHorizontal: Space.l, paddingBottom: Space.m }}>
                  {resp?.id === x.id ? (
                    <AskBox label="Respuesta para la jugadora (opcional)" ok={resp.estado === 'resuelto' ? 'Marcar resuelto' : 'Poner en proceso'} onCancel={() => setResp(null)} onOk={(r) => cambia(x.id, resp.estado, r)} />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: Space.s }}>
                      {x.estado === 'abierto' ? <View style={{ flex: 1 }}><Button small kind="tinted" title="En proceso" onPress={() => setResp({ id: x.id, estado: 'en_proceso' })} /></View> : null}
                      <View style={{ flex: 1 }}><Button small kind="tinted" title="Resuelto" onPress={() => setResp({ id: x.id, estado: 'resuelto' })} /></View>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}
