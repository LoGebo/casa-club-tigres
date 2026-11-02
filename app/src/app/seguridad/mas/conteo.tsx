// Conteo nocturno: marca a cada jugadora localizada dentro; las que faltan generan alerta urgente.
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { notify, run } from '@/components/notify';
import { Badge, Button, Empty, Group, Icon, Loading, Row, Screen, T } from '@/components/ui';
import { dt } from '@/features/seguridad/util';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type J = { id: number; nombre: string; habitacion?: string; fuera: boolean; destino?: string };
type C = { id: number; at: number; total: number; presentes: number; staff?: string; detalle?: string | { ausentes?: string[] } };

const ausentesDe = (c: C): string[] => {
  try { const d = typeof c.detalle === 'string' ? JSON.parse(c.detalle) : c.detalle; return d?.ausentes ?? []; } catch { return []; }
};

export default function Conteo() {
  const t = useTheme();
  const [lista, setLista] = useState<J[] | null>(null);
  const [hist, setHist] = useState<C[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await run(() => Promise.all([api<J[]>('/conteo'), api<C[]>('/conteos')]));
    if (!r) return;
    setLista(r[0]); setHist(r[1]);
    const dentro = new Set(r[0].filter((j) => !j.fuera).map((j) => j.id));
    setSel((s) => new Set([...s].filter((id) => dentro.has(id))));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!lista) return <Screen><Stack.Screen options={{ title: 'Conteo nocturno' }} /><Loading /></Screen>;
  const dentro = lista.filter((j) => !j.fuera), faltan = dentro.filter((j) => !sel.has(j.id));
  const toggle = (id: number) => { setConfirmar(false); setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; }); };

  const registrar = async () => {
    if (faltan.length && !confirmar) return setConfirmar(true);
    setBusy(true);
    const r = await run(() => api<{ ausentes: string[] }>('/conteo', 'POST', { presentes: [...sel] }));
    setBusy(false);
    if (r) { notify(r.ausentes.length ? 'Conteo registrado con alertas' : 'Conteo completo'); setSel(new Set()); setConfirmar(false); await load(); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: 'Conteo nocturno' }} />
      <T v="sub" dim>Recorre las habitaciones y marca a cada jugadora que veas dentro. Las que están afuera con permiso no se cuentan.</T>
      {dentro.length === 0 ? <Empty sf="person.2" ion="people-outline" title="Sin jugadoras para contar" /> : (
        <Group header={`${sel.size} de ${dentro.length} localizadas`}>
          {lista.map((j) => j.fuera ? (
            <Row key={j.id} title={j.nombre} subtitle={`Afuera con permiso · ${j.destino ?? ''}`} trailing={<Badge text="Afuera" tone="gold" />} />
          ) : (
            <Row key={j.id} title={j.nombre} subtitle={j.habitacion ? `Hab. ${j.habitacion}` : undefined} onPress={() => toggle(j.id)}
              leading={sel.has(j.id) ? <Icon sf="checkmark.circle.fill" ion="checkmark-circle" size={26} color={t.ok} /> : <Icon sf="circle" ion="ellipse-outline" size={26} color={t.label3} />} />
          ))}
        </Group>
      )}
      {confirmar ? <T v="sub" color={t.bad} style={{ fontWeight: '600' }}>{`${faltan.length} sin localizar. Se generará una alerta urgente para: ${faltan.map((j) => j.nombre).join(', ')}.`}</T> : null}
      {dentro.length ? <Button title={confirmar ? 'Registrar y alertar' : 'Registrar conteo'} kind={confirmar ? 'danger' : 'filled'} loading={busy} onPress={registrar} /> : null}

      {hist.length ? (
        <Group header="Conteos anteriores">
          {hist.slice(0, 8).map((c) => {
            const a = ausentesDe(c);
            return <Row key={c.id} minHeight={56} title={dt(c.at)} subtitle={a.length ? `Sin localizar: ${a.join(', ')}` : c.staff ? `Registró ${c.staff}` : undefined}
              trailing={<Badge text={`${c.presentes}/${c.total}`} tone={a.length ? 'bad' : 'ok'} />} />;
          })}
        </Group>
      ) : null}
    </Screen>
  );
}
