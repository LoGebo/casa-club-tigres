// Incidencias recientes y reporte de nuevas. Atenderlas es exclusivo de Coordinación (el backend lo exige).
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type I = { id: number; tipo: string; severidad: 'baja' | 'media' | 'urgente'; estado: 'abierta' | 'atendida'; jugadora?: string; descripcion: string; creado_at: number; resolucion?: string };

export default function Incidencias() {
  const t = useTheme();
  const [is, setIs] = useState<I[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<I[]>('/incidencias')); if (r) setIs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Incidencias' }} />
      <Button title="Reportar incidencia" kind="gold" onPress={() => router.push('/incidencia-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={t.onGold} />} />
      {!is ? <Loading /> : is.length === 0 ? <Empty sf="checkmark.shield" ion="shield-checkmark-outline" title="Sin incidencias recientes" /> : (
        <Group>
          {is.map((i) => {
            const urg = i.severidad === 'urgente' && i.estado === 'abierta';
            return (
              <Row key={i.id} minHeight={72}
                title={`${i.tipo.replace(/_/g, ' ')}${i.jugadora ? ` · ${i.jugadora}` : ''}`}
                subtitle={<><T v="sub" numberOfLines={3}>{i.descripcion}</T><T v="caption" dim>{`${dt(i.creado_at)}${i.resolucion ? ` · Resolución: ${i.resolucion}` : ''}`}</T></>}
                trailing={<>{urg ? <Badge text="Urgente" tone="bad" /> : <Badge text={i.severidad} tone={i.severidad === 'media' ? 'warn' : 'neutral'} />}<Badge text={i.estado === 'abierta' ? 'Abierta' : 'Atendida'} tone={i.estado === 'abierta' ? 'gold' : 'ok'} /></>} />
            );
          })}
        </Group>
      )}
    </Screen>
  );
}
