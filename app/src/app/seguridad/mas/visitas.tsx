// Visitas autorizadas por Coordinación: registrar entrada (con documento) y salida.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Empty, Group, Loading, Row, Screen, T } from '@/components/ui';
import { dt, hm } from '@/features/seguridad/util';
import { api } from '@/lib/api';

type V = { id: number; visitante: string; jugadora: string; relacion?: string; estado: 'autorizada' | 'dentro'; fecha_at: number; entrada_at?: number };

export default function Visitas() {
  const [vs, setVs] = useState<V[] | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<V[]>('/visitas')); if (r) setVs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accion = async (v: V, a: 'entrada' | 'salida') => {
    setBusy(true);
    const r = await run(() => api(`/visitas/${v.id}/${a}`, 'POST', { documento: a === 'entrada' ? doc.trim() : '' }));
    setBusy(false);
    if (r) { notify(a === 'entrada' ? 'Entrada registrada' : 'Salida registrada'); setAbierta(null); setDoc(''); await load(); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Visitas' }} />
      {!vs ? <Loading /> : vs.length === 0 ? <Empty sf="door.left.hand.open" ion="enter-outline" title="No hay visitas autorizadas" text="Las visitas sin autorización de Coordinación no pueden entrar." /> : (
        vs.map((v) => (
          <Group key={v.id}>
            <Row minHeight={64} title={v.visitante}
              subtitle={<T v="caption" dim numberOfLines={2}>{`Visita a ${v.jugadora}${v.relacion ? ` · ${v.relacion}` : ''} · ${dt(v.fecha_at)}${v.entrada_at ? ` · entró ${hm(v.entrada_at)}` : ''}`}</T>}
              trailing={<Badge text={v.estado === 'dentro' ? 'Dentro' : 'Autorizada'} tone={v.estado === 'dentro' ? 'ok' : 'tint'} />} />
            {v.estado === 'autorizada' && abierta === v.id ? <TextField label="Documento revisado" value={doc} onChangeText={setDoc} placeholder="INE, pasaporte…" /> : null}
            {v.estado === 'autorizada' && abierta === v.id ? <Row title="Confirmar entrada" minHeight={48} onPress={busy ? undefined : () => accion(v, 'entrada')} /> : null}
            {v.estado === 'autorizada' && abierta !== v.id ? <Row title="Registrar entrada" onPress={() => { setAbierta(v.id); setDoc(''); }} /> : null}
            {v.estado === 'dentro' ? <Row title="Registrar salida" onPress={busy ? undefined : () => accion(v, 'salida')} /> : null}
          </Group>
        ))
      )}
    </Screen>
  );
}
