// Barra inferior para web (en iOS/Android se usa la barra nativa del sistema con NativeTabs).
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { brand, MaxWidth } from '@/constants/theme';

export type WebTab = { name: string; title: string; ion: keyof typeof Ionicons.glyphMap; ionOn: keyof typeof Ionicons.glyphMap };

function Btn({ title, ion, ionOn, isFocused, ...props }: TabTriggerSlotProps & { title: string; ion: WebTab['ion']; ionOn: WebTab['ionOn'] }) {
  const c = isFocused ? brand.gold : 'rgba(255,255,255,0.66)';
  return (
    <Pressable {...(props as Record<string, unknown>)} accessibilityRole="tab" style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Ionicons name={isFocused ? ionOn : ion} size={24} color={c} />
      <Text style={{ color: c, fontSize: 11, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function WebTabs({ base, tabs }: { base: string; tabs: WebTab[] }) {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={{ position: 'fixed' as never, left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: brand.navy, borderTopWidth: 3, borderTopColor: brand.gold }}>
          <View style={{ flexDirection: 'row', width: '100%', maxWidth: MaxWidth }}>
            {tabs.map((t) => (
              <TabTrigger key={t.name} name={t.name} href={`/${base}/${t.name}` as never} asChild>
                <Btn title={t.title} ion={t.ion} ionOn={t.ionOn} />
              </TabTrigger>
            ))}
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}
