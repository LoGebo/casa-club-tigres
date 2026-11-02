import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Persona = { id: number; nombre: string; parentesco?: string; telefono?: string };

export default function Mas() {
  const t = useTheme();
  const [gente, setGente] = useState<Persona[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { const me = await api<{ id: number }>('/me'); setGente(await api<Persona[]>(`/jugadoras/${me.id}/recogen`)); } catch { setGente((g) => g ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const ic = (sf: string, ion: React.ComponentProps<typeof Icon>['ion']) => <Icon sf={sf} ion={ion} size={22} color={t.tint} />;

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <Group>
        <Row chevron leading={ic('person.2', 'people-outline')} title="Visitas" subtitle="Registra a quién esperas" onPress={() => router.push('/jugadora/mas/visitas')} />
        <Row chevron leading={ic('wrench.and.screwdriver', 'construct-outline')} title="Servicios" subtitle="Mantenimiento, lavandería, médico" onPress={() => router.push('/jugadora/mas/servicios')} />
        <Row chevron leading={ic('bell', 'notifications-outline')} title="Notificaciones" onPress={() => router.push('/notificaciones')} />
        <Row chevron leading={ic('person.crop.circle', 'person-circle-outline')} title="Mi cuenta" subtitle="PIN, avisos del teléfono, cerrar sesión" onPress={() => router.push('/cuenta')} />
      </Group>

      <Group header="Personas que pueden recogerme" footer="Solo Coordinación puede agregar o quitar personas. Si algo cambia, avísale a Coordinación.">
        {!gente ? <Row title={<Loading />} /> : gente.length ? gente.map((p) => (
          <Row key={p.id} minHeight={60} leading={ic('person.badge.key', 'key-outline')} title={p.nombre}
            subtitle={<T v="caption" dim>{[p.parentesco, p.telefono].filter(Boolean).join(' · ')}</T>} />
        )) : <Row title={<View><T v="body" dim>Aún no hay personas registradas.</T></View>} />}
      </Group>
    </Screen>
  );
}
