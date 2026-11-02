import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Card, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import type { Partido, Viaje } from '@/features/calendario';
import { dt, duracion, hm, useAhora } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';
import { api, qrUrl } from '@/lib/api';

type Me = { nombre: string; qr: string; fuera?: { regreso_at: number; destino?: string } | null };
type Evento = { id?: number; titulo: string; lugar?: string; inicio_at: number; fin_at?: number; serie?: boolean };
type Aviso = { id: number; titulo: string; cuerpo?: string; fijo?: boolean; creado_at: number; requiere_lectura?: boolean; leido?: boolean };
type Datos = { me: Me; ag: Evento[]; av: Aviso[]; viajes: Viaje[]; partidos: Partido[] };

function Fuera({ regreso, destino }: { regreso: number; destino?: string }) {
  const t = useTheme();
  const ahora = useAhora(15_000);
  const tarde = regreso < ahora;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: tarde ? t.badWeak : t.warnWeak, borderRadius: Radius.m, padding: Space.l, gap: 4 }}>
      <T v="caption" color={tarde ? t.bad : t.warn} style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>{tarde ? 'Regreso atrasado' : 'Estás fuera'}</T>
      <T v="title" color={tarde ? t.bad : t.label}>{tarde ? 'Ya pasó tu hora de regreso' : `Te quedan ${duracion(regreso - ahora)}`}</T>
      <T v="sub" dim>{tarde ? `Debías volver a las ${hm(regreso)}. Regresa y avisa a Seguridad o a Coordinación.` : `Regresas a las ${hm(regreso)}${destino ? ` · ${destino}` : ''}`}</T>
    </View>
  );
}

