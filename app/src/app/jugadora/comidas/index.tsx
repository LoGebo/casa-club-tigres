import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Foto } from '@/components/foto';
import { notify } from '@/components/notify';
import { Badge, Card, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { TIPOS_COMIDA } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Comida = { id: number; fecha: string; tipo: string; descripcion?: string; foto?: string | null; comentario?: string | null; creado_at: number };
type Menu = { fecha: string; tipo: string; descripcion: string };
type Resumen = { hoy: Record<string, boolean>; racha: number; semana: { fecha: string; n: number }[] };

const iso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nombreTipo = (k: string) => TIPOS_COMIDA.find((x) => x[0] === k)?.[1] ?? k;
const diaLargo = (f: string) => {
  const h = iso(), a = iso(new Date(Date.now() - 864e5));
  if (f === h) return 'Hoy';
  if (f === a) return 'Ayer';
  return new Date(f + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
};

function Hero({ r }: { r: Resumen }) {
  const t = useTheme();
  const hechas = (['desayuno', 'comida', 'cena'] as const).filter((k) => r.hoy[k]).length;
  return (
    <View style={{ backgroundColor: t.hero, borderRadius: Radius.l, padding: Space.l, gap: Space.m }} accessible accessibilityLabel={`Hoy llevas ${hechas} de 3 comidas. Racha de ${r.racha} días.`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <T v="caption" color={t.onHero2} style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Hoy</T>
          <T v="num" color={t.onHero} style={{ fontSize: 34 }}>{hechas} de 3</T>
          <T v="sub" color={t.onHero2}>comidas registradas</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="num" color={t.gold} style={{ fontSize: 34 }}>{r.racha}</T>
          <T v="sub" color={t.onHero2}>{r.racha === 1 ? 'día de racha' : 'días de racha'}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < hechas ? t.gold : 'rgba(255,255,255,0.22)' }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel="Últimos 7 días">
        {r.semana.map((d) => (
          <View key={d.fecha} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: d.n === 3 ? t.gold : 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              {d.n === 3 ? <Icon sf="checkmark" ion="checkmark" size={13} color={t.onGold} /> : null}
            </View>
            <T v="caption" color={t.onHero2} style={{ fontSize: 11 }}>{new Date(d.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'narrow' }).toUpperCase()}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Comidas() {
  const t = useTheme();
  const [d, setD] = useState<{ res: Resumen; lista: Comida[]; menu: Menu[] } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const [res, lista, menu] = await Promise.all([api<Resumen>('/comidas/resumen'), api<Comida[]>('/comidas'), api<Menu[]>('/menu?dias=1').catch(() => [] as Menu[])]);
      setD({ res, lista, menu }); setError(false);
    } catch (e) { setError(true); notify(e instanceof Error ? e.message : 'No se pudo cargar'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!d) return <Screen onRefresh={load}>{error ? <Empty sf="wifi.slash" ion="cloud-offline-outline" title="No se pudo cargar" text="Desliza hacia abajo para reintentar." /> : <Loading />}</Screen>;
  const hoy = iso();
  const deHoy = d.lista.filter((c) => c.fecha === hoy);
  const dias = [...new Set(d.lista.map((c) => c.fecha))];

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <Hero r={d.res} />

      <Group header="Hoy" footer="Toca una comida para subir tu foto o decir qué comiste. Si ya la registraste, puedes cambiarla o borrarla.">
        {TIPOS_COMIDA.map(([k, nombre]) => {
          const regs = deHoy.filter((c) => c.tipo === k);
          const hecho = regs.length > 0 || !!d.res.hoy[k];
          const menu = d.menu.find((m) => m.tipo === k && m.fecha === hoy)?.descripcion;
          return (
            <Row key={k} minHeight={68}
              onPress={() => router.push({ pathname: '/comida-nueva', params: regs[0] && k !== 'colacion' ? { tipo: k, id: String(regs[0].id) } : { tipo: k } })}
              leading={
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: hecho ? t.okWeak : t.fill }}>
                  <Icon sf={hecho ? 'checkmark' : 'plus'} ion={hecho ? 'checkmark' : 'add'} size={16} color={hecho ? t.ok : t.label2} />
                </View>
              }
              title={nombre}
              subtitle={<T v="caption" dim numberOfLines={2}>{menu ? `Menú: ${menu}` : 'Sin menú publicado'}</T>}
              trailing={hecho ? <Badge text={k === 'colacion' && regs.length > 1 ? `${regs.length} registros` : 'Registrada'} tone="ok" /> : <Badge text="Pendiente" />}
              chevron />
          );
        })}
      </Group>

      <View style={{ gap: Space.s }}>
        <T v="caption" dim style={{ marginLeft: Space.l, textTransform: 'uppercase', letterSpacing: 0.3 }}>Últimos 7 días</T>
        {dias.length ? dias.map((f) => (
          <Card key={f} style={{ gap: Space.m }}>
            <T v="headline" style={{ textTransform: 'capitalize' }}>{diaLargo(f)}</T>
            {d.lista.filter((c) => c.fecha === f).map((c) => (
              <View key={c.id} style={{ gap: 6 }}>
                <Foto url={c.foto} ratio={16 / 10} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
                  <T v="sub" style={{ fontWeight: '600' }}>{nombreTipo(c.tipo)}</T>
                  <T v="caption" dim>{new Date(c.creado_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</T>
                </View>
                {c.descripcion ? <T v="sub" dim>{c.descripcion}</T> : null}
                {c.comentario ? (
                  <View style={{ backgroundColor: t.tintWeak, borderRadius: Radius.s, padding: Space.m, gap: 2 }}>
                    <T v="caption" color={t.tint} style={{ fontWeight: '700' }}>Comentario de Coordinación</T>
                    <T v="sub">{c.comentario}</T>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )) : <Empty sf="fork.knife" ion="restaurant-outline" title="Aún no registras comidas" text="Registra tu primera comida de hoy y empieza tu racha." />}
      </View>
    </Screen>
  );
}
