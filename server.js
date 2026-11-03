import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import webpush from 'web-push';
import { q, one, config, setConfig, audit, DEFAULTS } from './db.js';
import mount from './features.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(__dir, 'data');
fs.mkdirSync(DATA, { recursive: true });

// ---------- seguridad básica ----------
const secretFile = path.join(DATA, 'secret');
if (!process.env.SECRET && !fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = process.env.SECRET || fs.readFileSync(secretFile, 'utf8'); // en hosting sin disco persistente: define SECRET
export const hashPin = (pin) => { const s = crypto.randomBytes(8).toString('hex'); return s + ':' + crypto.scryptSync(String(pin), s, 32).toString('hex'); };
const okPin = (pin, h) => { const [s, x] = h.split(':'); const y = crypto.scryptSync(String(pin), s, 32).toString('hex'); return crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y)); };
const sign = (o) => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
const verify = (t = '') => {
  const [p, s] = t.split('.'); if (!p || !s) return null;
  const e = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null;
};
const intentos = new Map(); // ponytail: en memoria, un solo proceso; mover a tabla si hay varias instancias
const strike = (ip) => { const a = (intentos.get(ip) || []).filter((t) => t > Date.now() - 10 * 60e3); a.push(Date.now()); intentos.set(ip, a); };
const bloqueado = (ip) => (intentos.get(ip) || []).filter((t) => t > Date.now() - 10 * 60e3).length >= 10;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '600kb' }));
app.use('/api', (req, res, next) => { res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); req.method === 'OPTIONS' ? res.sendStatus(204) : next(); }); // la app Expo (web/teléfono) llama desde otro origen; la auth es por token Bearer
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }); next(); });

const auth = (...roles) => (req, res, next) => {
  const u = verify((req.get('authorization') || '').replace('Bearer ', ''));
  if (!u || (roles.length && !roles.includes(u.rol))) return res.status(401).json({ error: 'Sesión no válida' });
  req.u = u; next();
};
const STAFF = ['seguridad', 'coordinacion'];
const fail = (res, c, m) => res.status(c).json({ error: m });
const edad = (nac) => Math.floor((Date.now() - new Date(nac).getTime()) / 31557600000);
const tel = (t = '') => { const d = String(t).replace(/\D/g, ''); return d.length === 10 ? '52' + d : d; };
const TZ = process.env.TZ_CLUB || 'America/Monterrey';
const hora = (ms) => new Date(ms).toLocaleString('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const wa = (j, msg) => (j.tutor_tel ? `https://wa.me/${tel(j.tutor_tel)}?text=${encodeURIComponent(msg)}` : null);
const str = (v, n = 300) => (v == null ? null : String(v).trim().slice(0, n) || null);
const esMenor = (j) => edad(j.nacimiento) < 18;
const OFFSET = process.env.TZ_OFFSET || '-06:00'; // ponytail: México ya no usa horario de verano; si el club cambia de zona, define TZ_CLUB y TZ_OFFSET
const fechaLocal = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ms);
const hmLocal = (ms = Date.now()) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
const dowLocal = (ms = Date.now()) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(ms);
const diaMs = (f) => Date.parse(f + 'T00:00:00' + OFFSET);
const aMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fotoUrl = (id) => (id ? `/api/fotos/${id}?k=${sign({ foto: id, exp: Date.now() + 7 * 864e5 })}` : null);
// Fuerzas básicas = categorías «Sub-XX»; cualquier otra (Primer equipo, etc.) es profesional
const nivel = (c) => (!c ? null : /^sub/i.test(c) ? 'fuerzas_basicas' : 'profesional');
const catOk = async (c) => { const v = str(c, 40); if (!v) return ''; const l = (await config()).categorias.split(',').map((x) => x.trim()); return l.includes(v) ? v : null; };
const pub = (j) => ({ disponibilidad: j.disponibilidad, disp_nota: j.disp_nota, sangre: j.sangre, seguro: j.seguro, telefono: j.telefono, categoria: j.categoria, nivel: nivel(j.categoria), id: j.id, clave: j.clave, nombre: j.nombre, nacimiento: j.nacimiento, menor: esMenor(j), habitacion: j.habitacion, tutor_nombre: j.tutor_nombre, tutor_tel: j.tutor_tel, emergencia_nombre: j.emergencia_nombre, emergencia_tel: j.emergencia_tel, alergias: j.alergias, notas_medicas: j.notas_medicas, activa: j.activa });
const efectivo = (p) => (['pendiente', 'esperando_padres', 'autorizado'].includes(p.estado) && p.regreso_at < Date.now() ? 'vencido' : p.estado);
const conJug = 'SELECT p.*, j.nombre AS jugadora, j.clave, j.nacimiento, j.tutor_nombre, j.tutor_tel FROM permisos p JOIN jugadoras j ON j.id=p.jugadora_id';
const fmt = (p) => ({ ...p, padre_token: undefined, padre_ip: undefined, padre_ua: undefined, estado: efectivo(p), menor: p.nacimiento ? edad(p.nacimiento) < 18 : undefined });
const min = (c, k) => Number(c[k]) * 60e3;

// ---------- notificaciones push (opcional: el usuario debe activarlas) ----------
let pushOk = false;
async function initPush() {
  const c = await config();
  let pubk = c.vapid_pub, privk = c.vapid_priv;
  if (!pubk) { const k = webpush.generateVAPIDKeys(); pubk = k.publicKey; privk = k.privateKey; await setConfig('vapid_pub', pubk); await setConfig('vapid_priv', privk); }
  webpush.setVapidDetails('mailto:' + (process.env.CONTACT_EMAIL || 'admin@casaclub.local'), pubk, privk);
  pushOk = pubk;
}
// targets: ['coordinacion','seguridad','jugadora'] (todos de ese rol) y/o [{rol,id}]. Guarda en la bandeja y empuja a web/teléfono.
async function notify(targets, payload) {
  try {
    const users = [];
    for (const t of targets) {
      if (typeof t !== 'string') { users.push(t); continue; }
      const rows = t === 'jugadora' ? await q('SELECT id FROM jugadoras WHERE activa') : await q('SELECT id FROM staff WHERE rol=$1 AND activo', [t]);
      for (const r of rows) users.push({ rol: t, id: r.id });
    }
    const msg = { titulo: String(payload.title || '').slice(0, 120), cuerpo: payload.body ? String(payload.body).slice(0, 240) : null, ruta: payload.ruta || null };
    for (const u of users) await q('INSERT INTO notificaciones(rol,user_id,titulo,cuerpo,ruta,at) VALUES($1,$2,$3,$4,$5,$6)', [u.rol, u.id, msg.titulo, msg.cuerpo, msg.ruta, Date.now()]);
    if (!users.length) return;
    const roles = users.map((u) => u.rol), ids = users.map((u) => u.id);
    if (pushOk) for (const x of await q('SELECT * FROM push_subs WHERE (rol,user_id) IN (SELECT * FROM unnest($1::text[], $2::int[]))', [roles, ids]))
      webpush.sendNotification({ endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } }, JSON.stringify(payload)).catch((e) => { if ([404, 410].includes(e.statusCode)) q('DELETE FROM push_subs WHERE id=$1', [x.id]); });
    const toks = await q('SELECT token FROM push_tokens WHERE (rol,user_id) IN (SELECT * FROM unnest($1::text[], $2::int[]))', [roles, ids]);
    if (toks.length) fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toks.map((x) => ({ to: x.token, title: msg.titulo, body: msg.cuerpo || undefined, data: { ruta: msg.ruta }, sound: 'default' }))) }).catch(() => {});
  } catch (e) { console.error('notify', e.message); }
}
app.get('/api/push/key', auth(), (req, res) => res.json({ key: pushOk || null }));
app.post('/api/push/sub', auth(), async (req, res) => {
  const { endpoint, keys } = req.body.sub || {}; if (!endpoint || !keys?.p256dh || !keys?.auth) return fail(res, 400, 'Suscripción inválida');
  await q('INSERT INTO push_subs(rol,user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET rol=$1,user_id=$2', [req.u.rol, req.u.id, endpoint, keys.p256dh, keys.auth]);
  res.json({ ok: true });
});

