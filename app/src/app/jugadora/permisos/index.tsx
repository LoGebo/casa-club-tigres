import { router } from 'expo-router';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt, EstadoBadge, useList } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';
import { qrUrl } from '@/lib/api';

type Permiso = { id: number; tipo: string; destino: string; acompanante: string; salida_at: number; regreso_at: number; estado: string; nota?: string; viaje_id?: number | null; menor?: boolean; qr?: string };

function Detalle({ p }: { p: Permiso }) {
  const t = useTheme();
  const viaje = !!p.viaje_id;
  const extra =
    p.estado === 'rechazado' && p.nota ? `Motivo: ${p.nota}`
    : p.estado === 'cancelado' ? (p.nota || 'Este permiso se canceló.')
    : p.estado === 'esperando_padres' ? (viaje ? 'Esperando la autorización de tu mamá/papá/tutor' : 'Coordinación ya avisó a tu tutor. Falta su respuesta.')
    : p.estado === 'autorizado' ? (viaje ? 'Autorizado automáticamente por la convocatoria. Muestra tu QR al abordar.' : 'Muestra el QR de este permiso a Seguridad al salir y al regresar.')
    : viaje && p.estado === 'pendiente' ? 'Se autoriza automáticamente cuando confirmes el viaje.'
    : null;
  const malo = p.estado === 'rechazado' || p.estado === 'vencido';
  return (
    <Row
      minHeight={72}
      onPress={viaje ? () => router.push({ pathname: '/viaje-jugadora', params: { id: String(p.viaje_id) } }) : undefined}
      chevron={viaje}
      title={p.destino}
      trailing={<View style={{ gap: 4, alignItems: 'flex-end' }}>{viaje ? <Badge text="Viaje" tone="tint" /> : null}<EstadoBadge e={p.estado} /></View>}
      subtitle={
        <View style={{ gap: 2 }}>
          <T v="caption" dim>{p.tipo === 'pernocta' ? 'Pernocta · ' : ''}{dt(p.salida_at)} → {dt(p.regreso_at)}</T>
          {!viaje ? <T v="caption" dim>Con {p.acompanante}</T> : null}
          {!viaje && p.qr && (p.estado === 'autorizado' || p.estado === 'salio') ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', padding: 8, borderRadius: 12, marginTop: 6 }}>
              <Image source={{ uri: qrUrl('CCP:' + p.qr) }} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityLabel="QR de este permiso" />
            </View>
          ) : null}
          {extra ? <T v="caption" color={malo ? t.bad : p.estado === 'esperando_padres' ? t.warn : t.label2}>{extra}</T> : null}
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
