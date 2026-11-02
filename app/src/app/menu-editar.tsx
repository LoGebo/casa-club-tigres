// Hoja: capturar el menú de una semana (desayuno, comida, cena, colación por día). Texto vacío = quitar.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { ErrorBox, TIPOS_COMIDA, addDays, changed, hoyStr, largaDia, lunesDe } from '@/features/coord-mas/util';

type MenuRow = { fecha: string; tipo: string; descripcion: string };
const key = (f: string, t: string) => `${f}|${t}`;
const toMap = (rs: MenuRow[], shift = 0) => Object.fromEntries(rs.map((r) => [key(shift ? addDays(r.fecha, shift) : r.fecha, r.tipo), r.descripcion]));

export default function MenuEditar() {
  const { desde } = useLocalSearchParams<{ desde?: string }>();
  const lunes = desde || lunesDe(hoyStr());
  const dias = [...Array(7)].map((_, i) => addDays(lunes, i));
  const [orig, setOrig] = useState<Record<string, string> | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiando, setCopiando] = useState(false);

  const cargar = () => {
    api<MenuRow[]>(`/menu?desde=${lunes}&dias=7`).then((rs) => { const m = toMap(rs); setOrig(m); setV(m); setErr(null); }).catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo cargar'));
  };
  useEffect(cargar, [lunes]);

  const copiar = async () => {
    setCopiando(true);
    const rs = await run(() => api<MenuRow[]>(`/menu?desde=${addDays(lunes, -7)}&dias=7`));
    setCopiando(false);
    if (!rs) return;
    if (rs.length === 0) { notify('La semana pasada no tiene menú'); return; }
    setV(toMap(rs, 7)); notify('Menú copiado. Revísalo y guarda.');
  };
  const guardar = async () => {
    const rows = dias.flatMap((f) => TIPOS_COMIDA.map(([t]) => ({ fecha: f, tipo: t, descripcion: (v[key(f, t)] ?? '').trim() }))).filter((r) => r.descripcion !== (orig?.[key(r.fecha, r.tipo)] ?? ''));
    if (rows.length === 0) { router.back(); return; }
    setBusy(true);
    const ok = await run(() => api('/menu', 'PUT', { rows }));
    setBusy(false);
    if (ok) { notify('Menú guardado'); changed(); router.back(); }
  };

  return (
    <SheetScreen title="Menú de la semana">
      {!orig ? (err ? <ErrorBox text={err} onRetry={cargar} /> : <Loading />) : (
        <>
          <Button title="Copiar de la semana pasada" kind="tinted" small loading={copiando} onPress={copiar} />
          {dias.map((f) => (
            <Group key={f} header={largaDia(f)}>
              {TIPOS_COMIDA.map(([t, l]) => <TextField key={t} label={l} value={v[key(f, t)] ?? ''} onChangeText={(s) => setV({ ...v, [key(f, t)]: s })} placeholder="Vacío = sin menú" />)}
            </Group>
          ))}
          <Button title="Guardar menú" loading={busy} onPress={guardar} />
        </>
      )}
    </SheetScreen>
  );
}
