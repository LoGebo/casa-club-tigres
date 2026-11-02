// Bitácora del día: entradas y salidas de jugadoras y visitas.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { run } from '@/components/notify';
import { Empty, Group, Icon, Loading, Screen, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { dayStr, MovRow, type Movimiento } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

export default function Registro() {
  const t = useTheme();
  const [dia, setDia] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; });
  const [rows, setRows] = useState<Movimiento[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fecha = dayStr(dia);
  const esHoy = fecha === dayStr(new Date());

  const load = useCallback(async () => { const r = await run(() => api<Movimiento[]>(`/registro?fecha=${fecha}`)); if (r) setRows(r); }, [fecha]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const mover = (n: number) => { tap(); setRows(null); setDia((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; }); };
  const c = (f: (m: Movimiento) => boolean) => (rows ?? []).filter(f).length;
  const titulo = esHoy ? 'Hoy' : dia.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  const flecha = (n: number, sf: string, ion: 'chevron-back' | 'chevron-forward', label: string, off?: boolean) => (
    <Pressable onPress={() => mover(n)} disabled={off} accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.3 : 1 }}><Icon sf={sf} ion={ion} size={20} /></Pressable>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: Radius.m }}>
        {flecha(-1, 'chevron.left', 'chevron-back', 'Día anterior')}
        <T v="headline" style={{ textTransform: 'capitalize' }}>{titulo}</T>
        {flecha(1, 'chevron.right', 'chevron-forward', 'Día siguiente', esHoy)}
      </View>
      {!rows ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: Radius.m, paddingVertical: Space.m }}>
            {([[c((m) => m.quien === 'jugadora' && m.tipo === 'salida'), 'Salidas'], [c((m) => m.quien === 'jugadora' && m.tipo === 'regreso'), 'Regresos'], [c((m) => m.quien === 'visita'), 'Visitas']] as const).map(([n, l]) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 28, fontWeight: '700', color: t.label, fontVariant: ['tabular-nums'] }}>{n}</Text><T v="caption" dim>{l}</T></View>
            ))}
          </View>
          {rows.length ? <Group>{rows.map((m, i) => <MovRow key={i} m={m} />)}</Group> : <Empty sf="list.bullet.rectangle" ion="list-outline" title="Sin movimientos este día" />}
        </>
      )}
    </Screen>
  );
}
