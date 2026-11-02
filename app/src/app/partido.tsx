// Detalle de partido para todos los roles. Coordinación edita resultado/sede, quita el partido o crea el viaje.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Crest, esTigres } from '@/components/crest';
import { SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Loading, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Partido, Viaje } from '@/features/calendario';
import { confirmar, dt } from '@/features/coord/util';

export default function PartidoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const edita = session?.rol === 'coordinacion';
  const [p, setP] = useState<Partido | null | undefined>(undefined);
  const [v, setV] = useState<Viaje | undefined>();
  const [res, setRes] = useState('');
  const [sede, setSede] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void run(() => Promise.all([api<Partido[]>('/partidos?atras=365'), api<Viaje[]>('/viajes?atras=365')])).then((r) => {
      if (!r) return setP(null);
      const x = r[0].find((q) => q.id === +id) ?? null;
      setP(x); setV(r[1].find((q) => q.partido_id === +id)); setRes(x?.resultado ?? ''); setSede(x?.sede ?? '');
    });
  }, [id]);

  return (
    <SheetScreen title="Partido">
      {p === undefined ? <Loading /> : p === null ? <T v="sub" dim>No se encontró el partido.</T> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}><Crest team={p.local} size={56} /><T v="sub" style={{ fontWeight: '600', textAlign: 'center' }}>{p.local}</T></View>
            <T v="large">{p.resultado ?? 'vs'}</T>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}><Crest team={p.visitante} size={56} /><T v="sub" style={{ fontWeight: '600', textAlign: 'center' }}>{p.visitante}</T></View>
          </View>
          <Group>
            <Row minHeight={48} title="Fecha" trailing={<T v="sub">{dt(p.inicio_at)}</T>} />
            {p.jornada ? <Row minHeight={48} title="Jornada" trailing={<T v="sub">{p.jornada}</T>} /> : null}
            {p.sede ? <Row minHeight={48} title="Sede" trailing={<T v="sub">{p.sede}</T>} /> : null}
            {v ? <Row minHeight={48} title="Viaje" subtitle={v.titulo} /> : null}
          </Group>
          {edita ? (
            <>
              <Group header="Editar">
                <TextField label="Resultado" value={res} onChangeText={setRes} placeholder="2-1" />
                <TextField label="Sede" value={sede} onChangeText={setSede} />
              </Group>
              <View style={{ gap: Space.s }}>
                <Button title="Guardar" loading={busy} onPress={async () => {
                  setBusy(true);
                  const r = await run(() => api(`/partidos/${p.id}`, 'PATCH', { resultado: res, sede }));
                  setBusy(false);
                  if (r) { notify('Guardado'); router.back(); }
                }} />
                {esTigres(p.local) || esTigres(p.visitante) ? (
                  v ? <Button kind="tinted" title="Convocar jugadoras" onPress={() => router.replace({ pathname: '/convocar', params: { id: String(v.id) } })} />
                    : <Button kind="tinted" title={esTigres(p.local) ? 'Crear convocatoria (local)' : 'Crear viaje para este partido'} onPress={() => router.replace({ pathname: '/viaje-nuevo', params: { partido_id: String(p.id) } })} />
                ) : null}
                <Button kind="danger" title="Quitar partido" onPress={async () => {
                  if (!(await confirmar('¿Quitar el partido?', `${p.local} vs ${p.visitante}`, 'Quitar'))) return;
                  if (await run(() => api(`/partidos/${p.id}`, 'DELETE'))) router.back();
                }} />
              </View>
            </>
          ) : v ? <T v="sub" dim>Hay un viaje programado. Revísalo en Calendario → Viajes.</T> : null}
        </>
      )}
    </SheetScreen>
  );
}
