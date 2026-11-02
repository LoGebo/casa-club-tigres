// Acceso: contadores, escaneo de QR de la jugadora, búsqueda por nombre y últimos registros.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { MovRow, type Movimiento } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Dash = { total: number; fuera: number; atrasadas: number; visitas_dentro: number };
type J = { id: number; nombre: string; habitacion?: string; activa: boolean };

export default function Escanear() {
  const t = useTheme();
  const [dash, setDash] = useState<Dash | null>(null);
  const [rec, setRec] = useState<Movimiento[]>([]);
  const [js, setJs] = useState<J[]>([]);
  const [q, setQ] = useState('');
  const [cam, setCam] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [perm, askPerm] = useCameraPermissions();
  const lock = useRef(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Dash>('/dashboard'), api<Movimiento[]>('/registro?limit=5'), api<J[]>('/jugadoras')]));
    if (r) { setDash(r[0]); setRec(r[1]); setJs(r[2].filter((j) => j.activa)); }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { setCam(false); lock.current = false; }; // al perder foco se desmonta la cámara
  }, [load]));

  const abrir = async () => {
    if (cam) return setCam(false);
    const p = perm?.granted ? perm : await askPerm();
    if (!p.granted) return notify('Permite la cámara en Ajustes o busca por nombre');
    lock.current = false; setCam(true);
  };
  const leido = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    if (!data.startsWith('CCF:')) { notify('Ese código no es de una jugadora'); setTimeout(() => { lock.current = false; }, 1500); return; }
    setCam(false);
    router.push({ pathname: '/ficha', params: { qr: data } });
  };

  const v = q.toLowerCase().trim();
  const hits = v ? js.filter((j) => j.nombre.toLowerCase().includes(v)).slice(0, 6) : [];

  if (!dash) return <Screen><Loading /></Screen>;
  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: Radius.m, paddingVertical: Space.m }}>
        {([[dash.total - dash.fuera, 'Dentro', false], [dash.fuera, 'Afuera', false], [dash.atrasadas, 'Atrasadas', dash.atrasadas > 0], [dash.visitas_dentro, 'Visitas', false]] as const).map(([n, l, alerta]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${n} ${l}`}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: alerta ? t.bad : t.label, fontVariant: ['tabular-nums'] }}>{n}</Text>
            <T v="caption" dim>{l}</T>
          </View>
        ))}
      </View>

      {cam ? (
        <View style={{ aspectRatio: 1, borderRadius: Radius.l, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={leido} />
        </View>
      ) : null}
      <Button title={cam ? 'Cerrar cámara' : 'Escanear QR de la jugadora'} kind={cam ? 'tinted' : 'filled'} onPress={abrir}
        icon={<Icon sf="qrcode.viewfinder" ion="qr-code" size={22} color={cam ? t.tint : t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />

      <Group header="O busca por nombre">
        <View style={{ minHeight: 48, paddingHorizontal: Space.l, justifyContent: 'center' }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Nombre de la jugadora" placeholderTextColor={t.label3} autoCorrect={false} clearButtonMode="while-editing"
            accessibilityLabel="Buscar jugadora" style={{ color: t.label, fontSize: 17, paddingVertical: 8 }} />
        </View>
        {hits.map((j) => <Row key={j.id} title={j.nombre} subtitle={j.habitacion ? `Hab. ${j.habitacion}` : undefined} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(j.id) } })} />)}
      </Group>
      {v && !hits.length ? <T v="sub" dim style={{ textAlign: 'center' }}>Sin resultados</T> : null}

      <T v="title">Últimos registros</T>
      {rec.length ? <Group>{rec.map((m, i) => <MovRow key={i} m={m} />)}</Group> : <Empty sf="tray" ion="file-tray-outline" title="Aún no hay movimientos hoy" />}
    </Screen>
  );
}
