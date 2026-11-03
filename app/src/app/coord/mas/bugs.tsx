// Seguimiento de errores reportados desde el botón flotante: estado, nota, captura y descarga CSV.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Foto } from '@/components/foto';
import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Loading, Screen, Segmented, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { dt } from '@/features/coord-mas/util';

type Bug = { id: number; nombre?: string; rol?: string; descripcion: string; tipo: string; pantalla?: string; dispositivo?: string; estado: string; nota?: string; creado_at: number; foto_url?: string | null };
const E = { nuevo: 'bad', en_proceso: 'warn', corregido: 'ok', descartado: 'neutral' } as const;
const SIG: Record<string, [string, string]> = { nuevo: ['en_proceso', 'Empezar a corregir'], en_proceso: ['corregido', 'Marcar corregido'] };

export default function Bugs() {
  const t = useTheme();
  const [bs, setBs] = useState<Bug[] | null>(null);
  const [vista, setVista] = useState<'abiertos' | 'cerrados'>('abiertos');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<Bug[]>('/bugs')); if (r) setBs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const cambiar = async (b: Bug, estado: string) => { if (await run(() => api(`/bugs/${b.id}`, 'PATCH', { estado }))) { notify('Actualizado'); void load(); } };

  const lista = (bs ?? []).filter((b) => (vista === 'abiertos') === (b.estado === 'nuevo' || b.estado === 'en_proceso'));
  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Errores reportados' }} />
      <Segmented options={[['abiertos', `Abiertos${bs ? ` (${bs.filter((b) => b.estado === 'nuevo' || b.estado === 'en_proceso').length})` : ''}`], ['cerrados', 'Cerrados']] as const} value={vista} onChange={setVista} />
      {!bs ? <Loading /> : lista.length === 0 ? <Empty sf="checkmark.seal" ion="checkmark-circle-outline" title="Sin reportes aquí" text="Los reportes llegan desde el botón flotante de la app." /> : (
        <Group>
          {lista.map((b) => (
            <View key={b.id} style={{ padding: Space.l, gap: 6, backgroundColor: t.surface }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <T v="headline" style={{ flex: 1 }}>{`#${b.id} · ${b.tipo === 'bloqueo' ? 'No puede seguir' : b.tipo === 'idea' ? 'Idea' : 'Falla'}`}</T>
                <Badge text={b.estado.replace('_', ' ')} tone={E[b.estado as keyof typeof E] ?? 'neutral'} />
              </View>
              <T v="body">{b.descripcion}</T>
              <T v="caption" dim>{[b.nombre, b.rol, dt(b.creado_at), b.pantalla].filter(Boolean).join(' · ')}</T>
              {b.dispositivo ? <T v="caption" dim numberOfLines={2}>{b.dispositivo}</T> : null}
              {b.foto_url ? <View style={{ maxWidth: 260 }}><Foto url={b.foto_url} ratio={0.6} radius={Radius.m} /></View> : null}
              {SIG[b.estado] ? <Button title={SIG[b.estado][1]} small kind="tinted" onPress={() => cambiar(b, SIG[b.estado][0])} /> : null}
              {b.estado !== 'descartado' && b.estado !== 'corregido' ? <Button title="Descartar" small kind="tinted" onPress={() => cambiar(b, 'descartado')} /> : <Button title="Reabrir" small kind="tinted" onPress={() => cambiar(b, 'nuevo')} />}
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}
