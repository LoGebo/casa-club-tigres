import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { CATEGORIAS, dt, EstadoBadge, useList } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';

type Ticket = { id: number; categoria: string; descripcion: string; estado: string; respuesta?: string; creado_at: number };

export default function Servicios() {
  const { data, refreshing, refresh } = useList<Ticket>('/tickets');
  const t = useTheme();
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T v="sub" dim>¿Se descompuso algo, necesitas lavandería o atención médica? Avísale a Coordinación desde aquí.</T>
      <Button title="Nueva solicitud" onPress={() => router.push('/ticket-nuevo')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      {!data ? <Loading /> : data.length ? (
        <Group>
          {data.map((k) => (
            <Row key={k.id} minHeight={72} title={CATEGORIAS.find((c) => c[0] === k.categoria)?.[1] ?? k.categoria} trailing={<EstadoBadge e={k.estado} />}
              subtitle={
                <View style={{ gap: 2 }}>
                  <T v="sub">{k.descripcion}</T>
                  {k.respuesta ? <T v="caption" dim>Respuesta: {k.respuesta}</T> : null}
                  <T v="caption" dim>{dt(k.creado_at)}</T>
                </View>
              } />
          ))}
        </Group>
      ) : <Empty sf="wrench.and.screwdriver" ion="construct-outline" title="Sin solicitudes" />}
    </Screen>
  );
}
