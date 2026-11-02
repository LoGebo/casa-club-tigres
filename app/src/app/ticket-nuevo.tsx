import { router } from 'expo-router';
import { useState } from 'react';

import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { Choice, SheetScreen, TextField } from '@/components/form';
import { FotoField, type FotoSubida } from '@/components/foto';
import { CATEGORIAS } from '@/features/jugadora/common';
import { api } from '@/lib/api';

export default function TicketNuevo() {
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number][0]>('mantenimiento');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<FotoSubida | null>(null);
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    if (!descripcion.trim()) return notify('Cuéntanos qué necesitas');
    setBusy(true);
    const r = await run(() => api('/tickets', 'POST', { categoria, descripcion, foto_id: foto?.id }));
    setBusy(false);
    if (r) { notify('Solicitud enviada'); router.back(); }
  };

  return (
    <SheetScreen title="Nueva solicitud">
      <Group>
        <Choice label="Categoría" options={CATEGORIAS} value={categoria} onChange={setCategoria} />
        <TextField label="¿Qué necesitas?" value={descripcion} onChangeText={setDescripcion} multiline />
        <FotoField value={foto} onChange={setFoto} label="Foto (opcional, ayuda a entender el problema)" />
      </Group>
      <Button title="Enviar" onPress={enviar} loading={busy} />
    </SheetScreen>
  );
}
