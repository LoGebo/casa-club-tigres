// Modal: coordinación registra una visita ya autorizada.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { changed, type Jug } from '@/features/coord-mas/util';

export default function VisitaCoordNueva() {
  const [js, setJs] = useState<Jug[] | null>(null);
  const [jid, setJid] = useState('');
  const [visitante, setVisitante] = useState('');
  const [relacion, setRelacion] = useState('');
  const [fecha, setFecha] = useState(() => Date.now() + 36e5);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void run(() => api<Jug[]>('/jugadoras')).then((r) => r && setJs(r.filter((j) => j.activa))); }, []);

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api('/visitas', 'POST', { jugadora_id: +jid, visitante, relacion, fecha_at: fecha }));
    setBusy(false);
    if (r) { notify('Visita autorizada'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Autorizar visita">
      {!js ? <Loading /> : (
        <>
          <Group header="Jugadora"><Choice options={js.map((j) => [String(j.id), j.nombre] as const)} value={jid} onChange={setJid} /></Group>
          <Group header="Visita">
            <TextField label="Visitante" value={visitante} onChangeText={setVisitante} autoCapitalize="words" />
            <TextField label="Relación (opcional)" value={relacion} onChangeText={setRelacion} placeholder="Madre, amigo…" />
            <DateTimeField label="Fecha y hora" value={fecha} onChange={setFecha} />
          </Group>
          <Button title="Autorizar visita" loading={busy} disabled={!jid || !visitante.trim()} onPress={guardar} />
        </>
      )}
    </SheetScreen>
  );
}
