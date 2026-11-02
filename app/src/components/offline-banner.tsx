// Franja superior cuando no hay internet o hay acciones por enviar (modo sin conexión).
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/constants/theme';
import { useCola } from '@/lib/cola';

export function OfflineBanner() {
  const { online, pendientes, descartados, vaciar } = useCola();
  const insets = useSafeAreaInsets();
  if (online && !pendientes && !descartados) return null;
  const texto = !online ? `Sin conexión${pendientes ? ` · ${pendientes} por enviar` : ''}` : pendientes ? `Enviando ${pendientes} pendiente${pendientes > 1 ? 's' : ''}…` : `${descartados} acción(es) no se pudo(ieron) registrar`;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <Pressable onPress={() => void vaciar()} accessibilityRole="button" accessibilityLabel={texto}
        style={{ marginTop: insets.top + 4, backgroundColor: !online ? brand.gold : brand.navy, paddingHorizontal: 14, minHeight: 28, borderRadius: 14, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
        <Text style={{ color: !online ? brand.navy : '#fff', fontSize: 13, fontWeight: '700' }}>{texto}</Text>
      </Pressable>
    </View>
  );
}
