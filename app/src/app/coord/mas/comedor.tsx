// Comedor: revisión de lo que comen las jugadoras (con foto y comentarios), menú semanal y cobertura de registros.
import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form';
import { Foto } from '@/components/foto';
import { notify, run } from '@/components/notify';
import { Badge, Button, Card, Empty, Group, Icon, Loading, Row, Screen, Segmented, T, tap } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { Bar, Chips, DayStepper, ErrorBox, NOMBRE_COMIDA, addDays, hm, hoyStr, largaDia, lunesDe, useLoad } from '@/features/coord-mas/util';

type Comida = { id: number; jugadora_id: number; jugadora: string; categoria?: string; tipo: string; descripcion?: string; foto?: string | null; comentario?: string | null; creado_at: number; fecha: string };
type Jug = { id: number; nombre: string; activa: boolean; categoria?: string };
type Cob = { id: number; nombre: string; categoria?: string; dias_completos: number; registros: number; hoy: number };
type MenuRow = { fecha: string; tipo: string; descripcion: string };

const SUGERENCIAS = ['Muy bien, así se come', 'Falta proteína', 'Agrega fruta o verdura', 'Cuida las porciones', 'Toma más agua'];

export default function Comedor() {
  const [sub, setSub] = useState<'hoy' | 'menu' | 'cobertura'>('hoy');
  const head = <Segmented options={[['hoy', 'Hoy'], ['menu', 'Menú'], ['cobertura', 'Cobertura']] as const} value={sub} onChange={setSub} />;
  return (
    <>
      <Stack.Screen options={{ title: 'Comedor' }} />
      {sub === 'hoy' ? <Hoy head={head} /> : sub === 'menu' ? <Menu head={head} /> : <Cobertura head={head} />}
    </>
  );
}

