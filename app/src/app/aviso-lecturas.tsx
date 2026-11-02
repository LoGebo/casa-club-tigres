// Hoja: quién ya leyó un aviso y quién falta (pendientes primero).
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { Avatar, Badge, Empty, Group, Loading, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Bar, ErrorBox, dt, useLoad } from '@/features/coord-mas/util';

type Lec = { id: number; nombre: string; categoria?: string; leido_at?: number | null };

export default function AvisoLecturas() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, err, load } = useLoad<Lec[]>(`/avisos/${id}/lecturas`);
  const falta = data?.filter((x) => !x.leido_at) ?? [];
  const leyeron = data?.filter((x) => x.leido_at) ?? [];
  return (
    <SheetScreen title="Lecturas">
      {!data ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : data.length === 0 ? <Empty sf="person.2" ion="people-outline" title="Sin destinatarias" /> : (
        <>
          <View style={{ gap: Space.s }}>
            <T v="num">{leyeron.length} de {data.length}</T>
            <T v="sub" dim>{falta.length === 0 ? 'Todas ya lo leyeron.' : `Faltan ${falta.length} por leerlo.`}</T>
            <Bar pct={leyeron.length / data.length} color={falta.length === 0 ? t.ok : t.tint} />
          </View>
          {falta.length > 0 ? (
            <Group header={`Pendientes (${falta.length})`}>
              {falta.map((x) => (
                <Row key={x.id} minHeight={56} leading={<Avatar name={x.nombre} size={36} />} title={x.nombre} subtitle={x.categoria} trailing={<Badge text="Sin leer" tone="warn" />} />
              ))}
            </Group>
          ) : null}
          {leyeron.length > 0 ? (
            <Group header={`Ya leyeron (${leyeron.length})`}>
              {leyeron.map((x) => (
                <Row key={x.id} minHeight={56} leading={<Avatar name={x.nombre} size={36} />} title={x.nombre} subtitle={x.categoria} trailing={<T v="caption" dim>{dt(x.leido_at!)}</T>} />
              ))}
            </Group>
          ) : null}
        </>
      )}
    </SheetScreen>
  );
}
