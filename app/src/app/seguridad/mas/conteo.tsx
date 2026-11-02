// Pase de lista del toque de queda: marca a cada jugadora localizada dentro; las que faltan generan alerta urgente.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T, impact } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { dt } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { enviarOCola } from '@/lib/cola';

type J = { id: number; nombre: string; habitacion?: string; categoria?: string; fuera: boolean; destino?: string };
type C = { id: number; at: number; total: number; presentes: number; staff?: string; detalle?: string | { ausentes?: string[] } };

const ausentesDe = (c: C): string[] => {
  try { const d = typeof c.detalle === 'string' ? JSON.parse(c.detalle) : c.detalle; return d?.ausentes ?? []; } catch { return []; }
};

export default function Conteo() {
  const t = useTheme();
  const [lista, setLista] = useState<J[] | null>(null);
  const [hist, setHist] = useState<C[]>([]);
  const [toque, setToque] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ausentes: string[]; cola: boolean; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<J[]>('/conteo'), api<C[]>('/conteos'), api<{ toque_queda?: string }>('/config')]));
    if (!r) return;
    setLista(r[0]); setHist(r[1]); setToque(r[2].toque_queda ?? '');
    const dentro = new Set(r[0].filter((j) => !j.fuera).map((j) => j.id));
    setSel((s) => new Set([...s].filter((id) => dentro.has(id))));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const titulo = <Stack.Screen options={{ title: 'Pase de lista' }} />;
  if (!lista) return <Screen>{titulo}<Loading /></Screen>;

  const dentro = lista.filter((j) => !j.fuera), fuera = lista.filter((j) => j.fuera);
  const faltan = dentro.filter((j) => !sel.has(j.id));
  const completo = dentro.length > 0 && faltan.length === 0;
  const toggle = (id: number) => { impact(); setConfirmar(false); setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; }); };

  const registrar = async () => {
    if (faltan.length && !confirmar) return setConfirmar(true);
    setBusy(true);
    const ausentes = faltan.map((j) => j.nombre);
    const r = await run(() => enviarOCola('/conteo', { presentes: [...sel] }, `Pase de lista (${sel.size}/${dentro.length})`));
    setBusy(false);
    if (r) { setRes({ ausentes, cola: r === 'en_cola', total: dentro.length }); setSel(new Set()); setConfirmar(false); void load(); }
  };

  if (res) {
    const bien = res.ausentes.length === 0;
    return (
      <Screen>
        {titulo}
        <View accessibilityRole="header" style={{ backgroundColor: bien ? t.ok : t.bad, borderRadius: Radius.l, padding: Space.xl, alignItems: 'center', gap: 6 }}>
          <Icon sf={bien ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'} ion={bien ? 'checkmark-circle' : 'warning'} size={52} color={t.surface} />
          <Text style={{ color: t.surface, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>{bien ? 'Todas presentes' : `${res.ausentes.length} sin localizar`}</Text>
          <Text style={{ color: t.surface, fontSize: 17, textAlign: 'center' }}>{`${res.total - res.ausentes.length} de ${res.total} localizadas`}</Text>
        </View>
        {res.cola ? <T v="sub" color={t.warn} style={{ fontWeight: '600' }}>Guardado, se enviará al volver la señal</T> : null}
        {!bien ? (
          <Group header="Sin localizar · alerta urgente generada">
            {res.ausentes.map((n) => <Row key={n} minHeight={52} title={<T v="headline" color={t.bad}>{n}</T>} leading={<Icon sf="person.fill.questionmark" ion="help-circle" color={t.bad} />} />)}
          </Group>
        ) : null}
        <Button title="Listo" onPress={() => setRes(null)} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {titulo}
      {toque ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.m, backgroundColor: t.tintWeak, borderRadius: Radius.m, padding: Space.l }}>
          <Icon sf="moon.fill" ion="moon" size={24} />
          <View style={{ flex: 1 }}>
            <T v="headline">{`Toque de queda: ${toque}`}</T>
            <T v="sub" dim>Recorre las habitaciones y marca a cada jugadora que veas dentro.</T>
          </View>
        </View>
      ) : null}

      {dentro.length === 0 ? <Empty sf="person.2" ion="people-outline" title="Sin jugadoras para contar" /> : (
        <>
          <View accessible accessibilityLabel={`${sel.size} de ${dentro.length} localizadas`} style={{ backgroundColor: completo ? t.okWeak : t.surface, borderRadius: Radius.l, padding: Space.l, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: completo ? t.ok : t.label, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{sel.size}</Text>
              <T v="title" dim>{`de ${dentro.length} localizadas`}</T>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.fill, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round((sel.size / dentro.length) * 100)}%`, height: 8, backgroundColor: completo ? t.ok : t.tint }} />
            </View>
          </View>
          <Button title={sel.size ? 'Quitar todas las marcas' : 'Marcar a todas presentes'} kind="tinted" onPress={() => { setConfirmar(false); setSel(sel.size ? new Set() : new Set(dentro.map((j) => j.id))); }} />

          <Group header={`Dentro de Casa Club · ${dentro.length}`}>
            {dentro.map((j) => {
              const on = sel.has(j.id);
              return (
                <Pressable key={j.id} onPress={() => toggle(j.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${j.nombre}${j.habitacion ? `, habitación ${j.habitacion}` : ''}`}
                  style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingHorizontal: Space.l, backgroundColor: pressed ? t.fill : 'transparent' })}>
                  <Icon sf={on ? 'checkmark.circle.fill' : 'circle'} ion={on ? 'checkmark-circle' : 'ellipse-outline'} size={34} color={on ? t.ok : t.label3} />
                  <View style={{ flex: 1 }}>
                    <T v="headline" style={{ fontWeight: '500' }}>{j.nombre}</T>
                    <T v="caption" dim>{[j.categoria, j.habitacion ? `Hab. ${j.habitacion}` : ''].filter(Boolean).join(' · ')}</T>
                  </View>
                </Pressable>
              );
            })}
          </Group>
        </>
      )}

      {fuera.length ? (
        <Group header={`Afuera con permiso · ${fuera.length}`} footer="No se cuentan en el pase de lista.">
          {fuera.map((j) => <Row key={j.id} minHeight={56} title={j.nombre} subtitle={j.destino ?? undefined} trailing={<Badge text="Afuera" tone="gold" />} />)}
        </Group>
      ) : null}

      {confirmar ? (
        <View accessibilityRole="alert" style={{ backgroundColor: t.badWeak, borderRadius: Radius.m, padding: Space.l, gap: 4 }}>
          <T v="headline" color={t.bad}>{`${faltan.length} sin localizar`}</T>
          <T v="sub" color={t.bad}>Se generará una alerta urgente para:</T>
          {faltan.map((j) => <T key={j.id} v="body" color={t.bad} style={{ fontWeight: '600' }}>{j.nombre}</T>)}
        </View>
      ) : null}
      {dentro.length ? <Button title={confirmar ? 'Registrar y alertar' : 'Registrar pase de lista'} kind={confirmar ? 'danger' : 'filled'} loading={busy} onPress={registrar} /> : null}

      {hist.length ? (
        <Group header="Pases de lista recientes">
          {hist.slice(0, 8).map((c) => {
            const a = ausentesDe(c);
            return <Row key={c.id} minHeight={56} title={dt(Number(c.at))} subtitle={a.length ? <T v="caption" color={t.bad}>{`Sin localizar: ${a.join(', ')}`}</T> : c.staff ? `Registró ${c.staff}` : undefined}
              trailing={<Badge text={`${c.presentes}/${c.total}`} tone={a.length ? 'bad' : 'ok'} />} />;
          })}
        </Group>
      ) : null}
    </Screen>
  );
}
