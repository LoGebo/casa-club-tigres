// Modo sin conexión de Seguridad: paquete de GET /offline guardado en el teléfono + resolución local de escaneos.
// Replica situacion() del servidor. Los movimientos hechos aquí se aplican al paquete (overlay) hasta que la cola los envíe.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api, getOnline } from '@/lib/api';
import { pendientes } from '@/lib/cola';

export type Recoge = { id?: number; nombre: string; parentesco?: string; telefono?: string; documento?: string };
export type PermisoPk = { id: number; qr?: string; jugadora_id: number; estado: 'autorizado' | 'salio'; tipo?: string; destino: string; acompanante: string; salida_at: number; regreso_at: number; viaje_id?: number | null; ubicacion?: string; metodo_auth?: string };
export type Emergencia = { nombre?: string; tel?: string; alergias?: string; sangre?: string; seguro?: string; tutor_nombre?: string; tutor_tel?: string; tel_medico?: string };
export type JugadoraPk = { id: number; nombre: string; clave?: string; qr: string; habitacion?: string; categoria?: string; menor: boolean; emergencia: Emergencia; recogen: Recoge[] };
export type Paquete = { generado_at: number; gracia_min: number; tel_coordinacion?: string; tel_medico?: string; jugadoras: JugadoraPk[]; permisos: PermisoPk[] };
export type Ficha = {
  id: number; nombre: string; habitacion?: string; categoria?: string; menor: boolean; emergencia: Emergencia; recogen: Recoge[];
  estado: 'autorizada' | 'fuera' | 'sin_permiso'; accion: 'salida' | 'regreso' | null; permiso?: PermisoPk; proximo?: PermisoPk | null; local?: boolean;
  anticipada?: boolean; permiso_escaneado?: { id: number; estado: string; destino: string; salida_at: number; regreso_at: number }; pendiente_coord?: PermisoPk | null; pendiente_tutor?: PermisoPk | null;
};
type Mov = { jid: number; tipo: 'salida' | 'regreso'; at: number };

const KP = 'cc-offline-pack';
const KO = 'cc-offline-ov';
let pack: Paquete | null = null;
let ov: Mov[] = [];
let cargado = false;
const subs = new Set<() => void>();
const avisar = () => subs.forEach((f) => f());

async function cargar() {
  if (cargado) return;
  cargado = true;
  try { pack = JSON.parse((await AsyncStorage.getItem(KP)) ?? 'null'); ov = JSON.parse((await AsyncStorage.getItem(KO)) ?? '[]'); } catch { pack = null; ov = []; }
  avisar();
}

/** Aplica un movimiento al paquete: la salida deja el permiso «salio»; el regreso lo quita (ya no está vigente). */
function aplicar(p: Paquete, m: Mov) {
  if (m.tipo === 'salida') {
    const x = p.permisos.filter((q) => q.jugadora_id === m.jid && q.estado === 'autorizado' && q.salida_at - p.gracia_min * 6e4 <= m.at && q.regreso_at >= m.at).sort((a, b) => a.salida_at - b.salida_at)[0]
      ?? p.permisos.filter((q) => q.jugadora_id === m.jid && q.estado === 'autorizado').sort((a, b) => a.salida_at - b.salida_at)[0];
    if (x) x.estado = 'salio';
  } else p.permisos = p.permisos.filter((q) => !(q.jugadora_id === m.jid && q.estado === 'salio'));
}

/** Descarga el paquete (si hay red). Si aún hay movimientos en cola, los vuelve a aplicar encima para no «desregistrarlos». */
export async function sincronizar(): Promise<boolean> {
  await cargar();
  if (!getOnline()) return false;
  try {
    const nuevo = await api<Paquete>('/offline');
    if (!nuevo?.jugadoras) return false;
    if ((await pendientes()) > 0) ov.forEach((m) => aplicar(nuevo, m)); else ov = [];
    pack = nuevo;
    await AsyncStorage.multiSet([[KP, JSON.stringify(nuevo)], [KO, JSON.stringify(ov)]]);
    avisar();
    return true;
  } catch { return false; }
}

/** Anota un movimiento ya enviado o encolado para que el siguiente escaneo muestre la acción correcta. */
export async function registrarLocal(jid: number, tipo: 'salida' | 'regreso') {
  await cargar();
  const m: Mov = { jid, tipo, at: Date.now() };
  ov = [...ov, m];
  if (pack) aplicar(pack, m);
  await AsyncStorage.multiSet([[KO, JSON.stringify(ov)], [KP, JSON.stringify(pack)]]).catch(() => {});
  avisar();
}

