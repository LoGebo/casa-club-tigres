// Más: lista agrupada con las secciones de Coordinación y contadores de pendientes (de /dashboard).
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { run } from '@/components/notify';
import { Badge, Group, Icon, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';

type Dash = { visitas_pend: number; incidencias: number; tickets: number };
const FILAS: { href: string; title: string; sf: string; ion: React.ComponentProps<typeof Icon>['ion']; n?: keyof Dash }[][] = [
  [{ href: 'visitas', title: 'Visitas', sf: 'person.badge.key', ion: 'key-outline', n: 'visitas_pend' },
   { href: 'incidencias', title: 'Incidencias', sf: 'exclamationmark.triangle', ion: 'warning-outline', n: 'incidencias' },
   { href: 'servicios', title: 'Servicios', sf: 'wrench.and.screwdriver', ion: 'construct-outline', n: 'tickets' }],
  [{ href: 'comunicar', title: 'Comunicar', sf: 'megaphone', ion: 'megaphone-outline' },
   { href: 'horarios', title: 'Horarios por categoría', sf: 'calendar.badge.clock', ion: 'time-outline' },
   { href: 'comedor', title: 'Comedor', sf: 'fork.knife', ion: 'restaurant-outline' }],
  [{ href: 'resumen', title: 'Resumen semanal', sf: 'chart.line.uptrend.xyaxis', ion: 'trending-up-outline' },
   { href: 'reportes', title: 'Reportes', sf: 'chart.bar', ion: 'bar-chart-outline' }],
  [{ href: 'equipo', title: 'Equipo y reglas', sf: 'gearshape', ion: 'settings-outline' }],
];

export default function Mas() {
  const [d, setD] = useState<Dash | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<Dash>('/dashboard')); if (r) setD(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {FILAS.map((g, i) => (
        <Group key={i}>
          {g.map((f) => {
            const n = f.n && d ? d[f.n] : 0;
            return (
              <Row key={f.href} title={f.title} leading={<Icon sf={f.sf} ion={f.ion} />} chevron minHeight={50}
                trailing={n ? <Badge text={String(n)} tone={f.n === 'incidencias' ? 'bad' : 'warn'} /> : undefined}
                onPress={() => router.push(`/coord/mas/${f.href}` as Href)} />
            );
          })}
        </Group>
      ))}
    </Screen>
  );
}
