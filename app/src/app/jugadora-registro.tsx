// Registro de jugadoras (coordinación): una sola, o varias pegando una lista. Crea las cuentas con usuario y PIN generados.
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, TextInput, View } from 'react-native';

import { DateField, SheetScreen, TextField } from '@/components/form';
import { notify, run } from '@/components/notify';
import { Badge, Button, Group, Icon, Row, Segmented, T } from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Fila = { nombre: string; nacimiento: string; telefono: string; tutor_nombre: string; tutor_tel: string };
type Creada = { nombre: string; clave: string; pin: string; telefono?: string | null };
type Omitida = { fila: number; nombre?: string | null; error: string };
type Resultado = { creadas: Creada[]; omitidas: Omitida[] };

const VACIA: Fila = { nombre: '', nacimiento: '', telefono: '', tutor_nombre: '', tutor_tel: '' };

const mensaje = (c: Creada) =>
  `Hola ${c.nombre.split(' ')[0]}, ya tienes cuenta en la app de Casa Club Femenil.\nUsuario: ${c.clave}\nPIN: ${c.pin}\nCámbialo al entrar (tu inicial → Cambiar PIN).`;
const wa = (tel: string | null | undefined, texto: string) => {
  const d = (tel ?? '').replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '52' + d : d}?text=${encodeURIComponent(texto)}`;
};

/** Una fila por jugadora: nombre, nacimiento, teléfono, tutor, teléfono del tutor (coma, punto y coma o tabulador) */
function parseLista(txt: string): Fila[] {
  return txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [nombre = '', nacimiento = '', telefono = '', tutor_nombre = '', tutor_tel = ''] = l.split(/[;\t,]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    return { nombre, nacimiento, telefono, tutor_nombre, tutor_tel };
  }).filter((f) => !/^nombre/i.test(f.nombre));
}

export default function Registro() {
  const t = useTheme();
  const [modo, setModo] = useState<'enlace' | 'una' | 'varias'>('enlace');
  const [codigo, setCodigo] = useState('');
  useEffect(() => { api<{ codigo: string }>('/registro/codigo').then((r) => setCodigo(r.codigo)).catch(() => {}); }, []);
  const enlace = Platform.OS === 'web' && typeof location !== 'undefined' ? `${location.origin}/registro?codigo=${codigo}` : `${process.env.EXPO_PUBLIC_WEB_URL ?? ''}/registro?codigo=${codigo}`;
  const [f, setF] = useState<Fila>(VACIA);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const set = (k: keyof Fila) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const enviar = async (rows: Fila[]) => {
    setBusy(true);
    const r = await run(() => api<Resultado>('/jugadoras/lote', 'POST', { rows }));
    setBusy(false);
    if (r) { setRes(r); if (r.creadas.length) notify(`${r.creadas.length} cuenta(s) creadas`); }
  };

  const copiarTodo = async () => {
    if (!res) return;
    const texto = res.creadas.map((c) => `${c.nombre}\tUsuario: ${c.clave}\tPIN: ${c.pin}`).join('\n');
    if (Platform.OS === 'web') { await navigator.clipboard?.writeText(texto); notify('Copiado'); } else await Share.share({ message: texto });
  };

  if (res) {
    return (
      <SheetScreen title="Cuentas creadas">
        {res.creadas.length ? (
          <>
            <T v="sub" dim>Entrega a cada jugadora su usuario y PIN. Esta lista no se vuelve a mostrar; ellas pueden cambiar su PIN al entrar.</T>
            <Group>
              {res.creadas.map((c) => (
                <Row key={c.clave} minHeight={64} title={c.nombre} subtitle={`Usuario ${c.clave} · PIN ${c.pin}`}
                  trailing={c.telefono ? <Icon sf="paperplane" ion="paper-plane-outline" color={t.ok} /> : undefined}
                  onPress={c.telefono ? () => void Linking.openURL(wa(c.telefono, mensaje(c))) : undefined} />
              ))}
            </Group>
            <T v="caption" dim>Toca una jugadora con teléfono para enviarle sus datos por WhatsApp.</T>
            <Button title="Copiar o compartir la lista" kind="tinted" onPress={copiarTodo} />
          </>
        ) : null}
        {res.omitidas.length ? (
          <Group header="No se crearon">
            {res.omitidas.map((o) => <Row key={o.fila} minHeight={52} title={o.nombre || `Fila ${o.fila}`} subtitle={o.error} trailing={<Badge text={`Fila ${o.fila}`} tone="bad" />} />)}
          </Group>
        ) : null}
        <Button title="Registrar más" onPress={() => { setRes(null); setF(VACIA); setTxt(''); }} />
      </SheetScreen>
    );
  }

  const filas = parseLista(txt);
  return (
    <SheetScreen title="Registro de jugadoras">
      <Segmented options={[['enlace', 'Enlace'], ['una', 'Una'], ['varias', 'Lista']] as const} value={modo} onChange={setModo} />
      {modo === 'enlace' ? (
        <>
          <T v="sub" dim>Manda este enlace a las jugadoras (o a un grupo de WhatsApp). Cada una crea su cuenta, escribe sus datos y elige su PIN. Tú no capturas nada.</T>
          <Group footer="Si el enlace se filtra, genera uno nuevo y el anterior deja de funcionar.">
            <Row title="Enlace de registro" subtitle={codigo ? enlace : 'Cargando…'} minHeight={64} />
          </Group>
          <Button title="Enviar por WhatsApp" disabled={!codigo} onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Crea tu cuenta de Casa Club Femenil aquí:\n${enlace}`)}`)} />
          <Button title="Copiar enlace" kind="tinted" disabled={!codigo} onPress={async () => { if (Platform.OS === 'web') { await navigator.clipboard?.writeText(enlace); notify('Enlace copiado'); } else await Share.share({ message: enlace }); }} />
          <Button title="Generar enlace nuevo" kind="tinted" disabled={!codigo} onPress={async () => { const r = await run(() => api<{ codigo: string }>('/registro/codigo', 'POST')); if (r) { setCodigo(r.codigo); notify('Enlace nuevo generado'); } }} />
        </>
      ) : modo === 'una' ? (
        <>
          <Group footer="Todos los campos son obligatorios. Se genera el usuario y un PIN que verás al terminar.">
            <TextField label="Nombre completo de la jugadora" value={f.nombre} onChangeText={set('nombre')} autoCapitalize="words" />
            <DateField label="Fecha de nacimiento" value={f.nacimiento} onChange={set('nacimiento')} />
            <TextField label="Teléfono móvil de la jugadora" value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
            <TextField label="Nombre del papá, mamá o tutor (da los permisos)" value={f.tutor_nombre} onChangeText={set('tutor_nombre')} autoCapitalize="words" />
            <TextField label="Teléfono móvil del papá, mamá o tutor" value={f.tutor_tel} onChangeText={set('tutor_tel')} keyboardType="phone-pad" />
          </Group>
          <Button title="Registrar jugadora" loading={busy}
            disabled={!f.nombre.trim() || !f.nacimiento || !f.telefono.trim() || !f.tutor_nombre.trim() || !f.tutor_tel.trim()}
            onPress={() => enviar([f])} />
        </>
      ) : (
        <>
          <T v="sub" dim>Pega una fila por jugadora con: nombre completo, fecha de nacimiento (2009-03-12 o 12/03/2009), teléfono, tutor y teléfono del tutor. Puedes copiarlas desde Excel o Sheets.</T>
          <TextInput value={txt} onChangeText={setTxt} multiline autoCapitalize="none" autoCorrect={false} accessibilityLabel="Lista de jugadoras"
            placeholder={'Ana Martínez López, 12/03/2009, 8112345678, María López, 8187654321'} placeholderTextColor={t.label3}
            style={{ backgroundColor: t.surface, color: t.label, borderRadius: Radius.m, padding: Space.m, minHeight: 180, fontSize: 15, textAlignVertical: 'top' }} />
          <View style={{ gap: Space.s }}>
            <T v="caption" dim>{filas.length ? `${filas.length} jugadora(s) detectadas` : 'Aún no hay filas'}</T>
            <Button title={filas.length ? `Crear ${filas.length} cuenta(s)` : 'Crear cuentas'} loading={busy} disabled={!filas.length} onPress={() => enviar(filas)} />
          </View>
        </>
      )}
    </SheetScreen>
  );
}
