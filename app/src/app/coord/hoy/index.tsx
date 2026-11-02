// Tablero del día de Coordinación.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { run } from '@/components/notify';
import { Badge, Button, Card, Group, Icon, Loading, Row, Screen, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { Emergencia } from '@/features/coord/emergencia';
import type { Viaje } from '@/features/calendario';
import { dt, hm, mins, telUrl } from '@/features/coord/util';

type Dash = { total: number; fuera: number; atrasadas: number; por_resolver: number; visitas_dentro: number; visitas_pend: number; incidencias: number; tickets: number };
type Fuera = { id: number; jugadora: string; destino: string; acompanante: string; regreso_at: number; atrasada: boolean; tutor_nombre?: string; tutor_tel?: string; wa_tutor?: string | null };
type Evento = { id: number; titulo: string; inicio_at: number; lugar?: string; categoria?: string | null };
type Conteo = { at: number; total: number; presentes: number };

export default function Hoy() {
  const t = useTheme();
  const [d, setD] = useState<Dash | null>(null);
  const [fu, setFu] = useState<Fuera[]>([]);
  const [ag, setAg] = useState<Evento[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [emer, setEmer] = useState(false);
  const [ahora, setAhora] = useState(0);
  const [viaje, setViaje] = useState<Viaje | null>(null);
  const [conteo, setConteo] = useState<Conteo | null>(null);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Dash>('/dashboard'), api<Fuera[]>('/fuera'), api<Evento[]>('/agenda'), api<Viaje[]>('/viajes').catch(() => [] as Viaje[]), api<Conteo[]>('/conteos').catch(() => [] as Conteo[])]));
    if (r) { const n = Date.now(); setAhora(n); setD(r[0]); setFu(r[1]); setAg(r[2]); setViaje(r[3].find((x) => x.regreso_at >= n) ?? null); setConteo(r[4][0] ?? null); }
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

      {late.length ? (
        <View style={{ gap: Space.s }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
            <Icon sf="exclamationmark.triangle.fill" ion="warning" color={t.bad} />
            <T v="title" color={t.bad}>{late.length === 1 ? '1 jugadora no ha regresado' : `${late.length} jugadoras no han regresado`}</T>
          </View>
          {late.map((p) => (
            <View key={p.id} style={{ backgroundColor: t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: Space.s }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space.s }}>
                <T v="headline" style={{ flex: 1 }}>{p.jugadora}</T>
                <T v="headline" color={t.bad}>{mins(ahora - p.regreso_at)} tarde</T>
              </View>
              <T v="sub">{p.destino} · con {p.acompanante}. Debía volver a las {hm(p.regreso_at)}.</T>
              {p.tutor_tel ? (
                <View style={{ flexDirection: 'row', gap: Space.s }}>
                  {p.wa_tutor ? <View style={{ flex: 1 }}><Button small title="Avisar al tutor" icon={<Icon sf="paperplane.fill" ion="send" size={18} color="#fff" />} onPress={() => { void Linking.openURL(p.wa_tutor!); }} /></View> : null}
                  <View style={{ flex: 1 }}><Button small kind="tinted" title="Llamar" icon={<Icon sf="phone.fill" ion="call" size={18} />} onPress={() => { void Linking.openURL(telUrl(p.tutor_tel!)); }} /></View>
                </View>
              ) : <T v="sub" color={t.bad}>Sin teléfono de tutor registrado.</T>}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: Space.s }}>
        <T v="title">Ahora</T>
        {!late.length ? <Group><Row leading={<Icon sf="checkmark.circle.fill" ion="checkmark-circle" color={t.ok} />} title="Todo en orden" subtitle="Nadie tiene el regreso vencido." /></Group> : null}
        <Group>
          <Row leading={<Icon sf="person.3.fill" ion="people" />} title="Conteo de jugadoras"
            subtitle={conteo && new Date(conteo.at).toDateString() === new Date(ahora).toDateString() ? `Último a las ${hm(conteo.at)}: ${conteo.presentes} de ${conteo.total} presentes` : 'Hoy todavía no hay conteo. Seguridad lo registra en su turno.'}
            trailing={conteo && new Date(conteo.at).toDateString() === new Date(ahora).toDateString() ? <Badge text={conteo.presentes === conteo.total ? 'Completo' : 'Faltan'} tone={conteo.presentes === conteo.total ? 'ok' : 'warn'} /> : <Badge text="Pendiente" tone="warn" />} />
        </Group>
        {viaje ? (
          <Card onPress={() => router.push({ pathname: '/viaje-coord', params: { id: String(viaje.id) } })}>
            <T v="caption" dim style={{ textTransform: 'uppercase' }}>Próximo viaje</T>
            <T v="headline">{viaje.titulo}</T>
            <T v="sub" dim>{viaje.destino} · sale {dt(viaje.salida_at)}</T>
            <T v="sub">{viaje.cuentas.convocada + viaje.cuentas.confirmada} convocadas · {viaje.cuentas.quiere} quieren ir</T>
          </Card>
        ) : null}
        <Button title="Salida de emergencia" kind="danger" icon={<Icon sf="cross.case.fill" ion="medkit" size={20} color={t.bad} />} onPress={() => setEmer(true)} />
      </View>

      <View style={{ gap: Space.s }}>
        <T v="title">Agenda de hoy</T>
        {ag.length ? (
          <Group>{ag.map((e) => <Row key={e.id} title={e.titulo} subtitle={e.lugar || undefined} leading={e.categoria ? <Badge text={e.categoria} tone="tint" /> : undefined} trailing={<T v="sub" dim style={{ fontVariant: ['tabular-nums'] }}>{hm(e.inicio_at)}</T>} />)}</Group>
        ) : <T v="sub" dim>Sin actividades. Agrégalas en Más → Agenda.</T>}
      </View>

      <Emergencia visible={emer} onClose={() => setEmer(false)} onDone={load} />
    </Screen>
  );
}
