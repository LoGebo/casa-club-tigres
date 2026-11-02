// Hoja de Seguridad: veredicto de una jugadora (por QR o por id), ficha de emergencia, personas que pueden recogerla
// y registro de salida / regreso (con cola sin conexión).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { ChipOffline, dt, hm, mins, useCfg } from '@/features/seguridad/util';
import { edadMin, registrarLocal, resolver, usePaquete, waTutor, type Ficha as F, type PermisoPk, type Recoge } from '@/features/seguridad/offline';
import { useTheme } from '@/hooks/use-theme';
import { enviarOCola } from '@/lib/cola';

const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SOLA = /^(|sola|ella|ninguno|ninguna|n\/a|no|-|—)$/;
const coincide = (acomp: string, r: Recoge) => { const a = norm(acomp), n = norm(r.nombre); return !!a && !!n && (n.includes(a) || a.includes(n) || norm(r.parentesco) === a); };

export default function Ficha() {
  const { id, qr } = useLocalSearchParams<{ id?: string; qr?: string }>();
  const t = useTheme();
  const cfg = useCfg();
  const { pack } = usePaquete();
  const [f, setF] = useState<F | null>(null);
  const [err, setErr] = useState('');
  const [hecho, setHecho] = useState<{ tipo: 'salida' | 'regreso'; cola: boolean; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await resolver({ qr, id });
      if (!r) setErr('Sin conexión y sin datos guardados. Conéctate una vez para descargarlos.'); else { setF(r); setErr(''); setNow(Date.now()); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo consultar'); }
  }, [id, qr]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const mov = async (tipo: 'salida' | 'regreso') => {
    if (!f || busy) return;
    setBusy(true);
    try {
      const r = await enviarOCola('/mov', { jugadora_id: f.id, tipo }, `${tipo === 'salida' ? 'Salida' : 'Regreso'} · ${f.nombre}`);
      await registrarLocal(f.id, tipo);
      setHecho({ tipo, cola: r === 'en_cola', at: Date.now() });
    } catch (e) { notify(e instanceof Error ? e.message : 'Algo salió mal'); await load(); }
    setBusy(false);
  };

  if (err) return <SheetScreen title="Jugadora"><Empty sf="exclamationmark.triangle" ion="warning-outline" title="No se pudo abrir" text={err} /><Button title="Reintentar" kind="tinted" onPress={load} /></SheetScreen>;
  if (!f) return <SheetScreen title="Jugadora"><Loading /></SheetScreen>;

  const p = f.permiso, e = f.emergencia ?? {};

  if (hecho) {
    return (
      <SheetScreen title={f.nombre}>
        <Panel tone="ok" sf="checkmark.circle.fill" ion="checkmark-circle" title={hecho.tipo === 'salida' ? 'Salida registrada' : 'Regreso registrado'} sub={hm(hecho.at)} />
        {hecho.cola ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.warnWeak, borderRadius: Radius.m, padding: Space.m }}>
            <Icon sf="clock.arrow.circlepath" ion="time-outline" size={20} color={t.warn} />
            <T v="sub" color={t.warn} style={{ fontWeight: '600', flex: 1 }}>Guardado, se enviará al volver la señal</T>
          </View>
        ) : null}
        {e.tutor_tel ? <Button title="Avisar al tutor por WhatsApp" kind="tinted" onPress={() => {
          const l = waTutor(e.tutor_tel, hecho.tipo === 'salida'
            ? `Casa Club Femenil Tigres: ${f.nombre} salió a las ${hm(hecho.at)}${p ? ` con destino ${p.destino} (acompañante: ${p.acompanante}). Regreso previsto: ${hm(p.regreso_at)}` : ''}.`
            : `Casa Club Femenil Tigres: ${f.nombre} regresó a las ${hm(hecho.at)}. ¡Todo en orden!`);
          if (l) void Linking.openURL(l);
        }} /> : <T v="sub" dim style={{ textAlign: 'center' }}>Sin teléfono de tutor registrado.</T>}
        <Button title="Listo" onPress={() => router.back()} />
      </SheetScreen>
    );
  }

  const tarde = f.estado === 'fuera' && p ? p.regreso_at < now : false;
  const datos = (x: PermisoPk) => (
    <Group>
      <Row minHeight={44} title="Destino" trailing={<V>{x.destino}</V>} />
      {x.ubicacion ? <Row minHeight={44} title="Lugar" trailing={<V>{x.ubicacion}</V>} /> : null}
      <Row minHeight={44} title="Acompañante" trailing={<V>{x.acompanante || '—'}</V>} />
      <Row minHeight={44} title="Regreso" trailing={<V>{dt(x.regreso_at)}</V>} />
    </Group>
  );

  return (
    <SheetScreen title={f.nombre}>
      {f.local ? <ChipOffline edad={edadMin(pack)} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {f.categoria ? <Badge text={f.categoria} tone="tint" /> : null}
        {f.menor ? <Badge text="Menor de edad" tone="warn" /> : null}
        {f.habitacion ? <T v="caption" dim>{`Hab. ${f.habitacion}`}</T> : null}
      </View>
      {f.estado === 'autorizada' && p ? (
        <>
          <Panel tone="ok" sf="checkmark.circle.fill" ion="checkmark-circle" title="Puede salir" sub={p.metodo_auth === 'emergencia' ? 'Salida de emergencia' : undefined} />
          <Verifica acomp={p.acompanante} recogen={f.recogen} tutor={e.tutor_nombre} />
          {datos(p)}
          <Button title="Registrar salida" loading={busy} onPress={() => mov('salida')} />
        </>
      ) : f.estado === 'fuera' && p ? (
        <>
          <Panel tone={tarde ? 'bad' : 'warn'} sf={tarde ? 'exclamationmark.triangle.fill' : 'clock.fill'} ion={tarde ? 'warning' : 'time'} title={tarde ? 'Regresa tarde' : 'Está afuera'} sub={tarde ? `${mins(now - p.regreso_at)} de retraso` : `Debe volver a las ${hm(p.regreso_at)}`} />
          {datos(p)}
          <Button title="Registrar regreso" loading={busy} onPress={() => mov('regreso')} />
        </>
      ) : (
        <>
          <Panel tone="bad" sf="xmark.circle.fill" ion="close-circle" title="NO puede salir" sub={f.menor ? 'Sin permiso autorizado. Es menor: necesita la autorización del tutor.' : 'Sin permiso autorizado vigente'} />
          {f.proximo ? <Group header="Su próximo permiso"><Row minHeight={44} title={f.proximo.destino} subtitle={dt(f.proximo.salida_at)} /></Group> : null}
          <Group>
            {cfg.tel_coordinacion ? <Row title="Llamar a Coordinación" leading={<Icon sf="phone.fill" ion="call" />} onPress={() => Linking.openURL(`tel:${cfg.tel_coordinacion}`)} /> : null}
            <Row title="Reportar intento de salida" leading={<Icon sf="exclamationmark.bubble" ion="chatbox-ellipses-outline" />} chevron
              onPress={() => router.push({ pathname: '/incidencia-nueva', params: { jid: String(f.id), tipo: 'intento_salida' } })} />
          </Group>
        </>
      )}

      {e.alergias ? (
        <View accessibilityRole="alert" style={{ backgroundColor: t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: 2 }}>
          <T v="caption" color={t.bad} style={{ fontWeight: '700', textTransform: 'uppercase' }}>Alergias</T>
          <T v="headline" color={t.bad}>{e.alergias}</T>
        </View>
      ) : null}

      <Group header="Pueden recogerla" footer={f.recogen.length ? 'Pide identificación a quien venga por ella.' : undefined}>
        {f.recogen.length ? f.recogen.map((r, i) => (
          <Row key={r.id ?? i} minHeight={60} title={r.nombre}
            subtitle={[r.parentesco, r.documento ? `Doc. ${r.documento}` : ''].filter(Boolean).join(' · ') || undefined}
            trailing={r.telefono ? <Llamar tel={r.telefono} label={`Llamar a ${r.nombre}`} /> : undefined} />
        )) : <Row minHeight={52} title={<T v="sub" dim>Nadie registrado. Solo sale con permiso y su acompañante.</T>} />}
      </Group>

      <Group header="Ficha de emergencia">
        <Row minHeight={44} title="Categoría" trailing={<V>{f.categoria || '—'}</V>} />
        <Row minHeight={44} title="Tipo de sangre" trailing={<V>{e.sangre || 'sin registrar'}</V>} />
        <Row minHeight={44} title="Alergias" trailing={<V>{e.alergias || 'ninguna registrada'}</V>} />
        <Row minHeight={44} title="Seguro médico" trailing={<V>{e.seguro || 'sin registrar'}</V>} />
        {e.tutor_tel ? <Contacto titulo={`Tutor${e.tutor_nombre ? ` · ${e.tutor_nombre}` : ''}`} tel={e.tutor_tel} /> : null}
        {e.tel && e.tel !== e.tutor_tel ? <Contacto titulo={`Emergencia${e.nombre ? ` · ${e.nombre}` : ''}`} tel={e.tel} /> : null}
        {e.tel_medico ? <Contacto titulo="Médico del club" tel={e.tel_medico} /> : null}
        {!e.tutor_tel && !e.tel ? <Row minHeight={44} title="Contacto" trailing={<V>sin registrar</V>} /> : null}
      </Group>
    </SheetScreen>
  );
}

