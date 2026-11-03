// Botón + cámara para leer el QR de la jugadora. Lo usan Escanear y Abordaje.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { notify } from '@/components/notify';
import { Button, Icon, T } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// En web el lector de QR (WASM) se sirve desde nuestro propio servidor: no depende de un CDN y funciona sin conexión.
if (Platform.OS === 'web') {
  void fetch('/zxing_reader.wasm').catch(() => {}); // precarga: queda en caché para leer QR aunque se caiga el internet
  void import('barcode-detector').then(({ setZXingModuleOverrides }) =>
    setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path) }));
}

/** onCode recibe el texto «CCF:…» (jugadora) o «CCP:…» (permiso). Con `continuo` la cámara sigue abierta tras cada lectura (abordaje). */
export function QrScanner({ onCode, title = 'Escanear QR de la jugadora', continuo }: { onCode: (qr: string) => void; title?: string; continuo?: boolean }) {
  const t = useTheme();
  const [cam, setCam] = useState(false);
  const [perm, askPerm] = useCameraPermissions();
  const lock = useRef(false);

  useFocusEffect(useCallback(() => () => { setCam(false); lock.current = false; }, []));

  const [falla, setFalla] = useState('');
  const abrir = async () => {
    if (cam) return setCam(false);
    setFalla('');
    if (Platform.OS === 'web') {
      const ua = navigator.userAgent;
      if (/FBAN|FBAV|Instagram|Line\/|; wv\)|WhatsApp/i.test(ua) || !navigator.mediaDevices?.getUserMedia) {
        return setFalla('Este navegador no deja usar la cámara (por ejemplo, el que se abre dentro de WhatsApp). Abre el enlace en Safari o Chrome, o instala la app en la pantalla de inicio. Mientras tanto, busca a la jugadora por nombre.');
      }
      if (!window.isSecureContext) return setFalla('La cámara solo funciona con conexión segura (https).');
    }
    const p = perm?.granted ? perm : await askPerm();
    if (!p.granted) { setFalla('La cámara está bloqueada. En iPhone: Ajustes > Safari > Cámara > Permitir (o toca “aA” en la barra > Ajustes del sitio web > Cámara). Luego vuelve a intentar.'); return; }
    lock.current = false; setCam(true);
  };
  const leido = ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    if (!(data.startsWith('CCF:') || (!continuo && data.startsWith('CCP:')))) { notify('Ese código no es de una jugadora'); setTimeout(() => { lock.current = false; }, 1500); return; }
    if (continuo) setTimeout(() => { lock.current = false; }, 2000); else setCam(false);
    onCode(data);
  };

  return (
    <>
      {cam ? (
        <View style={{ aspectRatio: 1, borderRadius: Radius.l, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={leido}
            onMountError={(e) => { setCam(false); setFalla('No se pudo abrir la cámara: ' + (e?.message || 'error desconocido') + '. Cierra otras apps que la usen o busca por nombre.'); }} />
        </View>
      ) : null}
      <Button title={cam ? 'Cerrar cámara' : title} kind={cam ? 'tinted' : 'filled'} onPress={abrir}
        icon={<Icon sf="qrcode.viewfinder" ion="qr-code" size={22} color={cam ? t.tint : t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
      {falla ? <T v="sub" color={t.bad}>{falla}</T> : null}
    </>
  );
}
