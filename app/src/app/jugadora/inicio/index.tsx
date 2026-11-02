import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { run } from '@/components/notify';
import { Card, Group, Loading, Row, Screen, T } from '@/components/ui';
import { dt, hm } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';
import { api, qrUrl } from '@/lib/api';

type Me = { nombre: string; qr: string; fuera?: { regreso_at: number } | null };
type Evento = { id?: number; titulo: string; lugar?: string; inicio_at: number; fin_at?: number };
type Aviso = { id: number; titulo: string; cuerpo?: string; fijo?: boolean; creado_at: number };

export default function Inicio() {
  const t = useTheme();
  const [d, setD] = useState<{ me: Me; ag: Evento[]; av: Aviso[]; now: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Me>('/me'), api<Evento[]>('/agenda'), api<Aviso[]>('/avisos')]));
    if (r) setD({ me: r[0], ag: r[1], av: r[2], now: Date.now() });
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!d) return <Screen><Loading /></Screen>;
  const { me, ag, av, now } = d;
  const fuera = me.fuera;
  return (
    <Screen onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <View style={{ gap: 6 }}>
        <T v="large">Hola, {me.nombre.split(' ')[0]}</T>
        <T v="headline" color={fuera ? t.warn : t.ok}>{fuera ? `Afuera · regresas a las ${hm(fuera.regreso_at)}` : 'Dentro de Casa Club'}</T>
      </View>

      <Card style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12 }}>
          <Image source={{ uri: qrUrl(me.qr) }} style={{ width: 240, height: 240 }} contentFit="contain" accessibilityLabel="Mi código QR de acceso" />
        </View>
        <T v="headline">Mi pase</T>
        <T v="caption" dim style={{ textAlign: 'center' }}>Muéstralo a Seguridad al salir y al regresar</T>
      </Card>

      <Group header="Hoy en Casa Club">
        {ag.length ? ag.map((e, i) => {
          const ahora = e.inicio_at <= now && (e.fin_at || e.inicio_at + 36e5) >= now;
          return (
            <Row key={e.id ?? i} title={e.titulo} subtitle={`${e.lugar ?? ''}${e.fin_at ? `${e.lugar ? ' · ' : ''}hasta ${hm(e.fin_at)}` : ''}`}
              leading={<T v="headline" color={ahora ? t.tint : t.label2} style={{ width: 52, fontVariant: ['tabular-nums'] }}>{hm(e.inicio_at)}</T>} />
          );
        }) : <Row title="Nada programado hoy." />}
      </Group>

      {av.length ? (
        <Group header="Avisos">
          {av.map((a) => <Row key={a.id} minHeight={64} title={a.titulo} subtitle={`${a.cuerpo ? a.cuerpo + '\n' : ''}${dt(a.creado_at)}`} />)}
        </Group>
      ) : null}
      <T v="caption" dim style={{ textAlign: 'center' }}>Sin permiso autorizado no es posible salir. Pídelo en la pestaña Permisos.</T>
    </Screen>
  );
}
