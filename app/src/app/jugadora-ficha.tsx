// Ficha de jugadora (Coordinación): emergencia, personas que pueden recogerla, disponibilidad, datos y QR.
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Share, View } from 'react-native';

import { SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Avatar, Badge, Button, Empty, Group, Icon, Loading, Row, Segmented, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, qrUrl } from '@/lib/api';
import { nivelDe } from '@/lib/categorias';
import { confirmar, DISP, dispDe, noDisp, recogenBus, telUrl, type Disp, type Jugadora } from '@/features/coord/util';

type Recoge = { id: number; nombre: string; parentesco?: string; telefono?: string; documento?: string };

export default function Ficha() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [j, setJ] = useState<Jugadora | null>(null);
  const [estado, setEstado] = useState<'carga' | 'ok' | 'error'>('carga');
  const [telMedico, setTelMedico] = useState('');
  const [rec, setRec] = useState<Recoge[]>([]);
  const [disp, setDisp] = useState<Disp>('disponible');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Jugadora[]>('/jugadoras'), api<{ tel_medico?: string }>('/config').catch(() => ({} as { tel_medico?: string })), api<Recoge[]>(`/jugadoras/${id}/recogen`).catch(() => [] as Recoge[])]));
    if (!r) { setEstado((e) => (e === 'carga' ? 'error' : e)); return; }
    const x = r[0].find((y) => y.id === +id) ?? null;
    setJ(x); setTelMedico(r[1].tel_medico ?? ''); setRec(r[2]);
    if (x) { setDisp(dispDe(x)); setNota(x.disp_nota ?? ''); }
    setEstado('ok');
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { recogenBus.add(load); return () => { recogenBus.delete(load); }; }, [load]);

  const llamar = (n: string) => { void Linking.openURL(telUrl(n)); };
  const call = (label: string, nombre?: string | null, n?: string | null) => n ? (
    <Row key={label} title={label} subtitle={nombre || undefined} minHeight={56} leading={<Icon sf="phone.fill" ion="call" color={t.ok} />}
      trailing={<T v="sub" color={t.tint} style={{ fontWeight: '600' }}>{n}</T>} onPress={() => llamar(n)} />
  ) : null;

  const guardarDisp = async () => {
    if (!j) return;
    setBusy(true);
    const r = await run(() => api(`/jugadoras/${j.id}`, 'PATCH', { disponibilidad: disp === 'disponible' ? '' : disp, disp_nota: disp === 'disponible' ? '' : nota }));
    setBusy(false);
    if (r) { notify('Disponibilidad actualizada'); await load(); }
  };
  const quitarRec = async (r: Recoge) => {
    if (!(await confirmar('Quitar persona autorizada', `${r.nombre} ya no podrá recoger a ${j?.nombre.split(' ')[0] ?? 'la jugadora'}.`, 'Quitar'))) return;
    const ok = await run(() => api(`/recogen/${r.id}`, 'DELETE'));
    if (ok) { notify('Persona quitada'); await load(); }
  };

  const compartir = () => {
    if (!j) return;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<title>QR ${j.nombre}</title><body style="font-family:sans-serif;text-align:center"><h2>${j.nombre.replace(/</g, '&lt;')}</h2><img src="${qrUrl(j.qr)}" width="260" onload="print()">`);
      w.document.close();
    } else void Share.share({ message: `Pase de acceso de ${j.nombre}`, url: qrUrl(j.qr) });
  };

  if (estado === 'carga') return <SheetScreen title="Ficha"><Loading /></SheetScreen>;
  if (estado === 'error' || !j) return <SheetScreen title="Ficha"><Empty sf="person.crop.circle.badge.exclamationmark" ion="alert-circle-outline" title={estado === 'error' ? 'No se pudo cargar' : 'La jugadora no existe'} text={estado === 'error' ? 'Revisa tu conexión e inténtalo de nuevo.' : undefined} /></SheetScreen>;

  const cambio = disp !== dispDe(j) || (disp !== 'disponible' && nota !== (j.disp_nota ?? ''));

  return (
    <SheetScreen title="Ficha">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.m }}>
        <Avatar name={j.nombre} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title">{j.nombre}</T>
          <T v="sub" dim>{j.categoria ? `${j.categoria} · ${nivelDe(j.categoria)}` : 'Sin categoría'}{j.habitacion ? ` · Hab. ${j.habitacion}` : ''}</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge text={j.menor ? 'Menor de edad' : 'Mayor de edad'} tone={j.menor ? 'gold' : 'neutral'} />
            {noDisp(j) ? <Badge text={DISP[dispDe(j)]} tone="warn" /> : null}
            {!j.activa ? <Badge text="Inactiva" tone="bad" /> : null}
          </View>
        </View>
      </View>

      {/* Emergencia */}
      <View style={{ gap: Space.s }}>
        <T v="title">Emergencia</T>
        {j.alergias ? (
          <View style={{ backgroundColor: t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: 2 }}>
            <T v="caption" color={t.bad} style={{ fontWeight: '700', textTransform: 'uppercase' }}>Alergias</T>
            <T v="headline" color={t.bad}>{j.alergias}</T>
          </View>
        ) : null}
        <Group>
          <Row minHeight={48} title="Tipo de sangre" trailing={<T v="headline">{j.sangre || 'Sin registrar'}</T>} />
          <Row minHeight={48} title="Seguro médico" trailing={<T v="sub" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{j.seguro || 'Sin registrar'}</T>} />
          {!j.alergias ? <Row minHeight={48} title="Alergias" trailing={<T v="sub" dim>Ninguna registrada</T>} /> : null}
          {j.notas_medicas ? <Row minHeight={48} title="Notas médicas" subtitle={j.notas_medicas} /> : null}
        </Group>
        <Group header="Llamar">
          {[call('Tutor', j.tutor_nombre, j.tutor_tel), call('Emergencia', j.emergencia_nombre, j.emergencia_tel), call('Médico del club', null, telMedico), call('La jugadora', null, j.telefono)].filter(Boolean)}
        </Group>
        {!j.tutor_tel && !j.emergencia_tel ? <T v="sub" color={t.bad}>No hay teléfono de tutor ni de emergencia. Agrégalo en Editar datos.</T> : null}
      </View>

      {/* Quién puede recogerla */}
      <View style={{ gap: Space.s }}>
        <T v="title">Pueden recogerla</T>
        {rec.length ? (
          <Group>
            {rec.map((r) => (
              <Row key={r.id} minHeight={60} title={r.nombre}
                subtitle={[r.parentesco, r.documento ? `Doc. ${r.documento}` : '', r.telefono].filter(Boolean).join(' · ') || undefined}
                trailing={<Pressable onPress={() => { void quitarRec(r); }} accessibilityRole="button" accessibilityLabel={`Quitar a ${r.nombre}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Icon sf="trash" ion="trash-outline" color={t.bad} /></Pressable>} />
            ))}
          </Group>
        ) : <T v="sub" dim>Nadie registrado todavía. Seguridad no sabrá a quién entregarla.</T>}
        <Button kind="tinted" title="Agregar persona autorizada" icon={<Icon sf="person.badge.plus" ion="person-add" size={20} />} onPress={() => router.push({ pathname: '/jugadora-recogen-nueva', params: { id: String(j.id) } })} />
      </View>

      {/* Disponibilidad */}
      <View style={{ gap: Space.s }}>
        <T v="title">Disponibilidad</T>
        <Segmented options={[['disponible', 'Disponible'], ['recuperacion', 'Recuperación'], ['descanso', 'Descanso']] as const} value={disp} onChange={setDisp} />
        {disp !== 'disponible' ? <Group footer="Aparece al convocarla a un viaje."><TextField label="Nota (lesión, motivo, hasta cuándo)" value={nota} onChangeText={setNota} multiline /></Group> : null}
        {cambio ? <Button title="Guardar disponibilidad" loading={busy} onPress={guardarDisp} /> : null}
      </View>

      <Group header="Datos">
        <Row minHeight={48} title="Categoría" trailing={<T v="sub">{j.categoria || 'Sin asignar'}</T>} />
        <Row minHeight={48} title="Nivel" trailing={<T v="sub">{nivelDe(j.categoria) || '—'}</T>} />
        <Row minHeight={48} title="Clave" trailing={<T v="sub">{j.clave}</T>} />
        <Row minHeight={48} title="Nacimiento" trailing={<T v="sub">{j.nacimiento}</T>} />
      </Group>

      <View style={{ alignItems: 'center', gap: Space.s }}>
        <View style={{ backgroundColor: '#fff', padding: Space.m, borderRadius: 14 }}>
          <Image source={{ uri: qrUrl(j.qr) }} style={{ width: 180, height: 180 }} contentFit="contain" accessibilityLabel={`QR de ${j.nombre}`} />
        </View>
        <T v="caption" dim>Pase de acceso</T>
      </View>
      <Button title="Editar datos" onPress={() => router.replace({ pathname: '/jugadora-form', params: { id: String(j.id) } })} />
      <Button kind="tinted" title={Platform.OS === 'web' ? 'Imprimir QR' : 'Compartir QR'} icon={<Icon sf="square.and.arrow.up" ion="share-outline" size={20} />} onPress={compartir} />
    </SheetScreen>
  );
}
