// Campana con contador de no leídas (bandeja de notificaciones). Se actualiza cada 30 s y al volver a la pantalla.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

export const useNoLeidas = () => {
  const [n, setN] = useState(0);
  const cargar = useCallback(() => { api<{ sin_leer: number }>('/notificaciones').then((r) => setN(r.sin_leer)).catch(() => {}); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    void (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch?.(() => {});
  }, [n]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 30_000); return () => clearInterval(t); }, [cargar]);
  return { n, recargar: cargar };
};

export function Bell() {
  const t = useTheme();
  const { n } = useNoLeidas();
  return (
    <Pressable onPress={() => router.push('/notificaciones')} accessibilityRole="button" accessibilityLabel={n ? `Notificaciones, ${n} sin leer` : 'Notificaciones'} hitSlop={6}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon sf="bell" ion="notifications-outline" size={24} color={t.tint} />
      {n ? (
        <View style={{ position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: brand.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: brand.navy, fontSize: 11, fontWeight: '800' }}>{n > 9 ? '9+' : n}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
