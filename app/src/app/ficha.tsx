// Hoja de Seguridad: veredicto de una jugadora (por QR o por id) y registro de salida / regreso.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { run } from '@/components/notify';
import { Button, Empty, Group, Icon, Loading, Row, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { dt, hm, mins, useCfg, type Permiso, type Situacion } from '@/features/seguridad/util';

export default function Ficha() {
  const t = useTheme();
  const { id, qr } = useLocalSearchParams<{ id?: string; qr?: string }>();
  const cfg = useCfg();
  const [r, setR] = useState<Situacion | null>(null);
  const [err, setErr] = useState('');
  const [hecho, setHecho] = useState<{ tipo: 'salida' | 'regreso'; wa: string | null; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try { setR(await api<Situacion>(qr ? `/scan/${encodeURIComponent(qr)}` : `/jugadoras/${id}/situacion`)); setErr(''); setNow(Date.now()); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo consultar'); }
  }, [id, qr]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const mov = async (tipo: 'salida' | 'regreso') => {
    if (!r || busy) return;
    setBusy(true);
    const res = await run(() => api<{ whatsapp: string | null }>('/mov', 'POST', { jugadora_id: r.id, tipo }));
    setBusy(false);
    if (res) setHecho({ tipo, wa: res.whatsapp, at: Date.now() });
    else await load(); // el estado pudo cambiar: vuelve a consultar
  };

  if (err) return <SheetScreen title="Jugadora"><Empty sf="exclamationmark.triangle" ion="warning-outline" title="No se pudo abrir" text={err} /><Button title="Reintentar" kind="tinted" onPress={load} /></SheetScreen>;
  if (!r) return <SheetScreen title="Jugadora"><Loading /></SheetScreen>;

  if (hecho) {
    return (
      <SheetScreen title={r.nombre}>
        <Panel tone="ok" sf="checkmark.circle.fill" ion="checkmark-circle" title={hecho.tipo === 'salida' ? 'Salida registrada' : 'Regreso registrado'} sub={hm(hecho.at)} />
        {hecho.wa ? <Button title="Avisar al tutor por WhatsApp" kind="tinted" onPress={() => Linking.openURL(hecho.wa!)} /> : <T v="sub" dim style={{ textAlign: 'center' }}>Sin teléfono de tutor registrado.</T>}
        <Button title="Listo" onPress={() => router.back()} />
      </SheetScreen>
    );
  }

  const p = r.permiso, e = r.emergencia ?? {};
  const tarde = r.estado === 'fuera' && p ? p.regreso_at < now : false;
  const datos = (x: Permiso) => (
    <Group>
      <Row minHeight={44} title="Destino" trailing={<V>{x.destino}</V>} />
      {x.ubicacion ? <Row minHeight={44} title="Lugar" trailing={<V>{x.ubicacion}</V>} /> : null}
      <Row minHeight={44} title="Acompañante" trailing={<V>{x.acompanante}</V>} />
      <Row minHeight={44} title="Regreso" trailing={<V>{dt(x.regreso_at)}</V>} />
    </Group>
  );

  return (
    <SheetScreen title={r.nombre}>
      {r.estado === 'autorizada' && p ? (
        <>
          <Panel tone="ok" sf="checkmark.circle.fill" ion="checkmark-circle" title="Puede salir" sub={p.metodo_auth === 'emergencia' ? 'Salida de emergencia' : undefined} />
          {datos(p)}
          <Button title="Registrar salida" loading={busy} onPress={() => mov('salida')} />
        </>
      ) : r.estado === 'fuera' && p ? (
        <>
          <Panel tone={tarde ? 'bad' : 'warn'} sf={tarde ? 'exclamationmark.triangle.fill' : 'clock.fill'} ion={tarde ? 'warning' : 'time'} title={tarde ? 'Regreso tarde' : 'Está afuera'} sub={tarde ? `${mins(now - p.regreso_at)} de retraso` : undefined} />
          {datos(p)}
          <Button title="Registrar regreso" loading={busy} onPress={() => mov('regreso')} />
        </>
      ) : (
        <>
          <Panel tone="bad" sf="xmark.circle.fill" ion="close-circle" title="No puede salir" sub="Sin permiso autorizado vigente" />
          {r.proximo ? <Group header="Su próximo permiso"><Row minHeight={44} title={r.proximo.destino} subtitle={dt(r.proximo.salida_at)} /></Group> : null}
          <Group>
            {cfg.tel_coordinacion ? <Row title="Llamar a Coordinación" leading={<Icon sf="phone.fill" ion="call" />} onPress={() => Linking.openURL(`tel:${cfg.tel_coordinacion}`)} /> : null}
            <Row title="Reportar intento de salida" leading={<Icon sf="exclamationmark.bubble" ion="chatbox-ellipses-outline" />} chevron
              onPress={() => router.push({ pathname: '/incidencia-nueva', params: { jid: String(r.id), tipo: 'intento_salida' } })} />
          </Group>
        </>
      )}

      <Group header="Ficha de emergencia">
        <Row minHeight={44} title="Habitación" trailing={<V>{r.habitacion || '—'}</V>} />
        <Row minHeight={44} title="Contacto" trailing={<V>{e.nombre || '—'}</V>} />
        {e.tel ? <Row minHeight={44} title="Teléfono" trailing={<T v="sub" color={t.tint} style={{ fontWeight: '600' }}>{e.tel}</T>} onPress={() => Linking.openURL(`tel:${e.tel}`)} /> : null}
        <Row minHeight={44} title="Alergias" trailing={<V>{e.alergias || 'ninguna registrada'}</V>} />
      </Group>
    </SheetScreen>
  );
}

const V = ({ children }: { children: string }) => <T v="sub" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{children}</T>;

function Panel({ tone, sf, ion, title, sub }: { tone: 'ok' | 'warn' | 'bad'; sf: string; ion: React.ComponentProps<typeof Icon>['ion']; title: string; sub?: string }) {
  const t = useTheme();
  const c = t[tone];
  return (
    <View accessibilityRole="header" style={{ backgroundColor: t[`${tone}Weak`], borderRadius: Radius.m, padding: Space.l, alignItems: 'center', gap: 6 }}>
      <Icon sf={sf} ion={ion} size={40} color={c} />
      <T v="title" color={c}>{title}</T>
      {sub ? <T v="sub" color={c}>{sub}</T> : null}
    </View>
  );
}
