// Ficha de jugadora: datos, tutor, alergias y QR (solo Coordinación).
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { run } from '@/components/notify';
import { Avatar, Badge, Button, Group, Icon, Loading, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, qrUrl } from '@/lib/api';
import { nivelDe } from '@/lib/categorias';
import { telUrl, type Jugadora } from '@/features/coord/util';

export default function Ficha() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [j, setJ] = useState<Jugadora | null>(null);
  useEffect(() => { void run(() => api<Jugadora[]>('/jugadoras')).then((r) => r && setJ(r.find((x) => x.id === +id) ?? null)); }, [id]);

  const tel = (label: string, nombre?: string, n?: string) => n ? (
    <Row title={label} subtitle={nombre} minHeight={52} trailing={<T v="sub" color={t.tint} style={{ fontWeight: '600' }}>{n}</T>} onPress={() => { void Linking.openURL(telUrl(n)); }} />
  ) : null;

  const compartir = () => {
    if (!j) return;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<title>QR ${j.nombre}</title><body style="font-family:sans-serif;text-align:center"><h2>${j.nombre.replace(/</g, '&lt;')}</h2><img src="${qrUrl(j.qr)}" width="260" onload="print()">`);
      w.document.close();
    } else void Share.share({ message: `Pase de acceso de ${j.nombre}`, url: qrUrl(j.qr) });
  };

  return (
    <SheetScreen title="Ficha">
      {!j ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.m }}>
            <Avatar name={j.nombre} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="title">{j.nombre}</T>
              <T v="sub" dim>{j.menor ? 'Menor de edad' : 'Mayor de edad'}{j.habitacion ? ` · Hab. ${j.habitacion}` : ''}</T>
              {!j.activa ? <Badge text="Inactiva" tone="bad" /> : null}
            </View>
          </View>
          <Group header="Datos">
            <Row minHeight={48} title="Categoría" trailing={<T v="sub">{j.categoria ? `${j.categoria} · ${nivelDe(j.categoria)}` : 'Sin asignar'}</T>} />
            <Row minHeight={48} title="Clave" trailing={<T v="sub">{j.clave}</T>} />
            <Row minHeight={48} title="Nacimiento" trailing={<T v="sub">{j.nacimiento}</T>} />
            {j.alergias ? <Row minHeight={48} title="Alergias" subtitle={j.alergias} /> : null}
            {j.notas_medicas ? <Row minHeight={48} title="Notas médicas" subtitle={j.notas_medicas} /> : null}
          </Group>
          <Group header="Contactos">
            {tel('Tutor', j.tutor_nombre || undefined, j.tutor_tel) ?? <Row minHeight={48} title="Tutor" subtitle={j.tutor_nombre || 'Sin teléfono registrado'} />}
            {tel('Emergencia', j.emergencia_nombre || undefined, j.emergencia_tel)}
          </Group>
          <View style={{ alignItems: 'center', gap: Space.s }}>
            <View style={{ backgroundColor: '#fff', padding: Space.m, borderRadius: 14 }}>
              <Image source={{ uri: qrUrl(j.qr) }} style={{ width: 180, height: 180 }} contentFit="contain" accessibilityLabel={`QR de ${j.nombre}`} />
            </View>
            <T v="caption" dim>Pase de acceso</T>
          </View>
          <Button title="Editar datos" onPress={() => router.replace({ pathname: '/jugadora-form', params: { id: String(j.id) } })} />
          <Button kind="tinted" title={Platform.OS === 'web' ? 'Imprimir QR' : 'Compartir QR'} icon={<Icon sf="square.and.arrow.up" ion="share-outline" size={20} />} onPress={compartir} />
        </>
      )}
    </SheetScreen>
  );
}
