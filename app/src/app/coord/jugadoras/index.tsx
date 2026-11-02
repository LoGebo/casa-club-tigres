// Jugadoras: lista compacta con búsqueda. Fila → ficha.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';

import { run } from '@/components/notify';
import { Avatar, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Jugadora } from '@/features/coord/util';

export default function Jugadoras() {
  const t = useTheme();
  const [js, setJs] = useState<Jugadora[] | null>(null);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const r = await run(() => api<Jugadora[]>('/jugadoras')); if (r) setJs(r); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!js) return <Screen><Loading /></Screen>;
  const v = q.trim().toLowerCase();
  const lista = js.filter((j) => !v || (j.nombre + ' ' + (j.habitacion || '')).toLowerCase().includes(v));
  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Button title="Agregar jugadora" icon={<Icon sf="plus" ion="add" size={20} color="#fff" />} onPress={() => router.push('/jugadora-form')} />
      <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre o habitación" placeholderTextColor={t.label3} autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Buscar jugadora"
        style={{ color: t.label, fontSize: 17, backgroundColor: t.fill, borderRadius: Radius.s, paddingHorizontal: Space.m, minHeight: 44 }} />
      {lista.length ? (
        <Group footer={`${js.filter((j) => j.activa).length} activas`}>
          {lista.map((j) => (
            <Row key={j.id} minHeight={60} leading={<Avatar name={j.nombre} size={40} />} title={j.nombre} chevron
              subtitle={`${j.habitacion ? `Hab. ${j.habitacion} · ` : ''}${j.menor ? 'Menor' : 'Mayor'} de edad${j.alergias ? ' · alergias' : ''}${j.activa ? '' : ' · inactiva'}`}
              onPress={() => router.push({ pathname: '/jugadora-ficha', params: { id: String(j.id) } })} />
          ))}
        </Group>
      ) : <Empty sf="person.2" ion="people-outline" title="Sin resultados" />}
      <T v="caption" dim style={{ textAlign: 'center' }}>Toca una jugadora para ver su ficha y su código QR.</T>
    </Screen>
  );
}
