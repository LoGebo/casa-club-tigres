// Convocatoria de un viaje: marca quiénes viajan (PUT /viajes/:id/jug).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Avatar, Badge, Button, Empty, Group, Icon, Loading, Row, T } from '@/components/ui';
import { api } from '@/lib/api';
import type { Viaje } from '@/features/calendario';
import type { Jugadora } from '@/features/coord/util';

const dentro = (e?: string) => e === 'convocada' || e === 'confirmada';
const ETQ: Record<string, [string, 'gold' | 'ok' | 'warn' | 'bad']> = { convocada: ['Convocada', 'gold'], confirmada: ['Confirmada', 'ok'], quiere: ['Quiere ir', 'warn'], baja: ['No puede', 'bad'] };

export default function Convocar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [js, setJs] = useState<Jugadora[] | null>(null);
  const [v, setV] = useState<Viaje | null>(null);
  const [on, setOn] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const est: Record<number, string> = Object.fromEntries((v?.jugadoras || []).map((j) => [j.id, j.estado]));

  useEffect(() => {
    void run(() => Promise.all([api<Jugadora[]>('/jugadoras'), api<Viaje[]>('/viajes')])).then((r) => {
      if (!r) return;
      const viaje = r[1].find((x) => x.id === +id) ?? null;
      setJs(r[0].filter((j) => j.activa)); setV(viaje);
      setOn(new Set((viaje?.jugadoras || []).filter((j) => dentro(j.estado)).map((j) => j.id)));
    });
  }, [id]);

  const guardar = async () => {
    if (!js) return;
    const nuevas = [...on].filter((i) => !dentro(est[i])), quitar = js.filter((j) => dentro(est[j.id]) && !on.has(j.id)).map((j) => j.id);
    setBusy(true);
    const r = await run(async () => {
      if (nuevas.length) await api(`/viajes/${id}/jug`, 'PUT', { ids: nuevas, estado: 'convocada' });
      if (quitar.length) await api(`/viajes/${id}/jug`, 'PUT', { ids: quitar, estado: null });
      return true;
    });
    setBusy(false);
    if (r) { notify('Convocatoria guardada'); router.back(); }
  };

  return (
    <SheetScreen title={v ? `Convocar · ${v.titulo}` : 'Convocar'}>
      {!js || !v ? <Loading /> : (
        <>
          <T v="sub" dim>Marca a quienes viajan. Las que pidieron ir aparecen señaladas.</T>
          {js.length ? (
            <Group footer={`${on.size} convocadas`}>
              {js.map((j) => (
                <Row key={j.id} minHeight={52} leading={<Avatar name={j.nombre} size={34} />} title={j.nombre}
                  trailing={<>{est[j.id] ? <Badge text={ETQ[est[j.id]][0]} tone={ETQ[est[j.id]][1]} /> : null}{on.has(j.id) ? <Icon sf="checkmark.circle.fill" ion="checkmark-circle" /> : <Icon sf="circle" ion="ellipse-outline" />}</>}
                  onPress={() => setOn((s) => { const n = new Set(s); if (!n.delete(j.id)) n.add(j.id); return n; })} />
              ))}
            </Group>
          ) : <Empty title="Sin jugadoras activas" />}
          <Button title="Guardar convocatoria" loading={busy} onPress={guardar} />
        </>
      )}
    </SheetScreen>
  );
}
