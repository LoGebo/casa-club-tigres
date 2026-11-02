// Agrega una persona autorizada para recoger a la jugadora (POST /jugadoras/:id/recogen).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, T } from '@/components/ui';
import { api } from '@/lib/api';
import { recogenBus } from '@/features/coord/util';

export default function RecogenNueva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [f, setF] = useState({ nombre: '', parentesco: '', telefono: '', documento: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api(`/jugadoras/${id}/recogen`, 'POST', f));
    setBusy(false);
    if (r) { notify('Persona autorizada agregada'); recogenBus.forEach((x) => x()); router.back(); }
  };

  return (
    <SheetScreen title="Persona autorizada">
      <T v="sub" dim>Solo estas personas pueden recoger a la jugadora. Seguridad verá su nombre y su documento en la puerta.</T>
      <Group>
        <TextField label="Nombre completo" value={f.nombre} onChangeText={set('nombre')} autoCapitalize="words" />
        <TextField label="Parentesco" value={f.parentesco} onChangeText={set('parentesco')} placeholder="Mamá, tío, entrenador…" autoCapitalize="sentences" />
        <TextField label="Teléfono" value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
        <TextField label="Documento (INE, pasaporte)" value={f.documento} onChangeText={set('documento')} autoCapitalize="none" />
      </Group>
      <Button title="Agregar" loading={busy} disabled={!f.nombre.trim()} onPress={guardar} />
    </SheetScreen>
  );
}
