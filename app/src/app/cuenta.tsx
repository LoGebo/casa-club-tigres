import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Avatar, Button, Group, Row, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ROL = { jugadora: 'Jugadora', seguridad: 'Seguridad', coordinacion: 'Coordinación' } as const;

export default function Cuenta() {
  const t = useTheme();
  const { session, logout } = useAuth();
  const [cambiando, setCambiando] = useState(false);
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  if (!session) return null;
  const input = { backgroundColor: t.surface, color: t.label, fontSize: 17, paddingHorizontal: 16, minHeight: 50, borderRadius: 12 } as const;

  const guardar = async () => {
    const r = await run(() => api('/pin', 'PATCH', { actual, nuevo }));
    if (r) { notify('PIN actualizado'); setCambiando(false); setActual(''); setNuevo(''); }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: Space.l, gap: Space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.m }}>
        <Avatar name={session.nombre} size={56} />
        <View><T v="title">{session.nombre}</T><T v="sub" dim>{ROL[session.rol]}</T></View>
      </View>
      {cambiando ? (
        <View style={{ gap: Space.m }}>
          <TextInput value={actual} onChangeText={setActual} placeholder="PIN actual" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" style={input} />
          <TextInput value={nuevo} onChangeText={setNuevo} placeholder="PIN nuevo (4 a 8 dígitos)" placeholderTextColor={t.label3} secureTextEntry keyboardType="number-pad" style={input} />
          <Button title="Guardar PIN" onPress={guardar} disabled={!actual || nuevo.length < 4} />
          <Button title="Cancelar" kind="plain" onPress={() => setCambiando(false)} />
        </View>
      ) : (
        <Group>
          <Row title="Cambiar PIN" onPress={() => setCambiando(true)} chevron />
          <Row title="Cerrar sesión" tone="danger" onPress={async () => { router.dismiss(); await logout(); }} />
        </Group>
      )}
    </ScrollView>
  );
}
