// Stack de cada pestaña: título grande nativo, barra translúcida y botón de cuenta.
import { router, Stack } from 'expo-router';
import { Platform, Pressable } from 'react-native';

import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

function AccountButton() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <Pressable onPress={() => router.push('/cuenta')} accessibilityLabel="Mi cuenta" hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Avatar name={session.nombre} size={32} />
    </Pressable>
  );
}

export function TabStack({ title, children }: { title: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: 'systemChromeMaterial',
        headerShadowVisible: false,
        headerTintColor: t.tint,
        headerStyle: { backgroundColor: Platform.OS === 'ios' ? undefined : t.bg },
        headerLargeStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.label },
        headerLargeTitleStyle: { color: t.label },
        contentStyle: { backgroundColor: t.bg },
        headerRight: () => <AccountButton />,
      }}>
      <Stack.Screen name="index" options={{ title }} />
      {children}
    </Stack>
  );
}
