// Todas las jugadoras con su estado. Tocar una abre la ficha para registrar salida o regreso.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { run } from '@/components/notify';
import { Avatar, Badge, Empty, Group, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { BADGE, clasif, linea, PRI, useCfg, type Clase, type Guardia } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type F = 'todas' | 'afuera' | 'permiso' | 'dentro';
const FILTRO: Record<F, (c: Clase) => boolean> = {
  todas: () => true, afuera: (c) => c === 'tarde' || c === 'fuera', permiso: (c) => c === 'habilitada' || c === 'proximo', dentro: (c) => c === 'dentro',
};
const OPC = [['todas', 'Todas'], ['afuera', 'Afuera'], ['permiso', 'Permiso'], ['dentro', 'Dentro']] as const;

export default function Jugadoras() {
  const t = useTheme();
  const cfg = useCfg();
  const [rows, setRows] = useState<Guardia[] | null>(null);
  const [f, setF] = useState<F>('todas');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { const r = await run(() => api<Guardia[]>('/guardia')); if (r) setRows(r); }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const i = setInterval(load, 30000); // refresco mientras la pantalla está enfocada
    return () => clearInterval(i);
  }, [load]));

  if (!rows) return <Screen><Loading /></Screen>;
  const gr = Number(cfg.gracia_min || 30);
  const todas = rows.map((x) => ({ x, c: clasif(x, gr) })).sort((a, b) => PRI[a.c] - PRI[b.c] || a.x.nombre.localeCompare(b.x.nombre));
  const n = (k: F) => todas.filter(({ c }) => FILTRO[k](c)).length;
  const v = q.toLowerCase().trim();
  const lista = todas.filter(({ x, c }) => FILTRO[f](c) && (!v || x.nombre.toLowerCase().includes(v)));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Segmented options={OPC.map(([k, l]) => [k, `${l} ${n(k)}`] as const)} value={f} onChange={setF} />
      <View style={{ backgroundColor: t.fill, borderRadius: 10, paddingHorizontal: Space.m, minHeight: 44, justifyContent: 'center' }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar jugadora" placeholderTextColor={t.label3} autoCorrect={false} clearButtonMode="while-editing"
          accessibilityLabel="Buscar jugadora" style={{ color: t.label, fontSize: 17, paddingVertical: 8 }} />
      </View>
      {lista.length ? (
        <Group>
          {lista.map(({ x, c }) => (
            <Row key={x.id} minHeight={64} leading={<Avatar name={x.nombre} />} title={x.nombre} subtitle={<T v="caption" dim numberOfLines={2}>{linea(x, c)}</T>}
              trailing={<Badge text={BADGE[c][1]} tone={BADGE[c][0]} />} chevron onPress={() => router.push({ pathname: '/ficha', params: { id: String(x.id) } })} />
          ))}
        </Group>
      ) : <Empty sf="magnifyingglass" ion="search-outline" title="Sin resultados" />}
    </Screen>
  );
}
