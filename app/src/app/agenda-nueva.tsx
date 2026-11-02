// Modal: agregar una actividad a la agenda del día.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { api } from '@/lib/api';
import { changed, hoyStr } from '@/features/coord-mas/util';

const TIPOS = [['entrenamiento', 'Entrenamiento'], ['comida', 'Comida'], ['estudio', 'Estudio'], ['transporte', 'Transporte'], ['otro', 'Otro']] as const;

export default function AgendaNueva() {
  const { dia } = useLocalSearchParams<{ dia?: string }>();
  const base = new Date((dia || hoyStr()) + 'T09:00').getTime();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<string>('entrenamiento');
  const [ini, setIni] = useState(base);
  const [fin, setFin] = useState(base + 36e5);
  const [lugar, setLugar] = useState('');
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    if (fin <= ini) { notify('El fin debe ser después del inicio'); return; }
    setBusy(true);
    const r = await run(() => api('/agenda', 'POST', { titulo, tipo, lugar, inicio_at: ini, fin_at: fin }));
    setBusy(false);
    if (r) { notify('Actividad agregada'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Nueva actividad">
      <Group><TextField label="Título" value={titulo} onChangeText={setTitulo} /></Group>
      <Group header="Tipo"><Choice options={TIPOS} value={tipo} onChange={setTipo} /></Group>
      <Group>
        <DateTimeField label="Inicio" value={ini} onChange={(v) => { setFin(fin + (v - ini)); setIni(v); }} />
        <DateTimeField label="Fin" value={fin} onChange={setFin} />
        <TextField label="Lugar (opcional)" value={lugar} onChangeText={setLugar} />
      </Group>
      <Button title="Agregar" loading={busy} disabled={!titulo.trim()} onPress={guardar} />
    </SheetScreen>
  );
}
