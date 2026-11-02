// Capa de datos: Postgres real (DATABASE_URL → Neon/Supabase/…) o PGlite (Postgres embebido en archivos) para local y pruebas.
// Mismo SQL en ambos. Tiempos en epoch-ms guardados como DOUBLE PRECISION (vuelven como number en pg y PGlite).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
let run;
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  pool.on('error', (e) => console.error('pg', e.message)); // Neon cierra conexiones ociosas: no tumbar el proceso
  run = (sql, p) => pool.query(sql, p);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.MEMORY_DB ? undefined : path.join(DATA, 'pg');
  if (dir) fs.mkdirSync(DATA, { recursive: true });
  const d = new PGlite(dir);
  await d.waitReady;
  run = (sql, p) => d.query(sql, p);
}
export const q = async (sql, p = []) => (await run(sql, p)).rows;
export const one = async (sql, p = []) => (await q(sql, p))[0] ?? null;

const T = 'DOUBLE PRECISION';
for (const stmt of `
CREATE TABLE IF NOT EXISTS staff(id SERIAL PRIMARY KEY, usuario TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, rol TEXT NOT NULL CHECK(rol IN('seguridad','coordinacion')), pin_hash TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS jugadoras(id SERIAL PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, nacimiento TEXT NOT NULL, habitacion TEXT, tutor_nombre TEXT, tutor_tel TEXT, emergencia_nombre TEXT, emergencia_tel TEXT, alergias TEXT, notas_medicas TEXT, pin_hash TEXT NOT NULL, qr TEXT UNIQUE NOT NULL, activa BOOLEAN NOT NULL DEFAULT TRUE);
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS categoria TEXT;
CREATE TABLE IF NOT EXISTS permisos(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), tipo TEXT NOT NULL DEFAULT 'salida', destino TEXT NOT NULL, acompanante TEXT NOT NULL, ubicacion TEXT, motivo TEXT, salida_at ${T} NOT NULL, regreso_at ${T} NOT NULL, estado TEXT NOT NULL DEFAULT 'pendiente', creado_at ${T} NOT NULL, padre_token TEXT UNIQUE, padre_enviado_at ${T}, padre_decision TEXT, padre_decision_at ${T}, padre_ip TEXT, padre_ua TEXT, metodo_auth TEXT, nota TEXT, resuelto_por INT, alerta_at ${T});
CREATE TABLE IF NOT EXISTS movimientos(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), permiso_id INT NOT NULL REFERENCES permisos(id), tipo TEXT NOT NULL CHECK(tipo IN('salida','regreso')), at ${T} NOT NULL, staff_id INT);
CREATE TABLE IF NOT EXISTS visitas(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), visitante TEXT NOT NULL, relacion TEXT, documento TEXT, estado TEXT NOT NULL DEFAULT 'pendiente', fecha_at ${T} NOT NULL, creado_at ${T} NOT NULL, entrada_at ${T}, salida_at ${T}, nota TEXT, resuelto_por INT);
CREATE TABLE IF NOT EXISTS incidencias(id SERIAL PRIMARY KEY, tipo TEXT NOT NULL, severidad TEXT NOT NULL DEFAULT 'media', jugadora_id INT REFERENCES jugadoras(id), descripcion TEXT NOT NULL, creado_por INT, creado_at ${T} NOT NULL, estado TEXT NOT NULL DEFAULT 'abierta', resolucion TEXT, resuelta_at ${T});
CREATE TABLE IF NOT EXISTS avisos(id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, cuerpo TEXT, fijo BOOLEAN NOT NULL DEFAULT FALSE, creado_at ${T} NOT NULL, vence_at ${T});
CREATE TABLE IF NOT EXISTS agenda(id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'otro', inicio_at ${T} NOT NULL, fin_at ${T}, lugar TEXT, nota TEXT);
CREATE TABLE IF NOT EXISTS tickets(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), categoria TEXT NOT NULL, descripcion TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'abierto', respuesta TEXT, creado_at ${T} NOT NULL, resuelto_at ${T});
CREATE TABLE IF NOT EXISTS conteos(id SERIAL PRIMARY KEY, at ${T} NOT NULL, staff_id INT, total INT NOT NULL, presentes INT NOT NULL, detalle TEXT);
CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id SERIAL PRIMARY KEY, at ${T} NOT NULL, rol TEXT, actor_id INT, accion TEXT NOT NULL, detalle TEXT);
CREATE TABLE IF NOT EXISTS partidos(id SERIAL PRIMARY KEY, torneo TEXT, jornada INT, local TEXT NOT NULL, visitante TEXT NOT NULL, inicio_at ${T} NOT NULL, sede TEXT, resultado TEXT, demo BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(inicio_at, local, visitante));
CREATE TABLE IF NOT EXISTS viajes(id SERIAL PRIMARY KEY, partido_id INT REFERENCES partidos(id), titulo TEXT NOT NULL, destino TEXT NOT NULL, salida_at ${T} NOT NULL, regreso_at ${T} NOT NULL, transporte TEXT, hospedaje TEXT, nota TEXT);
CREATE TABLE IF NOT EXISTS viaje_jug(viaje_id INT NOT NULL REFERENCES viajes(id), jugadora_id INT NOT NULL REFERENCES jugadoras(id), estado TEXT NOT NULL, PRIMARY KEY(viaje_id, jugadora_id));
CREATE TABLE IF NOT EXISTS push_subs(id SERIAL PRIMARY KEY, rol TEXT NOT NULL, user_id INT NOT NULL, endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL);
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS debe_cambiar_pin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS debe_cambiar_pin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS disponibilidad TEXT;
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS disp_nota TEXT;
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS sangre TEXT;
ALTER TABLE jugadoras ADD COLUMN IF NOT EXISTS seguro TEXT;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS viaje_id INT;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS padre_otp TEXT;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS padre_intentos INT NOT NULL DEFAULT 0;
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS recordatorio_at ${T};
ALTER TABLE permisos ADD COLUMN IF NOT EXISTS alerta2_at ${T};
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS cid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mov_cid ON movimientos(cid) WHERE cid IS NOT NULL;
CREATE TABLE IF NOT EXISTS recogen(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), nombre TEXT NOT NULL, parentesco TEXT, telefono TEXT, documento TEXT);
CREATE TABLE IF NOT EXISTS fotos(id SERIAL PRIMARY KEY, data TEXT NOT NULL, mime TEXT NOT NULL, creado_at ${T} NOT NULL, owner_rol TEXT, owner_id INT);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS foto_id INT;
CREATE TABLE IF NOT EXISTS menu(id SERIAL PRIMARY KEY, fecha TEXT NOT NULL, tipo TEXT NOT NULL, descripcion TEXT NOT NULL, UNIQUE(fecha, tipo));
CREATE TABLE IF NOT EXISTS comidas(id SERIAL PRIMARY KEY, jugadora_id INT NOT NULL REFERENCES jugadoras(id), fecha TEXT NOT NULL, tipo TEXT NOT NULL, descripcion TEXT, foto_id INT, comentario TEXT, comentario_at ${T}, creado_at ${T} NOT NULL);
CREATE INDEX IF NOT EXISTS ix_comidas ON comidas(jugadora_id, fecha);
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS requiere_lectura BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS aviso_lectura(aviso_id INT NOT NULL REFERENCES avisos(id) ON DELETE CASCADE, jugadora_id INT NOT NULL, at ${T} NOT NULL, PRIMARY KEY(aviso_id, jugadora_id));
ALTER TABLE agenda ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE agenda ADD COLUMN IF NOT EXISTS repite TEXT;
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS recordado_at ${T};
CREATE TABLE IF NOT EXISTS viaje_items(id SERIAL PRIMARY KEY, viaje_id INT NOT NULL, texto TEXT NOT NULL, orden INT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS viaje_check(item_id INT NOT NULL REFERENCES viaje_items(id) ON DELETE CASCADE, jugadora_id INT NOT NULL, at ${T} NOT NULL, PRIMARY KEY(item_id, jugadora_id));
CREATE TABLE IF NOT EXISTS notificaciones(id SERIAL PRIMARY KEY, rol TEXT NOT NULL, user_id INT NOT NULL, titulo TEXT NOT NULL, cuerpo TEXT, ruta TEXT, at ${T} NOT NULL, leida BOOLEAN NOT NULL DEFAULT FALSE);
CREATE INDEX IF NOT EXISTS ix_notif ON notificaciones(rol, user_id, at);
CREATE TABLE IF NOT EXISTS push_tokens(id SERIAL PRIMARY KEY, rol TEXT NOT NULL, user_id INT NOT NULL, token TEXT UNIQUE NOT NULL);
CREATE INDEX IF NOT EXISTS ix_perm_estado ON permisos(estado);
CREATE INDEX IF NOT EXISTS ix_perm_jug ON permisos(jugadora_id);
CREATE INDEX IF NOT EXISTS ix_mov_at ON movimientos(at);
`.split(';').map((s) => s.trim()).filter(Boolean)) await q(stmt);

// Configuración editable por Coordinación (valores por defecto)
export const DEFAULTS = { toque_queda: '22:00', gracia_min: '30', tolerancia_min: '10', max_pendientes: '3', tel_coordinacion: '', nombre_club: 'Casa Club Femenil', categorias: 'Sub-15,Sub-17,Sub-19,Sub-23,Primer equipo', tel_medico: '', escala_min: '20' };
export async function config() {
  const rows = await q('SELECT clave, valor FROM config');
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.clave, r.valor])) };
}
export const setConfig = (k, v) => q('INSERT INTO config(clave,valor) VALUES($1,$2) ON CONFLICT(clave) DO UPDATE SET valor=$2', [k, String(v)]);
export const audit = (u, accion, detalle) => q('INSERT INTO audit(at,rol,actor_id,accion,detalle) VALUES($1,$2,$3,$4,$5)', [Date.now(), u?.rol ?? null, u?.id ?? null, accion, detalle ? String(detalle).slice(0, 300) : null]);
