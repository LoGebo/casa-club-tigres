import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { confirmar, DayStepper, dt, hm, hoyStr, useOnChanged } from '@/features/coord-mas/util';

type Aviso = { id: number; titulo: string; cuerpo?: string; fijo: boolean; creado_at: number; vence_at?: number };
type Act = { id: number; titulo: string; tipo: string; inicio_at: number; fin_at?: number; lugar?: string };
const TIPO: Record<string, string> = { entrenamiento: 'Entrenamiento', comida: 'Comida', estudio: 'Estudio', transporte: 'Transporte', otro: 'Otro' };

export default function Comunicar() {
  const t = useTheme();
  const [sub, setSub] = useState<'avisos' | 'agenda'>('avisos');
  const [dia, setDia] = useState(hoyStr());
  const [av, setAv] = useState<Aviso[] | null>(null);
  const [ag, setAg] = useState<Act[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (sub === 'avisos') { const r = await run(() => api<Aviso[]>('/avisos')); if (r) setAv(r); }
    else { setAg(null); const r = await run(() => api<Act[]>(`/agenda?dia=${dia}&dias=1`)); if (r) setAg(r); }
  }, [sub, dia]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useOnChanged(load);

  const quitar = async (ruta: 'avisos' | 'agenda', id: number) => {
    if (!(await confirmar('¿Quitar?', 'Esta acción no se puede deshacer.', 'Quitar'))) return;
    if (await run(() => api(`/${ruta}/${id}`, 'DELETE'))) { notify('Quitado'); await load(); }
  };
  const fg = t.bg === '#000000' ? '#071647' : '#FFFFFF';

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Comunicar' }} />
      <Segmented options={[['avisos', 'Avisos'], ['agenda', 'Agenda']] as const} value={sub} onChange={setSub} />
      {sub === 'avisos' ? (
        <>
          <Button title="Nuevo aviso" onPress={() => router.push('/aviso-nuevo')} icon={<Icon sf="plus" ion="add" size={20} color={fg} />} />
          {!av ? <Loading /> : av.length === 0 ? <Empty sf="megaphone" ion="megaphone-outline" title="Sin avisos publicados" /> : (
            <Group header="Publicados" footer="Los avisos aparecen en el inicio de todas las jugadoras.">
              {av.map((a) => (
                <Row key={a.id} minHeight={72} title={a.titulo}
                  subtitle={<View style={{ gap: 2 }}>{a.cuerpo ? <T v="sub">{a.cuerpo}</T> : null}<T v="caption" dim>{dt(a.creado_at)}{a.vence_at ? ` · vence ${dt(a.vence_at)}` : ''}</T></View>}
                  trailing={<View style={{ alignItems: 'flex-end', gap: 6 }}>{a.fijo ? <Badge text="Fijo" tone="gold" /> : null}<Button small kind="danger" title="Quitar" onPress={() => quitar('avisos', a.id)} /></View>} />
              ))}
            </Group>
          )}
        </>
      ) : (
        <>
          <Button title="Nueva actividad" onPress={() => router.push({ pathname: '/agenda-nueva', params: { dia } })} icon={<Icon sf="plus" ion="add" size={20} color={fg} />} />
          <DayStepper value={dia} onChange={setDia} />
          {!ag ? <Loading /> : ag.length === 0 ? <Empty sf="calendar" ion="calendar-outline" title="Sin actividades este día" /> : (
            <Group>
              {ag.map((e) => (
                <Row key={e.id} minHeight={64} leading={<T v="headline" style={{ width: 52, fontVariant: ['tabular-nums'] }}>{hm(e.inicio_at)}</T>} title={e.titulo}
                  subtitle={`${TIPO[e.tipo] ?? e.tipo}${e.lugar ? ' · ' + e.lugar : ''}${e.fin_at ? ` · hasta ${hm(e.fin_at)}` : ''}`}
                  trailing={<Button small kind="danger" title="Quitar" onPress={() => quitar('agenda', e.id)} />} />
              ))}
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}