/** «Verifica identificación» cuando la acompaña otra persona */
function Verifica({ acomp, recogen, tutor }: { acomp: string; recogen: Recoge[]; tutor?: string }) {
  const t = useTheme();
  if (SOLA.test(norm(acomp))) return null;
  const r = recogen.find((x) => coincide(acomp, x));
  const esTutor = !!tutor && coincide(acomp, { nombre: tutor });
  const ok = !!r || esTutor;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: ok ? t.warnWeak : t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon sf="person.text.rectangle.fill" ion="id-card" size={22} color={ok ? t.warn : t.bad} />
        <T v="headline" color={ok ? t.warn : t.bad}>Verifica identificación</T>
      </View>
      <T v="body" style={{ fontWeight: '600' }}>{`Sale con ${acomp}`}</T>
      <T v="sub" color={ok ? t.ok : t.bad} style={{ fontWeight: '600' }}>
        {r ? `En la lista de autorizadas${r.parentesco ? ` (${r.parentesco})` : ''}${r.documento ? ` · Doc. ${r.documento}` : ''}` : esTutor ? 'Es su tutor registrado' : 'No aparece en la lista de personas autorizadas'}
      </T>
    </View>
  );
}

const V = ({ children }: { children: string }) => <T v="sub" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{children}</T>;

