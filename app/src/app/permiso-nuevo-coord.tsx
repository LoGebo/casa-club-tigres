// Coordinación crea un permiso por una jugadora (POST /permisos).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Loading, T } from '@/components/ui';
import { api } from '@/lib/api';
import { JugadoraPicker, type Jugadora } from '@/features/coord/util';

export default function PermisoNuevoCoord() {
  const [js, setJs] = useState<Jugadora[] | null>(null);
  const [jid, setJid] = useState<number | null>(null);
  const [tipo, setTipo] = useState<'salida' | 'pernocta'>('salida');
  const [destino, setDestino] = useState('');
  const [acomp, setAcomp] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sal, setSal] = useState(() => Date.now() + 36e5);
  const [reg, setReg] = useState(() => Date.now() + 4 * 36e5);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void run(() => api<Jugadora[]>('/jugadoras')).then((r) => r && setJs(r)); }, []);

  return (
    <SheetScreen title="Crear permiso">
      {js ? <JugadoraPicker jugadoras={js} value={jid} onChange={setJid} /> : <Loading />}
      <Group>
        <Choice options={[['salida', 'Salida del día'], ['pernocta', 'Pernocta fuera']] as const} value={tipo} onChange={setTipo} />
        <TextField label="Destino" value={destino} onChangeText={setDestino} />
        <TextField label="Acompañante" value={acomp} onChangeText={setAcomp} />
        <DateTimeField label="Salida" value={sal} onChange={setSal} />
        <DateTimeField label="Regreso" value={reg} onChange={setReg} />
        <TextField label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} />
      </Group>
      <T v="caption" dim>Después podrás autorizarlo o enviarlo al tutor desde Permisos.</T>
      <Button title="Crear permiso" loading={busy} disabled={jid == null || !destino.trim() || !acomp.trim()} onPress={async () => {
        if (!(sal < reg)) return notify('El regreso debe ser después de la salida');
        setBusy(true);
        const r = await run(() => api('/permisos', 'POST', { jugadora_id: jid, tipo, destino, acompanante: acomp, motivo, salida_at: sal, regreso_at: reg }));
        setBusy(false);
        if (r) { notify('Permiso creado'); router.back(); }
      }} />
    </SheetScreen>
  );
}
