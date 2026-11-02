import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Badge, Group, Icon, Row, Screen } from '@/components/ui';
import { useNoLeidas } from '@/components/bell';
import { dt } from '@/features/seguridad/util';
import { api } from '@/lib/api';

type Dash = { atrasadas: number; fuera: number; incidencias: number; visitas_dentro: number };
type Viaje = { id: number; titulo: string; destino?: string; salida_at: number; cuentas?: Record<string, number> };

type Ruta = '/seguridad/mas/afuera' | '/seguridad/mas/conteo' | '/seguridad/mas/visitas' | '/seguridad/mas/incidencias' | '/notificaciones';

export default function Mas() {
  const [d, setD] = useState<Dash | null>(null);
  const [vs, setVs] = useState<Viaje[]>([]);
  const { n: sinLeer, recargar } = useNoLeidas();
  useFocusEffect(useCallback(() => {
    api<Dash>('/dashboard').then(setD).catch(() => {});
    api<Viaje[]>('/viajes').then(setVs).catch(() => {});
    recargar();
  }, [recargar]));
  const go = (p: Ruta) => () => router.push(p as never);
  return (
    <Screen>
      {vs.length ? (
        <Group header="Viajes · lista de abordaje">
          {vs.slice(0, 6).map((v) => {
            const n = (v.cuentas?.convocada ?? 0) + (v.cuentas?.confirmada ?? 0);
            return (
              <Row key={v.id} minHeight={64} title={v.titulo} leading={<Icon sf="bus.fill" ion="bus" />} chevron
                subtitle={`${v.destino ? `${v.destino} · ` : ''}${dt(Number(v.salida_at))}`}
                trailing={<Badge text={`${n} convocada${n === 1 ? '' : 's'}`} />}
                onPress={() => router.push({ pathname: '/abordaje', params: { id: String(v.id) } })} />
            );
          })}
        </Group>
      ) : null}
      <Group header="Guardia">
        <Row title="Afuera ahora" leading={<Icon sf="figure.walk.departure" ion="walk-outline" />} chevron onPress={go('/seguridad/mas/afuera')}
          trailing={d?.atrasadas ? <Badge text={`${d.atrasadas} atrasada${d.atrasadas > 1 ? 's' : ''}`} tone="bad" /> : d ? <Badge text={String(d.fuera)} /> : undefined} />
        <Row title="Pase de lista" leading={<Icon sf="checklist" ion="checkbox-outline" />} chevron onPress={go('/seguridad/mas/conteo')} />
      </Group>
      <Group header="Accesos y reportes">
        <Row title="Visitas" leading={<Icon sf="door.left.hand.open" ion="enter-outline" />} chevron onPress={go('/seguridad/mas/visitas')}
          trailing={d?.visitas_dentro ? <Badge text={`${d.visitas_dentro} dentro`} /> : undefined} />
        <Row title="Incidencias" leading={<Icon sf="exclamationmark.triangle" ion="warning-outline" />} chevron onPress={go('/seguridad/mas/incidencias')}
          trailing={d?.incidencias ? <Badge text={`${d.incidencias} abierta${d.incidencias > 1 ? 's' : ''}`} tone="warn" /> : undefined} />
        <Row title="Notificaciones" leading={<Icon sf="bell" ion="notifications-outline" />} chevron onPress={go('/notificaciones')}
          trailing={sinLeer ? <Badge text={`${sinLeer} sin leer`} tone="gold" /> : undefined} />
      </Group>
    </Screen>
  );
}
