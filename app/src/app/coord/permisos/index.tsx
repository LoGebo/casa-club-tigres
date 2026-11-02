// Permisos de salida: por resolver, autorizados y afuera/recientes.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { notify, run } from '@/components/notify';
import { Badge, Button, Card, Empty, Icon, Loading, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { api } from '@/lib/api';
import { dt, PromptDialog } from '@/features/coord/util';

type Permiso = {
  id: number; jugadora: string; menor?: boolean; estado: string; tipo: string; destino: string; ubicacion?: string; acompanante: string; motivo?: string;
  salida_at: number; regreso_at: number; metodo_auth?: string; nota?: string; padre_decision_at?: number;
};
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'gold' | 'tint';
const ESTADO: Record<string, [string, Tone]> = {
  pendiente: ['Pendiente', 'warn'], esperando_padres: ['Esperando al tutor', 'warn'], autorizado: ['Autorizado', 'ok'], salio: ['Afuera', 'gold'], rechazado: ['Rechazado', 'bad'], vencido: ['Vencido', 'neutral'],
};
const AUTH = (p: Permiso) => ({
  tutor_digital: `Tutor (digital${p.padre_decision_at ? ', ' + dt(p.padre_decision_at) : ''})`, coordinacion_manual: `Coordinación: ${p.nota || ''}`, mayor_de_edad: 'Coordinación (mayor de edad)', emergencia: `EMERGENCIA: ${p.nota || ''}`,
} as Record<string, string>)[p.metodo_auth ?? ''];

export default function Permisos() {
  const [ps, setPs] = useState<Permiso[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dlg, setDlg] = useState<{ p: Permiso; accion: 'autorizar' | 'rechazar' } | null>(null);

  const load = useCallback(async () => {
    const r = await run(() => api<Permiso[]>('/permisos'));
    if (r) setPs(r.filter((p) => p.estado !== 'regreso'));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!ps) return <Screen><Loading /></Screen>;
  const grupos: [string, Permiso[]][] = [
    ['Por resolver', ps.filter((p) => ['pendiente', 'esperando_padres'].includes(p.estado))],
    ['Autorizados', ps.filter((p) => p.estado === 'autorizado')],
    ['Afuera y recientes', ps.filter((p) => ['salio', 'rechazado', 'vencido'].includes(p.estado))],
  ];

  const enviar = (p: Permiso) => run(async () => {
    const r = await api<{ whatsapp: string | null }>(`/permisos/${p.id}/enviar-padres`, 'POST');
    if (r.whatsapp) await Linking.openURL(r.whatsapp); else notify('La jugadora no tiene teléfono de tutor');
    await load();
  });

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Button title="Crear permiso" icon={<Icon sf="plus" ion="add" size={20} color="#fff" />} onPress={() => router.push('/permiso-nuevo-coord')} />
      {grupos.map(([titulo, l]) => (
        <View key={titulo} style={{ gap: Space.s }}>
          <T v="title">{titulo} ({l.length})</T>
          {l.length ? l.map((p) => {
            const abierta = ['pendiente', 'esperando_padres'].includes(p.estado), [etq, tone] = ESTADO[p.estado] ?? [p.estado, 'neutral' as Tone], a = AUTH(p);
            return (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.s }}>
                  <T v="headline" style={{ flex: 1 }}>{p.jugadora}</T>
                  <Badge text={etq} tone={tone} />
                </View>
                <T v="sub">{p.tipo === 'pernocta' ? 'Pernocta · ' : ''}{p.destino}{p.ubicacion ? ` · ${p.ubicacion}` : ''}</T>
                <T v="caption" dim>Con {p.acompanante} · {dt(p.salida_at)} → {dt(p.regreso_at)}{p.menor ? ' · Menor de edad' : ''}</T>
                {p.motivo ? <T v="caption" dim>Motivo: {p.motivo}</T> : null}
                {a ? <T v="caption" dim>Autorizado por: {a}</T> : null}
                {p.estado === 'rechazado' && p.nota ? <T v="caption" dim>Rechazo: {p.nota}</T> : null}
                {abierta ? (
                  <View style={{ gap: Space.s, marginTop: Space.xs }}>
                    {p.menor ? <Button small kind="tinted" title={p.estado === 'pendiente' ? 'Enviar a tutor por WhatsApp' : 'Reenviar por WhatsApp'} icon={<Icon sf="paperplane.fill" ion="send" size={18} />} onPress={() => enviar(p)} /> : null}
                    <View style={{ flexDirection: 'row', gap: Space.s }}>
                      <View style={{ flex: 1 }}><Button small kind="tinted" title="Autorizar yo" onPress={() => setDlg({ p, accion: 'autorizar' })} /></View>
                      <View style={{ flex: 1 }}><Button small kind="danger" title="Rechazar" onPress={() => setDlg({ p, accion: 'rechazar' })} /></View>
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          }) : <Empty sf="tray" ion="file-tray-outline" title="Nada por aquí" />}
        </View>
      ))}

      <PromptDialog
        visible={!!dlg}
        title={dlg?.accion === 'autorizar' ? 'Autorizar sin respuesta digital' : 'Rechazar permiso'}
        label={dlg?.accion === 'autorizar' ? (dlg.p.menor ? '¿Cómo se confirmó con el tutor? Queda constancia en el registro.' : 'Nota (opcional)') : 'Motivo (lo verá la jugadora)'}
        placeholder={dlg?.accion === 'autorizar' ? 'Llamada a mamá, 14:05' : undefined}
        required={dlg?.accion === 'autorizar' && !!dlg.p.menor}
        ok={dlg?.accion === 'autorizar' ? 'Autorizar' : 'Rechazar'}
        onCancel={() => setDlg(null)}
        onSubmit={async (nota) => {
          if (!dlg) return;
          const okk = await run(() => api(`/permisos/${dlg.p.id}/${dlg.accion}`, 'POST', { nota }));
          if (okk) { notify(dlg.accion === 'autorizar' ? 'Autorizado' : 'Permiso rechazado'); setDlg(null); await load(); }
        }}
      />
    </Screen>
  );
}
