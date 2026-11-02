// Modal: registrar una incidencia.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Choice, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { api } from '@/lib/api';
import { changed, type Jug } from '@/features/coord-mas/util';

const TIPOS = [['intento_salida', 'Intento de salida'], ['convivencia', 'Convivencia'], ['salud', 'Salud'], ['disciplina', 'Disciplina'], ['seguridad', 'Seguridad'], ['otro', 'Otro']] as const;
const SEV = [['baja', 'Baja'], ['media', 'Media'], ['urgente', 'Urgente']] as const;

export default function IncidenciaNueva() {
  const params = useLocalSearchParams<{ jid?: string; tipo?: string }>();
  const [js, setJs] = useState<Jug[]>([]);
  const [tipo, setTipo] = useState<string>(params.tipo ?? 'otro');
  const [sev, setSev] = useState<'baja' | 'media' | 'urgente'>('media');
  const [jid, setJid] = useState(params.jid ?? '');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void run(() => api<Jug[]>('/jugadoras')).then((r) => r && setJs(r.filter((j) => j.activa))); }, []);

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api('/incidencias', 'POST', { tipo, severidad: sev, jugadora_id: jid ? +jid : null, descripcion: desc }));
    setBusy(false);
    if (r) { notify('Incidencia registrada'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Registrar incidencia">
      <Group header="Tipo"><Choice options={TIPOS} value={tipo} onChange={setTipo} /></Group>
      <Group header="Gravedad"><Choice options={SEV} value={sev} onChange={setSev} /></Group>
      <Group header="Jugadora (opcional)"><Choice options={[['', 'Ninguna'], ...js.map((j) => [String(j.id), j.nombre] as const)]} value={jid} onChange={setJid} /></Group>
      <Group header="Qué pasó"><TextField label="Descripción" value={desc} onChangeText={setDesc} multiline /></Group>
      <Button title="Registrar" loading={busy} disabled={!desc.trim()} onPress={guardar} />
    </SheetScreen>
  );
}
