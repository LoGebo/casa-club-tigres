// Nuevo partido (POST /partidos).
import { router } from 'expo-router';
import { useState } from 'react';

import { DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { api } from '@/lib/api';

export default function PartidoNuevo() {
  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [ini, setIni] = useState(() => Date.now() + 864e5);
  const [jornada, setJornada] = useState('');
  const [sede, setSede] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <SheetScreen title="Nuevo partido">
      <Group>
        <TextField label="Local" value={local} onChangeText={setLocal} autoCapitalize="words" />
        <TextField label="Visitante" value={visitante} onChangeText={setVisitante} autoCapitalize="words" />
        <DateTimeField label="Fecha y hora" value={ini} onChange={setIni} />
        <TextField label="Jornada" value={jornada} onChangeText={setJornada} keyboardType="number-pad" />
        <TextField label="Sede" value={sede} onChangeText={setSede} />
      </Group>
      <Button title="Agregar partido" loading={busy} disabled={!local.trim() || !visitante.trim()} onPress={async () => {
        setBusy(true);
        const r = await run(() => api('/partidos', 'POST', { local, visitante, inicio_at: ini, jornada: jornada || undefined, sede, torneo: 'Liga MX Femenil' }));
        setBusy(false);
        if (r) { notify('Partido agregado'); router.back(); }
      }} />
    </SheetScreen>
  );
}
