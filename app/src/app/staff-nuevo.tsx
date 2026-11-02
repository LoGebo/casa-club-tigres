// Modal: alta de personal (Seguridad o Coordinación).
import { router } from 'expo-router';
import { useState } from 'react';

import { Choice, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { api } from '@/lib/api';
import { changed } from '@/features/coord-mas/util';

export default function StaffNuevo() {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState<'seguridad' | 'coordinacion'>('seguridad');
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    const r = await run(() => api('/staff', 'POST', { nombre, usuario, pin, rol }));
    setBusy(false);
    if (r) { notify('Personal agregado'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Agregar personal">
      <Group footer="Este PIN es temporal: la persona deberá cambiarlo la primera vez que entre.">
        <TextField label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
        <TextField label="Usuario" value={usuario} onChangeText={setUsuario} autoCapitalize="none" />
        <TextField label="PIN (4 a 8 dígitos)" value={pin} onChangeText={setPin} secure keyboardType="number-pad" />
      </Group>
      <Group header="Rol"><Choice options={[['seguridad', 'Seguridad'], ['coordinacion', 'Coordinación']] as const} value={rol} onChange={setRol} /></Group>
      <Button title="Crear" loading={busy} disabled={!nombre.trim() || !usuario.trim() || !/^\d{4,8}$/.test(pin)} onPress={guardar} />
    </SheetScreen>
  );
}
