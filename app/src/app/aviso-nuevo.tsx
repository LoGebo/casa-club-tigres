// Modal: publicar un aviso a todas las jugadoras o a una categoría, con confirmación de lectura opcional.
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native';

import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';
import { changed } from '@/features/coord-mas/util';

export default function AvisoNuevo() {
  const cats = useCategorias();
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [cat, setCat] = useState('');
  const [fijo, setFijo] = useState(false);
  const [lectura, setLectura] = useState(false);
  const [vence, setVence] = useState(false);
  const [venceAt, setVenceAt] = useState(() => Date.now() + 864e5);
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api<{ enviado_a?: number }>('/avisos', 'POST', { titulo, cuerpo, fijo, categoria: cat, requiere_lectura: lectura, vence_at: vence ? venceAt : null }));
    setBusy(false);
    if (r) { notify(r.enviado_a != null ? `Aviso enviado a ${r.enviado_a} jugadora${r.enviado_a === 1 ? '' : 's'}` : 'Aviso publicado'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Nuevo aviso">
      <Group>
        <TextField label="Título" value={titulo} onChangeText={setTitulo} />
        <TextField label="Mensaje (opcional)" value={cuerpo} onChangeText={setCuerpo} multiline />
      </Group>
      <Group header="Para quién" footer="Solo las jugadoras de esa categoría lo ven y reciben la notificación.">
        <Choice options={[['', 'Todas'], ...cats.map((c) => [c, c] as const)] as readonly (readonly [string, string])[]} value={cat} onChange={setCat} />
      </Group>
      <Group footer="Con confirmación, ellas tocan «Ya lo leí» y tú ves quién falta.">
        <Row title="Pedir confirmación de lectura" trailing={<Switch value={lectura} onValueChange={setLectura} accessibilityLabel="Pedir confirmación de lectura" />} />
        <Row title="Fijar arriba" trailing={<Switch value={fijo} onValueChange={setFijo} accessibilityLabel="Fijar arriba" />} />
        <Row title="Con fecha de vencimiento" trailing={<Switch value={vence} onValueChange={setVence} accessibilityLabel="Con fecha de vencimiento" />} />
        {vence ? <DateTimeField label="Vence" value={venceAt} onChange={setVenceAt} /> : null}
      </Group>
      <Button title="Publicar" loading={busy} disabled={!titulo.trim()} onPress={guardar} />
    </SheetScreen>
  );
}
