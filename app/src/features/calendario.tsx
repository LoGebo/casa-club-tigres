// Calendario de la liga y viajes del equipo. Lo usan jugadora, seguridad y coordinación (solo coordinación edita).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { abbr, Crest, esTigres } from '@/components/crest';
import { run, notify } from '@/components/notify';
import { Badge, Button, Card, Empty, Group, Icon, Loading, Row, Screen, Segmented, T, tap } from '@/components/ui';
import { brand, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export type Partido = { id: number; torneo?: string; jornada?: number; local: string; visitante: string; inicio_at: number; sede?: string; resultado?: string; demo: boolean };
export type Viaje = {
  id: number; partido_id?: number; titulo: string; destino: string; salida_at: number; regreso_at: number; transporte?: string; hospedaje?: string; nota?: string;
  yo: string | null; cuentas: Record<'convocada' | 'quiere' | 'confirmada' | 'baja', number>; jugadoras?: { id: number; nombre: string; estado: string }[];
};

const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const larga = (ms: number) => new Date(ms).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const corta = (ms: number) => new Date(ms).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + hora(ms);
const faltan = (ms: number) => {
  const d = Math.round((new Date(dayKey(ms) + 'T12:00').getTime() - new Date(dayKey(Date.now()) + 'T12:00').getTime()) / 864e5);
  return d <= 0 ? (ms < Date.now() - 3 * 36e5 ? 'Finalizado' : 'Hoy') : d === 1 ? 'Mañana' : `En ${d} días`;
};
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Sub = 'tigres' | 'liga' | 'viajes';
const ETQ: Record<string, [string, 'gold' | 'ok' | 'warn' | 'bad']> = { convocada: ['Convocada', 'gold'], confirmada: ['Confirmada', 'ok'], quiere: ['Quiere ir', 'warn'], baja: ['No puede', 'bad'] };

export default function Calendario() {
  const t = useTheme();
  const { session } = useAuth();
  const edita = session?.rol === 'coordinacion';
  const [ahora] = useState(() => Date.now()); // marca estable por render (el calendario se recarga al enfocar)
  const [sub, setSub] = useState<Sub>('tigres');
  const [ps, setPs] = useState<Partido[] | null>(null);
  const [vs, setVs] = useState<Viaje[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Partido[]>('/partidos'), api<Viaje[]>('/viajes')]));
    if (r) { setPs(r[0]); setVs(r[1]); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!ps) return <Screen><Loading /></Screen>;

  const lista = sub === 'tigres' ? ps.filter((p) => esTigres(p.local) || esTigres(p.visitante)) : ps;
  const por: Record<string, Partido[]> = {};
  lista.forEach((p) => (por[dayKey(p.inicio_at)] ||= []).push(p));
  const dias = Object.keys(por).sort();
  const hoy = dayKey(ahora);
  const proximo = lista.find((p) => p.inicio_at >= ahora - 3 * 36e5);
  const viajeDe = (p: Partido) => vs.some((v) => v.partido_id === p.id);
  const hayDemo = ps.some((p) => p.demo);

  const strip = Array.from({ length: 28 }, (_, i) => { const d = new Date(ahora); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });

  return (
    <Screen
      scrollRef={scroll}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Segmented options={[['tigres', 'Tigres'], ['liga', 'Liga'], ['viajes', 'Viajes']] as const} value={sub} onChange={setSub} />

      {sub === 'viajes' ? (
        <>
          {edita ? <Button title="Nuevo viaje" kind="gold" onPress={() => router.push('/viaje-nuevo')} icon={<Icon sf="plus" ion="add" size={20} color={t.onGold} />} /> : null}
          {vs.length ? vs.map((v) => <TripCard key={v.id} v={v} edita={edita} rol={session?.rol} reload={load} />) : <Empty sf="bus" ion="bus-outline" title="Sin viajes programados" text="Cuando haya partido de visita, aquí verás salida, regreso y convocadas." />}
        </>
      ) : (
        <>
          {sub === 'tigres' && proximo ? <NextMatch p={proximo} /> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }} style={{ marginHorizontal: -Space.l, paddingHorizontal: Space.l, flexGrow: 0 }}>
            {strip.map((d) => {
              const k = dayKey(d.getTime()), g = por[k], esHoy = k === hoy;
              return (
                <Pressable key={k} disabled={!g} onPress={() => { tap(); const y = ys.current[k]; if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }); }}
                  accessibilityLabel={`${larga(d.getTime())}${g ? `, ${g.length} partido` : ', sin partidos'}`}
                  style={{ width: 48, alignItems: 'center', paddingVertical: 8, gap: 4, opacity: g || esHoy ? 1 : 0.38 }}>
                  <T v="caption" dim style={{ textTransform: 'capitalize' }}>{d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</T>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: esHoy ? t.hero : 'transparent' }}>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: esHoy ? '#fff' : t.label, fontVariant: ['tabular-nums'] }}>{d.getDate()}</Text>
                  </View>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: g ? (g.some((p) => esTigres(p.local) || esTigres(p.visitante)) ? brand.gold : t.label3) : 'transparent' }} />
                </Pressable>
              );
            })}
          </ScrollView>

          {dias.length === 0 ? (
            <Empty sf="calendar" ion="calendar-outline" title="Aún no hay partidos" text={edita ? 'Agrega uno o importa el calendario de la liga.' : 'Coordinación publicará aquí el calendario.'} />
          ) : (
            dias.map((k, idx) => {
              const d = new Date(k + 'T12:00');
              const mes = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
              const nuevoMes = idx === 0 || new Date(dias[idx - 1] + 'T12:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) !== mes;
              return (
                <View key={k} onLayout={(e) => { ys.current[k] = e.nativeEvent.layout.y; }} style={{ gap: Space.s }}>
                  {nuevoMes ? <T v="title" style={{ marginTop: idx ? Space.m : 0 }}>{mayus(mes)}</T> : null}
                  <View style={{ flexDirection: 'row', gap: Space.m, alignItems: 'flex-start' }}>
                    <View style={{ width: 44, alignItems: 'center', paddingTop: 8, gap: 2 }}>
                      <T v="caption" dim style={{ textTransform: 'capitalize' }}>{d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</T>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: k === hoy ? t.tint : t.label, fontVariant: ['tabular-nums'] }}>{d.getDate()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Group>{por[k].map((p) => <Fixture key={p.id} p={p} viaja={viajeDe(p)} />)}</Group>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {edita ? (
            <Group>
              <Row title="Agregar partido" leading={<Icon sf="plus.circle.fill" ion="add-circle" />} onPress={() => router.push('/partido-nuevo')} chevron />
              <Row title="Importar calendario (CSV)" leading={<Icon sf="square.and.arrow.down" ion="download-outline" />} onPress={() => router.push('/importar')} chevron />
              {hayDemo ? <Row title="Quitar partidos de ejemplo" leading={<Icon sf="trash" ion="trash-outline" color={t.bad} />} onPress={() => run(async () => { await api('/partidos', 'DELETE'); notify('Ejemplos quitados'); await load(); })} /> : null}
            </Group>
          ) : null}
          {hayDemo ? <T v="caption" dim style={{ textAlign: 'center' }}>Calendario de ejemplo con fechas inventadas. Coordinación carga el real.</T> : null}
        </>
      )}
    </Screen>
  );
}

function NextMatch({ p }: { p: Partido }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push({ pathname: '/partido', params: { id: String(p.id) } })} accessibilityRole="button" accessibilityLabel={`Próximo partido: ${p.local} contra ${p.visitante}`}
      style={({ pressed }) => ({ backgroundColor: t.hero, borderRadius: Radius.l, padding: 20, gap: 14, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: brand.gold, fontSize: 15, fontWeight: '700' }}>{faltan(p.inicio_at)}</Text>
        <Text style={{ color: t.onHero2, fontSize: 15 }}>{mayus(larga(p.inicio_at))}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center', gap: 8 }}><Crest team={p.local} size={68} /><Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{p.local}</Text></View>
        <View style={{ alignItems: 'center', minWidth: 92 }}>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 0.5 }}>{p.resultado ?? hora(p.inicio_at)}</Text>
          <Text style={{ color: t.onHero2, fontSize: 12 }}>{p.resultado ? 'Resultado' : 'hrs'}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 8 }}><Crest team={p.visitante} size={68} /><Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{p.visitante}</Text></View>
      </View>
      {p.sede ? <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' }}><Icon sf="mappin.and.ellipse" ion="location-outline" size={15} color={t.onHero2} /><Text style={{ color: t.onHero2, fontSize: 14 }}>{p.sede}</Text></View> : null}
    </Pressable>
  );
}

