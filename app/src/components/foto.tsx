// Foto: tomar con la cámara o elegir de la galería, reducir en el teléfono (≈150 KB) y subirla. Devuelve {id, url}.
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { notify } from '@/components/notify';
import { Button, Icon, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, fotoSrc } from '@/lib/api';

export type FotoSubida = { id: number; url: string };

export async function subirFoto(uri: string): Promise<FotoSubida> {
  const r = await manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return api<FotoSubida>('/fotos', 'POST', { data: `data:image/jpeg;base64,${r.base64}` });
}

/** Campo de foto para formularios. `value` es la foto ya subida (o null). */
export function FotoField({ value, onChange, label = 'Foto' }: { value: FotoSubida | null; onChange: (f: FotoSubida | null) => void; label?: string }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const elegir = async (camara: boolean) => {
    try {
      setBusy(true);
      if (camara && Platform.OS !== 'web') { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { notify('Activa el permiso de la cámara en Ajustes'); return; } }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
      const r = camara ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets[0]) return;
      onChange(await subirFoto(r.assets[0].uri));
    } catch (e) { notify(e instanceof Error ? e.message : 'No se pudo subir la foto'); } finally { setBusy(false); }
  };
  return (
    <View style={{ padding: Space.l, gap: Space.m, backgroundColor: t.surface }}>
      <T v="caption" dim>{label}</T>
      {value ? <Image source={fotoSrc(value.url)} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.m, backgroundColor: t.fill }} contentFit="cover" accessibilityLabel="Foto adjunta" /> : null}
      <View style={{ flexDirection: 'row', gap: Space.s }}>
        <View style={{ flex: 1 }}><Button title={value ? 'Cambiar foto' : 'Tomar foto'} kind="tinted" small loading={busy} onPress={() => elegir(true)} icon={<Icon sf="camera" ion="camera-outline" size={18} />} /></View>
        {Platform.OS !== 'web' ? <View style={{ flex: 1 }}><Button title="Galería" kind="tinted" small onPress={() => elegir(false)} /></View> : null}
        {value ? <Button title="Quitar" kind="tinted" small onPress={() => onChange(null)} /> : null}
      </View>
    </View>
  );
}

/** Miniatura/vista de una foto ya guardada (url firmada que da el servidor). */
export function Foto({ url, ratio = 4 / 3, radius = Radius.m }: { url?: string | null; ratio?: number; radius?: number }) {
  const t = useTheme();
  if (!url) return null;
  return <Image source={fotoSrc(url)} style={{ width: '100%', aspectRatio: ratio, borderRadius: radius, backgroundColor: t.fill }} contentFit="cover" accessibilityLabel="Foto" />;
}