function Hoy({ head }: { head: ReactNode }) {
  const t = useTheme();
  const [dia, setDia] = useState(hoyStr());
  const [solo, setSolo] = useState<'todas' | 'sin'>('todas');
  const [abierta, setAbierta] = useState<number | null>(null);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, err, load, refresh, refreshing } = useLoad<Comida[]>(`/comidas?fecha=${dia}`);
  const { data: js } = useLoad<Jug[]>('/jugadoras');

  const hoyOPasado = dia <= hoyStr();
  const regs = (data ?? []).filter((c) => c.fecha === dia);
  const con = new Set(regs.map((c) => c.jugadora_id));
  const activas = (js ?? []).filter((j) => j.activa);
  const faltan = activas.filter((j) => !con.has(j.id));
  const lista = regs.filter((c) => solo === 'todas' || !c.comentario);

  const abrir = (c: Comida) => { tap(); if (abierta === c.id) setAbierta(null); else { setAbierta(c.id); setTxt(c.comentario ?? ''); } };
  const enviar = async (c: Comida) => {
    setBusy(true);
    const ok = await run(() => api(`/comidas/${c.id}`, 'PATCH', { comentario: txt.trim() }));
    setBusy(false);
    if (ok) { notify(txt.trim() ? `Comentario enviado a ${c.jugadora.split(' ')[0]}` : 'Comentario quitado'); setAbierta(null); await load(); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {head}
      <DayStepper value={dia} onChange={(d) => { setDia(d); setAbierta(null); }} />
      {!data ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : (
        <>
          <Card>
            <T v="num">{con.size}{js ? ` de ${activas.length}` : ''}</T>
            <T v="sub" dim>jugadoras registraron comida · {regs.length} registro{regs.length === 1 ? '' : 's'}</T>
            {js ? <Bar pct={activas.length ? con.size / activas.length : 0} /> : null}
          </Card>
          <Chips options={[['todas', 'Todos'], ['sin', `Sin comentar (${regs.filter((c) => !c.comentario).length})`]] as const} value={solo} onChange={setSolo} />
          {lista.length === 0 ? (
            <Empty sf="fork.knife" ion="restaurant-outline" title={regs.length === 0 ? 'Aún no hay registros' : 'Todo comentado'} text={regs.length === 0 ? `Nadie ha subido comidas el ${largaDia(dia)}.` : 'Ya revisaste todos los registros.'} />
          ) : (
            <Group header="Registros">
              {lista.map((c) => (
                <View key={c.id}>
                  <Pressable onPress={() => abrir(c)} accessibilityRole="button" accessibilityLabel={`${c.jugadora}, ${NOMBRE_COMIDA[c.tipo] ?? c.tipo}. Comentar`} style={({ pressed }) => ({ flexDirection: 'row', gap: Space.m, padding: Space.m, paddingHorizontal: Space.l, backgroundColor: pressed ? t.fill : 'transparent', alignItems: 'center' })}>
                    <View style={{ width: 64 }}>{c.foto ? <Foto url={c.foto} ratio={1} radius={10} /> : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon sf="text.alignleft" ion="document-text-outline" color={t.label3} /></View>}</View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="headline">{c.jugadora}</T>
                      <T v="caption" dim>{NOMBRE_COMIDA[c.tipo] ?? c.tipo} · {hm(c.creado_at)}{c.categoria ? ` · ${c.categoria}` : ''}</T>
                      {c.descripcion ? <T v="sub">{c.descripcion}</T> : <T v="sub" dim>Solo foto</T>}
                      {c.comentario ? <T v="caption" color={t.ok} style={{ fontWeight: '600' }}>Tu comentario: {c.comentario}</T> : null}
                    </View>
                    {!c.comentario ? <Badge text="Sin revisar" tone="warn" /> : null}
                  </Pressable>
                  {abierta === c.id ? (
                    <View style={{ paddingHorizontal: Space.l, paddingBottom: Space.l, gap: Space.m }}>
                      {c.foto ? <Foto url={c.foto} /> : null}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.s }}>
                        {SUGERENCIAS.map((s) => (
                          <Pressable key={s} onPress={() => { tap(); setTxt(s); }} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: t.tintWeak, justifyContent: 'center' }}>
                            <T v="sub" color={t.tint} style={{ fontWeight: '500' }}>{s}</T>
                          </Pressable>
                        ))}
                      </View>
                      <View style={{ borderRadius: 10, overflow: 'hidden' }}><TextField label={`Comentario para ${c.jugadora.split(' ')[0]} (le llega como notificación)`} value={txt} onChangeText={setTxt} multiline /></View>
                      <View style={{ flexDirection: 'row', gap: Space.s }}>
                        <View style={{ flex: 1 }}><Button small kind="tinted" title="Cancelar" onPress={() => setAbierta(null)} /></View>
                        <View style={{ flex: 1 }}><Button small title={c.comentario && !txt.trim() ? 'Quitar comentario' : 'Enviar'} loading={busy} disabled={!txt.trim() && !c.comentario} onPress={() => enviar(c)} /></View>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </Group>
          )}
          {hoyOPasado && js && faltan.length > 0 ? (
            <Group header={`Sin registrar (${faltan.length})`} footer="No subieron ninguna comida este día.">
              <Card style={{ borderRadius: 0 }}><T v="sub">{faltan.map((j) => j.nombre).join(' · ')}</T></Card>
            </Group>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Menu({ head }: { head: ReactNode }) {
  const t = useTheme();
  const [lunes, setLunes] = useState(lunesDe(hoyStr()));
  const { data, err, load, refresh, refreshing } = useLoad<MenuRow[]>(`/menu?desde=${lunes}&dias=7`);
  const hoy = hoyStr();
  const dias = [...Array(7)].map((_, i) => addDays(lunes, i));
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {head}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
        <Pressable onPress={() => setLunes(addDays(lunes, -7))} accessibilityLabel="Semana anterior" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon sf="chevron.left" ion="chevron-back" size={18} /></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}><T v="headline">Semana del {largaDia(lunes).split(', ')[1] ?? largaDia(lunes)}</T></View>
        <Pressable onPress={() => setLunes(addDays(lunes, 7))} accessibilityLabel="Semana siguiente" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon sf="chevron.right" ion="chevron-forward" size={18} /></Pressable>
      </View>
      <Button title="Editar menú de la semana" kind="tinted" onPress={() => router.push({ pathname: '/menu-editar', params: { desde: lunes } })} icon={<Icon sf="pencil" ion="create-outline" size={18} />} />
      {!data ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : data.length === 0 ? (
        <Empty sf="fork.knife" ion="restaurant-outline" title="Sin menú esta semana" text="Captúralo para que las jugadoras sepan qué sigue en el comedor." />
      ) : (
        dias.map((d) => {
          const rs = data.filter((r) => r.fecha === d);
          return (
            <Group key={d} header={d === hoy ? `Hoy · ${largaDia(d)}` : largaDia(d)}>
              {rs.length === 0 ? <Row minHeight={44} title={<T v="sub" color={t.label3}>Sin menú</T>} /> : rs.map((r) => (
                <Row key={r.tipo} minHeight={48} title={<T v="sub">{r.descripcion}</T>} leading={<T v="caption" dim style={{ width: 76 }}>{NOMBRE_COMIDA[r.tipo] ?? r.tipo}</T>} />
              ))}
            </Group>
          );
        })
      )}
    </Screen>
  );
}

function Cobertura({ head }: { head: ReactNode }) {
  const t = useTheme();
  const { data, err, load, refresh, refreshing } = useLoad<Cob[]>('/comidas/cobertura?dias=7');
  if (!data || data.length === 0) return <Screen refreshing={refreshing} onRefresh={refresh}>{head}{!data ? (err ? <ErrorBox text={err} onRetry={load} /> : <Loading />) : <Empty sf="person.2" ion="people-outline" title="Sin jugadoras activas" />}</Screen>;
  const nunca = data.filter((x) => x.registros === 0);
  const resto = data.filter((x) => x.registros > 0);
  const prom = data.reduce((s, x) => s + x.dias_completos, 0) / data.length;
  const fila = (x: Cob) => (
    <Row key={x.id} minHeight={72} title={x.nombre}
      subtitle={
        <View style={{ gap: 6 }}>
          <Bar pct={x.dias_completos / 7} color={x.dias_completos >= 5 ? t.ok : x.dias_completos >= 3 ? t.warn : t.bad} />
          <T v="caption" dim>{x.dias_completos} de 7 días completos · {x.registros} registro{x.registros === 1 ? '' : 's'}{x.categoria ? ` · ${x.categoria}` : ''}</T>
        </View>
      }
      trailing={<View style={{ alignItems: 'flex-end' }}><T v="headline" style={{ fontVariant: ['tabular-nums'] }}>{x.hoy}/3</T><T v="caption" dim>hoy</T></View>} />
  );
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {head}
      <Card>
        <T v="num">{prom.toFixed(1)} de 7</T>
        <T v="sub" dim>días completos en promedio (desayuno, comida y cena) en los últimos 7 días.</T>
      </Card>
      {nunca.length > 0 ? (
        <Group header={`Nunca registran (${nunca.length})`} footer="No han subido ninguna comida en 7 días. Vale la pena hablar con ellas.">
          {nunca.map((x) => <Row key={x.id} minHeight={56} title={x.nombre} subtitle={x.categoria} trailing={<Badge text="Sin registros" tone="bad" />} />)}
        </Group>
      ) : null}
      <Group header="Ranking de la semana">{resto.map(fila)}</Group>
    </Screen>
  );
}
