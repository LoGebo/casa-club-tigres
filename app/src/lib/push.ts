// Notificaciones push: en el teléfono (token de Expo) y en web (Web Push + service worker). Siempre existe además la bandeja dentro de la app.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
}

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export type PushEstado = 'activas' | 'inactivas' | 'bloqueadas' | 'no_disponible';

export async function estadoPush(): Promise<PushEstado> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'no_disponible';
    if (Notification.permission === 'denied') return 'bloqueadas';
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    return Notification.permission === 'granted' && (await reg?.pushManager.getSubscription()) ? 'activas' : 'inactivas';
  }
  if (!Device.isDevice) return 'no_disponible';
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'activas' : p.canAskAgain ? 'inactivas' : 'bloqueadas';
}

/** Pide permiso y registra este dispositivo. Debe llamarse desde un toque del usuario. */
export async function activarPush(): Promise<PushEstado> {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'no_disponible';
      if ((await Notification.requestPermission()) !== 'granted') return 'bloqueadas';
      const { key } = await api<{ key: string | null }>('/push/key'); if (!key) return 'no_disponible';
      const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }));
      await api('/push/sub', 'POST', { sub: sub.toJSON() });
      return 'activas';
    }
    if (!Device.isDevice) return 'no_disponible';
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return p.canAskAgain ? 'inactivas' : 'bloqueadas';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tok = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('/push/expo', 'POST', { token: tok.data });
    return 'activas';
  } catch { return 'no_disponible'; }
}

/** Si ya había permiso, vuelve a registrar el token sin molestar (los tokens cambian). */
export async function renovarPush() { try { if ((await estadoPush()) === 'activas') await activarPush(); } catch {} }

/** Abre la pantalla indicada por la notificación al tocarla (teléfono). */
export function escucharToques() {
  if (Platform.OS === 'web') return () => {};
  const s = Notifications.addNotificationResponseReceivedListener((r) => { const ruta = r.notification.request.content.data?.ruta; if (typeof ruta === 'string' && ruta) router.push(ruta as never); });
  return () => s.remove();
}
