// Salida de emergencia: crea un permiso ya autorizado (POST /emergencia).
import { useEffect, useState } from 'react';
import { Modal } from 'react-native';

import { run, notify } from '@/components/notify';
import { SheetScreen, TextField } from '@/components/form';
import { Button, Group, Loading, T } from '@/components/ui';
import { api } from '@/lib/api';
import { JugadoraPicker, type Jugadora } from './util';

export function Emergencia({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible ? <Contenido onClose={onClose} onDone={onDone} /> : null}
    </Modal>
  );
}

function Contenido({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [js, setJs] = useState<Jugadora[] | null>(null);
  const [jid, setJid] = useState<number | null>(null);
  const [f, setF] = useState({ motivo: '', destino: '', acompanante: '', horas: '6' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void run(() => api<Jugadora[]>('/jugadoras')).then((r) => r && setJs(r)); }, []);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const ok = jid != null && f.motivo.trim() && f.destino.trim();
  return (
    <SheetScreen title="Salida de emergencia" onClose={onClose}>
        <T v="sub" dim>Crea un permiso ya autorizado (ambulancia, familiar, etc.). Queda en la bitácora; Seguridad registra la salida al escanear.</T>
        {js ? <JugadoraPicker jugadoras={js} value={jid} onChange={setJid} /> : <Loading />}
        <Group>
          <TextField label="Motivo" value={f.motivo} onChangeText={set('motivo')} placeholder="Lesión, urgencia familiar…" />
          <TextField label="Destino" value={f.destino} onChangeText={set('destino')} placeholder="Hospital, domicilio…" />
          <TextField label="Acompañante" value={f.acompanante} onChangeText={set('acompanante')} placeholder="Personal del club" />
          <TextField label="Horas fuera previstas" value={f.horas} onChangeText={set('horas')} keyboardType="number-pad" />
        </Group>
        <Button title="Autorizar salida" kind="danger" loading={busy} disabled={!ok} onPress={async () => {
          setBusy(true);
          const r = await run(() => api('/emergencia', 'POST', { jugadora_id: jid, motivo: f.motivo, destino: f.destino, acompanante: f.acompanante, horas: Math.min(72, Math.max(1, +f.horas || 6)) }));
          setBusy(false);
          if (r) { notify('Salida de emergencia autorizada. Avisa a Seguridad.'); onClose(); onDone(); }
        }} />
      </SheetScreen>
  );
}
