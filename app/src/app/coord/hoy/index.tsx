// Tablero del día de Coordinación.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { run } from '@/components/notify';
import { Button, Card, Empty, Group, Icon, Loading, Row, Screen, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { Emergencia } from '@/features/coord/emergencia';
import { hm, mins, telUrl } from '@/features/coord/util';

type Dash = { total: number; fuera: number; atrasadas: number; por_resolver: number; visitas_dentro: number; visitas_pend: number; incidencias: number; tickets: number };
type Fuera = { id: number; jugadora: string; destino: string; acompanante: string; regreso_at: number; atrasada: boolean; tutor_nombre?: string; tutor_tel?: string };
type Evento = { id: number; titulo: string; inicio_at: number; lugar?: string };

export default function Hoy() {
  const t = useTheme();
  const [d, setD] = useState<Dash | null>(null);
  const [fu, setFu] = useState<Fuera[]>([]);
  const [ag, setAg] = useState<Evento[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [emer, setEmer] = useState(false);
  const [ahora, setAhora] = useState(0);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Dash>('/dashboard'), api<Fuera[]>('/fuera'), api<Evento[]>('/agenda')]));
    if (r) { setAhora(Date.now()); setD(r[0]); setFu(r[1]); setAg(r[2]); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!d) return <Screen><Loading /></Screen>;
  const late = fu.filter((p) => p.atrasada);
  const stats: { n: number; l: string; urgent?: boolean; to: '/coord/permisos' | '/coord/mas' }[] = [
    { n: d.atrasadas, l: 'Atrasadas', urgent: d.atrasadas > 0, to: '/coord/permisos' },
    { n: d.por_resolver, l: 'Permisos por resolver', to: '/coord/permisos' },
    { n: d.fuera, l: 'Afuera', to: '/coord/permisos' },
    { n: d.incidencias, l: 'Incidencias', urgent: d.incidencias > 0, to: '/coord/mas' },
    { n: d.visitas_pend, l: 'Visitas por autorizar', to: '/coord/mas' },
    { n: d.tickets, l: 'Servicios abiertos', to: '/coord/mas' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View>
        <T v="large">{d.total - d.fuera} de {d.total}</T>
        <T v="sub" dim>en casa club · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.s }}>
        {stats.map((s) => (
          <Pressable key={s.l} onPress={() => { tap(); router.push(s.to); }} accessibilityRole="button" accessibilityLabel={`${s.n} ${s.l}`}
            style={({ pressed }) => ({ flexBasis: '48%', flexGrow: 1, minHeight: 84, borderRadius: Radius.m, padding: Space.m, justifyContent: 'space-between', backgroundColor: s.urgent ? t.badWeak : t.surface, opacity: pressed ? 0.7 : 1 })}>
            <T v="num" color={s.urgent ? t.bad : undefined}>{s.n}</T>
            <T v="caption" dim={!s.urgent} color={s.urgent ? t.bad : undefined}>{s.l}</T>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: Space.s }}>
        <T v="title">Requiere atención</T>
        {late.length ? late.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space.s }}>
              <T v="headline" style={{ flex: 1 }}>{p.jugadora}</T>
              <T v="sub" color={t.bad} style={{ fontWeight: '600' }}>{mins(ahora - p.regreso_at)} tarde</T>
            </View>
            <T v="caption" dim>{p.destino} · con {p.acompanante} · debía volver {hm(p.regreso_at)}</T>
            {p.tutor_tel ? <Button small kind="tinted" title={`Llamar a ${p.tutor_nombre || 'tutor'}`} icon={<Icon sf="phone.fill" ion="call" size={18} />} onPress={() => { void Linking.openURL(telUrl(p.tutor_tel!)); }} /> : null}
          </Card>
        )) : <Empty sf="checkmark.circle" ion="checkmark-circle-outline" title="Todo en orden" />}
        <Button title="Salida de emergencia" kind="danger" icon={<Icon sf="cross.case.fill" ion="medkit" size={20} color={t.bad} />} onPress={() => setEmer(true)} />
      </View>

      <View style={{ gap: Space.s }}>
        <T v="title">Agenda de hoy</T>
        {ag.length ? (
          <Group>{ag.map((e) => <Row key={e.id} title={e.titulo} subtitle={e.lugar || undefined} trailing={<T v="sub" dim style={{ fontVariant: ['tabular-nums'] }}>{hm(e.inicio_at)}</T>} />)}</Group>
        ) : <T v="sub" dim>Sin actividades. Agrégalas en Más → Agenda.</T>}
      </View>

      <Emergencia visible={emer} onClose={() => setEmer(false)} onDone={load} />
    </Screen>
  );
}
