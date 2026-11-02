// Modal: publicar un aviso para todas las jugadoras.
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native';

import { DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { changed } from '@/features/coord-mas/util';

export default function AvisoNuevo() {
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fijo, setFijo] = useState(false);
  const [vence, setVence] = useState(false);
  const [venceAt, setVenceAt] = useState(() => Date.now() + 864e5);
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api('/avisos', 'POST', { titulo, cuerpo, fijo, vence_at: vence ? venceAt : null }));
    setBusy(false);
    if (r) { notify('Aviso publicado'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Nuevo aviso">
      <Group>
        <TextField label="Título" value={titulo} onChangeText={setTitulo} />
        <TextField label="Mensaje (opcional)" value={cuerpo} onChangeText={setCuerpo} multiline />
      </Group>
      <Group footer="Un aviso fijo se muestra siempre arriba.">
        <Row title="Fijar arriba" trailing={<Switch value={fijo} onValueChange={setFijo} />} />
        <Row title="Con fecha de vencimiento" trailing={<Switch value={vence} onValueChange={setVence} />} />
        {vence ? <DateTimeField label="Vence" value={venceAt} onChange={setVenceAt} /> : null}
      </Group>
      <Button title="Publicar" loading={busy} disabled={!titulo.trim()} onPress={guardar} />
    </SheetScreen>
  );
}