function Fixture({ p, viaja }: { p: Partido; viaja: boolean }) {
  const t = useTheme();
  const tig = esTigres(p.local) || esTigres(p.visitante);
  const nombre = (team: string) => ({ fontSize: 16, fontWeight: tig && esTigres(team) ? '700' : '500', color: tig && esTigres(team) ? t.tint : t.label }) as const;
  return (
    <Pressable onPress={() => { tap(); router.push({ pathname: '/partido', params: { id: String(p.id) } }); }} accessibilityRole="button" accessibilityLabel={`${p.local} contra ${p.visitante}, ${hora(p.inicio_at)}`}
      style={({ pressed }) => ({ minHeight: 68, paddingHorizontal: Space.m, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? t.fill : 'transparent' })}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Crest team={p.local} size={32} /><Text style={nombre(p.local)}>{abbr(p.local)}</Text></View>
      <View style={{ alignItems: 'center', minWidth: 84, gap: 1 }}>
        <Text style={{ fontSize: p.resultado ? 20 : 17, fontWeight: '700', color: t.label, fontVariant: ['tabular-nums'] }}>{p.resultado ?? hora(p.inicio_at)}</Text>
        <T v="caption" dim numberOfLines={1} style={{ maxWidth: 110 }}>{p.jornada ? `J${p.jornada}` : ''}</T>
        {viaja ? <Text style={{ fontSize: 11, fontWeight: '700', color: t.warn }}>Viaja el equipo</Text> : null}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}><Text style={nombre(p.visitante)}>{abbr(p.visitante)}</Text><Crest team={p.visitante} size={32} /></View>
    </Pressable>
  );
}

