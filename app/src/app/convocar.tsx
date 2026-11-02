// Convocatoria de un viaje: la coordinación elige QUIÉN viaja (PUT /viajes/:id/jug). Nunca se convoca a todas por defecto.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Avatar, Badge, Button, Empty, Group, Icon, Loading, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';
import type { Viaje } from '@/features/calendario';
import { Chips, confirmar, DISP, dispDe, noDisp, type Jugadora } from '@/features/coord/util';

const dentro = (e?: string) => e === 'convocada' || e === 'confirmada';
const ETQ: Record<string, [string, 'gold' | 'ok' | 'warn' | 'bad']> = { convocada: ['Convocada', 'gold'], confirmada: ['Confirmada', 'ok'], quiere: ['Quiere ir', 'warn'], baja: ['No puede', 'bad'] };

export default function Convocar() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cats = useCategorias();
  const [js, setJs] = useState<Jugadora[] | null>(null);
  const [v, setV] = useState<Viaje | null>(null);
  const [on, setOn] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState<{ pendientes: number } | null>(null);
  const [error, setError] = useState(false);
  const est: Record<number, string> = Object.fromEntries((v?.jugadoras || []).map((j) => [j.id, j.estado]));

  useEffect(() => {
    void run(() => Promise.all([api<Jugadora[]>('/jugadoras'), api<Viaje[]>('/viajes')])).then((r) => {
      if (!r) { setError(true); return; }
      const viaje = r[1].find((x) => x.id === +id) ?? null;
      setJs(r[0].filter((j) => j.activa)); setV(viaje);
      setOn(new Set((viaje?.jugadoras || []).filter((j) => dentro(j.estado)).map((j) => j.id)));
    });
  }, [id]);

  const alternar = (j: Jugadora) => {
    tap();
    setOn((s) => {
      const n = new Set(s);
      if (!n.delete(j.id)) { n.add(j.id); if (noDisp(j)) notify(`${j.nombre.split(' ')[0]} está en ${DISP[dispDe(j)].toLowerCase()}. Revisa antes de convocarla.`); }
      return n;
    });
  };

  const guardar = async () => {
    if (!js) return;
    const nuevas = [...on].filter((i) => !dentro(est[i])), quitar = js.filter((j) => dentro(est[j.id]) && !on.has(j.id)).map((j) => j.id);
    if (!nuevas.length && !quitar.length) { router.back(); return; }
    const aviso = js.filter((j) => nuevas.includes(j.id) && noDisp(j));
    if (aviso.length && !(await confirmar('Jugadoras no disponibles', `${aviso.map((j) => `${j.nombre} (${DISP[dispDe(j)].toLowerCase()})`).join(', ')}. ¿Convocarlas de todos modos?`, 'Convocar'))) return;
    setBusy(true);
    const r = await run(async () => {
      let pendientes = 0;
      if (nuevas.length) pendientes = (await api<{ pendientes_tutor: number }>(`/viajes/${id}/jug`, 'PUT', { ids: nuevas, estado: 'convocada' })).pendientes_tutor;
      if (quitar.length) pendientes = (await api<{ pendientes_tutor: number }>(`/viajes/${id}/jug`, 'PUT', { ids: quitar, estado: null })).pendientes_tutor;
      return { pendientes };
    });
    setBusy(false);
    if (r) { if (nuevas.length) setHecho(r); else { notify('Convocatoria guardada'); router.back(); } }
  };

  if (hecho) {
    return (
      <SheetScreen title="Convocatoria lista">
        <View style={{ alignItems: 'center', gap: Space.s, paddingVertical: Space.l }}>
          <Icon sf="checkmark.circle.fill" ion="checkmark-circle" size={56} color={t.ok} />
          <T v="title">{on.size} convocadas</T>
        </View>
        <T v="body">Se creó un permiso de viaje para cada una. A las mayores de edad ya les queda autorizado.</T>
        {hecho.pendientes > 0 ? (
          <View style={{ backgroundColor: t.warnWeak, borderRadius: Radius.m, padding: Space.l, gap: 4 }}>
            <T v="headline" color={t.warn}>{hecho.pendientes} menor{hecho.pendientes === 1 ? '' : 'es'} sin autorización</T>
            <T v="sub">Su mamá, papá o tutor debe autorizar el viaje. Mándales el enlace y el código por WhatsApp desde el viaje. Sin eso no podrán abordar.</T>
          </View>
        ) : null}
        <Button title={hecho.pendientes > 0 ? 'Enviar a tutores' : 'Ver el viaje'} onPress={() => router.replace({ pathname: '/viaje-coord', params: { id: String(id) } })} />
        <Button title="Cerrar" kind="plain" onPress={() => router.back()} />
      </SheetScreen>
    );
  }

  const ql = q.trim().toLowerCase();
  const lista = (js ?? []).filter((j) => (!cat || j.categoria === cat) && (!ql || j.nombre.toLowerCase().includes(ql)));
  const quieren = lista.filter((j) => est[j.id] === 'quiere');
  const resto = lista.filter((j) => est[j.id] !== 'quiere');

  const fila = (j: Jugadora) => {
    const e = est[j.id], marcada = on.has(j.id), d = dispDe(j);
    return (
      <Pressable key={j.id} onPress={() => alternar(j)} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}
        accessibilityLabel={`${j.nombre}${j.categoria ? ', ' + j.categoria : ''}${noDisp(j) ? ', ' + DISP[d] : ''}${e ? ', ' + ETQ[e][0] : ''}`}
        style={({ pressed }) => ({ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingHorizontal: Space.l, paddingVertical: Space.s, backgroundColor: pressed ? t.fill : 'transparent' })}>
        <Icon sf={marcada ? 'checkmark.circle.fill' : 'circle'} ion={marcada ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={marcada ? t.tint : t.label3} />
        <Avatar name={j.nombre} size={34} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="headline" style={{ fontWeight: '500' }}>{j.nombre}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {j.categoria ? <T v="caption" dim>{j.categoria}</T> : null}
            {e ? <Badge text={ETQ[e][0]} tone={ETQ[e][1]} /> : null}
            {noDisp(j) ? <Badge text={DISP[d]} tone="warn" /> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SheetScreen title={v ? `Convocar · ${v.titulo}` : 'Convocar'}>
      {error ? <Empty sf="wifi.slash" ion="cloud-offline-outline" title="No se pudo cargar" text="Revisa tu conexión y vuelve a abrir esta pantalla." />
        : !js || !v ? <Loading /> : (
        <>
          <T v="sub" dim>Elige solo a quienes viajan. Al convocar se crea su permiso de viaje; a las menores de edad todavía les falta la autorización de su tutor.</T>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar jugadora" placeholderTextColor={t.label3} autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Buscar jugadora"
            style={{ color: t.label, fontSize: 17, backgroundColor: t.fill, borderRadius: Radius.s, paddingHorizontal: Space.m, minHeight: 44 }} />
          {cats.length ? <Chips opts={[['', 'Todas'], ...cats.map((c) => [c, c] as const)]} value={cat} onChange={setCat} /> : null}
          {quieren.length ? <Group header={`Quieren viajar (${quieren.length})`}>{quieren.map(fila)}</Group> : null}
          {resto.length ? <Group header={quieren.length ? 'Demás jugadoras' : undefined}>{resto.map(fila)}</Group> : null}
          {!lista.length ? <Empty sf="person.2" ion="people-outline" title="Sin resultados" text="Cambia la búsqueda o la categoría." /> : null}
          <Button title={`Guardar convocatoria · ${on.size}`} loading={busy} onPress={guardar} />
        </>
      )}
    </SheetScreen>
  );
}
