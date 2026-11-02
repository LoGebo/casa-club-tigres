// Barra inferior para web (en iOS/Android se usa la barra nativa del sistema con NativeTabs).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Slot, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { brand, MaxWidth } from '@/constants/theme';

export type WebTab = { name: string; title: string; ion: keyof typeof Ionicons.glyphMap; ionOn: keyof typeof Ionicons.glyphMap };

export function WebTabs({ base, tabs }: { base: string; tabs: WebTab[] }) {
  const path = usePathname();
  return (
    <View style={{ flex: 1 }}>
      <Slot />
      <View style={{ position: 'fixed' as never, left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: brand.navy, borderTopWidth: 3, borderTopColor: brand.gold }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', width: '100%', maxWidth: MaxWidth }}>
          {tabs.map((t) => {
            const on = path === `/${base}/${t.name}` || path.startsWith(`/${base}/${t.name}/`);
            const c = on ? brand.gold : 'rgba(255,255,255,0.66)';
            return (
              <Pressable key={t.name} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.navigate(`/${base}/${t.name}` as never)}
                style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <Ionicons name={on ? t.ionOn : t.ion} size={24} color={c} />
                <Text style={{ color: c, fontSize: 11, fontWeight: '600' }}>{t.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
