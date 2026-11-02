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
CREATE INDEX IF NOT EXISTS ix_perm_estado ON permisos(estado);
CREATE INDEX IF NOT EXISTS ix_perm_jug ON permisos(jugadora_id);
CREATE INDEX IF NOT EXISTS ix_mov_at ON movimientos(at);
`.split(';').map((s) => s.trim()).filter(Boolean)) await q(stmt);

// Configuración editable por Coordinación (valores por defecto)
export const DEFAULTS = { toque_queda: '22:00', gracia_min: '30', tolerancia_min: '10', max_pendientes: '3', tel_coordinacion: '', nombre_club: 'Casa Club Femenil' };
export async function config() {
  const rows = await q('SELECT clave, valor FROM config');
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.clave, r.valor])) };
}
export const setConfig = (k, v) => q('INSERT INTO config(clave,valor) VALUES($1,$2) ON CONFLICT(clave) DO UPDATE SET valor=$2', [k, String(v)]);
export const audit = (u, accion, detalle) => q('INSERT INTO audit(at,rol,actor_id,accion,detalle) VALUES($1,$2,$3,$4,$5)', [Date.now(), u?.rol ?? null, u?.id ?? null, accion, detalle ? String(detalle).slice(0, 300) : null]);
