import { router } from 'expo-router';
import { useState } from 'react';

import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { api } from '@/lib/api';

export default function PermisoNuevo() {
  const [now] = useState(Date.now);
  const [tipo, setTipo] = useState<'salida' | 'pernocta'>('salida');
  const [destino, setDestino] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [acompanante, setAcompanante] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salida, setSalida] = useState(now + 36e5);
  const [regreso, setRegreso] = useState(now + 4 * 36e5);
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    if (!destino.trim() || !acompanante.trim()) return notify('Indica destino y con quién vas');
    setBusy(true);
    const r = await run(() => api('/permisos', 'POST', { tipo, destino, ubicacion, acompanante, motivo, salida_at: salida, regreso_at: regreso }));
    setBusy(false);
    if (r) { notify('Solicitud enviada a Coordinación'); router.back(); }
  };

  return (
    <SheetScreen title="Solicitar permiso">
      <Group>
        <Choice options={[['salida', 'Salida del día'], ['pernocta', 'Pernocta fuera']] as const} value={tipo} onChange={setTipo} />
        <TextField label="Destino" value={destino} onChangeText={setDestino} placeholder="Ej. Casa de mi familia" />
        <TextField label="Lugar / dirección" value={ubicacion} onChangeText={setUbicacion} placeholder="Colonia, calle, referencia" />
        <TextField label="¿Con quién vas?" value={acompanante} onChangeText={setAcompanante} placeholder="Nombre y parentesco" />
        <TextField label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} />
      </Group>
      <Group>
        <DateTimeField label="Salida" value={salida} onChange={setSalida} />
        <DateTimeField label="Regreso" value={regreso} onChange={setRegreso} />
      </Group>
      <Button title="Enviar solicitud" onPress={enviar} loading={busy} />
    </SheetScreen>
  );
}
