import { router } from 'expo-router';

import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt, EstadoBadge, useList } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';

type Visita = { id: number; visitante: string; relacion?: string; fecha_at: number; estado: string; nota?: string };

export default function Visitas() {
  const { data, refreshing, refresh } = useList<Visita>('/visitas');
  const t = useTheme();
  const dentro = data?.filter((v) => v.estado === 'dentro') ?? [];
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      {dentro.length ? <Group>{dentro.map((v) => (
        <Row key={`llego-${v.id}`} minHeight={64} leading={<Icon sf="person.crop.circle.badge.checkmark" ion="checkmark-circle" size={28} color={t.ok} />}
          title={<T v="headline" color={t.ok}>Llegó tu visita</T>} subtitle={<T v="sub">{v.visitante} ya está en la entrada.</T>} />
      ))}</Group> : null}
      <T v="sub" dim>Registra con anticipación a quién esperas. Coordinación debe autorizarla y Seguridad la verá en la entrada.</T>
      <Button title="Registrar visita" onPress={() => router.push('/visita-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      {!data ? <Loading /> : data.length ? (
        <Group>
          {data.map((v) => (
            <Row key={v.id} minHeight={64} title={v.visitante}
              subtitle={`${v.relacion ? v.relacion + ' · ' : ''}${dt(v.fecha_at)}${v.estado === 'rechazada' && v.nota ? `\nMotivo: ${v.nota}` : ''}`}
              trailing={v.estado === 'dentro' ? <Badge text="Llegó" tone="ok" /> : <EstadoBadge e={v.estado} visita />} />
          ))}
        </Group>
      ) : <Empty sf="person.2" ion="people-outline" title="Sin visitas registradas" text="Cuando registres una, aquí verás si se autorizó." />}
    </Screen>
  );
}
