import { router } from 'expo-router';
import { useState } from 'react';

import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { DateTimeField, SheetScreen, TextField } from '@/components/form';
import { api } from '@/lib/api';

export default function VisitaNueva() {
  const [visitante, setVisitante] = useState('');
  const [relacion, setRelacion] = useState('');
  const [fecha, setFecha] = useState(() => Date.now() + 864e5);
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    if (!visitante.trim()) return notify('Indica el nombre del visitante');
    setBusy(true);
    const r = await run(() => api('/visitas', 'POST', { visitante, relacion, fecha_at: fecha }));
    setBusy(false);
    if (r) { notify('Visita enviada a Coordinación'); router.back(); }
  };

  return (
    <SheetScreen title="Registrar visita">
      <Group>
        <TextField label="Nombre del visitante" value={visitante} onChangeText={setVisitante} autoCapitalize="words" />
        <TextField label="Relación" value={relacion} onChangeText={setRelacion} placeholder="Mamá, tía, amiga…" />
        <DateTimeField label="Fecha y hora" value={fecha} onChange={setFecha} />
      </Group>
      <Button title="Enviar" onPress={enviar} loading={busy} />
    </SheetScreen>
  );
}