// Vigilante: regreso atrasado → incidencia automática + aviso (se ejecuta cada minuto)
export async function vigilar() {
  const c = await config(), now = Date.now(), tol = min(c, 'tolerancia_min'), esc = min(c, 'escala_min'), f = fechaLocal(now), hm = hmLocal(now), m = aMin(hm);
  // 1. aviso a la jugadora 15 min antes de su hora de regreso
  for (const p of await q(`${conJug} WHERE p.estado='salio' AND p.recordatorio_at IS NULL AND p.regreso_at - $1 < $2 AND p.regreso_at > $2`, [15 * 60e3, now])) {
    await q('UPDATE permisos SET recordatorio_at=$1 WHERE id=$2', [now, p.id]);
    notify([{ rol: 'jugadora', id: p.jugadora_id }], { title: 'Ya casi es tu hora de regreso', body: `Debes estar de vuelta a las ${hora(p.regreso_at)}.`, ruta: '/jugadora/inicio' });
  }
  // 2. regreso atrasado → incidencia + aviso a Seguridad, Coordinación y a la propia jugadora
  for (const p of await q(`${conJug} WHERE p.estado='salio' AND p.alerta_at IS NULL AND p.regreso_at + $1 < $2`, [tol, now])) {
    await q('UPDATE permisos SET alerta_at=$1 WHERE id=$2', [now, p.id]);
    await q("INSERT INTO incidencias(tipo,severidad,jugadora_id,descripcion,creado_at) VALUES('retraso','media',$1,$2,$3)", [p.jugadora_id, `No ha regresado. Debía volver a las ${hora(p.regreso_at)} (destino: ${p.destino}).`, now]);
    notify(STAFF, { title: 'Regreso atrasado', body: `${p.jugadora} debía regresar a las ${hora(p.regreso_at)}`, tag: 'retraso-' + p.id, ruta: '/coord/hoy' });
    notify([{ rol: 'jugadora', id: p.jugadora_id }], { title: 'Ya pasó tu hora de regreso', body: 'Avisa a Coordinación o regresa a la casa club.', ruta: '/jugadora/inicio' });
  }
  // 3. escalada: sigue afuera pasado el margen → urgente, se repite cada 15 min hasta que regrese
  for (const p of await q(`${conJug} WHERE p.estado='salio' AND p.alerta_at IS NOT NULL AND p.regreso_at + $1 + $2 < $3 AND (p.alerta2_at IS NULL OR p.alerta2_at < $4)`, [tol, esc, now, now - 15 * 60e3])) {
    await q('UPDATE permisos SET alerta2_at=$1 WHERE id=$2', [now, p.id]);
    const mins = Math.round((now - p.regreso_at) / 60e3);
    await q("UPDATE incidencias SET severidad='urgente' WHERE tipo='retraso' AND jugadora_id=$1 AND estado='abierta'", [p.jugadora_id]);
    notify(STAFF, { title: 'URGENTE: sigue sin regresar', body: `${p.jugadora} lleva ${mins} min de retraso. Avisa a su tutor.`, tag: 'urgente-' + p.id, ruta: '/coord/hoy' });
  }
  // 4. toque de queda: avisa a Seguridad que haga el conteo y, si no se hace, a Coordinación
  if (c.toque_aviso !== f && m >= aMin(c.toque_queda)) {
    await setConfig('toque_aviso', f);
    notify(['seguridad'], { title: 'Hora del conteo', body: `Es el toque de queda (${c.toque_queda}). Haz el pase de lista.`, ruta: '/seguridad/mas/conteo' });
  } else if (c.toque_aviso === f && c.toque_falta !== f && m >= aMin(c.toque_queda) + Number(c.escala_min)) {
    await setConfig('toque_falta', f);
    if (!(await one('SELECT 1 FROM conteos WHERE at>=$1', [diaMs(f) + aMin(c.toque_queda) * 60e3]))) notify(STAFF, { title: 'Conteo pendiente', body: `Aún no se registra el conteo de las ${c.toque_queda}.`, ruta: '/seguridad/mas/conteo' });
  }
  // 5. recordatorio de registrar comidas (solo a quien aún no lo hizo, y solo si la hora ya pasó hace poco)
  for (const r of [{ tipo: 'comida', hm: '15:30' }, { tipo: 'cena', hm: '21:15' }]) {
    if (c['rec_' + r.tipo] === f || m < aMin(r.hm) || m > aMin(r.hm) + 120) continue;
    await setConfig('rec_' + r.tipo, f);
    const ids = await q('SELECT id FROM jugadoras j WHERE activa AND NOT EXISTS (SELECT 1 FROM comidas c WHERE c.jugadora_id=j.id AND c.fecha=$1 AND c.tipo=$2)', [f, r.tipo]);
    if (ids.length) notify(ids.map((x) => ({ rol: 'jugadora', id: x.id })), { title: r.tipo === 'comida' ? '¿Ya registraste tu comida?' : '¿Ya registraste tu cena?', body: 'Súbela con foto en un minuto.', ruta: '/jugadora/comidas' });
  }
  // 6. 24 h antes del viaje: recordatorio con lo que falta del checklist
  for (const v of await q('SELECT * FROM viajes WHERE recordado_at IS NULL AND salida_at - $1 < $2 AND salida_at > $2', [864e5, now])) {
    await q('UPDATE viajes SET recordado_at=$1 WHERE id=$2', [now, v.id]);
    const total = (await one('SELECT COUNT(*)::int n FROM viaje_items WHERE viaje_id=$1', [v.id])).n;
    for (const j of await q("SELECT jugadora_id FROM viaje_jug WHERE viaje_id=$1 AND estado IN('convocada','confirmada')", [v.id])) {
      const hechos = (await one('SELECT COUNT(*)::int n FROM viaje_check k JOIN viaje_items i ON i.id=k.item_id WHERE i.viaje_id=$1 AND k.jugadora_id=$2', [v.id, j.jugadora_id])).n;
      notify([{ rol: 'jugadora', id: j.jugadora_id }], { title: `Mañana: ${v.titulo}`, body: `Salida ${hora(v.salida_at)}.${total > hechos ? ` Te faltan ${total - hechos} cosas del checklist.` : ''}`, ruta: '/jugadora/calendario' });
    }
  }
  // 7. lunes 8:00 → resumen semanal listo
  if (dowLocal(now) === 'Mon' && m >= 480 && c.resumen_fecha !== f) { await setConfig('resumen_fecha', f); notify(['coordinacion'], { title: 'Tu resumen semanal está listo', body: 'Salidas, retrasos, incidencias y comidas de la semana.', ruta: '/coord/mas/resumen' }); }
  // 8. limpieza diaria: fotos de comidas (30 días), de servicios (90) y bandeja (60) para no llenar la base gratuita
  if (c.limpieza_fecha !== f && m >= 180) {
    await setConfig('limpieza_fecha', f);
    await q('DELETE FROM fotos WHERE id IN (SELECT foto_id FROM comidas WHERE foto_id IS NOT NULL AND creado_at<$1)', [now - 30 * 864e5]);
    await q('UPDATE comidas SET foto_id=NULL WHERE foto_id IS NOT NULL AND creado_at<$1', [now - 30 * 864e5]);
    await q('DELETE FROM fotos WHERE creado_at<$1', [now - 90 * 864e5]);
    await q('DELETE FROM notificaciones WHERE at<$1', [now - 60 * 864e5]);
  }
}