function Llamar({ tel, label }: { tel: string; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => Linking.openURL(`tel:${tel}`)} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={{ minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: t.tintWeak, alignItems: 'center', justifyContent: 'center' }}>
      <Icon sf="phone.fill" ion="call" size={20} />
    </Pressable>
  );
}
const Contacto = ({ titulo, tel }: { titulo: string; tel: string }) => (
  <Row minHeight={56} title={titulo} subtitle={tel} trailing={<Llamar tel={tel} label={`Llamar: ${titulo}`} />} onPress={() => Linking.openURL(`tel:${tel}`)} />
);

function Panel({ tone, sf, ion, title, sub }: { tone: 'ok' | 'warn' | 'bad'; sf: string; ion: React.ComponentProps<typeof Icon>['ion']; title: string; sub?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="header" accessibilityLabel={`${title}. ${sub ?? ''}`} style={{ backgroundColor: t[tone], borderRadius: Radius.l, paddingVertical: Space.xl, paddingHorizontal: Space.l, alignItems: 'center', gap: 6 }}>
      <Icon sf={sf} ion={ion} size={56} color={t.surface} />
      <Text style={{ color: t.surface, fontSize: 34, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      {sub ? <Text style={{ color: t.surface, fontSize: 17, fontWeight: '500', textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}
