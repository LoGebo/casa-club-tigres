import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { api, BASE, store } from '@/lib/api';
import { DayStepper, dt, hm, hoyStr } from '@/features/coord-mas/util';

type Sub = 'hist' | 'est' | 'cont' | 'bit';
type Mov = { id: number; at: number; tipo: string; jugadora: string; destino: string; acompanante: string; staff?: string };
type Est = { id: number; nombre: string; salidas: number; tardes: number };
type Conteo = { id: number; at: number; presentes: number; total: number; staff?: string; detalle?: string };
type Aud = { id: number; at: number; actor?: string; rol?: string; accion: string; detalle?: string };

export default function Reportes() {
  const [sub, setSub] = useState<Sub>('hist');
  const [fecha, setFecha] = useState(hoyStr());
  const [desde, setDesde] = useState(hoyStr().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoyStr());
  const [data, setData] = useState<any[] | null>(null);
  const [exp, setExp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const ruta = { hist: `/historial?fecha=${fecha}`, est: '/estadisticas?dias=30', cont: '/conteos', bit: '/audit' }[sub];
    setData(null);
    const r = await run(() => api<any[]>(ruta));
    if (r) setData(r);
  }, [sub, fecha]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const csv = async () => {
    setExp(true);
    await run(async () => {
      const s = await store.get();
      const r = await fetch(`${BASE}/api/reporte.csv?desde=${desde}&hasta=${hasta}`, { headers: { authorization: `Bearer ${s?.token ?? ''}` } });
      if (!r.ok) throw new Error('No se pudo generar el reporte');
      if (Platform.OS === 'web') {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: `movimientos_${desde}_${hasta}.csv` });
        a.click(); URL.revokeObjectURL(a.href);
      } else {
        await Share.share({ title: `movimientos_${desde}_${hasta}.csv`, message: await r.text() });
      }
    });
    setExp(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Reportes' }} />
      <Segmented options={[['hist', 'Historial'], ['est', 'Cifras'], ['cont', 'Conteos'], ['bit', 'Bitácora']] as const} value={sub} onChange={setSub} />
      {sub === 'hist' ? <DayStepper value={fecha} onChange={setFecha} /> : null}
      {!data ? <Loading /> : sub === 'hist' ? (
        data.length === 0 ? <Empty sf="clock" ion="time-outline" title="Sin movimientos este día" /> : (
          <Group>
            {(data as Mov[]).map((m) => (
              <Row key={m.id} minHeight={64} title={m.jugadora} subtitle={`${m.destino} · con ${m.acompanante} · registró ${m.staff ?? '—'}`}
                trailing={<Badge text={`${m.tipo === 'salida' ? 'Salida' : 'Regreso'} ${hm(m.at)}`} tone={m.tipo === 'salida' ? 'gold' : 'ok'} />} />
            ))}
          </Group>
        )
      ) : sub === 'est' ? (
        <>
          <Group header="Últimos 30 días" footer="Tardes: regresó después de su hora más la tolerancia.">
            {(data as Est[]).map((x) => (
              <Row key={x.id} minHeight={48} title={x.nombre}
                trailing={<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><T v="sub" dim>{x.salidas} salidas</T>{x.tardes ? <Badge text={`${x.tardes} tarde${x.tardes > 1 ? 's' : ''}`} tone="bad" /> : null}</View>} />
            ))}
          </Group>
          <Group header="Exportar movimientos (CSV)">
            <View style={{ padding: 4 }}><DayStepper label="Desde" value={desde} onChange={(k) => { setDesde(k); if (k > hasta) setHasta(k); }} /></View>
            <View style={{ padding: 4 }}><DayStepper label="Hasta" value={hasta} onChange={(k) => { setHasta(k < desde ? desde : k); }} /></View>
            <View style={{ padding: 12 }}><Button title={Platform.OS === 'web' ? 'Descargar CSV' : 'Compartir CSV'} loading={exp} onPress={csv} icon={<Icon sf="square.and.arrow.up" ion="share-outline" size={20} color="#fff" />} /></View>
          </Group>
        </>
      ) : sub === 'cont' ? (
        data.length === 0 ? <Empty sf="checklist" ion="list-outline" title="Aún no hay conteos" /> : (
          <Group>
            {(data as Conteo[]).map((c) => {
              let aus: string[] = [];
              try { aus = JSON.parse(c.detalle || '{}').ausentes ?? []; } catch {}
              return <Row key={c.id} minHeight={64} title={dt(c.at)} subtitle={`Registró ${c.staff ?? '—'}${aus.length ? ` · No localizadas: ${aus.join(', ')}` : ''}`} trailing={<Badge text={`${c.presentes}/${c.total}`} tone={aus.length ? 'bad' : 'ok'} />} />;
            })}
          </Group>
        )
      ) : (
        <Group header="Acciones del personal" footer="Últimas 150.">
          {(data as Aud[]).map((a) => <Row key={a.id} minHeight={56} title={`${a.accion}${a.detalle ? ' · ' + a.detalle : ''}`} subtitle={`${dt(a.at)} · ${a.actor ?? a.rol ?? '—'}`} />)}
        </Group>
      )}
    </Screen>
  );
}
