import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { Bar, ErrorBox, confirmar, dt, useLoad } from '@/features/coord-mas/util';

type Aviso = { id: number; titulo: string; cuerpo?: string; fijo: boolean; creado_at: number; vence_at?: number | null; categoria?: string | null; requiere_lectura?: boolean; leidos?: number; destinatarios?: number };

export default function Comunicar() {
  const t = useTheme();
  const { data: av, err, load, refresh, refreshing } = useLoad<Aviso[]>('/avisos');
  const fg = t.bg === '#000000' ? '#071647' : '#FFFFFF';

  const quitar = async (a: Aviso) => {
    if (!(await confirmar('¿Quitar este aviso?', 'Dejará de verse para las jugadoras. No se puede deshacer.', 'Quitar'))) return;
    if (await run(() => api(`/avisos/${a.id}`, 'DELETE'))) { notify('Aviso quitado'); await load(); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Comunicar' }} />
      <Button title="Nuevo aviso" onPress={() => router.push('/aviso-nuevo')} icon={<Icon sf="plus" ion="add" size={20} color={fg} />} />
      {!av ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : av.length === 0 ? <Empty sf="megaphone" ion="megaphone-outline" title="Sin avisos publicados" text="Publica uno y le llegará una notificación a las jugadoras." /> : (
        <Group header="Publicados" footer="Toca un aviso con confirmación para ver quién ya lo leyó.">
          {av.map((a) => {
            const lee = a.requiere_lectura && a.destinatarios != null;
            const faltan = lee ? a.destinatarios! - (a.leidos ?? 0) : 0;
            return (
              <Row key={a.id} minHeight={72} title={a.titulo} chevron={!!a.requiere_lectura}
                onPress={a.requiere_lectura ? () => router.push({ pathname: '/aviso-lecturas', params: { id: String(a.id) } }) : undefined}
                subtitle={
                  <View style={{ gap: 4 }}>
                    {a.cuerpo ? <T v="sub" numberOfLines={3}>{a.cuerpo}</T> : null}
                    <T v="caption" dim>Para {a.categoria ?? 'todas'} · {dt(a.creado_at)}{a.vence_at ? ` · vence ${dt(a.vence_at)}` : ''}</T>
                    {lee ? (
                      <View style={{ gap: 4, marginTop: 2 }}>
                        <T v="caption" color={faltan > 0 ? t.warn : t.ok} style={{ fontWeight: '600' }}>{a.leidos} de {a.destinatarios} leyeron{faltan === 0 ? ' · completo' : ''}</T>
                        <Bar pct={a.destinatarios ? (a.leidos ?? 0) / a.destinatarios : 0} color={faltan > 0 ? t.warn : t.ok} height={6} />
                      </View>
                    ) : null}
                  </View>
                }
                trailing={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {a.fijo ? <Badge text="Fijo" tone="gold" /> : null}
                    <Button small kind="danger" title="Quitar" onPress={() => quitar(a)} />
                  </View>
                } />
            );
          })}
        </Group>
      )}
    </Screen>
  );
}
