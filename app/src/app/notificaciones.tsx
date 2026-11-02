// Bandeja de notificaciones (lo que antes solo era push): se puede revisar aunque el aviso del teléfono se haya perdido.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { run } from '@/components/notify';
import { Button, Empty, Group, Icon, Loading, Row, T } from '@/components/ui';
import { brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { activarPush, estadoPush, type PushEstado } from '@/lib/push';

type N = { id: number; titulo: string; cuerpo?: string | null; ruta?: string | null; at: number; leida: boolean };
const cuando = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60e3);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

export default function Notificaciones() {
  const t = useTheme();
  const [items, setItems] = useState<N[] | null>(null);
  const [push, setPush] = useState<PushEstado>('activas');
  const cargar = useCallback(async () => { const r = await run(() => api<{ items: N[] }>('/notificaciones')); if (r) setItems(r.items); }, []);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));
  useEffect(() => { void estadoPush().then(setPush); }, []);

  const abrir = async (n: N) => {
    if (!n.leida) { await api('/notificaciones/leer', 'POST', { ids: [n.id] }).catch(() => {}); }
    if (n.ruta) { router.dismissAll?.(); router.push(n.ruta as never); }
  };
  const todas = async () => { await run(() => api('/notificaciones/leer', 'POST', {})); await cargar(); };

  return (
    <SheetScreen title="Notificaciones">
      {push === 'inactivas' ? (
        <Group footer="Así te enteras de permisos, avisos y alertas aunque no tengas la app abierta.">
          <Row minHeight={56} title="Activar avisos en este dispositivo" leading={<Icon sf="bell.badge" ion="notifications" color={t.tint} />} chevron onPress={async () => setPush(await activarPush())} />
        </Group>
      ) : push === 'bloqueadas' ? <T v="caption" dim>Los avisos están bloqueados en este dispositivo. Actívalos en Ajustes para recibirlos.</T> : null}
      {!items ? <Loading /> : !items.length ? <Empty sf="bell" ion="notifications-outline" title="Sin notificaciones" text="Aquí aparecerán tus avisos." /> : (
        <>
          <Group>
            {items.map((n) => (
              <Row key={n.id} minHeight={64} title={n.titulo} subtitle={`${n.cuerpo ? n.cuerpo + ' · ' : ''}${cuando(n.at)}`} chevron={!!n.ruta} onPress={() => void abrir(n)}
                leading={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.leida ? 'transparent' : brand.gold, borderWidth: n.leida ? 0 : 1, borderColor: brand.navy }} />} />
            ))}
          </Group>
          {items.some((n) => !n.leida) ? <Button title="Marcar todo como leído" kind="tinted" onPress={todas} /> : null}
        </>
      )}
    </SheetScreen>
  );
}
