// Nuevo viaje (POST /viajes). Con partido_id se prellena desde el partido.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group } from '@/components/ui';
import { api } from '@/lib/api';
import { esTigres } from '@/components/crest';
import type { Partido } from '@/features/calendario';

export default function ViajeNuevo() {
  const { partido_id } = useLocalSearchParams<{ partido_id?: string }>();
  const [f, setF] = useState({ titulo: '', destino: '', transporte: '', hospedaje: '', nota: '' });
  const [sal, setSal] = useState(() => Date.now() + 864e5);
  const [reg, setReg] = useState(() => Date.now() + 864e5 + 8 * 36e5);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (!partido_id) return;
    void run(() => api<Partido[]>('/partidos?atras=365')).then((r) => {
      const p = r?.find((x) => x.id === +partido_id);
      if (!p) return;
      setF((o) => ({ ...o, titulo: `${p.local} vs ${p.visitante}`, destino: !esTigres(p.local) ? p.sede || p.local : p.sede || 'Casa Club' }));
      setSal(p.inicio_at - 24 * 36e5); setReg(p.inicio_at + 8 * 36e5);
    });
  }, [partido_id]);

  return (
    <SheetScreen title="Nuevo viaje">
      <Group>
        <TextField label="Título" value={f.titulo} onChangeText={set('titulo')} />
        <TextField label="Destino" value={f.destino} onChangeText={set('destino')} />
        <DateTimeField label="Sale" value={sal} onChange={setSal} />
        <DateTimeField label="Regresa" value={reg} onChange={setReg} />
        <TextField label="Transporte" value={f.transporte} onChangeText={set('transporte')} placeholder="Autobús del club" />
        <TextField label="Hospedaje" value={f.hospedaje} onChangeText={set('hospedaje')} />
        <TextField label="Nota" value={f.nota} onChangeText={set('nota')} />
      </Group>
      <Button title="Crear viaje" loading={busy} disabled={!f.titulo.trim() || !f.destino.trim()} onPress={async () => {
        if (!(reg > sal)) return notify('El regreso debe ser después de la salida');
        setBusy(true);
        const r = await run(() => api<{ id: number }>('/viajes', 'POST', { ...f, partido_id: partido_id ? +partido_id : undefined, salida_at: sal, regreso_at: reg }));
        setBusy(false);
        if (r) { notify('Viaje creado. Ahora convoca a las jugadoras.'); router.replace({ pathname: '/convocar', params: { id: String(r.id) } }); }
      }} />
    </SheetScreen>
  );
}
