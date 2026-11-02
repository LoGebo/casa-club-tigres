import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ToastHost } from '@/components/notify';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { session, ready } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const rol = session?.rol;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, primary: c.tint, background: c.bg, card: c.surface, text: c.label, border: c.sep } }}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
            <Stack.Screen name="registro" />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'jugadora'}>
            <Stack.Screen name="jugadora" />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'seguridad'}>
            <Stack.Screen name="seguridad" />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'coordinacion'}>
            <Stack.Screen name="coord" />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="cuenta" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="partido" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'coordinacion'}>
            <Stack.Screen name="partido-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.8, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="viaje-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="convocar" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="importar" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'jugadora'}>
            <Stack.Screen name="permiso-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="visita-nueva" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="ticket-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="incidencia-nueva" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          {/* AGENT:jugadora-routes */}
          <Stack.Protected guard={rol === 'seguridad'}>
            <Stack.Screen name="ficha" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          {/* AGENT:seguridad-routes */}
          <Stack.Protected guard={rol === 'coordinacion'}>
            <Stack.Screen name="visita-coord-nueva" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="aviso-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="agenda-nueva" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="staff-nuevo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'coordinacion'}>
            <Stack.Screen name="permiso-nuevo-coord" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="jugadora-ficha" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
            <Stack.Screen name="jugadora-form" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={rol === 'coordinacion'}>
            <Stack.Screen name="jugadora-registro" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1], sheetGrabberVisible: true, headerShown: false }} />
          </Stack.Protected>
          {/* AGENT:coord-routes */}
        </Stack>
        <ToastHost />
      </View>
    </ThemeProvider>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