function TripCard({ v, edita, rol, reload }: { v: Viaje; edita: boolean; rol?: string; reload: () => Promise<void> }) {
  const t = useTheme();
  const c = v.cuentas;
  const abrir = () => {
    tap();
    const pathname = rol === 'coordinacion' ? '/viaje-coord' : rol === 'seguridad' ? '/abordaje' : '/viaje-jugadora';
    router.push({ pathname, params: { id: String(v.id) } });
  };
  const yo = async (estado: string, msg: string) => { await run(async () => { await api(`/viajes/${v.id}/yo`, 'POST', { estado }); notify(msg); await reload(); }); };
  return (
    <Card style={{ gap: Space.m }}>
      <Pressable onPress={abrir} accessibilityRole="button" accessibilityLabel={`Abrir viaje ${v.titulo}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.s, minHeight: 44 }}>
        <T v="headline" style={{ flex: 1 }}>{v.titulo}</T>
        {rol === 'jugadora' && v.yo ? <Badge text={ETQ[v.yo][0]} tone={ETQ[v.yo][1]} /> : null}
        <Icon sf="chevron.right" ion="chevron-forward" size={14} color={t.label3} />
      </Pressable>
      <Group>
        <Row minHeight={44} title="Destino" trailing={<T v="sub" style={{ fontWeight: '600' }}>{v.destino}</T>} />
        <Row minHeight={44} title="Sale" trailing={<T v="sub" style={{ fontWeight: '600' }}>{corta(v.salida_at)}</T>} />
        <Row minHeight={44} title="Regresa" trailing={<T v="sub" style={{ fontWeight: '600' }}>{corta(v.regreso_at)}</T>} />
        {v.transporte ? <Row minHeight={44} title="Transporte" trailing={<T v="sub" style={{ fontWeight: '600' }}>{v.transporte}</T>} /> : null}
        {v.hospedaje ? <Row minHeight={44} title="Hospedaje" trailing={<T v="sub" style={{ fontWeight: '600' }}>{v.hospedaje}</T>} /> : null}
      </Group>
      <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: Radius.s, paddingVertical: 10 }}>
        {([[c.convocada + c.confirmada, 'convocadas'], [c.confirmada, 'confirmadas'], [c.quiere, 'quieren ir']] as const).map(([n, l]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color: t.label, fontVariant: ['tabular-nums'] }}>{n}</Text><T v="caption" dim>{l}</T></View>
        ))}
      </View>
      {rol !== 'jugadora' && v.jugadoras?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{v.jugadoras.map((j) => <Badge key={j.id} text={`${j.nombre.split(' ')[0]} · ${ETQ[j.estado]?.[0] ?? j.estado}`} tone={ETQ[j.estado]?.[1] ?? 'neutral'} />)}</View>
      ) : null}
      {rol === 'jugadora' ? (
        v.yo === 'convocada' ? <View style={{ gap: 8 }}><Button title="Confirmo que voy" onPress={() => yo('confirmada', 'Confirmado ✓')} /><Button title="No puedo" kind="tinted" onPress={() => yo('baja', 'Avisaste que no puedes')} /></View>
          : v.yo === 'confirmada' ? <Button title="Ya no puedo ir" kind="tinted" onPress={() => yo('baja', 'Avisaste que no puedes')} />
          : v.yo === 'quiere' ? <Button title="Cancelar mi solicitud" kind="tinted" onPress={() => yo('quitar', 'Solicitud cancelada')} />
          : v.yo === 'baja' ? null : <Button title="Quiero ir" kind="gold" onPress={() => yo('quiere', 'Solicitud enviada ✓')} />
      ) : null}
      {edita ? <View style={{ gap: 8 }}><Button title="Administrar viaje" onPress={abrir} /><Button title="Convocar jugadoras" kind="tinted" small onPress={() => router.push({ pathname: '/convocar', params: { id: String(v.id) } })} /></View> : null}
      {rol === 'seguridad' ? <Button title="Lista de abordaje" kind="tinted" onPress={abrir} /> : null}
    </Card>
  );
}
