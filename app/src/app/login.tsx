import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { brand, MaxWidth, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const t = useTheme();
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [club, setClub] = useState('Casa Club Femenil');
  const pinRef = useRef<ComponentRef<typeof TextInput>>(null);
  useState(() => { api<{ nombre_club?: string }>('/config').then((c) => c.nombre_club && setClub(c.nombre_club)).catch(() => {}); });

  const go = async () => {
    setErr(''); setBusy(true);
    try { await login(usuario.trim(), pin); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo entrar'); } finally { setBusy(false); }
  };

  const input = { backgroundColor: t.surface, color: t.label, fontSize: 17, paddingHorizontal: 16, minHeight: 52 } as const;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ backgroundColor: brand.navy, paddingTop: 96, paddingBottom: 40, alignItems: 'center', gap: 14, borderBottomWidth: 4, borderBottomColor: brand.gold }}>
          <Image source={require('@/assets/crests/tigres.png')} style={{ width: 104, height: 104 }} contentFit="contain" accessibilityLabel="Escudo Tigres" />
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: 0.3 }}>{club}</Text>
          <Text style={{ color: brand.gold, fontSize: 15, fontWeight: '600' }}>Control de acceso</Text>
        </View>
        <View style={{ padding: 20, gap: 16, width: '100%', maxWidth: MaxWidth, alignSelf: 'center' }}>
          <View style={{ borderRadius: Radius.m, overflow: 'hidden' }}>
            <TextInput value={usuario} onChangeText={setUsuario} placeholder="Usuario o clave" placeholderTextColor={t.label3} autoCapitalize="none" autoCorrect={false} textContentType="username" returnKeyType="next" onSubmitEditing={() => pinRef.current?.focus()} style={input} accessibilityLabel="Usuario o clave" />
            <View style={{ height: 0.5, backgroundColor: t.sep, marginLeft: 16 }} />
            <TextInput ref={pinRef} value={pin} onChangeText={setPin} placeholder="PIN" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" textContentType="password" returnKeyType="go" onSubmitEditing={go} style={input} accessibilityLabel="PIN" />
          </View>
          {err ? <T v="sub" color={t.bad} accessibilityRole="alert">{err}</T> : null}
          <Button title="Entrar" onPress={go} loading={busy} disabled={!usuario || !pin} />
          <Pressable><T v="caption" dim style={{ textAlign: 'center' }}>¿Olvidaste tu PIN? Pídelo a Coordinación.</T></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
