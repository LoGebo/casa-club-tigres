// Horarios por categoría: la semana de actividades (entrenamiento, comida, gym, escuela…) agrupada por día.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';
import { Chips, ErrorBox, confirmar, dayKey, hm, hoyStr, largaDia, repLabel, useLoad } from '@/features/coord-mas/util';
import { TIPO_AGENDA } from '@/features/coord-mas/agenda';

type Act = { id: number; titulo: string; tipo: string; inicio_at: number; fin_at?: number | null; lugar?: string | null; categoria?: string | null; repite?: string | null; serie?: boolean };

export default function Horarios() {
  const t = useTheme();
  const cats = useCategorias();
  const [cat, setCat] = useState('');
  const { data, err, load, refresh, refreshing } = useLoad<Act[]>(`/agenda?dias=7&categoria=${encodeURIComponent(cat)}`);
  const fg = t.bg === '#000000' ? '#071647' : '#FFFFFF';

  const quitar = async (a: Act) => {
    const serie = !!a.repite;
    if (!(await confirmar(serie ? '¿Quitar toda la serie?' : '¿Quitar esta actividad?', serie ? `«${a.titulo}» se repite (${repLabel(a.repite)}). Se quitarán todas sus repeticiones, no solo este día.` : `Se quitará «${a.titulo}» de la agenda.`, 'Quitar'))) return;
    if (await run(() => api(`/agenda/${a.id}`, 'DELETE'))) { notify(serie ? 'Serie quitada' : 'Actividad quitada'); await load(); }
  };

  const dias = new Map<string, Act[]>();
  for (const a of data ?? []) { const k = dayKey(a.inicio_at); dias.set(k, [...(dias.get(k) ?? []), a]); }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Horarios' }} />
      <Button title="Nueva actividad" onPress={() => router.push('/agenda-nueva')} icon={<Icon sf="plus" ion="add" size={20} color={fg} />} />
      <Chips options={[['', 'Todas'], ...cats.map((c) => [c, c] as const)] as readonly (readonly [string, string])[]} value={cat} onChange={setCat} />
      {!data ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : dias.size === 0 ? (
        <Empty sf="calendar" ion="calendar-outline" title="Sin actividades esta semana" text={cat ? `Nada programado para ${cat}.` : 'Agrega entrenamientos, comidas, gym, escuela o fisioterapia.'} />
      ) : (
        [...dias.entries()].map(([k, acts]) => (
          <Group key={k} header={k === hoyStr() ? `Hoy · ${largaDia(k)}` : largaDia(k)}>
            {acts.map((a) => (
              <Row key={`${a.id}-${a.inicio_at}`} minHeight={64}
                leading={<View style={{ width: 52 }}><T v="headline" style={{ fontVariant: ['tabular-nums'] }}>{hm(a.inicio_at)}</T>{a.fin_at ? <T v="caption" dim style={{ fontVariant: ['tabular-nums'] }}>{hm(a.fin_at)}</T> : null}</View>}
                title={a.titulo}
                subtitle={
                  <View style={{ gap: 4 }}>
                    <T v="caption" dim>{TIPO_AGENDA[a.tipo] ?? a.tipo}{a.lugar ? ` · ${a.lugar}` : ''}</T>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Badge text={a.categoria ?? 'Todas'} tone="tint" />
                      {a.repite ? <Badge text={repLabel(a.repite)} tone="gold" /> : null}
                    </View>
                  </View>
                }
                trailing={
                  <Pressable onPress={() => quitar(a)} accessibilityRole="button" accessibilityLabel={`Quitar ${a.titulo}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf="trash" ion="trash-outline" size={20} color={t.bad} />
                  </Pressable>
                } />
            ))}
          </Group>
        ))
      )}
      <T v="caption" dim style={{ textAlign: 'center' }}>Se muestran los próximos 7 días. Quitar una actividad que se repite quita toda la serie.</T>
    </Screen>
  );
}
