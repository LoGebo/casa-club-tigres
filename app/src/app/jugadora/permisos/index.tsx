import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt, EstadoBadge, useList } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';

type Permiso = { id: number; tipo: string; destino: string; acompanante: string; salida_at: number; regreso_at: number; estado: string; nota?: string };

function Detalle({ p }: { p: Permiso }) {
  const t = useTheme();
  const extra = p.estado === 'rechazado' && p.nota ? `Motivo: ${p.nota}` : p.estado === 'esperando_padres' ? 'Coordinación ya avisó a tu tutor. Falta su respuesta.' : p.estado === 'autorizado' ? 'Muestra tu QR a Seguridad al salir y al regresar.' : null;
  return (
    <Row
      minHeight={72}
      title={p.destino}
      trailing={<EstadoBadge e={p.estado} />}
      subtitle={
        <View style={{ gap: 2 }}>
          <T v="caption" dim>{p.tipo === 'pernocta' ? 'Pernocta · ' : ''}{dt(p.salida_at)} → {dt(p.regreso_at)}</T>
          <T v="caption" dim>Con {p.acompanante}</T>
          {extra ? <T v="caption" color={p.estado === 'rechazado' ? t.bad : t.label2}>{extra}</T> : null}
        </View>
      }
    />
  );
}

export default function Permisos() {
  const { data, refreshing, refresh } = useList<Permiso>('/permisos');
  const t = useTheme();
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Button title="Solicitar permiso" onPress={() => router.push('/permiso-nuevo')} icon={<Icon sf="plus" ion="add" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      {!data ? <Loading /> : data.length ? <Group>{data.map((p) => <Detalle key={p.id} p={p} />)}</Group> : <Empty sf="rectangle.portrait.and.arrow.right" ion="exit-outline" title="Aún no has pedido permisos" text="Toca “Solicitar permiso” para empezar." />}
    </Screen>
  );
}