// ---------- login / sesión ----------
let ultimaVigilada = 0;
// Un monitor externo gratuito (cron-job.org / UptimeRobot) llama a /api/health cada pocos minutos: mantiene despierto el hosting
// gratuito y, además, ejecuta el vigilante de retrasos aunque el proceso acabe de despertar.
app.get('/api/health', (req, res) => { res.json({ ok: true }); if (Date.now() - ultimaVigilada > 50e3) { ultimaVigilada = Date.now(); vigilar().catch(console.error); } });
app.post('/api/login', async (req, res) => {
  if (bloqueado(req.ip)) return fail(res, 429, 'Demasiados intentos. Espera 10 minutos.');
  const uq = String(req.body.usuario || '').trim().toLowerCase(), pin = String(req.body.pin || '');
  const s = await one('SELECT * FROM staff WHERE usuario=$1 AND activo', [uq]);
  const j = s ? null : await one('SELECT * FROM jugadoras WHERE lower(clave)=$1 AND activa', [uq]);
  const x = s || j;
  if (!x || !okPin(pin, x.pin_hash)) { strike(req.ip); return fail(res, 401, 'Usuario o PIN incorrecto'); }
  const rol = s ? s.rol : 'jugadora';
  await audit({ rol, id: x.id }, 'login');
  res.json({ token: sign({ rol, id: x.id, exp: Date.now() + 30 * 864e5 }), rol, nombre: x.nombre, cambiar_pin: !!x.debe_cambiar_pin });
});
app.patch('/api/pin', auth(), async (req, res) => {
  const { actual, nuevo } = req.body; if (!/^\d{4,8}$/.test(nuevo || '')) return fail(res, 400, 'El PIN nuevo debe tener de 4 a 8 dígitos');
  const t = req.u.rol === 'jugadora' ? 'jugadoras' : 'staff';
  const x = await one(`SELECT pin_hash FROM ${t} WHERE id=$1`, [req.u.id]);
  if (!x || !okPin(actual || '', x.pin_hash)) return fail(res, 401, 'El PIN actual no es correcto');
  if (['1234', '0000', '1111', '123456', '12345', '4321'].includes(nuevo) || nuevo === actual) return fail(res, 400, 'Elige un PIN distinto y difícil de adivinar');
  await q(`UPDATE ${t} SET pin_hash=$1, debe_cambiar_pin=FALSE WHERE id=$2`, [hashPin(nuevo), req.u.id]); res.json({ ok: true });
});
app.get('/api/me', auth('jugadora'), async (req, res) => { const j = await one('SELECT * FROM jugadoras WHERE id=$1', [req.u.id]); res.json({ ...pub(j), qr: 'CCF:' + j.qr, ...(await mia(j.id)) }); });
const mia = async (id) => ({ fuera: await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='salio'`, [id]) });
app.get('/api/qr', async (req, res) => res.type('image/svg+xml').send(await QRCode.toString(String(req.query.d || '').slice(0, 200), { type: 'svg', margin: 4, errorCorrectionLevel: 'M' })));
app.get('/api/config', async (req, res) => { const c = await config(); if (!verify((req.get('authorization') || '').replace('Bearer ', ''))) return res.json({ nombre_club: c.nombre_club, categorias: c.categorias }); res.json({ categorias: c.categorias, tel_medico: c.tel_medico, escala_min: c.escala_min, toque_queda: c.toque_queda, tel_coordinacion: c.tel_coordinacion, nombre_club: c.nombre_club, gracia_min: c.gracia_min, tolerancia_min: c.tolerancia_min, max_pendientes: c.max_pendientes }); });
app.put('/api/config', auth('coordinacion'), async (req, res) => {
  for (const k of Object.keys(DEFAULTS)) if (req.body[k] != null) await setConfig(k, String(req.body[k]).slice(0, 200));
  await audit(req.u, 'config', JSON.stringify(req.body)); res.json({ ok: true });
});

// ---------- jugadoras ----------
app.get('/api/jugadoras', auth(...STAFF), async (req, res) => {
  const rows = await q('SELECT * FROM jugadoras ORDER BY nombre');
  res.json(rows.map((j) => (req.u.rol === 'coordinacion' ? { ...pub(j), qr: 'CCF:' + j.qr } : { id: j.id, nombre: j.nombre, clave: j.clave, habitacion: j.habitacion, activa: j.activa, categoria: j.categoria, nivel: nivel(j.categoria) })));
});
const campos = (b) => [str(b.nombre, 120), str(b.habitacion, 20), str(b.tutor_nombre, 120), str(b.tutor_tel, 20), str(b.emergencia_nombre, 120), str(b.emergencia_tel, 20), str(b.alergias, 300), str(b.notas_medicas, 500)];
app.post('/api/jugadoras', auth('coordinacion'), async (req, res) => {
  const b = req.body;
  if (!b.clave || !b.nombre || !b.nacimiento || !/^\d{4,8}$/.test(b.pin || '')) return fail(res, 400, 'Faltan datos (PIN de 4 a 8 dígitos)');
  if (edad(b.nacimiento) < 18 && !tel(b.tutor_tel)) return fail(res, 400, 'Para menores el teléfono del tutor es obligatorio');
  if (await one('SELECT 1 FROM jugadoras WHERE clave=$1', [b.clave.trim().toLowerCase()]) || await one('SELECT 1 FROM staff WHERE usuario=$1', [b.clave.trim().toLowerCase()])) return fail(res, 409, 'Esa clave ya existe');
  await q('INSERT INTO jugadoras(clave,nacimiento,nombre,habitacion,tutor_nombre,tutor_tel,emergencia_nombre,emergencia_tel,alergias,notas_medicas,pin_hash,qr) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [b.clave.trim().toLowerCase(), b.nacimiento, ...campos(b), hashPin(b.pin), crypto.randomBytes(12).toString('hex')]);
  if (str(b.telefono, 20)) await q('UPDATE jugadoras SET telefono=$1 WHERE clave=$2', [str(b.telefono, 20), b.clave.trim().toLowerCase()]);
  await q('UPDATE jugadoras SET debe_cambiar_pin=TRUE WHERE clave=$1', [b.clave.trim().toLowerCase()]);
  if (b.categoria) await q('UPDATE jugadoras SET categoria=$1 WHERE clave=$2', [await catOk(b.categoria) || null, b.clave.trim().toLowerCase()]);
  await audit(req.u, 'jugadora_alta', b.nombre); res.json({ ok: true });
});
// Registro por lista: crea las cuentas con clave y PIN generados y los devuelve UNA vez para entregarlos a cada jugadora
const quitaAcentos = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fechaIso = (f = '') => { const s = String(f).trim(), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (!m) return null; const [y, mo, d] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]]; const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; return Number.isNaN(new Date(iso).getTime()) ? null : iso; };
const crearJugadora = async (b, nombre, nac, pin) => {
  const partes = quitaAcentos(nombre).toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
  const base = (partes.length > 1 ? `${partes[0]}.${partes[partes.length > 2 ? partes.length - 2 : 1]}` : partes[0]) || 'jugadora';
  let clave = base, n = 1; while (await one('SELECT 1 FROM jugadoras WHERE clave=$1', [clave]) || await one('SELECT 1 FROM staff WHERE usuario=$1', [clave])) clave = base + ++n;
  await q('INSERT INTO jugadoras(clave,nacimiento,nombre,habitacion,tutor_nombre,tutor_tel,emergencia_nombre,emergencia_tel,pin_hash,qr,telefono,categoria) VALUES($1,$2,$3,$4,$5,$6,$5,$6,$7,$8,$9,$10)',
    [clave, nac, nombre, str(b.habitacion, 20), str(b.tutor_nombre, 120), str(b.tutor_tel, 20), hashPin(pin), crypto.randomBytes(12).toString('hex'), str(b.telefono, 20), b.categoria || null]);
  return clave;
};
// Autorregistro: la coordinación comparte un enlace con un código; la jugadora crea su cuenta y elige su PIN.
const codigoReg = async () => { let c = (await config()).codigo_registro; if (!c) { c = crypto.randomBytes(5).toString('base64url'); await setConfig('codigo_registro', c); } return c; };
app.get('/api/registro/codigo', auth('coordinacion'), async (req, res) => res.json({ codigo: await codigoReg() }));
app.post('/api/registro/codigo', auth('coordinacion'), async (req, res) => {
  const c = crypto.randomBytes(5).toString('base64url'); await setConfig('codigo_registro', c); await audit(req.u, 'registro_codigo_nuevo'); res.json({ codigo: c });
});
app.post('/api/registro', async (req, res) => {
  if (bloqueado(req.ip)) return fail(res, 429, 'Demasiados intentos. Espera 10 minutos.');
  const b = req.body || {};
  if (String(b.codigo || '') !== await codigoReg()) { strike(req.ip); return fail(res, 403, 'El enlace de registro no es válido o ya venció. Pídele uno nuevo a Coordinación.'); }
  const nombre = str(b.nombre, 120), nac = fechaIso(b.nacimiento);
  if (!nombre || !nac) return fail(res, 400, 'Escribe tu nombre completo y tu fecha de nacimiento');
  if (!tel(b.telefono)) return fail(res, 400, 'Escribe tu teléfono');
  if (edad(nac) < 18 && (!str(b.tutor_nombre) || !tel(b.tutor_tel))) return fail(res, 400, 'Escribe el nombre y teléfono de tu mamá, papá o tutor');
  if (!/^\d{4,8}$/.test(String(b.pin || ''))) return fail(res, 400, 'Elige un PIN de 4 a 8 dígitos');
  const cat = await catOk(b.categoria); if (!cat) return fail(res, 400, 'Elige tu categoría');
  if (String(b.pin) === '1234') return fail(res, 400, 'Ese PIN es muy fácil de adivinar. Elige otro');
  const dup = await one('SELECT 1 FROM jugadoras WHERE lower(nombre)=lower($1) AND nacimiento=$2', [nombre, nac]);
  if (dup) return fail(res, 409, 'Ya existe una cuenta con ese nombre y fecha. Entra con tu usuario o pídele ayuda a Coordinación.');
  const clave = await crearJugadora({ ...b, categoria: cat }, nombre, nac, String(b.pin));
  const j = await one('SELECT id FROM jugadoras WHERE clave=$1', [clave]);
  await audit({ rol: 'jugadora', id: j.id }, 'autorregistro', nombre);
  notify(['coordinacion'], { title: 'Nueva jugadora registrada', body: nombre, tag: 'reg-' + j.id });
  res.json({ token: sign({ rol: 'jugadora', id: j.id, exp: Date.now() + 30 * 864e5 }), rol: 'jugadora', nombre, clave });
});
app.post('/api/jugadoras/lote', auth('coordinacion'), async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 80) : []; if (!rows.length) return fail(res, 400, 'No hay jugadoras en la lista');
  const creadas = [], omitidas = [];
  for (const [i, b] of rows.entries()) {
    const nombre = str(b.nombre, 120), nac = fechaIso(b.nacimiento);
    if (!nombre || !nac) { omitidas.push({ fila: i + 1, nombre, error: 'Falta nombre o fecha de nacimiento válida' }); continue; }
    if (edad(nac) < 18 && !tel(b.tutor_tel)) { omitidas.push({ fila: i + 1, nombre, error: 'Menor sin teléfono del tutor' }); continue; }
    const pin = String(crypto.randomInt(1000, 10000));
    const clave = await crearJugadora({ ...b, categoria: await catOk(b.categoria) || null }, nombre, nac, pin);
    await q('UPDATE jugadoras SET debe_cambiar_pin=TRUE WHERE clave=$1', [clave]);
    creadas.push({ nombre, clave, pin, telefono: str(b.telefono, 20) });
  }
  await audit(req.u, 'jugadoras_lote', `${creadas.length} creadas, ${omitidas.length} omitidas`); res.json({ creadas, omitidas });
});
app.patch('/api/jugadoras/:id', auth('coordinacion'), async (req, res) => {
  const j = await one('SELECT * FROM jugadoras WHERE id=$1', [req.params.id]); if (!j) return fail(res, 404, 'No existe');
  const b = { ...j, ...Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined)) };
  if (req.body.pin && !/^\d{4,8}$/.test(req.body.pin)) return fail(res, 400, 'PIN inválido');
  await q('UPDATE jugadoras SET nombre=$1,habitacion=$2,tutor_nombre=$3,tutor_tel=$4,emergencia_nombre=$5,emergencia_tel=$6,alergias=$7,notas_medicas=$8,activa=$9,pin_hash=$10 WHERE id=$11',
    [...campos(b), typeof b.activa === 'boolean' ? b.activa : !!+b.activa, req.body.pin ? hashPin(req.body.pin) : j.pin_hash, j.id]);
  if (req.body.pin) await q('UPDATE jugadoras SET debe_cambiar_pin=TRUE WHERE id=$1', [j.id]);
  for (const k of ['disponibilidad', 'disp_nota', 'sangre', 'seguro']) if (req.body[k] !== undefined) await q(`UPDATE jugadoras SET ${k}=$1 WHERE id=$2`, [str(req.body[k], 120), j.id]);
  if (req.body.categoria !== undefined) { const c = await catOk(req.body.categoria); if (c === null) return fail(res, 400, 'Categoría no válida'); await q('UPDATE jugadoras SET categoria=$1 WHERE id=$2', [c || null, j.id]); }
  if (req.body.telefono !== undefined) await q('UPDATE jugadoras SET telefono=$1 WHERE id=$2', [str(req.body.telefono, 20), j.id]);
  await audit(req.u, 'jugadora_edit', `${j.nombre} ${Object.keys(req.body).join(',')}`); res.json({ ok: true });
});

// ---------- permisos ----------
app.post('/api/permisos', auth('jugadora', 'coordinacion'), async (req, res) => {
  const b = req.body, jid = req.u.rol === 'jugadora' ? req.u.id : b.jugadora_id;
  if (!str(b.destino) || !str(b.acompanante)) return fail(res, 400, 'Destino y acompañante son obligatorios');
  if (!(b.salida_at < b.regreso_at) || b.regreso_at < Date.now()) return fail(res, 400, 'Revisa el horario: el regreso debe ser después de la salida y en el futuro');
  const c = await config();
  const n = (await one("SELECT COUNT(*)::int n FROM permisos WHERE jugadora_id=$1 AND estado IN('pendiente','esperando_padres') AND regreso_at>$2", [jid, Date.now()])).n;
  if (n >= +c.max_pendientes) return fail(res, 429, `Ya hay ${n} solicitudes en espera`);
  const p = await one('INSERT INTO permisos(jugadora_id,tipo,destino,acompanante,ubicacion,motivo,salida_at,regreso_at,creado_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
    [jid, b.tipo === 'pernocta' ? 'pernocta' : 'salida', str(b.destino, 120), str(b.acompanante, 120), str(b.ubicacion, 200), str(b.motivo, 200), b.salida_at, b.regreso_at, Date.now()]);
  await audit(req.u, 'permiso_solicitud', p.id);
  if (req.u.rol === 'jugadora') notify(['coordinacion'], { title: 'Nueva solicitud de permiso', body: `${str(b.destino, 60)}`, tag: 'sol-' + p.id, ruta: '/coord/permisos' });
  res.json({ ok: true });
});
app.get('/api/permisos', auth('jugadora', 'coordinacion'), async (req, res) => {
  const rows = req.u.rol === 'jugadora'
    ? await q(`${conJug} WHERE p.jugadora_id=$1 ORDER BY p.salida_at DESC LIMIT 50`, [req.u.id])
    : await q(`${conJug} WHERE p.estado IN('pendiente','esperando_padres','autorizado','salio') OR p.creado_at>$1 ORDER BY p.salida_at ASC LIMIT 300`, [Date.now() - 2 * 864e5]);
  res.json(rows.map(fmt));
});
const decide = (fn) => async (req, res) => {
  const p = await one(`${conJug} WHERE p.id=$1`, [req.params.id]);
  if (!p) return fail(res, 404, 'No existe');
  if (!['pendiente', 'esperando_padres'].includes(p.estado)) return fail(res, 409, 'Esta solicitud ya fue resuelta');
  await fn(req, res, p);
};
app.post('/api/permisos/:id/enviar-padres', auth('coordinacion'), decide(async (req, res, p) => {
  if (!esMenor(p)) return fail(res, 400, 'Es mayor de edad: autoriza directamente');
  const tok = p.padre_token || crypto.randomBytes(18).toString('base64url'), otp = p.padre_otp || String(crypto.randomInt(1000, 10000));
  await q("UPDATE permisos SET estado='esperando_padres', padre_token=$1, padre_otp=$2, padre_enviado_at=$3 WHERE id=$4", [tok, otp, Date.now(), p.id]);
  const base = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  const msg = `Hola ${p.tutor_nombre || ''}, ${p.jugadora} solicita permiso para salir de Casa Club Femenil Tigres.\n\nDestino: ${p.destino}\nAcompañante: ${p.acompanante}\nSalida: ${hora(p.salida_at)}\nRegreso: ${hora(p.regreso_at)}\n\nPara autorizar o rechazar entra aquí:\n${base}/p/${tok}`;
  await audit(req.u, 'permiso_enviado_tutor', p.id); res.json({ whatsapp: wa(p, msg), whatsapp_codigo: wa(p, codigoMsg(otp)) });
}));
app.post('/api/permisos/:id/autorizar', auth('coordinacion'), decide(async (req, res, p) => {
  const menor = esMenor(p), nota = str(req.body.nota);
  if (menor && !nota) return fail(res, 400, 'Para menores sin respuesta digital del tutor, anota cómo se confirmó (ej. llamada a mamá 14:05)');
  await q("UPDATE permisos SET estado='autorizado', metodo_auth=$1, nota=$2, resuelto_por=$3 WHERE id=$4", [menor ? 'coordinacion_manual' : 'mayor_de_edad', nota, req.u.id, p.id]);
  await audit(req.u, 'permiso_autorizado', `${p.id} ${nota || ''}`); notify([{ rol: 'jugadora', id: p.jugadora_id }], { title: 'Permiso autorizado', body: p.destino, ruta: '/jugadora/permisos' }); res.json({ ok: true });
}));
app.post('/api/permisos/:id/rechazar', auth('coordinacion'), decide(async (req, res, p) => {
  await q("UPDATE permisos SET estado='rechazado', nota=$1, resuelto_por=$2 WHERE id=$3", [str(req.body.nota), req.u.id, p.id]);
  await audit(req.u, 'permiso_rechazado', p.id); notify([{ rol: 'jugadora', id: p.jugadora_id }], { title: 'Permiso rechazado', body: str(req.body.nota, 120) || p.destino, ruta: '/jugadora/permisos' }); res.json({ ok: true });
}));
const codigoMsg = (otp) => `Casa Club Femenil Tigres: tu código de confirmación es ${otp}. Escríbelo en la página para autorizar o rechazar. No lo compartas con nadie más.`;
// Salida de emergencia (ambulancia, familiar, etc.): Coordinación crea un permiso ya autorizado y trazable
app.post('/api/emergencia', auth('coordinacion'), async (req, res) => {
  const b = req.body, j = await one('SELECT * FROM jugadoras WHERE id=$1 AND activa', [b.jugadora_id]);
  if (!j || !str(b.motivo) || !str(b.destino)) return fail(res, 400, 'Indica jugadora, motivo y destino');
  const now = Date.now();
  await q("INSERT INTO permisos(jugadora_id,tipo,destino,acompanante,motivo,salida_at,regreso_at,estado,creado_at,metodo_auth,nota,resuelto_por) VALUES($1,'salida',$2,$3,$4,$5,$6,'autorizado',$5,'emergencia',$4,$7)",
    [j.id, str(b.destino, 120), str(b.acompanante, 120) || 'Personal del club', str(b.motivo, 200), now, now + (Number(b.horas) || 6) * 36e5, req.u.id]);
  await audit(req.u, 'salida_emergencia', `${j.nombre}: ${b.motivo}`); res.json({ ok: true });
});

// ---------- autorización del tutor (enlace con token aleatorio de un solo uso lógico) ----------
const porToken = (t) => one(`${conJug} WHERE p.padre_token=$1`, [String(t)]);
app.get('/api/p/:t', async (req, res) => {
  const p = await porToken(req.params.t); if (!p) { strike(req.ip); return fail(res, 404, 'Enlace no válido'); }
  res.json({ jugadora: p.jugadora, destino: p.destino, acompanante: p.acompanante, ubicacion: p.ubicacion, motivo: p.motivo, salida_at: p.salida_at, regreso_at: p.regreso_at, estado: efectivo(p), decision: p.padre_decision, tutor: p.tutor_nombre, tipo: p.tipo, requiere_codigo: !!p.padre_otp, viaje: !!p.viaje_id });
});
app.post('/api/p/:t', async (req, res) => {
  if (bloqueado(req.ip)) return fail(res, 429, 'Demasiados intentos');
  const p = await porToken(req.params.t); if (!p) { strike(req.ip); return fail(res, 404, 'Enlace no válido'); }
  const ok = req.body.decision === 'aprobar';
  if (ok && p.padre_otp) {
    if (p.padre_intentos >= 5) return fail(res, 429, 'Demasiados intentos con el código. Pide a Coordinación que te lo reenvíe.');
    if (String(req.body.codigo || '').trim() !== p.padre_otp) { await q('UPDATE permisos SET padre_intentos=padre_intentos+1 WHERE id=$1', [p.id]); return fail(res, 403, 'El código no es correcto'); }
  }
  const r = await q("UPDATE permisos SET estado=$1, padre_decision=$2, padre_decision_at=$3, padre_ip=$4, padre_ua=$5, metodo_auth=$6 WHERE id=$7 AND estado='esperando_padres' AND regreso_at>$3 RETURNING id",
    [ok ? 'autorizado' : 'rechazado', ok ? 'aprobado' : 'rechazado', Date.now(), req.ip, (req.get('user-agent') || '').slice(0, 200), ok ? 'tutor_digital' : null, p.id]);
  if (!r.length) return fail(res, 409, 'Esta solicitud ya no admite respuesta');
  notify(['coordinacion', { rol: 'jugadora', id: p.jugadora_id }], { title: ok ? 'Tutor autorizó' : 'Tutor rechazó', body: `${p.jugadora}: ${p.destino}`, tag: 'tut-' + p.id, ruta: '/jugadora/permisos' });
  res.json({ ok: true });
});

// ---------- seguridad: escaneo y movimientos ----------
async function situacion(j, now = Date.now(), pid = null) {
  const fuera = await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='salio'`, [j.id]);
  if (fuera) return { estado: 'fuera', accion: 'regreso', permiso: fmt(fuera) };
  const c = await config();
  // QR del permiso: si coordinación lo autorizó y no ha vencido, puede salir (menor o no) aunque sea antes de su hora
  if (pid) {
    const e = await one(`${conJug} WHERE p.id=$1 AND p.jugadora_id=$2 AND p.estado='autorizado' AND p.regreso_at>=$3`, [pid, j.id, now]);
    if (e) return { estado: 'autorizada', accion: 'salida', permiso: fmt(e), anticipada: e.salida_at - min(c, 'gracia_min') > now };
  }
  const ok = await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='autorizado' AND p.salida_at-$2<=$3 AND p.regreso_at>=$3 ORDER BY p.salida_at LIMIT 1`, [j.id, min(c, 'gracia_min'), now]);
  if (ok) return { estado: 'autorizada', accion: 'salida', permiso: fmt(ok) };
  const prox = await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='autorizado' AND p.salida_at>$2 ORDER BY p.salida_at LIMIT 1`, [j.id, now]);
  const espera = await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='esperando_padres' AND p.regreso_at>=$2 ORDER BY p.salida_at LIMIT 1`, [j.id, now]);
  const coord = await one(`${conJug} WHERE p.jugadora_id=$1 AND p.estado='pendiente' AND p.regreso_at>=$2 ORDER BY p.salida_at LIMIT 1`, [j.id, now]);
  return { estado: 'sin_permiso', accion: null, proximo: prox ? fmt(prox) : null, pendiente_tutor: espera ? fmt(espera) : null, pendiente_coord: coord ? fmt(coord) : null };
}
const ficha = async (j, pid = null, esc = null) => ({ ...(esc ? { permiso_escaneado: esc } : {}), id: j.id, nombre: j.nombre, clave: j.clave, habitacion: j.habitacion, categoria: j.categoria, menor: esMenor(j), emergencia: { nombre: j.emergencia_nombre || j.tutor_nombre, tel: j.emergencia_tel || j.tutor_tel, alergias: j.alergias, sangre: j.sangre, seguro: j.seguro, tutor_nombre: j.tutor_nombre, tutor_tel: j.tutor_tel, tel_medico: (await config()).tel_medico }, recogen: await q('SELECT id, nombre, parentesco, telefono, documento FROM recogen WHERE jugadora_id=$1 ORDER BY id', [j.id]), ...(await situacion(j, Date.now(), pid)) });
app.get('/api/scan/:qr', auth(...STAFF), async (req, res) => {
  if (req.params.qr.startsWith('CCP:')) {
    const p = await one(`${conJug} WHERE p.qr=$1`, [req.params.qr.slice(4)]);
    const jp = p && await one('SELECT * FROM jugadoras WHERE id=$1 AND activa', [p.jugadora_id]);
    return jp ? res.json(await ficha(jp, p.id, { id: p.id, estado: efectivo(p), destino: p.destino, salida_at: p.salida_at, regreso_at: p.regreso_at })) : fail(res, 404, 'Código de permiso no reconocido');
  }
  const j = await one('SELECT * FROM jugadoras WHERE qr=$1 AND activa', [req.params.qr.replace(/^CCF:/, '')]);
  j ? res.json(await ficha(j)) : fail(res, 404, 'Código no reconocido');
});
app.get('/api/jugadoras/:id/situacion', auth(...STAFF), async (req, res) => {
  const j = await one('SELECT * FROM jugadoras WHERE id=$1 AND activa', [req.params.id]);
  j ? res.json(await ficha(j)) : fail(res, 404, 'No existe');
});
app.post('/api/mov', auth(...STAFF), async (req, res) => {
  const j = await one('SELECT * FROM jugadoras WHERE id=$1 AND activa', [req.body.jugadora_id]);
  if (!j) return fail(res, 404, 'No existe');
  const cid = str(req.body.cid, 60);
  if (cid && await one('SELECT 1 FROM movimientos WHERE cid=$1', [cid])) return res.json({ ok: true, duplicado: true });
  const ahora = Date.now(), at = Number(req.body.at), hora_mov = at > ahora - 12 * 36e5 && at <= ahora + 6e4 ? at : ahora;
  const s = await situacion(j, hora_mov, req.body.por_qr ? Number(req.body.permiso_id) || null : null), tipo = req.body.tipo;
  if (s.accion !== tipo) return fail(res, 409, s.accion ? 'El estado cambió, vuelve a escanear' : 'Sin permiso vigente: NO puede salir');
  const now = hora_mov;
  // Un solo statement atómico: solo registra si el permiso sigue en el estado esperado (evita doble salida por doble toque)
  const r = await q(`WITH u AS (UPDATE permisos SET estado=$1 WHERE id=$2 AND estado=$3 RETURNING id) INSERT INTO movimientos(jugadora_id,permiso_id,tipo,at,staff_id,cid) SELECT $4::int,id,$5::text,$6::float8,$7::int,$8::text FROM u RETURNING id`,
    [tipo === 'salida' ? 'salio' : 'regreso', s.permiso.id, tipo === 'salida' ? 'autorizado' : 'salio', j.id, tipo, now, req.u.id, cid]);
  if (!r.length) return fail(res, 409, 'El estado cambió, vuelve a escanear');
  const p = s.permiso;
  const msg = tipo === 'salida'
    ? `Casa Club Femenil Tigres: ${j.nombre} salió a las ${hora(now)} con destino ${p.destino} (acompañante: ${p.acompanante}). Regreso previsto: ${hora(p.regreso_at)}.`
    : `Casa Club Femenil Tigres: ${j.nombre} regresó a las ${hora(now)}. ¡Todo en orden!`;
  res.json({ ok: true, whatsapp: wa(j, msg) });
});
// Salida grupal (entrenamiento): Seguridad marca que todas las que están dentro salieron juntas; crea un permiso por jugadora, avisa a Coordinación y a las jugadoras
app.post('/api/salida-grupal', auth(...STAFF), async (req, res) => {
  const motivo = str(req.body.motivo, 80) || 'Entrenamiento', horas = Math.min(Math.max(Number(req.body.horas) || 3, 0.5), 12), now = Date.now();
  const dentro = await q("SELECT j.id, j.nombre FROM jugadoras j WHERE j.activa AND NOT EXISTS(SELECT 1 FROM permisos p WHERE p.jugadora_id=j.id AND p.estado='salio')");
  for (const j of dentro) {
    const p = await one("INSERT INTO permisos(jugadora_id,tipo,destino,acompanante,motivo,salida_at,regreso_at,estado,creado_at,metodo_auth,nota,resuelto_por) VALUES($1,'salida',$2,'Cuerpo técnico','Salida grupal',$3,$4,'salio',$3,'salida_grupal',$5,$6) RETURNING id",
      [j.id, motivo, now, now + horas * 36e5, `Salida grupal registrada por ${req.u.rol}`, req.u.id]);
    await q('INSERT INTO movimientos(jugadora_id,permiso_id,tipo,at,staff_id) VALUES($1,$2,$3,$4,$5)', [j.id, p.id, 'salida', now, req.u.id]);
  }
  await audit(req.u, 'salida_grupal', `${motivo}: ${dentro.length} jugadoras`);
  if (dentro.length) {
    notify(['coordinacion', ...dentro.map((j) => ({ rol: 'jugadora', id: j.id }))], { title: `Salieron a ${motivo.toLowerCase()}`, body: `${dentro.length} jugadoras salieron a las ${hora(now)}. Regreso previsto: ${hora(now + horas * 36e5)}.`, tag: 'grupal-' + now, ruta: '/coord/hoy' });
  }
  res.json({ ok: true, jugadoras: dentro.length, regreso_at: now + horas * 36e5 });
});
app.post('/api/regreso-grupal', auth(...STAFF), async (req, res) => {
  const now = Date.now();
  const fuera = await q("SELECT id, jugadora_id FROM permisos WHERE estado='salio' AND metodo_auth='salida_grupal'");
  for (const p of fuera) {
    await q("UPDATE permisos SET estado='regreso' WHERE id=$1 AND estado='salio'", [p.id]);
    await q('INSERT INTO movimientos(jugadora_id,permiso_id,tipo,at,staff_id) VALUES($1,$2,$3,$4,$5)', [p.jugadora_id, p.id, 'regreso', now, req.u.id]);
  }
  await audit(req.u, 'regreso_grupal', `${fuera.length} jugadoras`);
  if (fuera.length) notify(['coordinacion'], { title: 'Regresaron del entrenamiento', body: `${fuera.length} jugadoras regresaron a las ${hora(now)}.`, tag: 'grupal-reg-' + now, ruta: '/coord/hoy' });
  res.json({ ok: true, jugadoras: fuera.length });
});
app.get('/api/fuera', auth(...STAFF), async (req, res) => {
  const rows = await q(`${conJug} WHERE p.estado='salio'`);
  const out = [];
  for (const p of rows) out.push({ ...fmt(p), salio_at: (await one("SELECT at FROM movimientos WHERE permiso_id=$1 AND tipo='salida'", [p.id]))?.at, atrasada: p.regreso_at < Date.now(), wa_tutor: p.regreso_at < Date.now() ? wa(p, `Casa Club Femenil Tigres: ${p.jugadora} aún no regresa. Debía volver a las ${hora(p.regreso_at)} (destino: ${p.destino}). ¿Sabes algo de ella? Por favor responde a este mensaje.`) : null });
  res.json(out.sort((a, b) => a.regreso_at - b.regreso_at));
});
app.get('/api/historial', auth('coordinacion'), async (req, res) => {
  const d = new Date(req.query.fecha ? req.query.fecha + 'T00:00:00' : Date.now()); d.setHours(0, 0, 0, 0);
  res.json(await q('SELECT m.*, j.nombre jugadora, p.destino, p.acompanante, s.nombre staff FROM movimientos m JOIN jugadoras j ON j.id=m.jugadora_id JOIN permisos p ON p.id=m.permiso_id LEFT JOIN staff s ON s.id=m.staff_id WHERE m.at>=$1 AND m.at<$2 ORDER BY m.at DESC', [d.getTime(), d.getTime() + 864e5]));
});

// Guardia: todas las jugadoras con su estado y el permiso que importa ahora (afuera, habilitado o el próximo)
app.get('/api/guardia', auth(...STAFF), async (req, res) => res.json(await q(`SELECT j.id, j.nombre, j.habitacion, p.id AS permiso_id, p.estado, p.tipo, p.destino, p.acompanante, p.ubicacion, p.salida_at, p.regreso_at, p.metodo_auth
  FROM jugadoras j LEFT JOIN LATERAL (SELECT * FROM permisos x WHERE x.jugadora_id=j.id AND (x.estado='salio' OR (x.estado='autorizado' AND x.regreso_at>=$1)) ORDER BY (x.estado='salio') DESC, x.salida_at LIMIT 1) p ON TRUE
  WHERE j.activa ORDER BY j.nombre`, [Date.now()])));
// Registro: bitácora de todas las entradas y salidas del día (jugadoras y visitas)
app.get('/api/registro', auth(...STAFF), async (req, res) => {
  const d = new Date(req.query.fecha ? req.query.fecha + 'T00:00:00' : Date.now()); d.setHours(0, 0, 0, 0);
  res.json(await q(`SELECT * FROM (
    SELECT m.at, m.tipo, j.nombre, p.destino AS detalle, p.acompanante AS con_quien, s.nombre AS staff, 'jugadora' AS quien FROM movimientos m JOIN jugadoras j ON j.id=m.jugadora_id JOIN permisos p ON p.id=m.permiso_id LEFT JOIN staff s ON s.id=m.staff_id WHERE m.at>=$1 AND m.at<$2
    UNION ALL SELECT v.entrada_at, 'entrada', v.visitante, 'Visita a ' || j.nombre, v.documento, NULL, 'visita' FROM visitas v JOIN jugadoras j ON j.id=v.jugadora_id WHERE v.entrada_at>=$1 AND v.entrada_at<$2
    UNION ALL SELECT v.salida_at, 'salida', v.visitante, 'Visita a ' || j.nombre, v.documento, NULL, 'visita' FROM visitas v JOIN jugadoras j ON j.id=v.jugadora_id WHERE v.salida_at>=$1 AND v.salida_at<$2
  ) t ORDER BY at DESC LIMIT $3`, [d.getTime(), d.getTime() + 864e5, Math.min(+req.query.limit || 500, 500)]));
});

// ---------- conteo (pase de lista / toque de queda) ----------
app.get('/api/conteo', auth(...STAFF), async (req, res) => res.json(await q("SELECT j.id, j.nombre, j.habitacion, j.categoria, EXISTS(SELECT 1 FROM permisos p WHERE p.jugadora_id=j.id AND p.estado='salio') AS fuera, (SELECT destino FROM permisos p WHERE p.jugadora_id=j.id AND p.estado='salio' LIMIT 1) AS destino FROM jugadoras j WHERE j.activa ORDER BY j.nombre")));
app.post('/api/conteo', auth(...STAFF), async (req, res) => {
  const presentes = new Set((req.body.presentes || []).map(Number));
  const lista = await q("SELECT j.id, j.nombre, EXISTS(SELECT 1 FROM permisos p WHERE p.jugadora_id=j.id AND p.estado='salio') AS fuera FROM jugadoras j WHERE j.activa");
  const dentro = lista.filter((j) => !j.fuera), ausentes = dentro.filter((j) => !presentes.has(j.id));
  for (const j of ausentes) await q("INSERT INTO incidencias(tipo,severidad,jugadora_id,descripcion,creado_por,creado_at) VALUES('conteo','urgente',$1,'No localizada en el conteo, aunque no registra salida.',$2,$3)", [j.id, req.u.id, Date.now()]);
  await q('INSERT INTO conteos(at,staff_id,total,presentes,detalle) VALUES($1,$2,$3,$4,$5)', [Date.now(), req.u.id, dentro.length, dentro.length - ausentes.length, JSON.stringify({ ausentes: ausentes.map((j) => j.nombre), fuera: lista.filter((j) => j.fuera).map((j) => j.nombre) })]);
  if (ausentes.length) notify(STAFF, { title: 'ALERTA: jugadora no localizada', body: ausentes.map((j) => j.nombre).join(', '), tag: 'conteo' });
  res.json({ ok: true, esperadas: dentro.length, ausentes: ausentes.map((j) => j.nombre) });
});
app.get('/api/conteos', auth(...STAFF), async (req, res) => res.json(await q('SELECT c.*, s.nombre staff FROM conteos c LEFT JOIN staff s ON s.id=c.staff_id ORDER BY at DESC LIMIT 30')));

// ---------- visitas ----------
app.post('/api/visitas', auth('jugadora', 'coordinacion'), async (req, res) => {
  const b = req.body, jid = req.u.rol === 'jugadora' ? req.u.id : b.jugadora_id;
  if (!str(b.visitante) || !(b.fecha_at > Date.now() - 36e5)) return fail(res, 400, 'Indica el nombre del visitante y una fecha futura');
  const est = req.u.rol === 'coordinacion' ? 'autorizada' : 'pendiente';
  const v = await one('INSERT INTO visitas(jugadora_id,visitante,relacion,estado,fecha_at,creado_at,resuelto_por) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [jid, str(b.visitante, 120), str(b.relacion, 60), est, b.fecha_at, Date.now(), est === 'autorizada' ? req.u.id : null]);
  if (req.u.rol === 'jugadora') notify(['coordinacion'], { title: 'Nueva solicitud de visita', body: str(b.visitante, 60), tag: 'vis-' + v.id });
  res.json({ ok: true });
});
app.get('/api/visitas', auth(), async (req, res) => {
  const base = 'SELECT v.*, j.nombre jugadora FROM visitas v JOIN jugadoras j ON j.id=v.jugadora_id';
  const rows = req.u.rol === 'jugadora' ? await q(`${base} WHERE v.jugadora_id=$1 ORDER BY v.fecha_at DESC LIMIT 30`, [req.u.id])
    : req.u.rol === 'seguridad' ? await q(`${base} WHERE v.estado='dentro' OR (v.estado='autorizada' AND v.fecha_at BETWEEN $1 AND $2) ORDER BY v.fecha_at`, [Date.now() - 12 * 36e5, Date.now() + 24 * 36e5])
      : await q(`${base} WHERE v.estado IN('pendiente','autorizada','dentro') OR v.creado_at>$1 ORDER BY v.fecha_at DESC LIMIT 200`, [Date.now() - 7 * 864e5]);
  res.json(rows);
});
const visitaEstado = (de, a, roles) => [auth(...roles), async (req, res) => {
  const [set, ps] = { autorizada: ['resuelto_por=$3', [req.u.id]], rechazada: ['resuelto_por=$3, nota=$4', [req.u.id, str(req.body.nota)]], dentro: ['entrada_at=$3, documento=$4', [Date.now(), str(req.body.documento, 60)]], salio: ['salida_at=$3', [Date.now()]] }[a];
  const r = await q(`UPDATE visitas SET estado='${a}', ${set} WHERE id=$1 AND estado = ANY($2::text[]) RETURNING id`, [req.params.id, de, ...ps]);
  if (!r.length) return fail(res, 409, 'La visita no está en un estado válido para esta acción');
  await audit(req.u, 'visita_' + a, req.params.id);
  const v = await one('SELECT jugadora_id, visitante FROM visitas WHERE id=$1', [req.params.id]);
  const txt = { autorizada: ['Visita autorizada', `${v.visitante} puede venir`], rechazada: ['Visita rechazada', v.visitante], dentro: ['Llegó tu visita', `${v.visitante} ya está en la entrada`] }[a];
  if (txt) notify([{ rol: 'jugadora', id: v.jugadora_id }], { title: txt[0], body: txt[1], ruta: '/jugadora/mas/visitas' });
  res.json({ ok: true });
}];
app.post('/api/visitas/:id/autorizar', ...visitaEstado(['pendiente'], 'autorizada', ['coordinacion']));
app.post('/api/visitas/:id/rechazar', ...visitaEstado(['pendiente'], 'rechazada', ['coordinacion']));
app.post('/api/visitas/:id/entrada', ...visitaEstado(['autorizada'], 'dentro', STAFF));
app.post('/api/visitas/:id/salida', ...visitaEstado(['dentro'], 'salio', STAFF));

// ---------- incidencias ----------
app.post('/api/incidencias', auth(...STAFF), async (req, res) => {
  const b = req.body; if (!str(b.descripcion)) return fail(res, 400, 'Describe lo ocurrido');
  const sev = ['baja', 'media', 'urgente'].includes(b.severidad) ? b.severidad : 'media';
  const i = await one('INSERT INTO incidencias(tipo,severidad,jugadora_id,descripcion,creado_por,creado_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [str(b.tipo, 40) || 'otro', sev, b.jugadora_id || null, str(b.descripcion, 800), req.u.id, Date.now()]);
  if (sev === 'urgente' || req.u.rol === 'seguridad') notify(['coordinacion'], { title: sev === 'urgente' ? 'INCIDENCIA URGENTE' : 'Nueva incidencia', body: str(b.descripcion, 80), tag: 'inc-' + i.id });
  res.json({ ok: true });
});
app.get('/api/incidencias', auth(...STAFF), async (req, res) => res.json(await q("SELECT i.*, j.nombre jugadora FROM incidencias i LEFT JOIN jugadoras j ON j.id=i.jugadora_id WHERE i.estado='abierta' OR i.creado_at>$1 ORDER BY (i.estado='abierta') DESC, i.creado_at DESC LIMIT 100", [Date.now() - 14 * 864e5])));
app.post('/api/incidencias/:id/atender', auth('coordinacion'), async (req, res) => {
  await q("UPDATE incidencias SET estado='atendida', resolucion=$1, resuelta_at=$2 WHERE id=$3 AND estado='abierta'", [str(req.body.resolucion, 500), Date.now(), req.params.id]);
  await audit(req.u, 'incidencia_atendida', req.params.id); res.json({ ok: true });
});

// ---------- comunicados y agenda ----------
app.get('/api/avisos', auth(), async (req, res) => {
  const base = 'SELECT a.* FROM avisos a WHERE (a.vence_at IS NULL OR a.vence_at>$1)';
  if (req.u.rol === 'jugadora') {
    const j = await one('SELECT categoria FROM jugadoras WHERE id=$1', [req.u.id]);
    return res.json(await q(`SELECT a.*, EXISTS(SELECT 1 FROM aviso_lectura l WHERE l.aviso_id=a.id AND l.jugadora_id=$3) AS leido FROM avisos a WHERE (a.vence_at IS NULL OR a.vence_at>$1) AND (a.categoria IS NULL OR a.categoria=$2) ORDER BY fijo DESC, creado_at DESC LIMIT 30`, [Date.now(), j?.categoria ?? '', req.u.id]));
  }
  const rows = await q(`${base} ORDER BY a.fijo DESC, a.creado_at DESC LIMIT 30`, [Date.now()]);
  for (const a of rows) if (a.requiere_lectura) {
    a.leidos = (await one('SELECT COUNT(*)::int n FROM aviso_lectura WHERE aviso_id=$1', [a.id])).n;
    a.destinatarios = (await one('SELECT COUNT(*)::int n FROM jugadoras WHERE activa AND ($1::text IS NULL OR categoria=$1)', [a.categoria])).n;
  }
  res.json(rows);
});
app.post('/api/avisos', auth('coordinacion'), async (req, res) => {
  if (!str(req.body.titulo)) return fail(res, 400, 'Falta el título');
  const cat = await catOk(req.body.categoria); if (cat === null) return fail(res, 400, 'Categoría no válida');
  const a = await one('INSERT INTO avisos(titulo,cuerpo,fijo,creado_at,vence_at,categoria,requiere_lectura) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [str(req.body.titulo, 120), str(req.body.cuerpo, 1000), !!req.body.fijo, Date.now(), req.body.vence_at || null, cat || null, !!req.body.requiere_lectura]);
  const dest = await q('SELECT id FROM jugadoras WHERE activa AND ($1::text IS NULL OR categoria=$1)', [cat || null]);
  notify(dest.map((x) => ({ rol: 'jugadora', id: x.id })), { title: str(req.body.titulo, 80), body: str(req.body.cuerpo, 120), ruta: '/jugadora/inicio', tag: 'av-' + a.id });
  res.json({ ok: true, id: a.id, enviado_a: dest.length });
});
app.post('/api/avisos/:id/leido', auth('jugadora'), async (req, res) => { await q('INSERT INTO aviso_lectura(aviso_id,jugadora_id,at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, req.u.id, Date.now()]); res.json({ ok: true }); });
app.get('/api/avisos/:id/lecturas', auth('coordinacion'), async (req, res) => {
  const a = await one('SELECT categoria FROM avisos WHERE id=$1', [req.params.id]); if (!a) return fail(res, 404, 'No existe');
  res.json(await q('SELECT j.id, j.nombre, j.categoria, l.at AS leido_at FROM jugadoras j LEFT JOIN aviso_lectura l ON l.jugadora_id=j.id AND l.aviso_id=$1 WHERE j.activa AND ($2::text IS NULL OR j.categoria=$2) ORDER BY (l.at IS NOT NULL), j.nombre', [req.params.id, a.categoria]));
});
app.delete('/api/avisos/:id', auth('coordinacion'), async (req, res) => { await q('DELETE FROM avisos WHERE id=$1', [req.params.id]); res.json({ ok: true }); });
const DOW = { Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab', Sun: 'dom' };
app.get('/api/agenda', auth(), async (req, res) => {
  const ini = req.query.dia ? diaMs(String(req.query.dia)) : diaMs(fechaLocal()), dias = Math.min(+req.query.dias || 1, 14), fin = ini + dias * 864e5;
  const cat = req.u.rol === 'jugadora' ? (await one('SELECT categoria FROM jugadoras WHERE id=$1', [req.u.id]))?.categoria ?? '' : str(req.query.categoria, 40);
  const rows = (await q("SELECT * FROM agenda WHERE (COALESCE(repite,'')='' AND inicio_at>=$1 AND inicio_at<$2) OR (COALESCE(repite,'')<>'' AND inicio_at<$2)", [ini, fin]))
    .filter((r) => !cat || !r.categoria || r.categoria === cat || (req.u.rol !== 'jugadora' && !req.query.categoria));
  const out = [];
  for (const r of rows) {
    if (!r.repite) { out.push(r); continue; }
    const tod = r.inicio_at - diaMs(fechaLocal(r.inicio_at));
    for (let d = 0; d < dias; d++) {
      const dia = ini + d * 864e5, inicio = dia + tod, w = DOW[dowLocal(dia + 12 * 36e5)];
      if (inicio < r.inicio_at || !(r.repite === 'diario' || (r.repite === 'lv' && !['sab', 'dom'].includes(w)) || r.repite.split(',').includes(w))) continue;
      out.push({ ...r, inicio_at: inicio, fin_at: r.fin_at ? r.fin_at + (inicio - r.inicio_at) : null, serie: true });
    }
  }
  res.json(out.sort((x, y) => x.inicio_at - y.inicio_at));
});
app.post('/api/agenda', auth('coordinacion'), async (req, res) => {
  const b = req.body; if (!str(b.titulo) || !(b.inicio_at > 0)) return fail(res, 400, 'Falta título u hora');
  const cat = await catOk(b.categoria); if (cat === null) return fail(res, 400, 'Categoría no válida');
  const rep = ['', 'diario', 'lv'].includes(b.repite || '') || String(b.repite).split(',').every((x) => Object.values(DOW).includes(x)) ? str(b.repite, 40) : null;
  await q('INSERT INTO agenda(titulo,tipo,inicio_at,fin_at,lugar,nota,categoria,repite) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [str(b.titulo, 120), str(b.tipo, 20) || 'otro', b.inicio_at, b.fin_at || null, str(b.lugar, 100), str(b.nota, 300), cat || null, rep]); res.json({ ok: true });
});
app.delete('/api/agenda/:id', auth('coordinacion'), async (req, res) => { await q('DELETE FROM agenda WHERE id=$1', [req.params.id]); res.json({ ok: true }); });

// ---------- calendario de la liga, viajes y convocatorias ----------
const ESTADOS_VJ = ['convocada', 'quiere', 'confirmada', 'baja'];
app.get('/api/partidos', auth(), async (req, res) => res.json(await q('SELECT * FROM partidos WHERE inicio_at>=$1 ORDER BY inicio_at LIMIT 400', [Date.now() - (+req.query.atras || 30) * 864e5])));
app.post('/api/partidos', auth('coordinacion'), async (req, res) => { // admite un partido o {rows:[…]} (importación CSV)
  const rows = (Array.isArray(req.body.rows) ? req.body.rows : [req.body]).slice(0, 400); let n = 0;
  for (const b of rows) {
    if (!str(b.local) || !str(b.visitante) || !(b.inicio_at > 0)) return fail(res, 400, 'Cada partido necesita local, visitante y fecha');
    const r = await q('INSERT INTO partidos(torneo,jornada,local,visitante,inicio_at,sede,resultado) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id', [str(b.torneo, 60), Number.isInteger(+b.jornada) && +b.jornada > 0 ? +b.jornada : null, str(b.local, 60), str(b.visitante, 60), b.inicio_at, str(b.sede, 100), str(b.resultado, 20)]);
    n += r.length;
  }
  await audit(req.u, 'partidos', `${n} agregados`); res.json({ ok: true, agregados: n });
});
app.patch('/api/partidos/:id', auth('coordinacion'), async (req, res) => { await q('UPDATE partidos SET resultado=$1, sede=COALESCE($2,sede) WHERE id=$3', [str(req.body.resultado, 20), str(req.body.sede, 100), req.params.id]); res.json({ ok: true }); });
app.delete('/api/partidos/:id', auth('coordinacion'), async (req, res) => { await q('UPDATE viajes SET partido_id=NULL WHERE partido_id=$1', [req.params.id]); await q('DELETE FROM partidos WHERE id=$1', [req.params.id]); res.json({ ok: true }); });
app.delete('/api/partidos', auth('coordinacion'), async (req, res) => { // borra solo los de demostración
  await q('UPDATE viajes SET partido_id=NULL WHERE partido_id IN (SELECT id FROM partidos WHERE demo)'); await q('DELETE FROM partidos WHERE demo'); res.json({ ok: true });
});

app.get('/api/viajes', auth(), async (req, res) => {
  const vs = await q('SELECT v.*, p.local, p.visitante, p.inicio_at AS partido_at FROM viajes v LEFT JOIN partidos p ON p.id=v.partido_id WHERE v.regreso_at>=$1 ORDER BY v.salida_at', [Date.now() - (+req.query.atras || 0) * 864e5]);
  const js = vs.length ? await q('SELECT vj.viaje_id, vj.estado, j.id, j.nombre FROM viaje_jug vj JOIN jugadoras j ON j.id=vj.jugadora_id WHERE vj.viaje_id = ANY($1) ORDER BY j.nombre', [vs.map((v) => v.id)]) : [];
  const staff = req.u.rol !== 'jugadora';
  res.json(vs.map((v) => { const r = js.filter((x) => x.viaje_id === v.id); return { ...v, yo: r.find((x) => x.id === req.u.id)?.estado || null, jugadoras: staff ? r : undefined, cuentas: ESTADOS_VJ.reduce((o, e) => ({ ...o, [e]: r.filter((x) => x.estado === e).length }), {}) }; }));
});
app.post('/api/viajes', auth('coordinacion'), async (req, res) => {
  const b = req.body; if (!str(b.titulo) || !str(b.destino) || !(b.salida_at > 0) || !(b.regreso_at > b.salida_at)) return fail(res, 400, 'Falta título, destino u horas válidas');
  const v = await one('INSERT INTO viajes(partido_id,titulo,destino,salida_at,regreso_at,transporte,hospedaje,nota) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [b.partido_id || null, str(b.titulo, 120), str(b.destino, 120), b.salida_at, b.regreso_at, str(b.transporte, 100), str(b.hospedaje, 100), str(b.nota, 300)]);
  await audit(req.u, 'viaje', str(b.titulo, 120)); res.json({ ok: true, id: v.id });
});
// Convocar = permiso de viaje automático (mayores: autorizado; menores: el tutor lo aprueba una sola vez con enlace + código)
async function syncPermisoViaje(v, jid, estado) {
  if (['convocada', 'confirmada'].includes(estado)) {
    const p = await one('SELECT id, estado, padre_decision FROM permisos WHERE viaje_id=$1 AND jugadora_id=$2', [v.id, jid]);
    if (p && p.estado !== 'cancelado') return;
    const j = await one('SELECT * FROM jugadoras WHERE id=$1', [jid]), menor = esMenor(j), tok = menor ? crypto.randomBytes(18).toString('base64url') : null, otp = menor ? String(crypto.randomInt(1000, 10000)) : null;
    if (p) await q('UPDATE permisos SET estado=$1, padre_token=COALESCE(padre_token,$2), padre_otp=COALESCE(padre_otp,$3) WHERE id=$4', [!menor || p.padre_decision === 'aprobado' ? 'autorizado' : 'esperando_padres', tok, otp, p.id]);
    else await q("INSERT INTO permisos(jugadora_id,tipo,destino,acompanante,motivo,salida_at,regreso_at,estado,creado_at,metodo_auth,padre_token,padre_otp,viaje_id) VALUES($1,'salida',$2,'Cuerpo técnico',$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [jid, v.destino, v.titulo, v.salida_at, v.regreso_at, menor ? 'esperando_padres' : 'autorizado', Date.now(), menor ? null : 'viaje', tok, otp, v.id]);
  } else await q("UPDATE permisos SET estado='cancelado', nota='Cambió la convocatoria del viaje' WHERE viaje_id=$1 AND jugadora_id=$2 AND estado IN('autorizado','esperando_padres','pendiente')", [v.id, jid]);
}
app.get('/api/viajes/:id/tutores', auth('coordinacion'), async (req, res) => {
  const v = await one('SELECT * FROM viajes WHERE id=$1', [req.params.id]); if (!v) return fail(res, 404, 'No existe');
  const base = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  const rows = await q("SELECT p.id, p.estado, p.padre_token, p.padre_otp, p.padre_decision, j.id jid, j.nombre, j.tutor_nombre, j.tutor_tel FROM permisos p JOIN jugadoras j ON j.id=p.jugadora_id WHERE p.viaje_id=$1 AND p.padre_token IS NOT NULL AND p.estado<>'cancelado' ORDER BY j.nombre", [v.id]);
  res.json(rows.map((r) => ({ permiso_id: r.id, jugadora_id: r.jid, nombre: r.nombre, tutor_nombre: r.tutor_nombre, estado: r.estado, decision: r.padre_decision,
    whatsapp: wa(r, `Hola ${r.tutor_nombre || ''}, ${r.nombre} fue convocada al viaje «${v.titulo}» (${v.destino}).\nSalida: ${hora(v.salida_at)}\nRegreso: ${hora(v.regreso_at)}\n\nPara autorizar su viaje (una sola vez) entra aquí:\n${base}/p/${r.padre_token}`), whatsapp_codigo: wa(r, codigoMsg(r.padre_otp)) })));
});
app.delete('/api/viajes/:id', auth('coordinacion'), async (req, res) => { await q("UPDATE permisos SET estado='cancelado', nota='Viaje cancelado' WHERE viaje_id=$1 AND estado IN('autorizado','esperando_padres','pendiente')", [req.params.id]); await q('DELETE FROM viaje_check WHERE item_id IN (SELECT id FROM viaje_items WHERE viaje_id=$1)', [req.params.id]); await q('DELETE FROM viaje_items WHERE viaje_id=$1', [req.params.id]); await q('DELETE FROM viaje_jug WHERE viaje_id=$1', [req.params.id]); await q('DELETE FROM viajes WHERE id=$1', [req.params.id]); res.json({ ok: true }); });
app.put('/api/viajes/:id/jug', auth('coordinacion'), async (req, res) => { // convocar / cambiar estado en lote; estado null = quitar
  const { ids, estado } = req.body; if (!Array.isArray(ids) || (estado != null && !ESTADOS_VJ.includes(estado))) return fail(res, 400, 'Datos inválidos');
  const v = await one('SELECT * FROM viajes WHERE id=$1', [req.params.id]); if (!v) return fail(res, 404, 'Viaje no encontrado');
  const nuevos = [];
  for (const id of ids.slice(0, 100)) {
    const antes = (await one('SELECT estado FROM viaje_jug WHERE viaje_id=$1 AND jugadora_id=$2', [v.id, id]))?.estado;
    if (estado == null) await q('DELETE FROM viaje_jug WHERE viaje_id=$1 AND jugadora_id=$2', [v.id, id]);
    else await q('INSERT INTO viaje_jug(viaje_id,jugadora_id,estado) VALUES($1,$2,$3) ON CONFLICT(viaje_id,jugadora_id) DO UPDATE SET estado=$3', [v.id, id, estado]);
    await syncPermisoViaje(v, id, estado);
    if (estado === 'convocada' && antes !== 'convocada' && antes !== 'confirmada') nuevos.push({ rol: 'jugadora', id });
  }
  if (nuevos.length) notify(nuevos, { title: 'Te convocaron', body: `${v.titulo} · ${hora(v.salida_at)}. Confirma si puedes ir.`, ruta: '/jugadora/calendario', tag: 'conv-' + v.id });
  await audit(req.u, 'viaje_convocatoria', `${v.titulo}: ${ids.length} → ${estado ?? 'quitar'}`);
  res.json({ ok: true, pendientes_tutor: (await one("SELECT COUNT(*)::int n FROM permisos WHERE viaje_id=$1 AND estado='esperando_padres'", [v.id])).n });
});
app.post('/api/viajes/:id/yo', auth('jugadora'), async (req, res) => { // la jugadora pide ir, confirma o avisa que no puede
  const v = await one('SELECT * FROM viajes WHERE id=$1', [req.params.id]); if (!v) return fail(res, 404, 'Viaje no encontrado');
  const cur = (await one('SELECT estado FROM viaje_jug WHERE viaje_id=$1 AND jugadora_id=$2', [req.params.id, req.u.id]))?.estado, a = req.body.estado, conv = ['convocada', 'confirmada', 'baja'];
  const set = (e) => q('INSERT INTO viaje_jug(viaje_id,jugadora_id,estado) VALUES($1,$2,$3) ON CONFLICT(viaje_id,jugadora_id) DO UPDATE SET estado=$3', [req.params.id, req.u.id, e]);
  if (a === 'quiere' && !cur) await set('quiere');
  else if (a === 'confirmada' && ['convocada', 'confirmada'].includes(cur)) await set('confirmada');
  else if (a === 'baja' && ['convocada', 'confirmada'].includes(cur)) await set('baja');
  else if (a === 'quitar' && cur === 'quiere') await q('DELETE FROM viaje_jug WHERE viaje_id=$1 AND jugadora_id=$2', [req.params.id, req.u.id]);
  else return fail(res, 400, 'Esa acción no aplica en tu situación');
  await syncPermisoViaje(v, req.u.id, a === 'confirmada' ? 'confirmada' : a === 'baja' ? 'baja' : null);
  if (a !== 'quitar') notify(['coordinacion'], { title: { quiere: 'Quiere viajar', confirmada: 'Confirmó viaje', baja: 'No puede viajar' }[a], body: `${(await one('SELECT nombre FROM jugadoras WHERE id=$1', [req.u.id])).nombre} · ${v.titulo}`, tag: `vj-${req.params.id}-${req.u.id}` });
  res.json({ ok: true });
});

// ---------- solicitudes de servicio (mantenimiento, lavandería, médico…) ----------
app.post('/api/tickets', auth('jugadora'), async (req, res) => {
  if (!str(req.body.descripcion)) return fail(res, 400, 'Describe qué necesitas');
  const cat = ['mantenimiento', 'lavanderia', 'medico', 'alimentos', 'otro'].includes(req.body.categoria) ? req.body.categoria : 'otro';
  const foto = Number(req.body.foto_id) > 0 && await one('SELECT 1 FROM fotos WHERE id=$1 AND owner_rol=$2 AND owner_id=$3', [req.body.foto_id, 'jugadora', req.u.id]) ? Number(req.body.foto_id) : null;
  const t = await one('INSERT INTO tickets(jugadora_id,categoria,descripcion,creado_at,foto_id) VALUES($1,$2,$3,$4,$5) RETURNING id', [req.u.id, cat, str(req.body.descripcion, 500), Date.now(), foto]);
  notify(['coordinacion'], { title: cat === 'medico' ? 'Solicitud MÉDICA' : 'Nueva solicitud de servicio', body: str(req.body.descripcion, 80), tag: 'tk-' + t.id, ruta: '/coord/mas/servicios' });
  res.json({ ok: true });
});
const conFoto = (rows) => rows.map((r) => ({ ...r, foto: fotoUrl(r.foto_id) }));
app.get('/api/tickets', auth('jugadora', 'coordinacion'), async (req, res) => res.json(conFoto(req.u.rol === 'jugadora'
  ? await q('SELECT * FROM tickets WHERE jugadora_id=$1 ORDER BY creado_at DESC LIMIT 30', [req.u.id])
  : await q("SELECT t.*, j.nombre jugadora, j.habitacion FROM tickets t JOIN jugadoras j ON j.id=t.jugadora_id WHERE t.estado<>'resuelto' OR t.creado_at>$1 ORDER BY (t.estado='resuelto'), t.creado_at DESC LIMIT 100", [Date.now() - 7 * 864e5]))));
app.patch('/api/tickets/:id', auth('coordinacion'), async (req, res) => {
  const e = ['abierto', 'en_proceso', 'resuelto'].includes(req.body.estado) ? req.body.estado : 'abierto';
  const t = await one('SELECT * FROM tickets WHERE id=$1', [req.params.id]); if (!t) return fail(res, 404, 'No existe');
  await q('UPDATE tickets SET estado=$1, respuesta=$2, resuelto_at=$3 WHERE id=$4', [e, str(req.body.respuesta, 300), e === 'resuelto' ? Date.now() : null, req.params.id]);
  if (e !== t.estado) notify([{ rol: 'jugadora', id: t.jugadora_id }], { title: e === 'resuelto' ? 'Tu solicitud se resolvió' : 'Tu solicitud está en proceso', body: str(req.body.respuesta, 120) || t.descripcion.slice(0, 80), ruta: '/jugadora/mas/servicios' });
  res.json({ ok: true });
});

// ---------- tablero, reportes, equipo, bitácora ----------
app.get('/api/dashboard', auth(...STAFF), async (req, res) => {
  const now = Date.now(), c = await config();
  res.json(await one(`SELECT (SELECT COUNT(*) FROM jugadoras WHERE activa)::int total,
    (SELECT COUNT(*) FROM permisos WHERE estado='salio')::int fuera,
    (SELECT COUNT(*) FROM permisos WHERE estado='salio' AND regreso_at+$2<$1)::int atrasadas,
    (SELECT COUNT(*) FROM permisos WHERE estado IN('pendiente','esperando_padres') AND regreso_at>=$1)::int por_resolver,
    (SELECT COUNT(*) FROM visitas WHERE estado='dentro')::int visitas_dentro,
    (SELECT COUNT(*) FROM visitas WHERE estado='pendiente')::int visitas_pend,
    (SELECT COUNT(*) FROM incidencias WHERE estado='abierta')::int incidencias,
    (SELECT COUNT(*) FROM tickets WHERE estado<>'resuelto')::int tickets`, [now, min(c, 'tolerancia_min')]));
});
app.get('/api/estadisticas', auth('coordinacion'), async (req, res) => {
  const c = await config(), dias = Math.min(+req.query.dias || 30, 365);
  res.json(await q("SELECT j.id, j.nombre, COUNT(m.id) FILTER (WHERE m.tipo='salida')::int salidas, COUNT(m.id) FILTER (WHERE m.tipo='regreso' AND m.at > p.regreso_at + $2)::int tardes FROM jugadoras j LEFT JOIN movimientos m ON m.jugadora_id=j.id AND m.at>$1 LEFT JOIN permisos p ON p.id=m.permiso_id WHERE j.activa GROUP BY j.id, j.nombre ORDER BY tardes DESC, salidas DESC, j.nombre", [Date.now() - dias * 864e5, min(c, 'tolerancia_min')]));
});
app.get('/api/reporte.csv', auth('coordinacion'), async (req, res) => {
  const d = (s, fin) => new Date(s + (fin ? 'T23:59:59' : 'T00:00:00')).getTime();
  const rows = await q('SELECT m.at, m.tipo, j.nombre jugadora, p.tipo permiso, p.destino, p.acompanante, p.regreso_at, p.metodo_auth, s.nombre staff FROM movimientos m JOIN jugadoras j ON j.id=m.jugadora_id JOIN permisos p ON p.id=m.permiso_id LEFT JOIN staff s ON s.id=m.staff_id WHERE m.at>=$1 AND m.at<=$2 ORDER BY m.at', [d(req.query.desde || '1970-01-01'), d(req.query.hasta || '2100-01-01', 1)]);
  const e = (v) => { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }; // evita inyección de fórmulas en Excel
  const f = (v) => '"' + e(v).replace(/"/g, '""') + '"';
  res.type('text/csv; charset=utf-8').send('﻿' + ['fecha', 'movimiento', 'jugadora', 'tipo_permiso', 'destino', 'acompanante', 'regreso_previsto', 'autorizacion', 'registro'].join(',') + '\n'
    + rows.map((r) => [new Date(r.at).toLocaleString('es-MX', { timeZone: TZ }), r.tipo, r.jugadora, r.permiso, r.destino, r.acompanante, new Date(r.regreso_at).toLocaleString('es-MX', { timeZone: TZ }), r.metodo_auth, r.staff].map(f).join(',')).join('\n'));
});
app.get('/api/staff', auth('coordinacion'), async (req, res) => res.json(await q('SELECT id, usuario, nombre, rol, activo FROM staff ORDER BY rol, nombre')));
app.post('/api/staff', auth('coordinacion'), async (req, res) => {
  const b = req.body, u = String(b.usuario || '').trim().toLowerCase();
  if (!u || !str(b.nombre) || !STAFF.includes(b.rol) || !/^\d{4,8}$/.test(b.pin || '')) return fail(res, 400, 'Faltan datos (PIN de 4 a 8 dígitos)');
  if (await one('SELECT 1 FROM staff WHERE usuario=$1', [u]) || await one('SELECT 1 FROM jugadoras WHERE lower(clave)=$1', [u])) return fail(res, 409, 'Ese usuario ya existe');
  await q('INSERT INTO staff(usuario,nombre,rol,pin_hash,debe_cambiar_pin) VALUES($1,$2,$3,$4,TRUE)', [u, str(b.nombre, 80), b.rol, hashPin(b.pin)]);
  await audit(req.u, 'staff_alta', u); res.json({ ok: true });
});
app.patch('/api/staff/:id', auth('coordinacion'), async (req, res) => {
  if (+req.params.id === req.u.id && req.body.activo === false) return fail(res, 400, 'No puedes desactivar tu propio usuario');
  if (req.body.pin) { if (!/^\d{4,8}$/.test(req.body.pin)) return fail(res, 400, 'PIN inválido'); await q('UPDATE staff SET pin_hash=$1, debe_cambiar_pin=TRUE WHERE id=$2', [hashPin(req.body.pin), req.params.id]); }
  if (typeof req.body.activo === 'boolean') await q('UPDATE staff SET activo=$1 WHERE id=$2', [req.body.activo, req.params.id]);
  await audit(req.u, 'staff_edit', req.params.id); res.json({ ok: true });
});
app.get('/api/audit', auth('coordinacion'), async (req, res) => res.json(await q('SELECT a.*, s.nombre actor FROM audit a LEFT JOIN staff s ON s.id=a.actor_id AND a.rol IN(\'seguridad\',\'coordinacion\') ORDER BY a.at DESC LIMIT 150')));

mount({ app, auth, STAFF, fail, str, notify, audit, sign, verify, fotoUrl, fechaLocal, diaMs, hora, esMenor, strike, bloqueado, okPin, hashPin });
const WEB = path.join(__dir, 'public');
const PRIVACIDAD = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aviso de privacidad · Casa Club Femenil</title>
<style>body{font:16px/1.55 -apple-system,system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px 16px;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:24px}</style>
<h1>Aviso de privacidad</h1><p>Casa Club Femenil Tigres UANL (la "Casa Club") usa esta app únicamente para controlar entradas, salidas, permisos y la convivencia dentro de la casa, y para cuidar la seguridad de las jugadoras, incluidas las menores de edad.</p>
<h2>Datos que se guardan</h2><p>Nombre, fecha de nacimiento, categoría, teléfono, datos del tutor y de contacto de emergencia, información médica básica (alergias, sangre, seguro), movimientos de entrada y salida, permisos, viajes, comidas con foto, reportes con foto y notificaciones.</p>
<h2>Para qué se usan</h2><p>Autorizar y registrar salidas y regresos, avisar a tutores y personal de la Casa Club, atender emergencias y organizar viajes, horarios y comidas. No se venden ni se comparten con terceros ni se usan para publicidad.</p>
<h2>Quién los ve</h2><p>La jugadora ve sus propios datos. El personal de seguridad y de coordinación de la Casa Club ve lo necesario para su función. El tutor solo ve el permiso que se le envía por enlace con código.</p>
<h2>Conservación y eliminación</h2><p>Las fotos de comidas se borran a los 30 días y las demás fotos a los 90. Cada jugadora puede eliminar su cuenta desde Cuenta &rsaquo; Eliminar mi cuenta, y los datos personales se borran. También puede pedirlo a la coordinación de la Casa Club. El historial de salidas se conserva de forma anónima por seguridad.</p>
<h2>Derechos ARCO</h2><p>Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos (o los de tu hija) con la coordinación de la Casa Club.</p></html>`;
app.get('/privacidad', (_req, res) => res.type('html').send(PRIVACIDAD));
app.use(express.static(WEB, { setHeaders: (res, f) => { res.set('Cache-Control', /[/\\]_expo[/\\]|[/\\]assets[/\\]|\.wasm$/.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache'); } }));
app.use((req, res, next) => { // rutas de la app (/login, /registro, /p/TOKEN…) → la misma página; la API nunca cae aquí
  if (req.method !== 'GET' || req.path.startsWith('/api/') || path.extname(req.path)) return next();
  res.set('Cache-Control', 'no-cache').sendFile(path.join(WEB, 'index.html'), (e) => e && next());
});
app.use((e, req, res, next) => { console.error(e); fail(res, 500, 'Error del servidor'); });

// Primera vez en un servidor nuevo: crea Coordinación y Seguridad con los PIN temporales de las variables de entorno (deben cambiarlos al entrar).
async function cuentasIniciales() {
  if ((await one('SELECT COUNT(*)::int n FROM staff')).n) return;
  for (let [u, n, rol, p] of [['coordinacion', 'Coordinación', 'coordinacion', process.env.COORD_PIN], ['seguridad', 'Seguridad', 'seguridad', process.env.SEG_PIN]])
  {
    const gen = !/^\d{4,8}$/.test(p || '');
    if (gen && !process.env.RENDER) continue; // fuera de Render no se inventan cuentas
    if (gen) p = String(crypto.randomInt(100000, 999999)); // sin variable: PIN temporal aleatorio, solo se muestra en los logs del servidor
    await q('INSERT INTO staff(usuario,nombre,rol,pin_hash,debe_cambiar_pin) VALUES($1,$2,$3,$4,TRUE)', [u, n, rol, hashPin(p)]);
    console.log('Cuenta creada:', u, gen ? `PIN temporal: ${p}` : '');
  }
}
await cuentasIniciales();
// Calendarios oficiales (Liga MX Femenil Apertura 2026: Primer equipo y Sub-19 de Tigres). Se siembran una sola vez; luego Coordinación los edita desde la app.
async function sembrarCalendarios() {
  if (!(process.env.RENDER || process.env.SEMBRAR_CAL) || (await q("SELECT 1 FROM config WHERE clave='cal_apertura_2026'")).length) return;
  const cal = JSON.parse(fs.readFileSync(path.join(__dir, 'calendarios.json'), 'utf8')); let n = 0;
  for (const p of cal) n += (await q('INSERT INTO partidos(torneo,jornada,local,visitante,inicio_at,sede) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id', [p.torneo, p.jornada, p.local, p.visitante, p.inicio_at, p.sede])).length;
  await setConfig('cal_apertura_2026', n); console.log(`Calendarios sembrados: ${n} partidos`);
}
await sembrarCalendarios();
if (process.env.RENDER) console.log('Enlace de registro:', `${process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL}/registro?codigo=${await codigoReg()}`);
await initPush();
export default app;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setInterval(() => vigilar().catch(console.error), 60e3);
  app.listen(process.env.PORT || 3000, () => console.log('Casa Club en http://localhost:' + (process.env.PORT || 3000)));
}
