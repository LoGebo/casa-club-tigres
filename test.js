// Prueba de humo del flujo completo (Postgres embebido en memoria).
import assert from 'node:assert/strict';
import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); process.env.MEMORY_DB = '1';
const { q } = await import('./db.js');
const { default: app, hashPin, vigilar } = await import('./server.js');
await q("INSERT INTO staff(usuario,nombre,rol,pin_hash) VALUES('seguridad','S','seguridad',$1),('coordinacion','C','coordinacion',$2)", [hashPin('111111'), hashPin('222222')]);
const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`;
const call = async (m, u, body, tk) => { const r = await fetch(B + u, { method: m, headers: { 'content-type': 'application/json', ...(tk && { authorization: 'Bearer ' + tk }) }, body: body && JSON.stringify(body) }); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { j = { text: t }; } return { s: r.status, j }; };
const login = async (u, p) => (await call('POST', '/api/login', { usuario: u, pin: p })).j.token;
const seg = await login('seguridad', '111111'), co = await login('coordinacion', '222222');
const ok = (r, s = 200) => assert.equal(r.s, s, JSON.stringify(r.j));

ok(await call('POST', '/api/login', { usuario: 'seguridad', pin: 'mal' }), 401);
ok(await call('POST', '/api/jugadoras', { clave: 'ana', nombre: 'Ana', nacimiento: '2010-01-01', pin: '1234' }, co), 400); // menor sin tutor
ok(await call('POST', '/api/jugadoras', { clave: 'ana', nombre: 'Ana', nacimiento: '2010-01-01', tutor_tel: '8112345678', alergias: 'Penicilina', pin: '1234' }, co));
ok(await call('POST', '/api/jugadoras', { clave: 'caro', nombre: 'Caro', nacimiento: '2000-01-01', pin: '1234' }, co));
const ana = await login('ana', '1234'), me = (await call('GET', '/api/me', null, ana)).j;
let s = (await call('GET', '/api/scan/' + me.qr, null, seg)).j; assert.equal(s.estado, 'sin_permiso'); assert.equal(s.emergencia.alergias, 'Penicilina');

// permiso de menor: tutor digital
const now = Date.now();
ok(await call('POST', '/api/permisos', { destino: 'Casa', acompanante: 'Mamá', salida_at: now, regreso_at: now + 36e5 }, ana));
const pid = (await call('GET', '/api/permisos', null, co)).j[0].id;
ok(await call('POST', `/api/permisos/${pid}/autorizar`, {}, co), 400);
const ep = (await call('POST', `/api/permisos/${pid}/enviar-padres`, null, co)).j, w = ep.whatsapp; assert.match(w, /wa\.me\/528112345678/);
const tok = decodeURIComponent(w).match(/\/p\/(\S+)/)[1], otp = decodeURIComponent(ep.whatsapp_codigo).match(/es (\d{4})/)[1];
ok(await call('POST', '/api/mov', { jugadora_id: me.id, tipo: 'salida' }, seg), 409);
ok(await call('POST', '/api/p/' + tok, { decision: 'aprobar', codigo: '0000' }), 403);
ok(await call('POST', '/api/p/' + tok, { decision: 'aprobar', codigo: otp }));
ok(await call('POST', '/api/p/' + tok, { decision: 'aprobar', codigo: otp }), 409);
assert.equal((await call('GET', '/api/scan/' + me.qr, null, seg)).j.accion, 'salida');
ok(await call('POST', '/api/mov', { jugadora_id: me.id, tipo: 'salida' }, seg));
ok(await call('POST', '/api/mov', { jugadora_id: me.id, tipo: 'salida' }, seg), 409);
const gd = (await call('GET', '/api/guardia', null, seg)).j.find((x) => x.nombre === 'Ana'); assert.equal(gd.estado, 'salio'); assert.equal(gd.destino, 'Casa');
const rg = (await call('GET', '/api/registro', null, seg)).j; assert.equal(rg.length, 1); assert.equal(rg[0].tipo, 'salida');
assert.equal((await call('GET', '/api/fuera', null, seg)).j.length, 1);
assert.equal((await call('GET', '/api/dashboard', null, seg)).j.fuera, 1);

// atraso → incidencia automática (tolerancia 0 para el test)
await call('PUT', '/api/config', { tolerancia_min: 0 }, co);
await q("UPDATE permisos SET regreso_at=$1", [Date.now() - 6e4]);
await vigilar();
const inc = (await call('GET', '/api/incidencias', null, seg)).j; assert.equal(inc[0].tipo, 'retraso');
ok(await call('POST', '/api/mov', { jugadora_id: me.id, tipo: 'regreso' }, seg));
assert.equal((await call('GET', '/api/fuera', null, seg)).j.length, 0);

// conteo: Ana (dentro) y Caro (dentro) → Caro no aparece → incidencia urgente
const c = await call('POST', '/api/conteo', { presentes: [me.id] }, seg); ok(c); assert.deepEqual(c.j.ausentes, ['Caro']);
// mayor de edad: autoriza directo; salida de emergencia
const caro = await login('caro', '1234'), cid = (await call('GET', '/api/me', null, caro)).j.id;
ok(await call('POST', '/api/emergencia', { jugadora_id: cid, motivo: 'Lesión', destino: 'Hospital' }, co));
ok(await call('POST', '/api/mov', { jugadora_id: cid, tipo: 'salida' }, seg));

// visitas
ok(await call('POST', '/api/visitas', { visitante: 'Tía Laura', relacion: 'Familiar', fecha_at: Date.now() + 36e5 }, ana));
const vid = (await call('GET', '/api/visitas', null, co)).j[0].id;
ok(await call('POST', `/api/visitas/${vid}/entrada`, { documento: 'INE' }, seg), 409); // sin autorizar
ok(await call('POST', `/api/visitas/${vid}/autorizar`, {}, co));
ok(await call('POST', `/api/visitas/${vid}/entrada`, { documento: 'INE' }, seg));
ok(await call('POST', `/api/visitas/${vid}/salida`, {}, seg));

// servicios, avisos, agenda, equipo, reportes, roles
ok(await call('POST', '/api/tickets', { categoria: 'mantenimiento', descripcion: 'Foco fundido' }, ana));
ok(await call('POST', '/api/avisos', { titulo: 'Hola' }, co)); ok(await call('POST', '/api/avisos', { titulo: 'x' }, ana), 401);
ok(await call('POST', '/api/agenda', { titulo: 'Entrena', tipo: 'entrenamiento', inicio_at: Date.now() }, co));
ok(await call('POST', '/api/staff', { usuario: 'guardia2', nombre: 'Guardia 2', rol: 'seguridad', pin: '5555' }, co));
ok(await call('PATCH', '/api/pin', { actual: '1234', nuevo: '9876' }, ana)); await login('ana', '9876');
const csv = await call('GET', '/api/reporte.csv', null, co); ok(csv); assert.match(csv.j.text, /Ana/);
assert.ok((await call('GET', '/api/estadisticas', null, co)).j.length === 2);
assert.ok((await call('GET', '/api/audit', null, co)).j.length > 5);
ok(await call('GET', '/api/historial', null, seg), 401);
ok(await call('GET', '/api/health'));
// liga, viajes y convocatorias
const t0 = Date.now() + 864e5;
ok(await call('POST', '/api/partidos', { local: 'Pachuca', visitante: 'Tigres', inicio_at: t0 }, ana), 401);
ok(await call('POST', '/api/partidos', { rows: [{ local: 'Pachuca', visitante: 'Tigres', inicio_at: t0, jornada: 3 }, { local: 'Tigres', visitante: 'Pumas', inicio_at: t0 + 864e5 }] }, co));
assert.equal((await call('POST', '/api/partidos', { rows: [{ local: 'Pachuca', visitante: 'Tigres', inicio_at: t0 }] }, co)).j.agregados, 0); // sin duplicados
const pts = (await call('GET', '/api/partidos', null, ana)).j; assert.equal(pts.length, 2);
const vj = (await call('POST', '/api/viajes', { partido_id: pts[0].id, titulo: 'Pachuca', destino: 'Pachuca', salida_at: t0 - 36e5, regreso_at: t0 + 36e5 }, co)).j.id;
const aid = (await call('GET', '/api/jugadoras', null, co)).j.find((j) => j.clave === 'ana').id;
ok(await call('POST', `/api/viajes/${vj}/yo`, { estado: 'confirmada' }, ana), 400); // no convocada aún
ok(await call('POST', `/api/viajes/${vj}/yo`, { estado: 'quiere' }, ana));
ok(await call('PUT', `/api/viajes/${vj}/jug`, { ids: [aid], estado: 'convocada' }, co));
ok(await call('POST', `/api/viajes/${vj}/yo`, { estado: 'confirmada' }, ana));
let vs = (await call('GET', '/api/viajes', null, seg)).j; assert.equal(vs[0].jugadoras[0].estado, 'confirmada'); assert.equal(vs[0].cuentas.confirmada, 1);
vs = (await call('GET', '/api/viajes', null, ana)).j; assert.equal(vs[0].yo, 'confirmada'); assert.equal(vs[0].jugadoras, undefined);
ok(await call('DELETE', `/api/viajes/${vj}`, null, co));
// registro por lista
const lote = (await call('POST', '/api/jugadoras/lote', { rows: [{ nombre: 'Lucía Pérez Gómez', nacimiento: '12/03/2009', telefono: '8110000001', tutor_nombre: 'Marta', tutor_tel: '8110000002' }, { nombre: 'Lucía Pérez Gómez', nacimiento: '2009-03-12', tutor_tel: '8110000002' }, { nombre: 'Sin Tutor', nacimiento: '2010-01-01' }, { nombre: 'Mala Fecha', nacimiento: 'xx' }] }, co)).j;
assert.equal(lote.creadas.length, 2); assert.equal(lote.omitidas.length, 2); assert.notEqual(lote.creadas[0].clave, lote.creadas[1].clave);
assert.ok(await login(lote.creadas[0].clave, lote.creadas[0].pin)); ok(await call('POST', '/api/jugadoras/lote', { rows: [] }, co), 400); ok(await call('POST', '/api/jugadoras/lote', { rows: [{ nombre: 'X' }] }, seg), 401);
const cod = (await call('GET', '/api/registro/codigo', null, co)).j.codigo;
const reg = { codigo: cod, nombre: 'Prof Ejemplo Uno', nacimiento: '1998-05-01', telefono: '8110000009', pin: '5821' };
ok(await call('POST', '/api/registro', { ...reg, categoria: 'Inventada' }), 400);
const r1 = await call('POST', '/api/registro', { ...reg, categoria: 'Primer equipo' }); assert.equal(r1.s, 200);
const lista = (await call('GET', '/api/jugadoras', null, co)).j; assert.equal(lista.find((x) => x.nombre === 'Prof Ejemplo Uno').nivel, 'profesional');
const pidP = lista.find((x) => x.nombre === 'Prof Ejemplo Uno').id; await call('PATCH', '/api/jugadoras/' + pidP, { categoria: 'Sub-23' }, co);
assert.equal((await call('GET', '/api/jugadoras', null, co)).j.find((x) => x.id === pidP).nivel, 'fuerzas_basicas');

// ===== etapa 2: viajes = permiso, tutor con código, abordaje, checklist, comedor, avisos, agenda, bandeja, PIN, offline =====
const carId = (await call('GET', '/api/jugadoras', null, co)).j.find((x) => x.clave === 'caro').id, anaId = me.id;
const vjx = (await call('POST', '/api/viajes', { titulo: 'Visita a Pachuca', destino: 'Pachuca', salida_at: Date.now() - 6e4, regreso_at: Date.now() + 36e5 * 8 }, co)).j.id;
const cv = await call('PUT', `/api/viajes/${vjx}/jug`, { ids: [anaId, carId], estado: 'convocada' }, co); ok(cv); assert.equal(cv.j.pendientes_tutor, 1);
const tut = (await call('GET', `/api/viajes/${vjx}/tutores`, null, co)).j; assert.equal(tut.length, 1); // solo la menor necesita al tutor
const tTok = decodeURIComponent(tut[0].whatsapp).match(/\/p\/(\S+)/)[1], tOtp = decodeURIComponent(tut[0].whatsapp_codigo).match(/es (\d{4})/)[1];
let ab = (await call('GET', `/api/viajes/${vjx}/abordaje`, null, seg)).j; assert.equal(ab.total, 2);
ok(await call('POST', `/api/viajes/${vjx}/abordar`, { jugadora_id: anaId, tipo: 'salida' }, seg), 409); // menor sin autorización del tutor: no sube
ok(await call('POST', `/api/viajes/${vjx}/abordar`, { jugadora_id: carId, tipo: 'salida', cid: 'x1' }, seg));
ok(await call('POST', `/api/viajes/${vjx}/abordar`, { jugadora_id: carId, tipo: 'salida', cid: 'x1' }, seg)); // idempotente
ok(await call('POST', '/api/p/' + tTok, { decision: 'aprobar', codigo: tOtp }));
ok(await call('POST', `/api/viajes/${vjx}/abordar`, { jugadora_id: anaId, tipo: 'salida' }, seg));
ab = (await call('GET', `/api/viajes/${vjx}/abordaje`, null, seg)).j; assert.equal(ab.abordaron, 2);
ok(await call('POST', `/api/viajes/${vjx}/abordar`, { jugadora_id: anaId, tipo: 'regreso' }, seg));
// checklist
ok(await call('POST', `/api/viajes/${vjx}/items`, { textos: ['INE', 'Uniforme'] }, co));
const items = (await call('GET', `/api/viajes/${vjx}/checklist`, null, ana)).j.items; assert.equal(items.length, 2);
ok(await call('POST', `/api/viajes/${vjx}/check`, { item_id: items[0].id, hecho: true }, ana));
assert.equal((await call('GET', `/api/viajes/${vjx}/checklist`, null, co)).j.jugadoras.find((x) => x.id === anaId).hechos, 1);
// baja cancela permiso
ok(await call('POST', `/api/viajes/${vjx}/yo`, { estado: 'baja' }, await login('caro', '1234')));
// foto + comedor
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const foto = (await call('POST', '/api/fotos', { data: png }, ana)).j; assert.ok(foto.id);
assert.equal((await fetch(B + foto.url)).status, 200); assert.equal((await fetch(B + foto.url.replace(/k=.*/, 'k=x'))).status, 403);
ok(await call('POST', '/api/comidas', { tipo: 'comida', descripcion: 'Pollo y arroz', foto_id: foto.id }, ana));
ok(await call('POST', '/api/comidas', { tipo: 'comida', descripcion: 'Pollo con verduras' }, ana)); // misma comida = se actualiza
const cm = (await call('GET', '/api/comidas', null, ana)).j; assert.equal(cm.length, 1); assert.ok(cm[0].foto);
ok(await call('PATCH', `/api/comidas/${cm[0].id}`, { comentario: 'Buen plato' }, co));
ok(await call('PUT', '/api/menu', { rows: [{ fecha: new Date().toISOString().slice(0, 10), tipo: 'comida', descripcion: 'Pollo' }] }, co));
assert.equal((await call('GET', '/api/menu', null, ana)).j.length >= 0, true);
assert.equal((await call('GET', '/api/comidas/resumen', null, ana)).j.hoy.comida, true);
// aviso por categoría con lectura; agenda por categoría y repetición
ok(await call('PATCH', '/api/jugadoras/' + anaId, { categoria: 'Sub-17', disponibilidad: 'recuperacion', sangre: 'O+' }, co));
const av = (await call('POST', '/api/avisos', { titulo: 'Junta Sub-17', categoria: 'Sub-17', requiere_lectura: true }, co)).j; assert.equal(av.enviado_a, 1);
assert.equal((await call('GET', '/api/avisos', null, ana)).j[0].leido, false); ok(await call('POST', `/api/avisos/${av.id}/leido`, null, ana));
assert.equal((await call('GET', `/api/avisos/${av.id}/lecturas`, null, co)).j.filter((x) => x.leido_at).length, 1);
ok(await call('POST', '/api/agenda', { titulo: 'Entrena Sub-17', inicio_at: Date.now() + 36e5, repite: 'diario', categoria: 'Sub-17' }, co));
ok(await call('POST', '/api/agenda', { titulo: 'Solo Sub-19', inicio_at: Date.now() + 36e5, categoria: 'Sub-19' }, co));
const ag = (await call('GET', '/api/agenda?dias=3', null, ana)).j; assert.ok(ag.filter((x) => x.titulo === 'Entrena Sub-17').length >= 2); assert.ok(!ag.some((x) => x.titulo === 'Solo Sub-19'));
// bandeja
const nt = (await call('GET', '/api/notificaciones', null, ana)).j; assert.ok(nt.sin_leer >= 2); ok(await call('POST', '/api/notificaciones/leer', {}, ana));
assert.equal((await call('GET', '/api/notificaciones', null, ana)).j.sin_leer, 0);
// personas que recogen + ficha
ok(await call('POST', `/api/jugadoras/${anaId}/recogen`, { nombre: 'Tío Luis', parentesco: 'Tío', telefono: '8100000000' }, co));
assert.equal((await call('GET', '/api/scan/' + me.qr, null, seg)).j.recogen.length, 1);
// PIN: obligatorio cambiarlo tras alta/lote, y rechaza PIN débil
const lc = (await call('POST', '/api/jugadoras/lote', { rows: [{ nombre: 'Pin Cambio', nacimiento: '1999-01-01', telefono: '8100000001' }] }, co)).j.creadas[0];
const lr = (await call('POST', '/api/login', { usuario: lc.clave, pin: lc.pin })).j; assert.equal(lr.cambiar_pin, true);
ok(await call('PATCH', '/api/pin', { actual: lc.pin, nuevo: '1234' }, lr.token), 400); ok(await call('PATCH', '/api/pin', { actual: lc.pin, nuevo: '7392' }, lr.token));
assert.equal((await call('POST', '/api/login', { usuario: lc.clave, pin: '7392' })).j.cambiar_pin, false);
// offline y resumen y push token
const of = (await call('GET', '/api/offline', null, seg)).j; assert.ok(of.jugadoras.length >= 3 && of.permisos);
ok(await call('POST', '/api/mov', { jugadora_id: carId, tipo: 'salida', cid: 'off-1', at: Date.now() - 1000 }, seg), 409); // sin permiso vigente
const rs = (await call('GET', '/api/resumen', null, co)).j; assert.ok(rs.actual.salidas >= 2);
ok(await call('POST', '/api/push/expo', { token: 'ExponentPushToken[abc-123]' }, ana)); ok(await call('POST', '/api/push/expo', { token: 'x' }, ana), 400);
await vigilar();
// borrar cuenta
const del = await login('caro', '1234'); ok(await call('DELETE', '/api/me', { pin: '0000' }, del), 401); ok(await call('DELETE', '/api/me', { pin: '1234' }, del));
assert.equal((await call('POST', '/api/login', { usuario: 'caro', pin: '1234' })).s, 401);
console.log('OK'); srv.close(); process.exit(0);
