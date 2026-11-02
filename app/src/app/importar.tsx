// Importar calendario de la liga pegando CSV (jornada, fecha, hora, local, visitante, sede).
// ponytail: solo pegar texto (expo-document-picker no está instalado); agregar el selector de archivo si se instala.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput } from 'react-native';

import { SheetScreen } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Fila = { jornada?: number; inicio_at: number; local: string; visitante: string; sede?: string; torneo: string };

function parseCsv(txt: string) {
  const rows: Fila[] = [], bad: number[] = [];
  txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
    if (i === 0 && /fecha/i.test(l)) return;
    const [jor, fecha, hora, local, visitante, sede] = l.split(/[;\t,]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    const m = fecha?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), n = fecha?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const [y, mo, d] = m ? [+m[1], +m[2], +m[3]] : n ? [+n[3], +n[2], +n[1]] : [0, 0, 0];
    const hh = /^\d{1,2}:\d{2}$/.test(hora || '') ? hora.split(':').map(Number) : [12, 0];
    const dtm = new Date(y, mo - 1, d, hh[0], hh[1]);
    if (!local || !visitante || !y || isNaN(dtm.getTime()) || dtm.getMonth() !== mo - 1) return bad.push(i + 1);
    rows.push({ jornada: +jor > 0 ? +jor : undefined, inicio_at: dtm.getTime(), local, visitante, sede: sede || undefined, torneo: 'Liga MX Femenil' });
  });
  return { rows, bad };
}

export default function Importar() {
  const t = useTheme();
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const { rows, bad } = useMemo(() => parseCsv(txt), [txt]);
  return (
    <SheetScreen title="Importar calendario">
      <T v="sub" dim>Una fila por partido: jornada, fecha, hora, local, visitante, sede. Fecha como 2027-01-10 o 10/01/2027. Puedes copiarlas desde Excel o Sheets y pegarlas aquí.</T>
      <TextInput value={txt} onChangeText={setTxt} multiline autoCapitalize="none" autoCorrect={false} placeholder="1,2027-01-10,19:00,Tigres,Rayadas,Estadio Universitario" placeholderTextColor={t.label3} accessibilityLabel="Calendario en CSV"
        style={{ color: t.label, fontSize: 15, backgroundColor: t.surface, borderRadius: Radius.m, padding: Space.m, minHeight: 180, textAlignVertical: 'top' }} />
      {txt.trim() ? <T v="caption" dim>{rows.length} partidos válidos{bad.length ? ` · filas con error: ${bad.slice(0, 8).join(', ')}` : ''}</T> : null}
      <Button title={rows.length ? `Importar ${rows.length} partidos` : 'Importar'} loading={busy} disabled={!rows.length} onPress={async () => {
        setBusy(true);
        const r = await run(() => api<{ agregados: number }>('/partidos', 'POST', { rows }));
        setBusy(false);
        if (r) { notify(`${r.agregados} partidos agregados${bad.length ? `, ${bad.length} filas omitidas` : ''}`); router.back(); }
      }} />
    </SheetScreen>
  );
}
