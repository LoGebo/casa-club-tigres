// Botón + cámara para leer el QR de la jugadora. Lo usan Escanear y Abordaje.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { notify } from '@/components/notify';
import { Button, Icon } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** onCode recibe el texto «CCF:…». Con `continuo` la cámara sigue abierta tras cada lectura (abordaje). */
export function QrScanner({ onCode, title = 'Escanear QR de la jugadora', continuo }: { onCode: (qr: string) => void; title?: string; continuo?: boolean }) {
  const t = useTheme();
  const [cam, setCam] = useState(false);
  const [perm, askPerm] = useCameraPermissions();
  const lock = useRef(false);

  useFocusEffect(useCallback(() => () => { setCam(false); lock.current = false; }, []));

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
    if (continuo) setTimeout(() => { lock.current = false; }, 2000); else setCam(false);
    onCode(data);
  };

  return (
    <>
      {cam ? (
        <View style={{ aspectRatio: 1, borderRadius: Radius.l, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={leido} />
        </View>
      ) : null}
      <Button title={cam ? 'Cerrar cámara' : title} kind={cam ? 'tinted' : 'filled'} onPress={abrir}
        icon={<Icon sf="qrcode.viewfinder" ion="qr-code" size={22} color={cam ? t.tint : t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} />
    </>
  );
}
