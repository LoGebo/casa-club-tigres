// Botón flotante «Reportar error»: toma captura de la pantalla (web) o deja adjuntar una foto, pide la descripción y lo manda a la tabla de seguimiento de Coordinación.
import { usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { FotoField, subirFoto, type FotoSubida } from '@/components/foto';
import { notify, run } from '@/components/notify';
import { Button, Icon, Segmented, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

const VERSION = 'web-2026-11';

async function capturar(): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const c = await html2canvas(document.body, { scale: 0.6, useCORS: true, logging: false, backgroundColor: null });
    let q = 0.6, d = c.toDataURL('image/jpeg', q);
    while (d.length > 480000 && q > 0.2) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
    return d.length <= 480000 ? d : null;
  } catch { return null; }
}

export function ReportarBug() {
  const t = useTheme();
  const ruta = usePathname();
  const [oculto, setOculto] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoSubida | null>(null);
  const [txt, setTxt] = useState('');
  const [tipo, setTipo] = useState<'falla' | 'bloqueo' | 'idea'>('falla');
  const [busy, setBusy] = useState(false);

  const abrir = async () => {
    setOculto(true); // que el botón no salga en la captura
    await new Promise((r) => setTimeout(r, 80));
    setShot(await capturar());
    setOculto(false); setFoto(null); setTxt(''); setTipo('falla'); setAbierto(true);
  };
  const enviar = async () => {
    setBusy(true);
    const r = await run(async () => {
      const f = foto ?? (shot ? await subirFoto(shot).catch(() => null) : null);
      return api('/bugs', 'POST', {
        descripcion: txt, tipo, pantalla: ruta, version: VERSION, foto_id: f?.id,
        dispositivo: Platform.OS === 'web' ? `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}` : Platform.OS,
      });
    });
    setBusy(false);
    if (r) { notify('¡Gracias! Reporte enviado'); setAbierto(false); }
  };

  return (
    <>
      {!oculto && !abierto ? (
        <Pressable onPress={abrir} accessibilityRole="button" accessibilityLabel="Reportar un error"
          style={{ position: 'absolute', right: 12, bottom: 104, width: 44, height: 44, borderRadius: 22, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center', opacity: 0.9, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6, zIndex: 999 }}>
          <Icon sf="ladybug.fill" ion="bug" size={22} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />
        </Pressable>
      ) : null}
      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Space.l, gap: Space.m, paddingTop: 48, paddingBottom: 60, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="title">Reportar un error</T>
              <Pressable onPress={() => setAbierto(false)} hitSlop={10} accessibilityLabel="Cerrar"><T v="body" color={t.tint}>Cerrar</T></Pressable>
            </View>
            <T v="sub" dim>Cuéntanos qué pasó. Guardamos la pantalla donde estabas para poder corregirlo.</T>
            <Segmented options={[['falla', 'Algo falló'], ['bloqueo', 'No puedo seguir'], ['idea', 'Idea']] as const} value={tipo} onChange={setTipo} />
            <TextInput value={txt} onChangeText={setTxt} multiline placeholder="Ej.: Al escanear el QR sale error / no me deja poner mi fecha" placeholderTextColor={t.label3} accessibilityLabel="Descripción"
              style={{ backgroundColor: t.surface, color: t.label, borderRadius: Radius.m, padding: Space.m, minHeight: 120, fontSize: 16, textAlignVertical: 'top' }} />
            {!foto && shot ? (
              <View style={{ gap: 6 }}>
                <T v="caption" dim>Captura automática de tu pantalla</T>
                <Image source={{ uri: shot }} style={{ width: '100%', aspectRatio: 0.55, maxHeight: 320, borderRadius: Radius.m, backgroundColor: t.fill }} contentFit="contain" />
                <Button title="Quitar captura" kind="tinted" small onPress={() => setShot(null)} />
              </View>
            ) : null}
            <FotoField value={foto} onChange={setFoto} label={shot || foto ? 'Adjuntar otra foto (opcional)' : 'Adjuntar captura o foto (opcional)'} />
            <Button title="Enviar reporte" loading={busy} disabled={txt.trim().length < 5} onPress={enviar} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
