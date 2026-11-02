// Página pública para mamá, papá o tutor: autoriza o rechaza la salida de la jugadora (enlace + código de 4 dígitos).
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { TextField } from '@/components/form';
import { Button, Group, Loading, Row, T } from '@/components/ui';
import { brand, MaxWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Info = { jugadora: string; destino: string; acompanante: string; ubicacion?: string; motivo?: string; salida_at: number; regreso_at: number; estado: string; decision?: string | null; tutor?: string; tipo: string; requiere_codigo: boolean; viaje: boolean };
const cuando = (ms: number) => new Date(ms).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export default function Tutor() {
  const t = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [i, setI] = useState<Info | null>(null);
  const [err, setErr] = useState('');
  const [codigo, setCodigo] = useState('');
  const [fin, setFin] = useState<'aprobar' | 'rechazar' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Info>(`/p/${token}`).then(setI).catch((e) => setErr(e instanceof Error ? e.message : 'Enlace no válido')); }, [token]);

  const responder = async (decision: 'aprobar' | 'rechazar') => {
    setBusy(true); setErr('');
    try { await api(`/p/${token}`, 'POST', { decision, codigo }); setFin(decision); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo enviar'); } finally { setBusy(false); }
  };

  const cuerpo = () => {
    if (err && !i) return <T v="body" color={t.bad}>{err}</T>;
    if (!i) return <Loading />;
    if (fin) return (
      <View style={{ gap: Space.m, alignItems: 'center', paddingVertical: Space.xl }}>
        <T v="title">{fin === 'aprobar' ? 'Permiso autorizado' : 'Permiso rechazado'}</T>
        <T v="body" dim style={{ textAlign: 'center' }}>{fin === 'aprobar' ? `${i.jugadora} ya puede salir con este permiso.` : `${i.jugadora} no podrá salir con este permiso.`} Gracias por responder.</T>
      </View>
    );
    const abierta = i.estado === 'esperando_padres';
    return (
      <>
        <T v="body">{i.tutor ? `Hola ${i.tutor}. ` : ''}<T v="body" style={{ fontWeight: '700' }}>{i.jugadora}</T> {i.viaje ? 'fue convocada a un viaje del club y' : 'solicita un permiso y'} necesita tu autorización.</T>
        <Group>
          <Row minHeight={52} title={i.viaje ? 'Viaje' : 'Destino'} trailing={<T v="sub" style={{ maxWidth: 220, textAlign: 'right' }}>{i.destino}</T>} />
          <Row minHeight={52} title="Acompañante" trailing={<T v="sub">{i.acompanante}</T>} />
          <Row minHeight={52} title="Salida" trailing={<T v="sub">{cuando(i.salida_at)}</T>} />
          <Row minHeight={52} title="Regreso" trailing={<T v="sub">{cuando(i.regreso_at)}</T>} />
          {i.motivo ? <Row minHeight={52} title="Motivo" subtitle={i.motivo} /> : null}
        </Group>
        {!abierta ? (
          <T v="body" dim>{i.estado === 'autorizado' ? 'Ya autorizaste este permiso.' : i.estado === 'rechazado' ? 'Este permiso fue rechazado.' : 'Esta solicitud ya no admite respuesta.'}</T>
        ) : (
          <>
            {i.requiere_codigo ? <Group header="Código de confirmación" footer="Te lo enviamos en un segundo mensaje de WhatsApp. Solo se pide para autorizar."><TextField label="Código de 4 dígitos" value={codigo} onChangeText={setCodigo} keyboardType="number-pad" /></Group> : null}
            {err ? <T v="sub" color={t.bad} accessibilityRole="alert">{err}</T> : null}
            <Button title="Autorizar" loading={busy} disabled={i.requiere_codigo && codigo.trim().length < 4} onPress={() => responder('aprobar')} />
            <Button title="Rechazar" kind="tinted" disabled={busy} onPress={() => responder('rechazar')} />
            <T v="caption" dim style={{ textAlign: 'center' }}>Se guarda la fecha y hora de tu respuesta.</T>
          </>
        )}
      </>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: brand.navy, paddingTop: 56, paddingBottom: 24, alignItems: 'center', gap: 8, borderBottomWidth: 4, borderBottomColor: brand.gold }}>
          <Image source={require('@/assets/crests/tigres.png')} style={{ width: 72, height: 72 }} contentFit="contain" accessibilityLabel="Escudo Tigres" />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Casa Club Femenil</Text>
          <Text style={{ color: brand.gold, fontSize: 14, fontWeight: '600' }}>Autorización de salida</Text>
        </View>
        <View style={{ padding: Space.l, gap: Space.l, width: '100%', maxWidth: MaxWidth, alignSelf: 'center', paddingBottom: 48 }}>{cuerpo()}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
