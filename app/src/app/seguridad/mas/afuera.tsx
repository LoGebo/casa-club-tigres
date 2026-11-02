import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { run } from '@/components/notify';
import { Badge, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { hm, mins } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type P = { id: number; jugadora: string; jugadora_id: number; destino: string; acompanante: string; salio_at?: number; regreso_at: number; atrasada: boolean; tutor_nombre?: string; tutor_tel?: string };

export default function Afuera() {
  const t = useTheme();
  const [rows, setRows] = useState<P[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(0);
  const load = useCallback(async () => { const r = await run(() => api<P[]>('/fuera')); if (r) { setRows(r); setNow(Date.now()); } }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Afuera ahora' }} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty sf="house" ion="home-outline" title="Todas están dentro" text="Ninguna jugadora está fuera de Casa Club." /> : (
        <>
          {/* atrasadas primero (el backend ya ordena por regreso) */}
          {rows.map((p) => (
            <Group key={p.id} header={p.atrasada ? 'Atrasada' : undefined}>
              <Row minHeight={64} title={p.jugadora}
                subtitle={<T v="caption" dim numberOfLines={2}>{`${p.destino} · con ${p.acompanante}${p.salio_at ? ` · salió ${hm(p.salio_at)}` : ''}`}</T>}
                trailing={p.atrasada ? <Badge text={`${mins(now - p.regreso_at)} tarde`} tone="bad" /> : <Badge text={`regresa ${hm(p.regreso_at)}`} />} />
              <Row title="Registrar regreso" leading={<Icon sf="arrow.down.left.circle" ion="enter-outline" />} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(p.jugadora_id) } })} />
              {p.atrasada && p.tutor_tel ? <Row title={`Llamar a ${p.tutor_nombre || 'tutor'}`} leading={<Icon sf="phone.fill" ion="call" color={t.bad} />} onPress={() => Linking.openURL(`tel:${p.tutor_tel}`)} /> : null}
            </Group>
          ))}
        </>
      )}
    </Screen>
  );
}
