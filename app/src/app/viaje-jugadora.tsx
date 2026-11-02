import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, T, tap } from '@/components/ui';
import { Space } from '@/constants/theme';
import type { Viaje } from '@/features/calendario';
import { dt, EstadoBadge } from '@/features/jugadora/common';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Item = { id: number; texto: string; hecho: boolean };
type Permiso = { id: number; estado: string; viaje_id?: number | null };

const YO: Record<string, [string, 'warn' | 'ok' | 'tint' | 'neutral']> = {
  convocada: ['Te convocaron', 'warn'], confirmada: ['Confirmada', 'ok'], quiere: ['Pediste ir', 'tint'], baja: ['No vas', 'neutral'],
};

function Dato({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return <Row minHeight={48} title={<T v="caption" dim>{k}</T>} subtitle={<T v="body">{v}</T>} />;
}

export default function ViajeJugadora() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [v, setV] = useState<Viaje | null | undefined>();
  const [permiso, setPermiso] = useState<Permiso | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<Viaje[]>('/viajes?atras=30'), api<Permiso[]>('/permisos').catch(() => [] as Permiso[])]));
    if (!r) { setV((x) => x ?? null); return; }
    const viaje = r[0].find((x) => x.id === Number(id)) ?? null;
    setV(viaje);
    setPermiso(r[1].find((p) => p.viaje_id === Number(id) && p.estado !== 'cancelado') ?? r[1].find((p) => p.viaje_id === Number(id)) ?? null);
    if (viaje && (viaje.yo === 'convocada' || viaje.yo === 'confirmada')) {
      const c = await run(() => api<{ items: Item[] }>(`/viajes/${id}/checklist`));
      if (c) setItems(c.items);
    } else setItems([]);
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const responder = async (estado: 'confirmada' | 'baja' | 'quiere' | 'quitar', msg: string) => {
    setBusy(true);
    const r = await run(() => api(`/viajes/${id}/yo`, 'POST', { estado }));
    setBusy(false);
    if (r) { notify(msg); await load(); }
  };

  const marcar = async (it: Item) => {
    tap();
    setItems((l) => l.map((x) => (x.id === it.id ? { ...x, hecho: !it.hecho } : x)));
    const r = await run(() => api(`/viajes/${id}/check`, 'POST', { item_id: it.id, hecho: !it.hecho }));
    if (!r) setItems((l) => l.map((x) => (x.id === it.id ? { ...x, hecho: it.hecho } : x)));
  };

  if (v === undefined) return <SheetScreen title="Viaje"><Loading /></SheetScreen>;
  if (v === null) return <SheetScreen title="Viaje"><Empty sf="bus" ion="bus-outline" title="No encontramos este viaje" text="Puede que ya haya terminado o que Coordinación lo quitara." /></SheetScreen>;

  const hechos = items.filter((i) => i.hecho).length;
  const yo = v.yo ? YO[v.yo] : null;
  const menor = permiso?.estado === 'esperando_padres';

  return (
    <SheetScreen title={v.titulo}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s, flexWrap: 'wrap' }}>
        {yo ? <Badge text={yo[0]} tone={yo[1]} /> : <Badge text="No estás en la lista" />}
      </View>

      <Group>
        <Dato k="Destino" v={v.destino} />
        <Dato k="Salida" v={dt(v.salida_at)} />
        <Dato k="Regreso" v={dt(v.regreso_at)} />
        <Dato k="Transporte" v={v.transporte} />
        <Dato k="Hospedaje" v={v.hospedaje} />
        <Dato k="Nota" v={v.nota} />
      </Group>

      {permiso ? (
        <Group header="Tu permiso de salida">
          <Row minHeight={64} title="Viaje" trailing={<EstadoBadge e={permiso.estado} />}
            subtitle={<T v="caption" color={menor ? t.warn : t.label2}>
              {menor ? 'Esperando la autorización de tu mamá/papá/tutor. Sin ella no puedes abordar.'
                : permiso.estado === 'autorizado' ? 'Autorizado automáticamente por la convocatoria.'
                : permiso.estado === 'cancelado' ? 'Este permiso se canceló.'
                : 'Se genera cuando confirmas tu lugar.'}
            </T>} />
        </Group>
      ) : null}

      {v.yo === 'convocada' ? (
        <View style={{ gap: Space.s }}>
          <T v="sub" dim>Te convocaron a este viaje. ¿Vas a ir?</T>
          <Button title="Confirmo" onPress={() => responder('confirmada', 'Confirmaste tu lugar')} loading={busy} />
          <Button title="No puedo ir" kind="danger" onPress={() => responder('baja', 'Avisamos a Coordinación')} disabled={busy} />
        </View>
      ) : v.yo === 'confirmada' ? (
        <Button title="Ya no puedo ir" kind="danger" onPress={() => responder('baja', 'Avisamos a Coordinación')} loading={busy} />
      ) : v.yo === 'quiere' ? (
        <View style={{ gap: Space.s }}>
          <T v="sub" dim>Coordinación ya vio que quieres ir. Te avisará si te convoca.</T>
          <Button title="Cancelar mi solicitud" kind="tinted" onPress={() => responder('quitar', 'Solicitud cancelada')} loading={busy} />
        </View>
      ) : v.yo === 'baja' ? (
        <T v="sub" dim>Avisaste que no puedes ir. Si cambia algo, habla con Coordinación.</T>
      ) : (
        <Button title="Quiero ir" onPress={() => responder('quiere', 'Coordinación recibió tu solicitud')} loading={busy} />
      )}

      {items.length ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: Space.l }}>
            <T v="caption" dim style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>Qué llevar</T>
            <T v="caption" color={hechos === items.length ? t.ok : t.label2} style={{ fontWeight: '600' }}>{hechos === items.length ? 'Todo listo' : `${hechos} de ${items.length} listo`}</T>
          </View>
          <Group>
            {items.map((it) => (
              <Pressable key={it.id} onPress={() => marcar(it)} accessibilityRole="checkbox" accessibilityState={{ checked: it.hecho }} accessibilityLabel={it.texto}
                style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingHorizontal: Space.l, paddingVertical: Space.s, backgroundColor: pressed ? t.fill : 'transparent' })}>
                <Icon sf={it.hecho ? 'checkmark.circle.fill' : 'circle'} ion={it.hecho ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={it.hecho ? t.ok : t.label3} />
                <T v="body" dim={it.hecho} style={{ flex: 1, textDecorationLine: it.hecho ? 'line-through' : 'none' }}>{it.texto}</T>
              </Pressable>
            ))}
          </Group>
        </View>
      ) : null}
    </SheetScreen>
  );
}
