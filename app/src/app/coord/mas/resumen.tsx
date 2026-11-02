// Resumen semanal: reporte con comparación contra el periodo anterior, rankings y texto para compartir.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Group, Icon, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Bar, ErrorBox, compartir, dt, useLoad } from '@/features/coord-mas/util';

type Per = { salidas: number; regresos: number; tardes: number; incidencias: number; permisos: number; visitas: number };
type Res = {
  dias: number; desde: number; hasta: number; activas: number; actual: Per; anterior: Per;
  incidencias_por_tipo: { tipo: string; n: number }[]; incidencias_abiertas: number; sin_regresar: number;
  mas_tardes: { id: number; nombre: string; n: number }[]; mas_salidas: { id: number; nombre: string; n: number }[];
  servicios: { creados: number; resueltos: number; abiertos: number };
  conteos: { at: number; total: number; presentes: number }[];
  comedor: { registros: number; jugadoras_con_registro: number; dias_completos: number };
  viajes: { id: number; titulo: string; salida_at: number; convocadas: number }[];
};

const dia = (ms: number) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

/** Cambio contra el periodo previo. `malo` = que suba es una mala noticia (retrasos, incidencias). */
function Delta({ now, prev, malo, light }: { now: number; prev: number; malo?: boolean; light?: boolean }) {
  const t = useTheme();
  const base = light ? t.onHero2 : t.label2;
  if (now === prev) return <T v="caption" color={base}>Igual que antes</T>;
  const sube = now > prev;
  const color = light ? t.onHero : malo ? (sube ? t.bad : t.ok) : base;
  const txt = prev === 0 ? 'Antes: 0' : `${sube ? '+' : '−'}${Math.round((Math.abs(now - prev) / prev) * 100)}%`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={`${sube ? 'Subió' : 'Bajó'} ${txt}`}>
      <Icon sf={sube ? 'arrow.up.right' : 'arrow.down.right'} ion={sube ? 'trending-up' : 'trending-down'} size={14} color={color} />
      <T v="caption" color={color} style={{ fontWeight: '600' }}>{txt}</T>
    </View>
  );
}

