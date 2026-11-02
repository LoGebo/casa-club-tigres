import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { SheetScreen, TextField } from '@/components/form';
import { FotoField, type FotoSubida } from '@/components/foto';
import { notify, run } from '@/components/notify';
import { Button, Group, T } from '@/components/ui';
import { TIPOS_COMIDA } from '@/features/jugadora/common';
import { api } from '@/lib/api';

type Comida = { id: number; tipo: string; descripcion?: string; foto?: string | null; foto_id?: number | null };

export default function ComidaNueva() {
  const p = useLocalSearchParams<{ tipo?: string; id?: string }>();
  const tipo = TIPOS_COMIDA.find((x) => x[0] === p.tipo)?.[0] ?? 'comida';
  const nombre = TIPOS_COMIDA.find((x) => x[0] === tipo)![1];
  const [desc, setDesc] = useState('');
  const [foto, setFoto] = useState<FotoSubida | null>(null);
  const [previa, setPrevia] = useState<Comida | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p.id) return;
    void run(() => api<Comida[]>('/comidas')).then((l) => {
      const c = l?.find((x) => x.id === Number(p.id));
      if (!c) return;
      setPrevia(c); setDesc(c.descripcion ?? '');
      if (c.foto && c.foto_id) setFoto({ id: c.foto_id, url: c.foto });
    });
  }, [p.id]);

  const guardar = async () => {
    if (!desc.trim() && !foto) return notify('Agrega una foto o escribe qué comiste');
    setBusy(true);
    const r = await run(() => api('/comidas', 'POST', { tipo, descripcion: desc.trim(), foto_id: foto?.id }));
    setBusy(false);
    if (r) { notify(previa ? `${nombre} actualizada` : `${nombre} registrada`); router.back(); }
  };

  const borrar = () => {
    const hacer = async () => { const r = await run(() => api(`/comidas/${previa!.id}`, 'DELETE')); if (r) { notify('Registro borrado'); router.back(); } };
    if (Platform.OS === 'web') { if (confirm(`¿Borrar tu ${nombre.toLowerCase()} de hoy?`)) void hacer(); return; }
    Alert.alert(`¿Borrar tu ${nombre.toLowerCase()} de hoy?`, 'Podrás registrarla de nuevo.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => void hacer() }]);
  };

  return (
    <SheetScreen title={previa ? `Editar ${nombre.toLowerCase()}` : nombre}>
      <T v="sub" dim>Sube una foto de tu plato o cuéntanos qué comiste. {tipo !== 'colacion' ? 'Si ya la registraste hoy, se actualiza.' : ''}</T>
      <Group>
        <FotoField value={foto} onChange={setFoto} label="Foto del plato" />
        <TextField label="¿Qué comiste? (opcional si hay foto)" value={desc} onChangeText={setDesc} multiline placeholder="Ej. Pollo con arroz y ensalada" />
      </Group>
      <Button title={previa ? 'Guardar cambios' : 'Registrar'} onPress={guardar} loading={busy} />
      {previa ? <Button title="Borrar registro" kind="danger" onPress={borrar} /> : null}
    </SheetScreen>
  );
}
