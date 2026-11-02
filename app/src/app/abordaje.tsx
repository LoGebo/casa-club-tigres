// Lista de abordaje del autobús (ida / vuelta). Seguridad y Coordinación. Marcar = POST /viajes/:id/abordar vía cola sin conexión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Icon, Loading, Segmented, T, impact } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { edadMin, paquete, porQr, registrarLocal, usePaquete } from '@/features/seguridad/offline';
import { QrScanner } from '@/features/seguridad/scanner';
import { ChipOffline, dt, hm, SearchBox } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { enviarOCola, pendientes, useCola } from '@/lib/cola';

type Fila = { id: number; nombre: string; categoria?: string; permiso: string | null; ida_at: number | string | null; vuelta_at: number | string | null };
type Data = { viaje: { id: number; titulo: string; destino?: string; salida_at: number }; jugadoras: Fila[]; total: number };
type Marcas = Record<string, { ida?: number; vuelta?: number }>;
type Tipo = 'salida' | 'regreso';

const ahora = () => Date.now();
const num = (x: number | string | null | undefined) => (x == null ? 0 : Number(x));

export default function Abordaje() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { online } = useCola();
  const { pack } = usePaquete();
  const [d, setD] = useState<Data | null>(null);
  const [marcas, setMarcas] = useState<Marcas>({});
  const [tipo, setTipo] = useState<'ida' | 'vuelta'>('ida');
  const [q, setQ] = useState('');
  const [confirmar, setConfirmar] = useState<Fila | null>(null);
  const [fallo, setFallo] = useState(false);
  const clave = `cc-abordaje-${id}`;

  const load = useCallback(async () => {
    let m: Marcas = {};
    try { m = JSON.parse((await AsyncStorage.getItem(clave)) ?? '{}'); } catch {}
    const r = await run(() => api<Data>(`/viajes/${id}/abordaje`));
    if (!r) { setFallo(true); return; }
    // Con la cola vacía el servidor ya tiene todo: las marcas locales sobran
    if (online && (await pendientes()) === 0) { m = {}; void AsyncStorage.removeItem(clave).catch(() => {}); }
    setMarcas(m); setD(r); setFallo(false);
  }, [id, clave, online]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const ida = (f: Fila) => num(f.ida_at) || marcas[f.id]?.ida || 0;
  const vuelta = (f: Fila) => num(f.vuelta_at) || marcas[f.id]?.vuelta || 0;

  const marcar = async (f: Fila) => {
    const tp: Tipo = tipo === 'ida' ? 'salida' : 'regreso';
    setConfirmar(null);
    impact();
    const r = await run(() => enviarOCola(`/viajes/${id}/abordar`, { jugadora_id: f.id, tipo: tp }, `${tipo === 'ida' ? 'Abordó' : 'Regresó'} · ${f.nombre}`));
    if (!r) return;
    const m = { ...marcas, [f.id]: { ...marcas[f.id], [tipo === 'ida' ? 'ida' : 'vuelta']: ahora() } };
    setMarcas(m);
    await AsyncStorage.setItem(clave, JSON.stringify(m)).catch(() => {});
    await registrarLocal(f.id, tp);
    notify(r === 'en_cola' ? `${f.nombre}: guardado, se enviará al volver la señal` : tipo === 'ida' ? `${f.nombre} abordó` : `${f.nombre} regresó`);
  };

  const tocar = (f: Fila) => {
    const faltan = (d?.jugadoras ?? []).filter((x) => estado(x).accion).length;
    if (faltan === 1) setConfirmar(f); else void marcar(f);
  };

  const estado = (f: Fila): { badge: [string, 'ok' | 'bad' | 'warn' | 'neutral' | 'tint']; accion: boolean; bloqueada?: boolean } => {
    const i = ida(f), v = vuelta(f);
    if (tipo === 'vuelta') {
      if (v) return { badge: [`Regresó ${hm(v)}`, 'ok'], accion: false };
      if (i) return { badge: ['Falta subir', 'warn'], accion: true };
      return { badge: ['No ha salido', 'neutral'], accion: false };
    }
    if (i) return { badge: [`Abordó ${hm(i)}`, 'ok'], accion: false };
    if (f.permiso === 'autorizado') return { badge: ['Autorizada', 'tint'], accion: true };
    if (f.permiso === 'esperando_padres' || f.permiso === 'pendiente') return { badge: ['FALTA AUTORIZACIÓN DEL TUTOR', 'bad'], accion: false, bloqueada: true };
    return { badge: ['Sin permiso vigente', 'bad'], accion: false, bloqueada: true };
  };

  // Lectura de QR: busca a la jugadora en el paquete (funciona sin señal) o, si no, pregunta al servidor
  const porCodigo = async (qr: string) => {
    if (!d) return;
    const pk = await paquete();
    let jid = pk ? porQr(pk, qr)?.id : undefined;
    if (!jid) { const s = await run(() => api<{ id: number }>(`/scan/${encodeURIComponent(qr)}`)); jid = s?.id; }
    const f = d.jugadoras.find((x) => x.id === jid);
    if (!f) return notify('Esa jugadora no está convocada a este viaje');
    const e = estado(f);
    if (e.bloqueada) return notify(`${f.nombre}: ${e.badge[0].toLowerCase()}. NO debe abordar`);
    if (!e.accion) return notify(`${f.nombre}: ${e.badge[0].toLowerCase()}`);
    tocar(f);
  };

  if (!d) return <SheetScreen title="Abordaje">{fallo ? <Empty sf="exclamationmark.triangle" ion="warning-outline" title="No se pudo abrir" text="Revisa la conexión e intenta de nuevo." /> : <Loading />}{fallo ? <Button title="Reintentar" kind="tinted" onPress={load} /> : null}</SheetScreen>;

  const lista = d.jugadoras;
  const hechas = lista.filter((f) => (tipo === 'ida' ? ida(f) : vuelta(f))).length;
  const meta = tipo === 'ida' ? lista.length : lista.filter(ida).length;
  const bloqueadas = tipo === 'ida' ? lista.filter((f) => estado(f).bloqueada) : [];
  const v = q.toLowerCase().trim();
  const grupos = [...new Set(lista.map((f) => f.categoria || 'Sin categoría'))].sort().map((c) => [c, lista.filter((f) => (f.categoria || 'Sin categoría') === c && (!v || f.nombre.toLowerCase().includes(v)))] as const).filter(([, fs]) => fs.length);
  const completo = meta > 0 && hechas >= meta;

  return (
    <SheetScreen title={d.viaje.titulo}>
      {!online ? <ChipOffline edad={edadMin(pack)} /> : null}
      <T v="sub" dim>{`${d.viaje.destino ? `${d.viaje.destino} · ` : ''}${dt(Number(d.viaje.salida_at))}`}</T>

      <View accessible accessibilityLabel={`${hechas} de ${meta} ${tipo === 'ida' ? 'abordaron' : 'regresaron'}`} style={{ backgroundColor: completo ? t.okWeak : t.surface, borderRadius: Radius.l, padding: Space.l, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: completo ? t.ok : t.label, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{hechas}</Text>
          <T v="title" dim>{`de ${meta} ${tipo === 'ida' ? 'abordaron' : 'regresaron'}`}</T>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.fill, overflow: 'hidden' }}>
          <View style={{ width: `${meta ? Math.round((hechas / meta) * 100) : 0}%`, height: 8, backgroundColor: completo ? t.ok : t.tint }} />
        </View>
        {bloqueadas.length ? <T v="sub" color={t.bad} style={{ fontWeight: '700' }}>{`${bloqueadas.length} sin autorización: no deben abordar`}</T> : null}
      </View>

      <Segmented options={[['ida', 'Ida'], ['vuelta', 'Vuelta']] as const} value={tipo} onChange={(k) => { setTipo(k); setConfirmar(null); }} />

      {confirmar ? (
        <View accessibilityRole="alert" style={{ backgroundColor: t.surface, borderRadius: Radius.m, padding: Space.l, gap: 10 }}>
          <T v="headline">{`${confirmar.nombre} es la última`}</T>
          <T v="sub" dim>{tipo === 'ida' ? 'Al marcarla, todo el grupo queda abordo. ¿Confirmas?' : 'Al marcarla, todo el grupo queda de regreso. ¿Confirmas?'}</T>
          <Button title="Confirmar" onPress={() => marcar(confirmar)} />
          <Button title="Cancelar" kind="plain" onPress={() => setConfirmar(null)} />
        </View>
      ) : null}

      <QrScanner continuo title={tipo === 'ida' ? 'Escanear QR para subir' : 'Escanear QR para regreso'} onCode={porCodigo} />
      <SearchBox value={q} onChangeText={setQ} />

      {!lista.length ? <Empty sf="person.2.slash" ion="people-outline" title="Sin jugadoras convocadas" text="Coordinación aún no convoca a nadie a este viaje." /> : null}
      {grupos.map(([cat, fs]) => (
        <View key={cat} style={{ gap: 6 }}>
          <T v="caption" dim style={{ marginLeft: Space.l, textTransform: 'uppercase', letterSpacing: 0.3 }}>{`${cat} · ${fs.length}`}</T>
          <View style={{ backgroundColor: t.surface, borderRadius: Radius.m, overflow: 'hidden' }}>
            {fs.map((f, i) => {
              const e = estado(f);
              const hecho = e.badge[1] === 'ok';
              return (
                <Pressable key={f.id} disabled={!e.accion} onPress={() => tocar(f)} accessibilityRole="button"
                  accessibilityLabel={`${f.nombre}. ${e.badge[0]}${e.accion ? '. Toca para marcar' : ''}`}
                  style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingHorizontal: Space.l, paddingVertical: Space.m, backgroundColor: e.bloqueada ? t.badWeak : pressed ? t.fill : 'transparent', borderTopWidth: i ? 0.5 : 0, borderTopColor: t.sep })}>
                  <Icon sf={hecho ? 'checkmark.circle.fill' : e.bloqueada ? 'xmark.octagon.fill' : 'circle'} ion={hecho ? 'checkmark-circle' : e.bloqueada ? 'close-circle' : 'ellipse-outline'} size={28} color={hecho ? t.ok : e.bloqueada ? t.bad : e.accion ? t.tint : t.label3} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="headline" style={{ fontWeight: '500' }}>{f.nombre}</T>
                    <Badge text={e.badge[0]} tone={e.badge[1]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </SheetScreen>
  );
}
