// Funciones de la segunda etapa: fotos, comedor, bandeja de notificaciones, personas autorizadas a recoger,
// checklist y abordaje de viajes, resumen semanal y paquete para uso sin conexión.
import crypto from 'node:crypto';
import { q, one, config } from './db.js';

const TIPOS_COMIDA = ['desayuno', 'comida', 'cena', 'colacion'];
const PRINCIPALES = ['desayuno', 'comida', 'cena'];

export default function mount(h) {
  const { app, auth, STAFF, fail, str, notify, audit, sign, verify, fotoUrl, fechaLocal, diaMs, hora, esMenor, strike, bloqueado } = h;

  // ---------- fotos (comprimidas en el teléfono; se guardan en la base, con enlace firmado de 7 días) ----------
  app.post('/api/fotos', auth(), async (req, res) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || ''));
    if (!m || m[2].length > 520000) return fail(res, 400, 'Foto no válida o demasiado pesada');
    if ((await one('SELECT COUNT(*)::int n FROM fotos WHERE owner_rol=$1 AND owner_id=$2 AND creado_at>$3', [req.u.rol, req.u.id, Date.now() - 36e5])).n >= 40) return fail(res, 429, 'Demasiadas fotos seguidas. Espera un rato.');
    const f = await one('INSERT INTO fotos(data,mime,creado_at,owner_rol,owner_id) VALUES($1,$2,$3,$4,$5) RETURNING id', [m[2], m[1], Date.now(), req.u.rol, req.u.id]);
    res.json({ id: f.id, url: fotoUrl(f.id) });
  });
  app.get('/api/fotos/:id', async (req, res) => {
    const o = verify(String(req.query.k || '')); if (!o || o.foto !== Number(req.params.id)) return fail(res, 403, 'Enlace no válido');
    const f = await one('SELECT data, mime FROM fotos WHERE id=$1', [req.params.id]); if (!f) return fail(res, 404, 'Foto no disponible');
    res.set({ 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400', 'Cross-Origin-Resource-Policy': 'cross-origin' }).send(Buffer.from(f.data, 'base64'));
  });
  const fotoMia = async (id, u) => (Number(id) > 0 && await one('SELECT 1 FROM fotos WHERE id=$1 AND owner_rol=$2 AND owner_id=$3', [id, u.rol, u.id]) ? Number(id) : null);

  // ---------- comedor: menú semanal + registro de comidas con foto ----------
  app.get('/api/menu', auth(), async (req, res) => {
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : fechaLocal(), dias = Math.min(+req.query.dias || 7, 31);
    const hasta = fechaLocal(diaMs(desde) + (dias - 1) * 864e5 + 12 * 36e5);
    res.json(await q('SELECT * FROM menu WHERE fecha>=$1 AND fecha<=$2 ORDER BY fecha, array_position(ARRAY[\'desayuno\',\'comida\',\'cena\',\'colacion\'], tipo)', [desde, hasta]));
  });
  app.put('/api/menu', auth('coordinacion'), async (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 120) : [req.body];
    for (const r of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') || !TIPOS_COMIDA.includes(r.tipo)) return fail(res, 400, 'Fecha o tipo de comida no válidos');
      const d = str(r.descripcion, 200);
      if (!d) await q('DELETE FROM menu WHERE fecha=$1 AND tipo=$2', [r.fecha, r.tipo]);
      else await q('INSERT INTO menu(fecha,tipo,descripcion) VALUES($1,$2,$3) ON CONFLICT(fecha,tipo) DO UPDATE SET descripcion=$3', [r.fecha, r.tipo, d]);
    }
    await audit(req.u, 'menu', `${rows.length} comidas`); res.json({ ok: true });
  });
  const conFotoC = (rows) => rows.map((r) => ({ ...r, foto: fotoUrl(r.foto_id) }));
  app.post('/api/comidas', auth('jugadora'), async (req, res) => {
    const tipo = req.body.tipo, desc = str(req.body.descripcion, 200), foto = await fotoMia(req.body.foto_id, req.u), f = fechaLocal();
    if (!TIPOS_COMIDA.includes(tipo)) return fail(res, 400, 'Elige qué comida fue');
    if (!desc && !foto) return fail(res, 400, 'Agrega una foto o escribe qué comiste');
    if ((await one('SELECT COUNT(*)::int n FROM comidas WHERE jugadora_id=$1 AND fecha=$2', [req.u.id, f])).n >= 8) return fail(res, 429, 'Ya registraste muchas comidas hoy');
    const ya = tipo === 'colacion' ? null : await one('SELECT id FROM comidas WHERE jugadora_id=$1 AND fecha=$2 AND tipo=$3', [req.u.id, f, tipo]);
    if (ya) await q('UPDATE comidas SET descripcion=$1, foto_id=COALESCE($2,foto_id), creado_at=$3 WHERE id=$4', [desc, foto, Date.now(), ya.id]);
    else await q('INSERT INTO comidas(jugadora_id,fecha,tipo,descripcion,foto_id,creado_at) VALUES($1,$2,$3,$4,$5,$6)', [req.u.id, f, tipo, desc, foto, Date.now()]);
    res.json({ ok: true });
  });
  app.get('/api/comidas', auth('jugadora', 'coordinacion'), async (req, res) => {
    if (req.u.rol === 'jugadora') return res.json(conFotoC(await q('SELECT * FROM comidas WHERE jugadora_id=$1 AND fecha>=$2 ORDER BY fecha DESC, creado_at DESC', [req.u.id, fechaLocal(Date.now() - 6 * 864e5)])));
    const f = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || '') ? req.query.fecha : fechaLocal(), jid = Number(req.query.jugadora_id) || null;
    res.json(conFotoC(await q('SELECT c.*, j.nombre jugadora, j.categoria FROM comidas c JOIN jugadoras j ON j.id=c.jugadora_id WHERE ($1::int IS NULL AND c.fecha=$2) OR ($1::int IS NOT NULL AND c.jugadora_id=$1 AND c.fecha>=$3) ORDER BY c.fecha DESC, c.creado_at DESC LIMIT 300', [jid, f, fechaLocal(Date.now() - 6 * 864e5)])));
  });
  app.delete('/api/comidas/:id', auth('jugadora'), async (req, res) => { await q('DELETE FROM comidas WHERE id=$1 AND jugadora_id=$2 AND fecha=$3', [req.params.id, req.u.id, fechaLocal()]); res.json({ ok: true }); });
  app.patch('/api/comidas/:id', auth('coordinacion'), async (req, res) => {
    const c = await one('SELECT * FROM comidas WHERE id=$1', [req.params.id]); if (!c) return fail(res, 404, 'No existe');
    await q('UPDATE comidas SET comentario=$1, comentario_at=$2 WHERE id=$3', [str(req.body.comentario, 300), Date.now(), c.id]);
    if (str(req.body.comentario)) notify([{ rol: 'jugadora', id: c.jugadora_id }], { title: 'Comentario sobre tu comida', body: str(req.body.comentario, 120), ruta: '/jugadora/comidas' });
    res.json({ ok: true });
  });
  app.get('/api/comidas/resumen', auth('jugadora'), async (req, res) => {
    const hoy = fechaLocal(), rows = await q('SELECT fecha, tipo FROM comidas WHERE jugadora_id=$1 AND fecha>=$2', [req.u.id, fechaLocal(Date.now() - 60 * 864e5)]);
    const por = {}; for (const r of rows) (por[r.fecha] ??= new Set()).add(r.tipo);
    const completo = (f) => PRINCIPALES.every((t) => por[f]?.has(t));
    let racha = 0, d = completo(hoy) ? 0 : 1; while (completo(fechaLocal(Date.now() - d * 864e5))) { racha++; d++; }
    res.json({ hoy: Object.fromEntries(TIPOS_COMIDA.map((t) => [t, !!por[hoy]?.has(t)])), racha, semana: [...Array(7)].map((_, i) => { const f = fechaLocal(Date.now() - (6 - i) * 864e5); return { fecha: f, n: PRINCIPALES.filter((t) => por[f]?.has(t)).length }; }) });
  });
  app.get('/api/comidas/cobertura', auth('coordinacion'), async (req, res) => {
    const dias = Math.min(+req.query.dias || 7, 30), desde = fechaLocal(Date.now() - (dias - 1) * 864e5), hoy = fechaLocal();
    res.json(await q(`SELECT j.id, j.nombre, j.categoria,
      (SELECT COUNT(*)::int FROM (SELECT c.fecha FROM comidas c WHERE c.jugadora_id=j.id AND c.fecha>=$1 AND c.tipo IN('desayuno','comida','cena') GROUP BY c.fecha HAVING COUNT(DISTINCT c.tipo)=3) x) AS dias_completos,
      (SELECT COUNT(*)::int FROM comidas c WHERE c.jugadora_id=j.id AND c.fecha>=$1) AS registros,
      (SELECT COUNT(DISTINCT c.tipo)::int FROM comidas c WHERE c.jugadora_id=j.id AND c.fecha=$2 AND c.tipo IN('desayuno','comida','cena')) AS hoy
      FROM jugadoras j WHERE j.activa ORDER BY dias_completos DESC, j.nombre`, [desde, hoy]));
  });

  // ---------- bandeja de notificaciones y push a teléfono ----------
  app.get('/api/notificaciones', auth(), async (req, res) => {
    const items = await q('SELECT id, titulo, cuerpo, ruta, at, leida FROM notificaciones WHERE rol=$1 AND user_id=$2 ORDER BY at DESC LIMIT 60', [req.u.rol, req.u.id]);
    res.json({ items, sin_leer: (await one('SELECT COUNT(*)::int n FROM notificaciones WHERE rol=$1 AND user_id=$2 AND NOT leida', [req.u.rol, req.u.id])).n });
  });
  app.post('/api/notificaciones/leer', auth(), async (req, res) => {
    await q('UPDATE notificaciones SET leida=TRUE WHERE rol=$1 AND user_id=$2 AND ($3::int[] IS NULL OR id = ANY($3::int[]))', [req.u.rol, req.u.id, Array.isArray(req.body.ids) ? req.body.ids.map(Number) : null]);
    res.json({ ok: true });
  });
  app.post('/api/push/expo', auth(), async (req, res) => {
    const t = String(req.body.token || ''); if (!/^Expo(nent)?PushToken\[[\w-]+\]$/.test(t)) return fail(res, 400, 'Token no válido');
    await q('INSERT INTO push_tokens(rol,user_id,token) VALUES($1,$2,$3) ON CONFLICT(token) DO UPDATE SET rol=$1, user_id=$2', [req.u.rol, req.u.id, t]); res.json({ ok: true });
  });
  app.delete('/api/push/expo', auth(), async (req, res) => { await q('DELETE FROM push_tokens WHERE token=$1 AND rol=$2 AND user_id=$3', [String(req.body.token || ''), req.u.rol, req.u.id]); res.json({ ok: true }); });

  // ---------- personas autorizadas a recoger a la jugadora ----------
  app.get('/api/jugadoras/:id/recogen', auth('jugadora', ...STAFF), async (req, res) => {
    if (req.u.rol === 'jugadora' && req.u.id !== +req.params.id) return fail(res, 403, 'Sin acceso');
    res.json(await q('SELECT id, nombre, parentesco, telefono, documento FROM recogen WHERE jugadora_id=$1 ORDER BY id', [req.params.id]));
  });
  app.post('/api/jugadoras/:id/recogen', auth('coordinacion'), async (req, res) => {
    if (!str(req.body.nombre)) return fail(res, 400, 'Escribe el nombre de la persona');
    if (!await one('SELECT 1 FROM jugadoras WHERE id=$1', [req.params.id])) return fail(res, 404, 'No existe');
    await q('INSERT INTO recogen(jugadora_id,nombre,parentesco,telefono,documento) VALUES($1,$2,$3,$4,$5)', [req.params.id, str(req.body.nombre, 120), str(req.body.parentesco, 60), str(req.body.telefono, 20), str(req.body.documento, 60)]);
    await audit(req.u, 'recogen_alta', req.params.id); res.json({ ok: true });
  });
  app.delete('/api/recogen/:id', auth('coordinacion'), async (req, res) => { await q('DELETE FROM recogen WHERE id=$1', [req.params.id]); await audit(req.u, 'recogen_baja', req.params.id); res.json({ ok: true }); });

  // ---------- checklist del viaje ----------
  const convocada = (vid, jid) => one("SELECT 1 FROM viaje_jug WHERE viaje_id=$1 AND jugadora_id=$2 AND estado IN('convocada','confirmada')", [vid, jid]);
  app.get('/api/viajes/:id/checklist', auth(), async (req, res) => {
    const items = await q('SELECT id, texto FROM viaje_items WHERE viaje_id=$1 ORDER BY orden, id', [req.params.id]);
    if (req.u.rol === 'jugadora') {
      const mios = new Set((await q('SELECT item_id FROM viaje_check WHERE jugadora_id=$1 AND item_id = ANY($2::int[])', [req.u.id, items.map((i) => i.id)])).map((r) => r.item_id));
      return res.json({ items: items.map((i) => ({ ...i, hecho: mios.has(i.id) })) });
    }
    const js = await q("SELECT j.id, j.nombre, (SELECT COUNT(*)::int FROM viaje_check k JOIN viaje_items i ON i.id=k.item_id WHERE i.viaje_id=$1 AND k.jugadora_id=j.id) hechos FROM viaje_jug vj JOIN jugadoras j ON j.id=vj.jugadora_id WHERE vj.viaje_id=$1 AND vj.estado IN('convocada','confirmada') ORDER BY j.nombre", [req.params.id]);
    res.json({ items, jugadoras: js, total: items.length });
  });
  app.post('/api/viajes/:id/items', auth('coordinacion'), async (req, res) => {
    const textos = (Array.isArray(req.body.textos) ? req.body.textos : [req.body.texto]).map((t) => str(t, 120)).filter(Boolean).slice(0, 30);
    if (!textos.length) return fail(res, 400, 'Escribe al menos un punto');
    const n = (await one('SELECT COALESCE(MAX(orden),0)::int n FROM viaje_items WHERE viaje_id=$1', [req.params.id])).n;
    for (const [i, t] of textos.entries()) await q('INSERT INTO viaje_items(viaje_id,texto,orden) VALUES($1,$2,$3)', [req.params.id, t, n + i + 1]);
    res.json({ ok: true });
  });
  app.delete('/api/viajes/:id/items/:item', auth('coordinacion'), async (req, res) => { await q('DELETE FROM viaje_items WHERE id=$1 AND viaje_id=$2', [req.params.item, req.params.id]); res.json({ ok: true }); });
  app.post('/api/viajes/:id/check', auth('jugadora'), async (req, res) => {
    if (!await convocada(req.params.id, req.u.id)) return fail(res, 403, 'No estás convocada a este viaje');
    if (!await one('SELECT 1 FROM viaje_items WHERE id=$1 AND viaje_id=$2', [req.body.item_id, req.params.id])) return fail(res, 404, 'No existe ese punto');
    if (req.body.hecho) await q('INSERT INTO viaje_check(item_id,jugadora_id,at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [req.body.item_id, req.u.id, Date.now()]);
    else await q('DELETE FROM viaje_check WHERE item_id=$1 AND jugadora_id=$2', [req.body.item_id, req.u.id]);
    res.json({ ok: true });
  });

  // ---------- abordaje (lista de subida y regreso del autobús; usa los mismos movimientos que la puerta) ----------
  app.get('/api/viajes/:id/abordaje', auth(...STAFF), async (req, res) => {
    const viaje = await one('SELECT id, titulo, destino, salida_at, regreso_at, transporte FROM viajes WHERE id=$1', [req.params.id]); if (!viaje) return fail(res, 404, 'No existe');
    const js = await q("SELECT j.id, j.nombre, j.categoria, vj.estado AS convocatoria, p.estado AS permiso, (SELECT at FROM movimientos m WHERE m.permiso_id=p.id AND m.tipo='salida' ORDER BY at LIMIT 1) AS ida_at, (SELECT at FROM movimientos m WHERE m.permiso_id=p.id AND m.tipo='regreso' ORDER BY at DESC LIMIT 1) AS vuelta_at FROM viaje_jug vj JOIN jugadoras j ON j.id=vj.jugadora_id LEFT JOIN permisos p ON p.viaje_id=vj.viaje_id AND p.jugadora_id=j.id WHERE vj.viaje_id=$1 AND vj.estado IN('convocada','confirmada') ORDER BY j.nombre", [req.params.id]);
    res.json({ viaje, jugadoras: js, total: js.length, abordaron: js.filter((x) => x.ida_at).length, regresaron: js.filter((x) => x.vuelta_at).length });
  });
  app.post('/api/viajes/:id/abordar', auth(...STAFF), async (req, res) => {
    const { jugadora_id, tipo } = req.body, cid = str(req.body.cid, 60); if (!['salida', 'regreso'].includes(tipo)) return fail(res, 400, 'Tipo inválido');
    if (cid && await one('SELECT 1 FROM movimientos WHERE cid=$1', [cid])) return res.json({ ok: true, duplicado: true });
    const p = await one("SELECT p.*, j.nombre FROM permisos p JOIN jugadoras j ON j.id=p.jugadora_id WHERE p.viaje_id=$1 AND p.jugadora_id=$2 AND p.estado<>'cancelado'", [req.params.id, jugadora_id]);
    if (!p) return fail(res, 404, 'Esa jugadora no está convocada a este viaje');
    if (tipo === 'salida' && p.estado === 'esperando_padres') return fail(res, 409, 'Falta la autorización del tutor: NO debe abordar');
    const ahora = Date.now(), at = Number(req.body.at), now = at > ahora - 12 * 36e5 && at <= ahora + 6e4 ? at : ahora;
    const r = await q(`WITH u AS (UPDATE permisos SET estado=$1 WHERE id=$2 AND estado=$3 RETURNING id) INSERT INTO movimientos(jugadora_id,permiso_id,tipo,at,staff_id,cid) SELECT $4::int,id,$5::text,$6::float8,$7::int,$8::text FROM u RETURNING id`,
      [tipo === 'salida' ? 'salio' : 'regreso', p.id, tipo === 'salida' ? 'autorizado' : 'salio', p.jugadora_id, tipo, now, req.u.id, cid]);
    if (!r.length) return fail(res, 409, 'Ya estaba registrada o su estado cambió');
    res.json({ ok: true });
  });

  // ---------- resumen semanal ----------
  app.get('/api/resumen', auth('coordinacion'), async (req, res) => {
    const dias = Math.min(+req.query.dias || 7, 31), now = Date.now(), desde = now - dias * 864e5, previo = desde - dias * 864e5, c = await config(), tol = Number(c.tolerancia_min) * 60e3;
    const n = async (sql, p) => (await one(sql, p)).n;
    const periodo = async (a, b) => ({
      salidas: await n("SELECT COUNT(*)::int n FROM movimientos WHERE tipo='salida' AND at>=$1 AND at<$2", [a, b]),
      regresos: await n("SELECT COUNT(*)::int n FROM movimientos WHERE tipo='regreso' AND at>=$1 AND at<$2", [a, b]),
      tardes: await n("SELECT COUNT(*)::int n FROM movimientos m JOIN permisos p ON p.id=m.permiso_id WHERE m.tipo='regreso' AND m.at>=$1 AND m.at<$2 AND m.at>p.regreso_at+$3", [a, b, tol]),
      incidencias: await n('SELECT COUNT(*)::int n FROM incidencias WHERE creado_at>=$1 AND creado_at<$2', [a, b]),
      permisos: await n('SELECT COUNT(*)::int n FROM permisos WHERE creado_at>=$1 AND creado_at<$2', [a, b]),
      visitas: await n('SELECT COUNT(*)::int n FROM visitas WHERE creado_at>=$1 AND creado_at<$2', [a, b]),
    });
    const activas = await n('SELECT COUNT(*)::int n FROM jugadoras WHERE activa', []), fd = fechaLocal(desde);
    res.json({
      dias, desde, hasta: now, activas,
      actual: await periodo(desde, now), anterior: await periodo(previo, desde),
      incidencias_por_tipo: await q('SELECT tipo, COUNT(*)::int n FROM incidencias WHERE creado_at>=$1 GROUP BY tipo ORDER BY n DESC', [desde]),
      incidencias_abiertas: await n("SELECT COUNT(*)::int n FROM incidencias WHERE estado='abierta'", []),
      sin_regresar: await n("SELECT COUNT(*)::int n FROM permisos WHERE estado='salio' AND regreso_at<$1", [now]),
      mas_tardes: await q("SELECT j.id, j.nombre, COUNT(*)::int n FROM movimientos m JOIN permisos p ON p.id=m.permiso_id JOIN jugadoras j ON j.id=m.jugadora_id WHERE m.tipo='regreso' AND m.at>=$1 AND m.at>p.regreso_at+$2 GROUP BY j.id, j.nombre ORDER BY n DESC, j.nombre LIMIT 5", [desde, tol]),
      mas_salidas: await q("SELECT j.id, j.nombre, COUNT(*)::int n FROM movimientos m JOIN jugadoras j ON j.id=m.jugadora_id WHERE m.tipo='salida' AND m.at>=$1 GROUP BY j.id, j.nombre ORDER BY n DESC, j.nombre LIMIT 5", [desde]),
      servicios: { creados: await n('SELECT COUNT(*)::int n FROM tickets WHERE creado_at>=$1', [desde]), resueltos: await n('SELECT COUNT(*)::int n FROM tickets WHERE resuelto_at>=$1', [desde]), abiertos: await n("SELECT COUNT(*)::int n FROM tickets WHERE estado<>'resuelto'", []) },
      conteos: await q('SELECT at, total, presentes FROM conteos WHERE at>=$1 ORDER BY at DESC', [desde]),
      comedor: { registros: await n('SELECT COUNT(*)::int n FROM comidas WHERE fecha>=$1', [fd]), jugadoras_con_registro: await n('SELECT COUNT(DISTINCT jugadora_id)::int n FROM comidas WHERE fecha>=$1', [fd]),
        dias_completos: await n("SELECT COUNT(*)::int n FROM (SELECT jugadora_id, fecha FROM comidas WHERE fecha>=$1 AND tipo IN('desayuno','comida','cena') GROUP BY jugadora_id, fecha HAVING COUNT(DISTINCT tipo)=3) x", [fd]) },
      viajes: await q('SELECT v.id, v.titulo, v.salida_at, (SELECT COUNT(*)::int FROM viaje_jug WHERE viaje_id=v.id AND estado IN(\'convocada\',\'confirmada\')) convocadas FROM viajes v WHERE v.salida_at>=$1 AND v.salida_at<$2 ORDER BY v.salida_at', [desde, now + 7 * 864e5]),
    });
  });

  // ---------- paquete sin conexión para Seguridad (jugadoras, QR y permisos vigentes) ----------
  app.get('/api/offline', auth(...STAFF), async (req, res) => {
    const c = await config(), now = Date.now();
    const js = await q('SELECT * FROM jugadoras WHERE activa ORDER BY nombre'), rec = await q('SELECT jugadora_id, nombre, parentesco, telefono, documento FROM recogen');
    res.json({
      generado_at: now, gracia_min: Number(c.gracia_min), tel_coordinacion: c.tel_coordinacion, tel_medico: c.tel_medico,
      jugadoras: js.map((j) => ({ id: j.id, nombre: j.nombre, clave: j.clave, qr: j.qr, habitacion: j.habitacion, categoria: j.categoria, menor: esMenor(j), emergencia: { nombre: j.emergencia_nombre || j.tutor_nombre, tel: j.emergencia_tel || j.tutor_tel, alergias: j.alergias, sangre: j.sangre, seguro: j.seguro, tutor_nombre: j.tutor_nombre, tutor_tel: j.tutor_tel, tel_medico: c.tel_medico }, recogen: rec.filter((r) => r.jugadora_id === j.id) })),
      permisos: await q("SELECT id, jugadora_id, estado, tipo, destino, acompanante, salida_at, regreso_at, viaje_id FROM permisos WHERE estado IN('autorizado','salio') AND regreso_at>$1", [now - 24 * 36e5]),
    });
  });
}
