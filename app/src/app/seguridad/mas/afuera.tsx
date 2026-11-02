// Quién está afuera ahora. Las atrasadas van arriba, con minutos de retraso, llamada y aviso al tutor.
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { run } from '@/components/notify';
import { Badge, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { paquete, porId } from '@/features/seguridad/offline';
import { hm, mins } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type P = { id: number; jugadora: string; jugadora_id: number; destino: string; acompanante: string; salio_at?: number; regreso_at: number; atrasada: boolean; tutor_nombre?: string; tutor_tel?: string; wa_tutor?: string | null };

export default function Afuera() {
  const t = useTheme();
  const [rows, setRows] = useState<P[] | null>(null);
  const [emerg, setEmerg] = useState<Record<number, { nombre?: string; tel?: string }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    const r = await run(() => api<P[]>('/fuera'));
    if (!r) { setRows((x) => x ?? []); return; }
    setRows(r); setNow(Date.now());
    const pk = await paquete();
    if (pk) setEmerg(Object.fromEntries(r.map((p) => [p.jugadora_id, porId(pk, p.jugadora_id)?.emergencia ?? {}])));
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]));

  const tarde = (rows ?? []).filter((p) => p.regreso_at < now), enTiempo = (rows ?? []).filter((p) => p.regreso_at >= now);
  const tel = (n: string | undefined, label: string, key: string) => n ? <Row key={key} title={label} subtitle={n} leading={<Icon sf="phone.fill" ion="call" />} onPress={() => Linking.openURL(`tel:${n}`)} /> : null;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Afuera ahora' }} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty sf="house" ion="home-outline" title="Todas están dentro" text="Ninguna jugadora está fuera de Casa Club." /> : (
        <>
          {tarde.length ? (
            <View style={{ backgroundColor: t.bad, borderRadius: Radius.l, padding: Space.l, flexDirection: 'row', alignItems: 'center', gap: Space.m }} accessibilityRole="alert">
              <Icon sf="exclamationmark.triangle.fill" ion="warning" size={32} color={t.surface} />
              <Text style={{ color: t.surface, fontSize: 20, fontWeight: '800', flex: 1 }}>{`${tarde.length} ${tarde.length > 1 ? 'jugadoras atrasadas' : 'jugadora atrasada'}`}</Text>
            </View>
          ) : null}
          {tarde.map((p) => {
            const e = emerg[p.jugadora_id] ?? {};
            return (
              <View key={p.id} style={{ gap: 8 }}>
                <View style={{ backgroundColor: t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <T v="title" color={t.bad} style={{ flex: 1 }}>{p.jugadora}</T>
                    <Badge text={`${mins(now - p.regreso_at)} tarde`} tone="bad" />
                  </View>
                  <T v="sub">{`${p.destino} · con ${p.acompanante}`}</T>
                  <T v="caption" dim>{`${p.salio_at ? `Salió ${hm(p.salio_at)} · ` : ''}debía volver ${hm(p.regreso_at)}`}</T>
                </View>
                <Group>
                  {tel(p.tutor_tel, `Llamar a ${p.tutor_nombre || 'tutor'}`, 'tutor')}
                  {p.wa_tutor ? <Row title="Avisar al tutor por WhatsApp" leading={<Icon sf="message.fill" ion="logo-whatsapp" />} chevron onPress={() => Linking.openURL(p.wa_tutor!)} /> : null}
                  {e.tel && e.tel !== p.tutor_tel ? tel(e.tel, `Llamar a emergencia${e.nombre ? ` · ${e.nombre}` : ''}`, 'em') : null}
                  <Row title="Registrar regreso" leading={<Icon sf="arrow.down.left.circle" ion="enter-outline" />} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(p.jugadora_id) } })} />
                </Group>
              </View>
            );
          })}
          {enTiempo.length ? (
            <Group header={`Afuera con permiso · ${enTiempo.length}`}>
              {enTiempo.map((p) => (
                <Row key={p.id} minHeight={64} title={p.jugadora}
                  subtitle={<T v="caption" dim numberOfLines={2}>{`${p.destino} · con ${p.acompanante}${p.salio_at ? ` · salió ${hm(p.salio_at)}` : ''}`}</T>}
                  trailing={<Badge text={`regresa ${hm(p.regreso_at)}`} />} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(p.jugadora_id) } })} />
              ))}
            </Group>
          ) : null}
        </>
      )}
    </Screen>
  );
}
