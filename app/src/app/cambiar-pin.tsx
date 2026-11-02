// Pantalla obligatoria: PIN generado por Coordinación → la persona elige el suyo antes de usar la app.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { TextField } from '@/components/form';
import { Button, Group, T } from '@/components/ui';
import { MaxWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CambiarPin() {
  const t = useTheme();
  const { pinCambiado, logout } = useAuth();
  const [actual, setActual] = useState(''); const [nuevo, setNuevo] = useState(''); const [rep, setRep] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const guardar = async () => {
    if (!/^\d{4,8}$/.test(nuevo)) return setErr('El PIN nuevo debe tener de 4 a 8 dígitos');
    if (nuevo !== rep) return setErr('Los dos PIN nuevos no coinciden');
    setErr(''); setBusy(true);
    try { await api('/pin', 'PATCH', { actual, nuevo }); await pinCambiado(); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cambiar'); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Space.l, paddingTop: 72, gap: Space.l, width: '100%', maxWidth: MaxWidth, alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <T v="title">Elige tu PIN</T>
          <T v="body" dim>El PIN que recibiste es temporal. Crea uno que solo tú conozcas: de 4 a 8 dígitos, sin 1234 ni repeticiones obvias.</T>
        </View>
        <Group>
          <TextField label="PIN actual (el que te dieron)" value={actual} onChangeText={setActual} keyboardType="number-pad" secure />
          <TextField label="PIN nuevo" value={nuevo} onChangeText={setNuevo} keyboardType="number-pad" secure />
          <TextField label="Repite el PIN nuevo" value={rep} onChangeText={setRep} keyboardType="number-pad" secure />
        </Group>
        {err ? <T v="sub" color={t.bad} accessibilityRole="alert">{err}</T> : null}
        <Button title="Guardar y entrar" loading={busy} disabled={!actual || !nuevo || !rep} onPress={guardar} />
        <Button title="Salir" kind="tinted" onPress={() => void logout()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
