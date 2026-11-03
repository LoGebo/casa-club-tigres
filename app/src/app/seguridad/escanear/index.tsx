// Acceso: contadores, escaneo de QR de la jugadora, búsqueda por nombre y últimos registros.
// Mantiene el paquete sin conexión al día (al entrar, al volver a primer plano y cada 5 min).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { PromptDialog } from '@/features/coord/util';
import { usePaquete } from '@/features/seguridad/offline';
import { QrScanner } from '@/features/seguridad/scanner';
import { ChipOffline, MovRow, SearchBox, type Movimiento } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCola } from '@/lib/cola';

type Dash = { total: number; fuera: number; atrasadas: number; visitas_dentro: number };
type J = { id: number; nombre: string; habitacion?: string; categoria?: string; activa?: boolean };

export default function Escanear() {
  const t = useTheme();
  const { online } = useCola();
  const { pack, edad, sincronizar } = usePaquete(true);
  const [dash, setDash] = useState<Dash | null>(null);
  const [rec, setRec] = useState<Movimiento[]>([]);
  const [js, setJs] = useState<J[]>([]);
  const [q, setQ] = useState('');
  const [listo, setListo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [grupal, setGrupal] = useState<'salida' | 'regreso' | null>(null);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Dash>('/dashboard'), api<Movimiento[]>('/registro?limit=5'), api<J[]>('/jugadoras')]));
    if (r) { setDash(r[0]); setRec(r[1]); setJs(r[2].filter((j) => j.activa)); }
    setListo(true);
  }, []);
  useFocusEffect(useCallback(() => { void load(); void sincronizar(); }, [load, sincronizar]));

  const v = q.toLowerCase().trim();
  const base: J[] = pack?.jugadoras ?? js;
  const hits = v ? base.filter((j) => j.nombre.toLowerCase().includes(v)).slice(0, 6) : [];

  if (!listo && !pack) return <Screen><Loading /></Screen>;
  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([load(), sincronizar()]); setRefreshing(false); }}>
      {!online ? <ChipOffline edad={edad} /> : null}
      {dash ? (
        <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: Radius.m, paddingVertical: Space.m }}>
          {([[dash.total - dash.fuera, 'Dentro', false], [dash.fuera, 'Afuera', false], [dash.atrasadas, 'Atrasadas', dash.atrasadas > 0], [dash.visitas_dentro, 'Visitas', false]] as const).map(([n, l, alerta]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${n} ${l}`}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: alerta ? t.bad : t.label, fontVariant: ['tabular-nums'] }}>{n}</Text>
              <T v="caption" dim>{l}</T>
            </View>
          ))}
        </View>
      ) : null}

      <QrScanner onCode={(data) => router.push({ pathname: '/ficha', params: { qr: data } })} />

      <Group header="Todo el grupo" footer="Marca a todas las jugadoras que están dentro como salidas juntas (o de regreso) y avisa a Coordinación.">
        <Row title="Salieron todas a entrenar" leading={<Icon sf="figure.run" ion="walk-outline" />} chevron onPress={() => setGrupal('salida')} />
        <Row title="Regresaron todas del entrenamiento" leading={<Icon sf="arrow.uturn.backward" ion="arrow-undo-outline" />} chevron onPress={() => setGrupal('regreso')} />
      </Group>
      <PromptDialog visible={!!grupal} required={false} ok={grupal === 'salida' ? 'Registrar salida' : 'Registrar regreso'}
        title={grupal === 'salida' ? 'Salieron todas a entrenar' : 'Regresaron del entrenamiento'}
        label={grupal === 'salida' ? 'Se marcarán como afuera TODAS las jugadoras que están dentro. Escribe a dónde van (opcional).' : 'Se marcarán de regreso todas las que salieron en grupo.'}
        placeholder={grupal === 'salida' ? 'Entrenamiento' : undefined} onCancel={() => setGrupal(null)}
        onSubmit={async (txt) => {
          const tipo = grupal; setGrupal(null);
          const r = await run(() => api<{ jugadoras: number }>(tipo === 'salida' ? '/salida-grupal' : '/regreso-grupal', 'POST', { motivo: txt || undefined }));
          if (r) { notify(`${r.jugadoras} jugadora(s) ${tipo === 'salida' ? 'salieron' : 'regresaron'}. Coordinación fue avisada.`); void load(); void sincronizar(); }
        }} />

      <Group header="O busca por nombre">
        <View style={{ padding: Space.s }}><SearchBox value={q} onChangeText={setQ} placeholder="Nombre de la jugadora" /></View>
        {hits.map((j) => <Row key={j.id} title={j.nombre} subtitle={[j.categoria, j.habitacion ? `Hab. ${j.habitacion}` : ''].filter(Boolean).join(' · ') || undefined} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(j.id) } })} />)}
      </Group>
      {v && !hits.length ? <T v="sub" dim style={{ textAlign: 'center' }}>Sin resultados</T> : null}

      <T v="title">Últimos registros</T>
      {rec.length ? <Group>{rec.map((m, i) => <MovRow key={i} m={m} />)}</Group> : <Empty sf="tray" ion="file-tray-outline" title="Aún no hay movimientos hoy" />}
    </Screen>
  );
}
