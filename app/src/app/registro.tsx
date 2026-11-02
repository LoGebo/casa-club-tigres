// Registro público: la jugadora entra con el enlace que le manda Coordinación, crea su cuenta y elige su PIN.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Choice, DateField, TextField } from '@/components/form';
import { Button, Group, T } from '@/components/ui';
import { brand, MaxWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useCategorias } from '@/lib/categorias';

export default function Registro() {
  const t = useTheme();
  const { codigo } = useLocalSearchParams<{ codigo?: string }>();
  const { registrar } = useAuth();
  const [f, setF] = useState({ nombre: '', nacimiento: '', telefono: '', tutor_nombre: '', tutor_tel: '', categoria: '', pin: '', pin2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const cats = useCategorias();
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const completo = Object.entries(f).every(([k, v]) => v.trim() || (k === 'categoria' && !cats.length));

  const enviar = async () => {
    if (f.pin !== f.pin2) return setErr('Los dos PIN no coinciden');
    setErr(''); setBusy(true);
    try { await registrar({ ...f, codigo: codigo ?? '' }); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo crear la cuenta'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: brand.navy, paddingTop: 64, paddingBottom: 28, alignItems: 'center', gap: 10, borderBottomWidth: 4, borderBottomColor: brand.gold }}>
          <Image source={require('@/assets/crests/tigres.png')} style={{ width: 80, height: 80 }} contentFit="contain" accessibilityLabel="Escudo Tigres" />
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>Crea tu cuenta</Text>
          <Text style={{ color: brand.gold, fontSize: 15, fontWeight: '600' }}>Casa Club Femenil</Text>
        </View>
        <View style={{ padding: Space.l, gap: Space.l, width: '100%', maxWidth: MaxWidth, alignSelf: 'center', paddingBottom: 48 }}>
          {!codigo ? <T v="sub" color={t.bad}>Este enlace está incompleto. Pídele a Coordinación que te lo mande otra vez.</T> : null}
          <Group header="Tus datos" footer="Todos los campos son obligatorios.">
            <TextField label="Nombre completo" value={f.nombre} onChangeText={set('nombre')} autoCapitalize="words" />
            <DateField label="Fecha de nacimiento" value={f.nacimiento} onChange={set('nacimiento')} />
            <TextField label="Tu teléfono móvil" value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
          </Group>
          {cats.length ? <Group header="Tu categoría" footer="Si cambias de categoría, Coordinación lo actualiza."><Choice options={cats.map((c) => [c, c] as const)} value={f.categoria} onChange={set('categoria')} /></Group> : null}
          <Group header="Mamá, papá o tutor" footer="Si eres menor de edad, es quien autoriza tus salidas por WhatsApp.">
            <TextField label="Nombre de quien da los permisos" value={f.tutor_nombre} onChangeText={set('tutor_nombre')} autoCapitalize="words" />
            <TextField label="Teléfono móvil del tutor" value={f.tutor_tel} onChangeText={set('tutor_tel')} keyboardType="phone-pad" />
          </Group>
          <Group header="Tu PIN" footer="De 4 a 8 dígitos. Con él entrarás a la app.">
            <TextField label="PIN" value={f.pin} onChangeText={set('pin')} keyboardType="number-pad" secure />
            <TextField label="Repite tu PIN" value={f.pin2} onChangeText={set('pin2')} keyboardType="number-pad" secure />
          </Group>
          {err ? <T v="sub" color={t.bad} accessibilityRole="alert">{err}</T> : null}
          <Button title="Crear mi cuenta" onPress={enviar} loading={busy} disabled={!completo || !codigo} />
          <Button title="Ya tengo cuenta" kind="tinted" onPress={() => router.replace('/login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
