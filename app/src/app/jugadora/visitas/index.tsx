import { router } from 'expo-router';

import { Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt, EstadoBadge, useList } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';

type Visita = { id: number; visitante: string; relacion?: string; fecha_at: number; estado: string };

export default function Visitas() {
  const { data, refreshing, refresh } = useList<Visita>('/visitas');
  const t = useTheme();
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <T v="sub" dim>Registra con anticipación a quién esperas. Coordinación debe autorizarla y Seguridad la verá en la entrada.</T>
      <Button title="Registrar visita" onPress={() => router.push('/visita-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      {!data ? <Loading /> : data.length ? (
        <Group>{data.map((v) => <Row key={v.id} title={v.visitante} subtitle={`${v.relacion ? v.relacion + ' · ' : ''}${dt(v.fecha_at)}`} trailing={<EstadoBadge e={v.estado} visita />} />)}</Group>
      ) : <Empty sf="person.2" ion="people-outline" title="Sin visitas registradas" />}
    </Screen>
  );
}