export default function Resumen() {
  const t = useTheme();
  const [dias, setDias] = useState<'7' | '30'>('7');
  const { data: r, err, load, refresh, refreshing } = useLoad<Res>(`/resumen?dias=${dias}`);
  const head = <Segmented options={[['7', '7 días'], ['30', '30 días']] as const} value={dias} onChange={setDias} />;

  if (!r) return <Screen>{<Stack.Screen options={{ title: 'Resumen' }} />}{head}{err ? <ErrorBox text={err} onRetry={load} /> : <Loading />}</Screen>;

  const a = r.actual, p = r.anterior;
  const aTiempo = Math.max(0, a.regresos - a.tardes);
  const maxInc = Math.max(1, ...r.incidencias_por_tipo.map((x) => x.n));
  const pres = r.conteos.length ? Math.round((r.conteos.reduce((s, c) => s + (c.total ? c.presentes / c.total : 1), 0) / r.conteos.length) * 100) : null;
  const partic = r.activas ? Math.round((r.comedor.jugadoras_con_registro / r.activas) * 100) : 0;
  const rango = `${dia(r.desde)} al ${dia(r.hasta)}`;

  const texto = () => [
    `Casa Club · Resumen de ${r.dias} días (${rango})`, '',
    `Salidas: ${a.salidas} (antes ${p.salidas})`,
    `Regresos: ${a.regresos}, ${a.tardes} tarde (antes ${p.tardes})`,
    `Permisos: ${a.permisos} · Visitas: ${a.visitas}`,
    `Incidencias: ${a.incidencias} (antes ${p.incidencias}), ${r.incidencias_abiertas} abierta${r.incidencias_abiertas === 1 ? '' : 's'}`,
    r.sin_regresar ? `Sin regresar a tiempo ahora: ${r.sin_regresar}` : '',
    r.mas_tardes.length ? `\nRegresos tarde: ${r.mas_tardes.map((x) => `${x.nombre} (${x.n})`).join(', ')}` : '',
    r.mas_salidas.length ? `Más salidas: ${r.mas_salidas.map((x) => `${x.nombre} (${x.n})`).join(', ')}` : '',
    r.incidencias_por_tipo.length ? `Incidencias por tipo: ${r.incidencias_por_tipo.map((x) => `${cap(x.tipo)} ${x.n}`).join(', ')}` : '',
    `\nServicios: ${r.servicios.creados} nuevos, ${r.servicios.resueltos} resueltos, ${r.servicios.abiertos} abiertos`,
    pres != null ? `Conteos: ${r.conteos.length}, presencia promedio ${pres}%` : '',
    `Comedor: ${r.comedor.jugadoras_con_registro} de ${r.activas} jugadoras registraron (${partic}%), ${r.comedor.dias_completos} días completos`,
    r.viajes.length ? `Viajes: ${r.viajes.map((v) => `${v.titulo} (${dia(v.salida_at)}, ${v.convocadas} convocadas)`).join('; ')}` : '',
  ].filter((x, i, arr) => x !== '' || arr[i - 1] !== '').join('\n');

  const fila = (label: string, now: number, prev: number, malo?: boolean) => (
    <Row key={label} minHeight={56} title={label} trailing={<View style={{ alignItems: 'flex-end', gap: 2 }}><T v="title" style={{ fontVariant: ['tabular-nums'] }}>{now}</T><Delta now={now} prev={prev} malo={malo} /></View>} />
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: 'Resumen' }} />
      {head}
      <View style={{ backgroundColor: t.hero, borderRadius: 20, padding: Space.l, gap: Space.m }}>
        <T v="caption" color={t.onHero2} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{rango}</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <T v="large" color={t.onHero} style={{ fontSize: 44, lineHeight: 50 }}>{a.salidas}</T>
            <T v="sub" color={t.onHero2}>salidas del club</T>
          </View>
          <Delta now={a.salidas} prev={p.salidas} light />
        </View>
        <View style={{ flexDirection: 'row', gap: Space.xl }}>
          <View><T v="headline" color={t.onHero}>{aTiempo}</T><T v="caption" color={t.onHero2}>a tiempo</T></View>
          <View><T v="headline" color={t.gold}>{a.tardes}</T><T v="caption" color={t.onHero2}>tarde</T></View>
          <View><T v="headline" color={t.onHero}>{r.incidencias_abiertas}</T><T v="caption" color={t.onHero2}>incid. abiertas</T></View>
        </View>
      </View>

      {r.sin_regresar > 0 ? (
        <Card style={{ backgroundColor: t.badWeak }}>
          <T v="headline" color={t.bad}>{r.sin_regresar} jugadora{r.sin_regresar === 1 ? '' : 's'} sin regresar</T>
          <T v="sub">Salió{r.sin_regresar === 1 ? '' : 'ieron'} y ya pasó su hora de regreso. Revisa Hoy en Inicio.</T>
        </Card>
      ) : null}

      <Group header={`Contra los ${r.dias} días anteriores`} footer="Rojo solo cuando subir es malo (regresos tarde, incidencias). Lo demás es informativo.">
        {fila('Salidas', a.salidas, p.salidas)}
        {fila('Regresos', a.regresos, p.regresos)}
        {fila('Regresos tarde', a.tardes, p.tardes, true)}
        {fila('Incidencias', a.incidencias, p.incidencias, true)}
        {fila('Permisos pedidos', a.permisos, p.permisos)}
        {fila('Visitas', a.visitas, p.visitas)}
      </Group>

      <Group header="Más regresos tarde">
        {r.mas_tardes.length === 0 ? <Row title="Nadie regresó tarde" leading={<Icon sf="checkmark.circle.fill" ion="checkmark-circle" color={t.ok} />} /> :
          r.mas_tardes.map((x, i) => <Row key={x.id} minHeight={52} leading={<T v="headline" dim style={{ width: 20 }}>{i + 1}</T>} title={x.nombre} trailing={<Badge text={`${x.n} vez${x.n === 1 ? '' : 'es'}`} tone="warn" />} />)}
      </Group>
      <Group header="Más salidas">
        {r.mas_salidas.length === 0 ? <Row title="Sin salidas en el periodo" /> :
          r.mas_salidas.map((x, i) => <Row key={x.id} minHeight={52} leading={<T v="headline" dim style={{ width: 20 }}>{i + 1}</T>} title={x.nombre} trailing={<T v="headline" style={{ fontVariant: ['tabular-nums'] }}>{x.n}</T>} />)}
      </Group>

      <Group header="Incidencias por tipo">
        {r.incidencias_por_tipo.length === 0 ? <Row title="Sin incidencias" leading={<Icon sf="checkmark.circle.fill" ion="checkmark-circle" color={t.ok} />} /> :
          r.incidencias_por_tipo.map((x) => (
            <Row key={x.tipo} minHeight={56} title={cap(x.tipo)} subtitle={<Bar pct={x.n / maxInc} color={t.warn} height={6} />} trailing={<T v="headline" style={{ fontVariant: ['tabular-nums'] }}>{x.n}</T>} />
          ))}
      </Group>

      <Group header="Servicios">
        <Row title="Solicitudes nuevas" trailing={<T v="headline">{r.servicios.creados}</T>} />
        <Row title="Resueltas" trailing={<T v="headline">{r.servicios.resueltos}</T>} />
        <Row title="Abiertas ahora" trailing={<Badge text={String(r.servicios.abiertos)} tone={r.servicios.abiertos ? 'warn' : 'ok'} />} />
      </Group>

      <Group header="Conteos de la noche" footer={r.conteos.length ? 'Seguridad cuenta quién está dentro. Se marcan los conteos con faltantes.' : undefined}>
        {r.conteos.length === 0 ? <Row title="Sin conteos en el periodo" /> : (
          <>
            <Row title="Presencia promedio" subtitle={`${r.conteos.length} conteo${r.conteos.length === 1 ? '' : 's'}`} trailing={<T v="title">{pres}%</T>} />
            {r.conteos.slice(0, 5).map((c) => <Row key={c.at} minHeight={48} title={dt(c.at)} trailing={<Badge text={`${c.presentes} de ${c.total}`} tone={c.presentes < c.total ? 'warn' : 'ok'} />} />)}
          </>
        )}
      </Group>

      <Group header="Comedor">
        <Row title="Participación" subtitle={<Bar pct={partic / 100} color={partic >= 70 ? t.ok : partic >= 40 ? t.warn : t.bad} height={6} />} trailing={<View style={{ alignItems: 'flex-end' }}><T v="title">{partic}%</T><T v="caption" dim>{r.comedor.jugadoras_con_registro} de {r.activas}</T></View>} />
        <Row title="Registros" trailing={<T v="headline">{r.comedor.registros}</T>} />
        <Row title="Días completos (3 comidas)" trailing={<T v="headline">{r.comedor.dias_completos}</T>} />
      </Group>

      <Group header="Viajes">
        {r.viajes.length === 0 ? <Row title="Sin viajes en el periodo" /> : r.viajes.map((v) => <Row key={v.id} minHeight={56} title={v.titulo} subtitle={dt(v.salida_at)} trailing={<Badge text={`${v.convocadas} convocadas`} tone="tint" />} />)}
      </Group>

      <Button title="Compartir resumen" icon={<Icon sf="square.and.arrow.up" ion="share-outline" size={20} color={t.bg === '#000000' ? '#071647' : '#FFFFFF'} />} onPress={() => compartir(texto(), 'Resumen Casa Club')} />
    </Screen>
  );
}
