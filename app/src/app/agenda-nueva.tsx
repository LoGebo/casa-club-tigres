// Modal: agregar una actividad al horario (de una categoría o de todas), con repetición.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Choice, DateTimeField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, T, tap } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';
import { changed, DIAS_SEM, hoyStr } from '@/features/coord-mas/util';
import { TIPOS_AGENDA } from '@/features/coord-mas/agenda';

const REPS = [['no', 'No repite'], ['diario', 'Todos los días'], ['lv', 'Lunes a viernes'], ['dias', 'Días específicos']] as const;
type Rep = (typeof REPS)[number][0];

export default function AgendaNueva() {
  const t = useTheme();
  const cats = useCategorias();
  const { dia } = useLocalSearchParams<{ dia?: string }>();
  const base = new Date((dia || hoyStr()) + 'T09:00').getTime();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<string>('entrenamiento');
  const [ini, setIni] = useState(base);
  const [fin, setFin] = useState(base + 36e5);
  const [lugar, setLugar] = useState('');
  const [cat, setCat] = useState('');
  const [rep, setRep] = useState<Rep>('no');
  const [dias, setDias] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    if (fin <= ini) { notify('El fin debe ser después del inicio'); return; }
    const repite = rep === 'no' ? '' : rep === 'dias' ? DIAS_SEM.map(([k]) => k).filter((k) => dias.includes(k)).join(',') : rep;
    setBusy(true);
    const r = await run(() => api('/agenda', 'POST', { titulo, tipo, lugar, categoria: cat, repite, inicio_at: ini, fin_at: fin }));
    setBusy(false);
    if (r) { notify(repite ? 'Actividad recurrente agregada' : 'Actividad agregada'); changed(); router.back(); }
  };
  return (
    <SheetScreen title="Nueva actividad">
      <Group><TextField label="Título" value={titulo} onChangeText={setTitulo} placeholder="Ej. Entrenamiento de tarde" /></Group>
      <Group header="Tipo"><Choice options={TIPOS_AGENDA} value={tipo} onChange={setTipo} /></Group>
      <Group footer={rep === 'no' ? undefined : 'La fecha de inicio marca desde cuándo empieza; solo importa la hora para los días siguientes.'}>
        <DateTimeField label="Inicio" value={ini} onChange={(v) => { setFin(fin + (v - ini)); setIni(v); }} />
        <DateTimeField label="Fin" value={fin} onChange={setFin} />
        <TextField label="Lugar (opcional)" value={lugar} onChangeText={setLugar} />
      </Group>
      <Group header="Categoría"><Choice options={[['', 'Todas'], ...cats.map((c) => [c, c] as const)] as readonly (readonly [string, string])[]} value={cat} onChange={setCat} /></Group>
      <Group header="Repetición">
        <Choice options={REPS} value={rep} onChange={setRep} />
        {rep === 'dias' ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: Space.m, backgroundColor: t.surface, gap: 4 }}>
            {DIAS_SEM.map(([k, l]) => {
              const on = dias.includes(k);
              return (
                <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={k}
                  onPress={() => { tap(); setDias(on ? dias.filter((x) => x !== k) : [...dias, k]); }}
                  style={{ flex: 1, minHeight: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.tint : t.fill }}>
                  <Text style={{ color: on ? (t.bg === '#000000' ? '#071647' : '#FFFFFF') : t.label, fontWeight: '600', fontSize: 15 }}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Group>
      <Button title="Agregar" loading={busy} disabled={!titulo.trim() || (rep === 'dias' && dias.length === 0)} onPress={guardar} />
      {rep === 'dias' && dias.length === 0 ? <T v="caption" dim style={{ textAlign: 'center' }}>Elige al menos un día.</T> : null}
    </SheetScreen>
  );
}
