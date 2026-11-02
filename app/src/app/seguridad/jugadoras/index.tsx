// Todas las jugadoras con su estado. Tocar una abre la ficha para registrar salida o regreso.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { run } from '@/components/notify';
import { Avatar, Badge, Empty, Group, Loading, Row, Screen, Segmented, T, tap } from '@/components/ui';
import { Space } from '@/constants/theme';
import { BADGE, clasif, linea, PRI, SearchBox, useCfg, type Clase, type Guardia } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';

type F = 'todas' | 'afuera' | 'permiso' | 'dentro';
const FILTRO: Record<F, (c: Clase) => boolean> = {
  todas: () => true, afuera: (c) => c === 'tarde' || c === 'fuera', permiso: (c) => c === 'habilitada' || c === 'proximo', dentro: (c) => c === 'dentro',
};
const OPC = [['todas', 'Todas'], ['afuera', 'Afuera'], ['permiso', 'Permiso'], ['dentro', 'Dentro']] as const;
type Jug = { id: number; categoria?: string; activa?: boolean };

export default function Jugadoras() {
  const t = useTheme();
  const cfg = useCfg();
  const cats = useCategorias();
  const [rows, setRows] = useState<Guardia[] | null>(null);
  const [catDe, setCatDe] = useState<Record<number, string>>({});
  const [f, setF] = useState<F>('todas');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Guardia[]>('/guardia'), api<Jug[]>('/jugadoras')]));
    if (r) { setRows(r[0]); setCatDe(Object.fromEntries(r[1].map((j) => [j.id, j.categoria ?? '']))); }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const i = setInterval(load, 30000); // refresco mientras la pantalla está enfocada
    return () => clearInterval(i);
  }, [load]));

  if (!rows) return <Screen><Loading /></Screen>;
  const gr = Number(cfg.gracia_min || 30);
  const todas = rows.map((x) => ({ x, c: clasif(x, gr) })).filter(({ x }) => !cat || catDe[x.id] === cat).sort((a, b) => PRI[a.c] - PRI[b.c] || a.x.nombre.localeCompare(b.x.nombre));
  const n = (k: F) => todas.filter(({ c }) => FILTRO[k](c)).length;
  const v = q.toLowerCase().trim();
  const lista = todas.filter(({ x, c }) => FILTRO[f](c) && (!v || x.nombre.toLowerCase().includes(v)));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Segmented options={OPC.map(([k, l]) => [k, `${l} ${n(k)}`] as const)} value={f} onChange={setF} />
      {cats.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s }} style={{ flexGrow: 0 }}>
          {['', ...cats].map((c) => {
            const on = c === cat;
            return (
              <Pressable key={c || 'todas'} onPress={() => { tap(); setCat(c); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={c ? `Categoría ${c}` : 'Todas las categorías'}
                style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? t.tint : t.fill }}>
                <Text style={{ color: on ? (t.bg === '#000000' ? '#071647' : '#FFFFFF') : t.label, fontSize: 15, fontWeight: '600' }}>{c || 'Todas'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <SearchBox value={q} onChangeText={setQ} />
      {lista.length ? (
        <Group>
          {lista.map(({ x, c }) => (
            <Row key={x.id} minHeight={64} leading={<Avatar name={x.nombre} />} title={x.nombre}
              subtitle={<><T v="caption" dim numberOfLines={1}>{[catDe[x.id], x.habitacion ? `Hab. ${x.habitacion}` : ''].filter(Boolean).join(' · ')}</T><T v="caption" dim numberOfLines={2}>{linea(x, c)}</T></>}
              trailing={<Badge text={BADGE[c][1]} tone={BADGE[c][0]} />} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(x.id) } })} />
          ))}
        </Group>
      ) : <Empty sf="magnifyingglass" ion="search-outline" title="Sin resultados" />}
    </Screen>
  );
}
