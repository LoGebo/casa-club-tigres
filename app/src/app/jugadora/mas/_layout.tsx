import { Stack } from 'expo-router';

import { TabStack } from '@/components/tab-stack';

export default function Layout() {
  return (
    <TabStack title="Más">
      <Stack.Screen name="visitas" options={{ title: 'Visitas' }} />
      <Stack.Screen name="servicios" options={{ title: 'Servicios' }} />
    </TabStack>
  );
}
