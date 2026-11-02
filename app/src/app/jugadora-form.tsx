// Alta y edición de jugadora (POST /jugadoras, PATCH /jugadoras/:id). Mismas validaciones que el backend.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { Choice, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Button, Group, Loading, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { useCategorias } from '@/lib/categorias';
import type { Jugadora } from '@/features/coord/util';

const VACIA = { categoria: '', telefono: '', nombre: '', clave: '', pin: '', nacimiento: '', habitacion: '', tutor_nombre: '', tutor_tel: '', emergencia_nombre: '', emergencia_tel: '', alergias: '', notas_medicas: '' };
const edad = (nac: string) => Math.floor((Date.now() - new Date(nac).getTime()) / 31557600000);

export default function JugadoraForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const cats = useCategorias();
  const [f, setF] = useState(VACIA);
  const [activa, setActiva] = useState(true);
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    void run(() => api<Jugadora[]>('/jugadoras')).then((r) => {
      const j = r?.find((x) => x.id === +id);
      if (j) { setF({ ...VACIA, ...Object.fromEntries(Object.keys(VACIA).map((k) => [k, (j as unknown as Record<string, string | undefined>)[k] ?? ''])), pin: '' }); setActiva(j.activa); }
      setReady(true);
    });
  }, [id]);
  const set = (k: keyof typeof VACIA) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  const guardar = async () => {
    if (!f.nombre.trim()) return notify('Falta el nombre');
    if (f.pin ? !/^\d{4,8}$/.test(f.pin) : !id) return notify('El PIN debe tener de 4 a 8 dígitos');
    if (!id) {
      if (!f.clave.trim()) return notify('Falta la clave de acceso');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.nacimiento) || isNaN(edad(f.nacimiento))) return notify('Nacimiento con formato AAAA-MM-DD');
    }
    if (f.nacimiento && edad(f.nacimiento) < 18 && !f.tutor_tel.replace(/\D/g, '')) return notify('Para menores el teléfono del tutor es obligatorio');
    setBusy(true);
    const r = await run(() => {
      if (id) { const { clave, nacimiento, pin, ...rest } = f; return api(`/jugadoras/${id}`, 'PATCH', { ...rest, activa, ...(pin ? { pin } : {}) }); }
      return api('/jugadoras', 'POST', f);
    });
    setBusy(false);
    if (r) { notify('Guardado'); router.back(); }
  };

  return (
    <SheetScreen title={id ? 'Editar jugadora' : 'Nueva jugadora'}>
      {!ready ? <Loading /> : (
        <>
          <Group header="Datos">
            <TextField label="Nombre completo" value={f.nombre} onChangeText={set('nombre')} autoCapitalize="words" />
            <TextField label="Clave de acceso" value={f.clave} onChangeText={id ? () => {} : set('clave')} autoCapitalize="none" placeholder={id ? undefined : 'p. ej. mgarcia'} />
            <TextField label={id ? 'Nuevo PIN (opcional)' : 'PIN (4 a 8 dígitos)'} value={f.pin} onChangeText={set('pin')} keyboardType="number-pad" secure />
            <TextField label="Teléfono de la jugadora" value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
            <TextField label="Nacimiento (AAAA-MM-DD)" value={f.nacimiento} onChangeText={id ? () => {} : set('nacimiento')} keyboardType="numbers-and-punctuation" placeholder="2008-05-21" />
            <TextField label="Habitación" value={f.habitacion} onChangeText={set('habitacion')} />
          </Group>
          <Group header="Categoría" footer="Puede cambiar con el tiempo (Sub-17 → Sub-19 → Primer equipo).">
            <Choice options={[['', 'Sin categoría'], ...cats.map((c) => [c, c] as const)]} value={f.categoria} onChange={set('categoria')} />
          </Group>
          <Group header="Tutor y emergencia" footer="Para menores de edad el teléfono del tutor es obligatorio.">
            <TextField label="Tutor" value={f.tutor_nombre} onChangeText={set('tutor_nombre')} autoCapitalize="words" />
            <TextField label="WhatsApp del tutor" value={f.tutor_tel} onChangeText={set('tutor_tel')} keyboardType="phone-pad" />
            <TextField label="Contacto de emergencia" value={f.emergencia_nombre} onChangeText={set('emergencia_nombre')} autoCapitalize="words" />
            <TextField label="Teléfono de emergencia" value={f.emergencia_tel} onChangeText={set('emergencia_tel')} keyboardType="phone-pad" />
          </Group>
          <Group header="Salud (solo Coordinación)">
            <TextField label="Alergias" value={f.alergias} onChangeText={set('alergias')} />
            <TextField label="Notas médicas" value={f.notas_medicas} onChangeText={set('notas_medicas')} multiline />
          </Group>
          {id ? <Group><Row title="Activa en casa club" trailing={<Switch value={activa} onValueChange={setActiva} accessibilityLabel="Jugadora activa" />} /></Group> : null}
          <Button title="Guardar" loading={busy} onPress={guardar} />
        </>
      )}
    </SheetScreen>
  );
}
