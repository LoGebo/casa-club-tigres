import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Badge, Group, Icon, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';

type Dash = { atrasadas: number; fuera: number; incidencias: number; visitas_dentro: number };

export default function Mas() {
  const [d, setD] = useState<Dash | null>(null);
  useFocusEffect(useCallback(() => { api<Dash>('/dashboard').then(setD).catch(() => {}); }, []));
  const go = (p: '/seguridad/mas/afuera' | '/seguridad/mas/conteo' | '/seguridad/mas/visitas' | '/seguridad/mas/incidencias') => () => router.push(p as never);
  return (
    <Screen>
      <Group header="Guardia">
        <Row title="Afuera ahora" leading={<Icon sf="figure.walk.departure" ion="walk-outline" />} chevron onPress={go('/seguridad/mas/afuera')}
          trailing={d?.atrasadas ? <Badge text={`${d.atrasadas} atrasada${d.atrasadas > 1 ? 's' : ''}`} tone="bad" /> : d ? <Badge text={String(d.fuera)} /> : undefined} />
        <Row title="Conteo nocturno" leading={<Icon sf="checklist" ion="checkbox-outline" />} chevron onPress={go('/seguridad/mas/conteo')} />
      </Group>
      <Group header="Accesos y reportes">
        <Row title="Visitas" leading={<Icon sf="door.left.hand.open" ion="enter-outline" />} chevron onPress={go('/seguridad/mas/visitas')}
          trailing={d?.visitas_dentro ? <Badge text={`${d.visitas_dentro} dentro`} /> : undefined} />
        <Row title="Incidencias" leading={<Icon sf="exclamationmark.triangle" ion="warning-outline" />} chevron onPress={go('/seguridad/mas/incidencias')}
          trailing={d?.incidencias ? <Badge text={`${d.incidencias} abierta${d.incidencias > 1 ? 's' : ''}`} tone="warn" /> : undefined} />
      </Group>
    </Screen>
  );
}