export const paquete = async () => { await cargar(); return pack; };
export const edadMin = (p: Paquete | null) => (p ? Math.max(0, Math.round((Date.now() - p.generado_at) / 6e4)) : 0);
export const textoEdad = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/** Misma lógica que situacion() del servidor, con los datos del paquete */
export function fichaLocal(p: Paquete, j: JugadoraPk, now = Date.now(), pid?: number): Ficha {
  const base = { id: j.id, nombre: j.nombre, habitacion: j.habitacion, categoria: j.categoria, menor: j.menor, emergencia: { ...j.emergencia, tel_medico: j.emergencia.tel_medico || p.tel_medico }, recogen: j.recogen, local: true };
  const mios = p.permisos.filter((x) => x.jugadora_id === j.id);
  const fuera = mios.find((x) => x.estado === 'salio');
  if (fuera) return { ...base, estado: 'fuera', accion: 'regreso', permiso: fuera };
  const esc = pid ? mios.find((x) => x.id === pid && x.estado === 'autorizado' && x.regreso_at >= now) : undefined;
  if (esc) return { ...base, estado: 'autorizada', accion: 'salida', permiso: esc, anticipada: esc.salida_at - p.gracia_min * 6e4 > now };
  const ok = mios.filter((x) => x.estado === 'autorizado' && x.salida_at - p.gracia_min * 6e4 <= now && x.regreso_at >= now).sort((a, b) => a.salida_at - b.salida_at)[0];
  if (ok) return { ...base, estado: 'autorizada', accion: 'salida', permiso: ok };
  const prox = mios.filter((x) => x.estado === 'autorizado' && x.salida_at > now).sort((a, b) => a.salida_at - b.salida_at)[0];
  return { ...base, estado: 'sin_permiso', accion: null, proximo: prox ?? null };
}
export const porQr = (p: Paquete, qr: string) => p.jugadoras.find((j) => j.qr === qr.replace(/^CCF:/, ''));
export const porId = (p: Paquete, id: number) => p.jugadoras.find((j) => j.id === id);

/** Ficha en línea; si no hay red, la resuelve con el paquete. Devuelve null si no hay datos para resolverla. */
export async function resolver(q: { qr?: string; id?: string }): Promise<Ficha | null> {
  await cargar();
  if (getOnline()) {
    try {
      const f = await api<Ficha>(q.qr ? `/scan/${encodeURIComponent(q.qr)}` : `/jugadoras/${q.id}/situacion`);
      // api() devuelve la copia guardada si perdió la red: esa NO sirve para decidir una salida
      if (getOnline()) return f;
    } catch (e) { if (!(e instanceof Error) || e.message !== 'Sin conexión con el servidor') throw e; }
  }
  if (!pack) return null;
  if (q.qr?.startsWith('CCP:')) {
    const x = pack.permisos.find((y) => y.qr === q.qr!.slice(4));
    const jp = x && porId(pack, x.jugadora_id);
    if (!x || !jp) throw new Error('Permiso no encontrado en los datos guardados. Conéctate para revisarlo.');
    return fichaLocal(pack, jp, Date.now(), x.id);
  }
  const j = q.qr ? porQr(pack, q.qr) : porId(pack, Number(q.id));
  if (!j) throw new Error('Código no reconocido en los datos guardados');
  return fichaLocal(pack, j);
}

/** Mantiene el paquete al día: al entrar, al volver a primer plano y cada 5 min con red. Devuelve el paquete y su antigüedad. */
export function usePaquete(auto = false) {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((x) => x + 1);
    subs.add(f); void cargar().then(f);
    return () => { subs.delete(f); };
  }, []);
  useEffect(() => {
    if (!auto) return;
    void sincronizar();
    const t = setInterval(() => { void sincronizar(); }, 5 * 6e4);
    const s = AppState.addEventListener('change', (e) => { if (e === 'active') void sincronizar(); });
    return () => { clearInterval(t); s.remove(); };
  }, [auto]);
  const sync = useCallback(() => sincronizar(), []);
  return { pack, edad: edadMin(pack), sincronizar: sync };
}

/** Enlace de WhatsApp al tutor (mismo formato que arma el servidor) */
export const waTutor = (tel: string | undefined, msg: string) => {
  const d = String(tel ?? '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? '52' + d : d}?text=${encodeURIComponent(msg)}` : null;
};
