// Permisos de salida: por resolver, autorizados y afuera/recientes.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Modal, View } from 'react-native';

import { SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Card, Empty, Group, Icon, Loading, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { api } from '@/lib/api';
import { dt, PromptDialog } from '@/features/coord/util';

type Permiso = {
  id: number; jugadora: string; menor?: boolean; estado: string; tipo: string; destino: string; ubicacion?: string; acompanante: string; motivo?: string;
  tutor_nombre?: string; tutor_tel?: string; salida_at: number; regreso_at: number; metodo_auth?: string; nota?: string; padre_decision_at?: number; viaje_id?: number | null; titulo?: string;
};
type Envio = { jugadora: string; whatsapp: string | null; whatsapp_codigo: string | null };
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'gold' | 'tint';
const ESTADO: Record<string, [string, Tone]> = {
  pendiente: ['Pendiente', 'warn'], esperando_padres: ['Esperando al tutor', 'warn'], autorizado: ['Autorizado', 'ok'], salio: ['Afuera', 'gold'], rechazado: ['Rechazado', 'bad'], vencido: ['Vencido', 'neutral'], cancelado: ['Cancelado', 'neutral'],
};
const AUTH = (p: Permiso) => ({
  tutor_digital: `Tutor (digital${p.padre_decision_at ? ', ' + dt(p.padre_decision_at) : ''})`, coordinacion_manual: `Coordinación: ${p.nota || ''}`, mayor_de_edad: 'Coordinación (mayor de edad)', emergencia: `EMERGENCIA: ${p.nota || ''}`,
} as Record<string, string>)[p.metodo_auth ?? ''];

export default function Permisos() {
  const [ps, setPs] = useState<Permiso[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState<{ p: Permiso; tel: string } | null>(null);
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
    ['Afuera y recientes', ps.filter((p) => ['salio', 'rechazado', 'vencido', 'cancelado'].includes(p.estado))],
  ];

  const enviar = (p: Permiso) => run(async () => {
    const r = await api<{ whatsapp: string | null; whatsapp_codigo: string | null }>(`/permisos/${p.id}/enviar-padres`, 'POST');
    if (!r.whatsapp) { notify('La jugadora no tiene teléfono de tutor'); return; }
    setPaso(0); setEnvio({ jugadora: p.jugadora, ...r });
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
                {p.viaje_id ? <Badge text="Permiso de viaje" tone="tint" /> : null}
                <T v="sub">{p.tipo === 'pernocta' ? 'Pernocta · ' : ''}{p.destino}{p.ubicacion ? ` · ${p.ubicacion}` : ''}</T>
                <T v="caption" dim>Con {p.acompanante} · {dt(p.salida_at)} → {dt(p.regreso_at)}{p.menor ? ' · Menor de edad' : ''}</T>
                {p.motivo ? <T v="caption" dim>Motivo: {p.motivo}</T> : null}
                {a ? <T v="caption" dim>Autorizado por: {a}</T> : null}
                {p.estado === 'rechazado' && p.nota ? <T v="caption" dim>Rechazo: {p.nota}</T> : null}
                {abierta ? (
                  <View style={{ gap: Space.s, marginTop: Space.xs }}>
                    {p.menor ? <Button small kind="tinted" title={p.estado === 'pendiente' ? 'Enviar al tutor' : 'Reenviar al tutor'} icon={<Icon sf="paperplane.fill" ion="send" size={18} />} onPress={() => enviar(p)} /> : null}
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

      <Modal visible={!!envio} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEnvio(null)}>
        {envio ? (
          <SheetScreen title="Enviar al tutor" onClose={() => setEnvio(null)}>
            <T v="sub" dim>Para autorizar a {envio.jugadora}, el tutor necesita dos mensajes de WhatsApp. Mándalos en este orden.</T>
            <Button title={paso > 0 ? '1  Enlace enviado. Reenviar' : '1  Enviar enlace por WhatsApp'} kind={paso > 0 ? 'tinted' : 'filled'} icon={<Icon sf="paperplane.fill" ion="send" size={18} color={paso > 0 ? undefined : '#fff'} />}
              onPress={async () => { if (envio.whatsapp) await Linking.openURL(envio.whatsapp); setPaso((x) => Math.max(x, 1)); }} />
            <Button title={paso > 1 ? '2  Código enviado. Reenviar' : '2  Enviar código'} kind={paso === 1 ? 'filled' : 'tinted'} disabled={paso < 1} icon={<Icon sf="number" ion="keypad" size={18} color={paso === 1 ? '#fff' : undefined} />}
              onPress={async () => { if (envio.whatsapp_codigo) await Linking.openURL(envio.whatsapp_codigo); setPaso(2); }} />
            <T v="caption" dim>El tutor abre el enlace y escribe el código de 4 dígitos para autorizar o rechazar. Si no responde, puedes autorizar tú anotando cómo lo confirmaste.</T>
            <Button title="Listo" kind="plain" onPress={() => setEnvio(null)} />
          </SheetScreen>
        ) : null}
      </Modal>

      <Modal visible={!!aviso} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAviso(null)}>
        {aviso ? (
          <SheetScreen title="Avisar al tutor" onClose={() => setAviso(null)}>
            <T v="sub" dim>El permiso de {aviso.p.jugadora} quedó autorizado. La app no puede mandar WhatsApp sola: toca el botón y se abre tu WhatsApp con el mensaje listo; solo falta darle enviar. Puedes cambiar el número si quieres avisar a otra persona.</T>
            <Group>
              <TextField label={`Teléfono de ${aviso.p.tutor_nombre || 'mamá, papá o tutor'}`} value={aviso.tel} onChangeText={(v) => setAviso({ ...aviso, tel: v })} keyboardType="phone-pad" />
            </Group>
            <Button title="Avisar por WhatsApp" disabled={aviso.tel.replace(/\D/g, '').length < 10} icon={<Icon sf="paperplane.fill" ion="send" size={18} color="#fff" />}
              onPress={async () => {
                const d = aviso.tel.replace(/\D/g, ''), n = d.length === 10 ? '52' + d : d;
                const msg = `Hola ${aviso.p.tutor_nombre || ''}, te avisamos de Casa Club Femenil Tigres: el permiso de ${aviso.p.jugadora} fue AUTORIZADO.\n\nDestino: ${aviso.p.destino}\nAcompañante: ${aviso.p.acompanante}\nSalida: ${dt(aviso.p.salida_at)}\nRegreso: ${dt(aviso.p.regreso_at)}`;
                await Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`);
              }} />
            <Button title="Ahora no" kind="plain" onPress={() => setAviso(null)} />
          </SheetScreen>
        ) : null}
      </Modal>

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
          if (okk) {
            notify(dlg.accion === 'autorizar' ? 'Autorizado' : 'Permiso rechazado'); setDlg(null); await load();
            if (dlg.accion === 'autorizar' && dlg.p.menor) setAviso({ p: dlg.p, tel: dlg.p.tutor_tel ?? '' }); // ofrece avisar a mamá/papá
          }
        }}
      />
    </Screen>
  );
}