export default function Inicio() {
  const t = useTheme();
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ahora = useAhora();
  const load = useCallback(async () => {
    try {
      const [me, ag, av, viajes, partidos] = await Promise.all([
        api<Me>('/me'), api<Evento[]>('/agenda'), api<Aviso[]>('/avisos'),
        api<Viaje[]>('/viajes').catch(() => [] as Viaje[]), api<Partido[]>('/partidos?atras=0').catch(() => [] as Partido[]),
      ]);
      setD({ me, ag, av, viajes, partidos }); setError(false);
    } catch (e) { setError(true); notify(e instanceof Error ? e.message : 'No se pudo cargar'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const entendido = async (a: Aviso) => {
    setD((x) => x && { ...x, av: x.av.map((v) => (v.id === a.id ? { ...v, leido: true } : v)) });
    const r = await run(() => api(`/avisos/${a.id}/leido`, 'POST'));
    if (!r) void load(); else notify('Listo, quedó registrado');
  };

  if (!d) return <Screen onRefresh={load}>{error ? <Empty sf="wifi.slash" ion="cloud-offline-outline" title="No se pudo cargar" text="Desliza hacia abajo para reintentar." /> : <Loading />}</Screen>;
  const { me, ag, av, viajes, partidos } = d;
  const fuera = me.fuera;
  const pendientes = av.filter((a) => a.requiere_lectura && !a.leido);
  const viaje = viajes.filter((v) => v.regreso_at > ahora && v.yo !== 'baja').sort((a, b) => Number(!!b.yo) - Number(!!a.yo) || a.salida_at - b.salida_at)[0];
  const partido = partidos.filter((p) => p.inicio_at > ahora).sort((a, b) => a.inicio_at - b.inicio_at)[0];

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <View style={{ gap: 4 }}>
        <T v="large">Hola, {me.nombre.split(' ')[0]}</T>
        <T v="headline" color={fuera ? t.warn : t.ok}>{fuera ? 'Fuera de Casa Club' : 'Dentro de Casa Club'}</T>
      </View>

      {fuera ? <Fuera regreso={fuera.regreso_at} destino={fuera.destino} /> : null}

      {pendientes.length ? (
        <Card style={{ backgroundColor: t.warnWeak }}>
          <T v="headline" color={t.warn}>{pendientes.length === 1 ? 'Tienes 1 aviso por confirmar' : `Tienes ${pendientes.length} avisos por confirmar`}</T>
          <T v="sub" dim>Léelos abajo y toca “Entendido”.</T>
        </Card>
      ) : null}

      <Card style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 }}>
          <Image source={{ uri: qrUrl(me.qr) }} style={{ width: 240, height: 240 }} contentFit="contain" accessibilityLabel="Mi código QR de acceso" />
        </View>
        <T v="headline">Mi pase</T>
        <T v="caption" dim style={{ textAlign: 'center' }}>Muéstralo a Seguridad al salir y al regresar</T>
      </Card>

      <Group header="Hoy">
        {ag.length ? ag.map((e, i) => {
          const ya = e.inicio_at <= ahora && (e.fin_at || e.inicio_at + 36e5) >= ahora;
          const pasado = (e.fin_at || e.inicio_at + 36e5) < ahora;
          return (
            <Row key={`${e.id ?? i}-${e.inicio_at}`} minHeight={60}
              leading={<T v="headline" color={ya ? t.tint : pasado ? t.label3 : t.label2} style={{ width: 54, fontVariant: ['tabular-nums'] }}>{hm(e.inicio_at)}</T>}
              title={<T v="headline" color={pasado ? t.label2 : undefined} style={{ fontWeight: '500' }}>{e.titulo}</T>}
              subtitle={<T v="caption" dim>{[e.lugar, e.fin_at ? `hasta ${hm(e.fin_at)}` : ''].filter(Boolean).join(' · ')}</T>}
              trailing={ya ? <Badge text="Ahora" tone="tint" /> : e.serie ? <Badge text="Se repite" /> : undefined} />
          );
        }) : <Row title={<T v="body" dim>Nada programado hoy.</T>} />}
      </Group>

      {viaje ? (
        <Group header="Próximo viaje">
          <Row minHeight={64} chevron onPress={() => router.push({ pathname: '/viaje-jugadora', params: { id: String(viaje.id) } })}
            leading={<Icon sf="bus" ion="bus-outline" size={24} />}
            title={viaje.titulo} subtitle={`${viaje.destino} · sale ${dt(viaje.salida_at)}`}
            trailing={viaje.yo === 'convocada' ? <Badge text="Responde" tone="warn" /> : viaje.yo === 'confirmada' ? <Badge text="Confirmada" tone="ok" /> : viaje.yo === 'quiere' ? <Badge text="Pediste ir" tone="tint" /> : undefined} />
        </Group>
      ) : partido ? (
        <Group header="Próximo partido">
          <Row minHeight={64} chevron onPress={() => router.push({ pathname: '/partido', params: { id: String(partido.id) } })}
            leading={<Icon sf="sportscourt" ion="football-outline" size={24} />}
            title={`${partido.local} vs ${partido.visitante}`} subtitle={`${dt(partido.inicio_at)}${partido.sede ? ` · ${partido.sede}` : ''}`} />
        </Group>
      ) : null}

      {av.length ? (
        <Group header="Avisos">
          {av.map((a) => {
            const falta = a.requiere_lectura && !a.leido;
            return (
              <Row key={a.id} minHeight={72}
                title={a.titulo}
                subtitle={
                  <View style={{ gap: 6 }}>
                    {a.cuerpo ? <T v="sub" dim>{a.cuerpo}</T> : null}
                    <T v="caption" dim>{dt(a.creado_at)}{a.fijo ? ' · Fijado' : ''}</T>
                    {falta ? <View style={{ paddingTop: 4 }}><Button title="Entendido" small onPress={() => entendido(a)} /></View> : null}
                  </View>
                }
                trailing={a.requiere_lectura && a.leido ? <Badge text="Leído" tone="ok" /> : falta ? <Badge text="Por confirmar" tone="warn" /> : undefined} />
            );
          })}
        </Group>
      ) : null}
      <T v="caption" dim style={{ textAlign: 'center' }}>Sin permiso autorizado no es posible salir. Pídelo en la pestaña Permisos.</T>
    </Screen>
  );
}
