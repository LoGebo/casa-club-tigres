// Detalle de un viaje para Coordinación: convocatoria, autorización de tutores, checklist y abordaje.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Viaje } from '@/features/calendario';
import { confirmar, dt } from '@/features/coord/util';

type Tutor = { permiso_id: number; jugadora_id: number; nombre: string; tutor_nombre?: string; estado: string; decision?: string | null; whatsapp: string | null; whatsapp_codigo: string | null };
type Check = { items: { id: number; texto: string }[]; jugadoras: { id: number; nombre: string; hechos: number }[]; total: number };
type Abordaje = { total: number; abordaron: number; regresaron: number };

const ETQ: Record<string, [string, 'gold' | 'ok' | 'warn' | 'bad']> = { convocada: ['Convocada', 'gold'], confirmada: ['Confirmada', 'ok'], quiere: ['Quiere ir', 'warn'], baja: ['No puede', 'bad'] };
const SUGERENCIAS = ['INE o pasaporte', 'Uniforme', 'Botines', 'Documento del tutor', 'Medicamentos', 'Tarea/escuela'];

export default function ViajeCoord() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [v, setV] = useState<Viaje | null>(null);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [chk, setChk] = useState<Check | null>(null);
  const [ab, setAb] = useState<Abordaje | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [estado, setEstado] = useState<'carga' | 'ok' | 'error' | 'noexiste'>('carga');

  const load = useCallback(async () => {
    const r = await run(() => api<Viaje[]>('/viajes?atras=60'));
    if (!r) { setEstado((e) => (e === 'carga' ? 'error' : e)); return; }
    const viaje = r.find((x) => x.id === +id);
    if (!viaje) { setEstado('noexiste'); return; }
    setV(viaje); setEstado('ok');
    const [a, b, c] = await Promise.all([api<Tutor[]>(`/viajes/${id}/tutores`).catch(() => null), api<Check>(`/viajes/${id}/checklist`).catch(() => null), api<Abordaje>(`/viajes/${id}/abordaje`).catch(() => null)]);
    if (a) setTutores(a); if (b) setChk(b); if (c) setAb(c);
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const abrir = (url: string | null) => { if (url) void Linking.openURL(url); else notify('Falta el teléfono del tutor en la ficha'); };
  const poner = (jid: number, est: string | null, msg: string) => run(async () => { await api(`/viajes/${id}/jug`, 'PUT', { ids: [jid], estado: est }); notify(msg); await load(); });
  const quitar = async (jid: number, nombre: string) => { if (await confirmar('Quitar de la convocatoria', `${nombre} dejará de estar convocada y su permiso de viaje se cancela.`, 'Quitar')) await poner(jid, null, 'Quitada del viaje'); };
  const agregar = async (texto: string) => {
    const x = texto.trim(); if (!x) return;
    const r = await run(() => api(`/viajes/${id}/items`, 'POST', { texto: x }));
    if (r) { setNuevo(''); await load(); }
  };
  const borrarItem = (item: number) => run(async () => { await api(`/viajes/${id}/items/${item}`, 'DELETE'); await load(); });
  const borrarViaje = async () => {
    if (!(await confirmar('Eliminar viaje', 'Se cancelan los permisos de viaje y se borra la convocatoria y el checklist. No se puede deshacer.', 'Eliminar'))) return;
    const r = await run(() => api(`/viajes/${id}`, 'DELETE'));
    if (r) { notify('Viaje eliminado'); router.back(); }
  };

  if (estado === 'carga') return <SheetScreen title="Viaje"><Loading /></SheetScreen>;
  if (estado !== 'ok' || !v) return <SheetScreen title="Viaje"><Empty sf="bus" ion="bus-outline" title={estado === 'error' ? 'No se pudo cargar' : 'El viaje ya no existe'} text={estado === 'error' ? 'Revisa tu conexión e inténtalo de nuevo.' : undefined} /></SheetScreen>;

  const c = v.cuentas, js = v.jugadoras ?? [];
  const orden = ['quiere', 'convocada', 'confirmada', 'baja'];
  const espera = tutores.filter((x) => x.estado === 'esperando_padres');
  const sugeridas = SUGERENCIAS.filter((s) => !chk?.items.some((i) => i.texto.toLowerCase() === s.toLowerCase()));

  return (
    <SheetScreen title={v.titulo}>
      <Group>
        <Row minHeight={48} title="Destino" trailing={<T v="sub" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v.destino}</T>} />
        <Row minHeight={48} title="Sale" trailing={<T v="sub" style={{ fontWeight: '600' }}>{dt(v.salida_at)}</T>} />
        <Row minHeight={48} title="Regresa" trailing={<T v="sub" style={{ fontWeight: '600' }}>{dt(v.regreso_at)}</T>} />
        {v.transporte ? <Row minHeight={48} title="Transporte" trailing={<T v="sub" style={{ fontWeight: '600' }}>{v.transporte}</T>} /> : null}
        {v.hospedaje ? <Row minHeight={48} title="Hospedaje" trailing={<T v="sub" style={{ fontWeight: '600' }}>{v.hospedaje}</T>} /> : null}
        {v.nota ? <Row minHeight={48} title="Nota" subtitle={v.nota} /> : null}
      </Group>

      {/* Convocatoria */}
      <View style={{ gap: Space.s }}>
        <T v="title">Convocatoria</T>
        <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: Radius.m, paddingVertical: Space.m }}>
          {([[c.convocada, 'convocadas'], [c.confirmada, 'confirmadas'], [c.quiere, 'quieren ir'], [c.baja, 'no pueden']] as const).map(([n, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{n}</T><T v="caption" dim>{l}</T></View>
          ))}
        </View>
        {js.length ? (
          <Group>
            {[...js].sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado)).map((j) => (
              <Row key={j.id} minHeight={60} title={j.nombre}
                subtitle={
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.s, alignItems: 'center', marginTop: 2 }}>
                    <Badge text={ETQ[j.estado]?.[0] ?? j.estado} tone={ETQ[j.estado]?.[1] ?? 'neutral'} />
                    {j.estado === 'quiere' || j.estado === 'convocada' ? (
                      <Pressable onPress={() => { tap(); void poner(j.id, j.estado === 'quiere' ? 'convocada' : 'confirmada', j.estado === 'quiere' ? 'Convocada' : 'Confirmada por ti'); }}
                        accessibilityRole="button" accessibilityLabel={`${j.estado === 'quiere' ? 'Convocar' : 'Confirmar por'} ${j.nombre}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
                        <T v="sub" color={t.tint} style={{ fontWeight: '600' }}>{j.estado === 'quiere' ? 'Convocar' : 'Confirmar por ella'}</T>
                      </Pressable>
                    ) : null}
                  </View>
                }
                trailing={
                  <Pressable onPress={() => { void quitar(j.id, j.nombre); }} accessibilityRole="button" accessibilityLabel={`Quitar a ${j.nombre}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf="minus.circle" ion="remove-circle-outline" color={t.bad} />
                  </Pressable>
                } />
            ))}
          </Group>
        ) : <Empty sf="person.2" ion="people-outline" title="Aún no hay convocadas" text="Elige quiénes viajan." />}
        <Button title="Elegir quiénes viajan" kind="tinted" onPress={() => router.push({ pathname: '/convocar', params: { id: String(v.id) } })} />
      </View>

      {/* Tutores */}
      <View style={{ gap: Space.s }}>
        <T v="title">Autorización de tutores</T>
        {!tutores.length ? <T v="sub" dim>Ninguna menor convocada necesita autorización del tutor.</T> : (
          <>
            {espera.length ? (
              <View style={{ backgroundColor: t.warnWeak, borderRadius: Radius.m, padding: Space.m }}>
                <T v="sub" color={t.warn} style={{ fontWeight: '600' }}>{espera.length} menor{espera.length === 1 ? '' : 'es'} sin autorización: no pueden abordar.</T>
              </View>
            ) : null}
            {tutores.map((x) => {
              const esp = x.estado === 'esperando_padres', rech = x.decision === 'rechazado';
              return (
                <View key={x.permiso_id} style={{ backgroundColor: t.surface, borderRadius: Radius.m, padding: Space.l, gap: Space.s }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s }}>
                    <View style={{ flex: 1 }}>
                      <T v="headline">{x.nombre}</T>
                      <T v="caption" dim>Tutor: {x.tutor_nombre || 'sin nombre'}</T>
                    </View>
                    <Badge text={rech ? 'Rechazó' : esp ? 'Esperando' : 'Aprobado'} tone={rech ? 'bad' : esp ? 'warn' : 'ok'} />
                  </View>
                  {esp ? (
                    x.whatsapp ? (
                      <>
                        <Button small kind="tinted" title="1  Enviar enlace por WhatsApp" icon={<Icon sf="paperplane.fill" ion="send" size={18} />} onPress={() => abrir(x.whatsapp)} />
                        <Button small kind="tinted" title="2  Enviar código" icon={<Icon sf="number" ion="keypad" size={18} />} onPress={() => abrir(x.whatsapp_codigo)} />
                        <T v="caption" dim>Manda primero el enlace y después el código: el tutor lo escribe en la página para autorizar.</T>
                      </>
                    ) : <T v="sub" color={t.bad}>No hay teléfono del tutor. Agrégalo en la ficha de la jugadora o autoriza desde Permisos.</T>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </View>

      {/* Checklist */}
      <View style={{ gap: Space.s }}>
        <T v="title">Checklist</T>
        <T v="sub" dim>Lo que cada jugadora debe llevar. Ellas lo marcan desde su app.</T>
        {chk?.items.length ? (
          <Group>
            {chk.items.map((i) => (
              <Row key={i.id} minHeight={48} title={i.texto}
                trailing={<Pressable onPress={() => { void borrarItem(i.id); }} accessibilityRole="button" accessibilityLabel={`Quitar ${i.texto}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Icon sf="xmark.circle.fill" ion="close-circle" color={t.label3} /></Pressable>} />
            ))}
          </Group>
        ) : null}
        <View style={{ flexDirection: 'row', gap: Space.s }}>
          <TextInput value={nuevo} onChangeText={setNuevo} placeholder="Agregar punto" placeholderTextColor={t.label3} accessibilityLabel="Nuevo punto del checklist" returnKeyType="done" onSubmitEditing={() => { void agregar(nuevo); }}
            style={{ flex: 1, color: t.label, fontSize: 17, backgroundColor: t.surface, borderRadius: Radius.m, paddingHorizontal: Space.l, minHeight: 48 }} />
          <View style={{ width: 96 }}><Button title="Agregar" disabled={!nuevo.trim()} onPress={() => agregar(nuevo)} /></View>
        </View>
        {sugeridas.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.s }}>
            {sugeridas.map((s) => (
              <Pressable key={s} onPress={() => { tap(); void agregar(s); }} accessibilityRole="button" accessibilityLabel={`Agregar ${s}`}
                style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: t.tintWeak }}>
                <T v="sub" color={t.tint} style={{ fontWeight: '600' }}>+ {s}</T>
              </Pressable>
            ))}
          </View>
        ) : null}
        {chk?.items.length && chk.jugadoras.length ? (
          <Group header="Avance por jugadora">
            {chk.jugadoras.map((j) => {
              const listo = j.hechos >= chk.total;
              return <Row key={j.id} minHeight={48} title={j.nombre} trailing={<Badge text={listo ? 'Completo' : `${j.hechos} de ${chk.total}`} tone={listo ? 'ok' : j.hechos ? 'warn' : 'neutral'} />} />;
            })}
          </Group>
        ) : null}
      </View>

      {/* Abordaje */}
      <View style={{ gap: Space.s }}>
        <T v="title">Abordaje</T>
        <Group>
          <Row minHeight={48} title="Abordaron" trailing={<T v="sub" style={{ fontWeight: '600' }}>{ab ? `${ab.abordaron} de ${ab.total}` : '—'}</T>} />
          <Row minHeight={48} title="Regresaron" trailing={<T v="sub" style={{ fontWeight: '600' }}>{ab ? `${ab.regresaron} de ${ab.total}` : '—'}</T>} />
        </Group>
        <Button title="Abrir lista de abordaje" onPress={() => router.push({ pathname: '/abordaje', params: { id: String(v.id) } })} />
      </View>

      <Button title="Eliminar viaje" kind="danger" onPress={borrarViaje} />
    </SheetScreen>
  );
}
