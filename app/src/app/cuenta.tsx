import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, TextInput, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Avatar, Badge, Button, Group, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCola } from '@/lib/cola';
import { activarPush, estadoPush, type PushEstado } from '@/lib/push';

const ROL = { jugadora: 'Jugadora', seguridad: 'Seguridad', coordinacion: 'Coordinación' } as const;
const PUSH: Record<PushEstado, [string, 'ok' | 'warn' | 'bad' | 'neutral']> = {
  activas: ['Activadas', 'ok'], inactivas: ['Desactivadas', 'warn'], bloqueadas: ['Bloqueadas', 'bad'], no_disponible: ['No disponibles', 'neutral'],
};

export default function Cuenta() {
  const t = useTheme();
  const { session, logout } = useAuth();
  const cola = useCola();
  const [cambiando, setCambiando] = useState(false);
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [pinBorrar, setPinBorrar] = useState('');
  const [push, setPush] = useState<PushEstado | null>(null);
  const ios = Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = Platform.OS === 'web' && typeof window !== 'undefined' && ((navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);
  const refrescarPush = useCallback(() => { void estadoPush().then(setPush).catch(() => setPush('no_disponible')); }, []);
  useEffect(refrescarPush, [refrescarPush]);
  if (!session) return null;
  const input = { backgroundColor: t.surface, color: t.label, fontSize: 17, paddingHorizontal: 16, minHeight: 50, borderRadius: 12 } as const;

  const guardar = async () => {
    const r = await run(() => api('/pin', 'PATCH', { actual, nuevo }));
    if (r) { notify('PIN actualizado'); setCambiando(false); setActual(''); setNuevo(''); }
  };
  const activar = async () => {
    if (push === 'bloqueadas' && Platform.OS !== 'web') return void Linking.openSettings();
    const e = await activarPush();
    setPush(e);
    notify(e === 'activas' ? 'Notificaciones activadas' : e === 'bloqueadas' ? 'Actívalas en Ajustes del teléfono' : e === 'no_disponible' ? 'Este dispositivo no las admite' : 'No se activaron');
  };
  const v = Constants.expoConfig?.version ?? '1.0';

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: Space.l, gap: Space.l, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.m }}>
        <Avatar name={session.nombre} size={56} />
        <View style={{ flex: 1 }}><T v="title">{session.nombre}</T><T v="sub" dim>{ROL[session.rol]}</T></View>
      </View>

      {cola.pendientes > 0 ? (
        <View style={{ backgroundColor: t.warnWeak, borderRadius: 12, padding: Space.m, gap: 2 }}>
          <T v="headline" color={t.warn}>{cola.pendientes === 1 ? '1 acción por enviar' : `${cola.pendientes} acciones por enviar`}</T>
          <T v="caption" dim>Se mandan solas cuando vuelva la conexión.</T>
        </View>
      ) : null}

      {cambiando ? (
        <View style={{ gap: Space.m }}>
          <TextInput value={actual} onChangeText={setActual} placeholder="PIN actual" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" style={input} accessibilityLabel="PIN actual" />
          <TextInput value={nuevo} onChangeText={setNuevo} placeholder="PIN nuevo (4 a 8 dígitos)" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" style={input} accessibilityLabel="PIN nuevo" />
          <Button title="Guardar PIN" onPress={guardar} disabled={!actual || nuevo.length < 4} />
          <Button title="Cancelar" kind="plain" onPress={() => setCambiando(false)} />
        </View>
      ) : borrando ? (
        <View style={{ gap: Space.m }}>
          <T v="sub" dim>Se borran tus datos personales, fotos y comidas, y ya no podrás entrar. Esta acción no se puede deshacer. Escribe tu PIN para confirmar.</T>
          <TextInput value={pinBorrar} onChangeText={setPinBorrar} placeholder="Tu PIN" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" style={input} accessibilityLabel="PIN para eliminar la cuenta" />
          <Button title="Eliminar mi cuenta" kind="danger" disabled={pinBorrar.length < 4} onPress={async () => { const r = await run(() => api('/me', 'DELETE', { pin: pinBorrar })); if (r) { router.dismiss(); await logout(); } }} />
          <Button title="Cancelar" kind="plain" onPress={() => { setBorrando(false); setPinBorrar(''); }} />
        </View>
      ) : (
        <>
          {ios && !instalada ? (
            <View style={{ backgroundColor: t.warnWeak, borderRadius: 12, padding: Space.m, gap: 4 }}>
              <T v="headline" color={t.warn}>Instala la app para recibir avisos</T>
              <T v="sub" dim>En iPhone los avisos solo llegan si la app está en tu pantalla de inicio. Ábrela en Safari (no dentro de WhatsApp), toca Compartir, luego “Agregar a pantalla de inicio”. Ábrela desde ese ícono y activa aquí las notificaciones.</T>
            </View>
          ) : null}
          <Group header="Avisos">
            <Row title="Notificaciones del teléfono" subtitle={push === 'bloqueadas' ? 'Toca para abrir Ajustes' : push === 'inactivas' ? 'Toca para activarlas' : undefined}
              trailing={push ? <Badge text={PUSH[push][0]} tone={PUSH[push][1]} /> : undefined}
              onPress={push === 'inactivas' || push === 'bloqueadas' ? activar : undefined} />
            <Row title="Ver notificaciones" chevron onPress={() => router.push('/notificaciones')} />
          </Group>
          <Group header="Seguridad">
            <Row title="Cambiar PIN" onPress={() => setCambiando(true)} chevron />
          </Group>
          <Group>
            <Row title="Cerrar sesión" tone="danger" onPress={async () => { router.dismiss(); await logout(); }} />
          </Group>
          {session.rol === 'jugadora' ? <Group footer="Borra tus datos personales de la app."><Row title="Eliminar mi cuenta" tone="danger" onPress={() => setBorrando(true)} /></Group> : null}
          <T v="caption" dim style={{ textAlign: 'center' }}>Casa Club Femenil Tigres · versión {v}</T>
        </>
      )}
    </ScrollView>
  );
}
