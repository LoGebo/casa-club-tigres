// Crea usuarios de Seguridad y Coordinación. PINs: env SEG_PIN / COORD_PIN o aleatorios (se imprimen una vez).
// `node seed.js demo` agrega jugadoras, agenda y avisos de prueba (clave ana/bea/caro, PIN 1234).
import crypto from 'node:crypto';
import { q, one } from './db.js';
import { hashPin } from './server.js';
const pin = (v) => v || String(crypto.randomInt(100000, 999999));
for (const [u, n, rol, p] of [['seguridad', 'Seguridad', 'seguridad', pin(process.env.SEG_PIN)], ['coordinacion', 'Coordinación', 'coordinacion', pin(process.env.COORD_PIN)]]) {
  if (await one('SELECT 1 FROM staff WHERE usuario=$1', [u])) { console.log(u, 'ya existe'); continue; }
  await q('INSERT INTO staff(usuario,nombre,rol,pin_hash) VALUES($1,$2,$3,$4)', [u, n, rol, hashPin(p)]); console.log(`${u}  PIN: ${p}`);
}
if (process.argv[2] === 'demo') {
  for (const [c, n, nac, hab] of [['ana', 'Ana Martínez', '2009-03-12', '101'], ['bea', 'Beatriz Soto', '2008-07-30', '101'], ['caro', 'Carolina Ruiz', '2004-11-02', '102']])
    if (!(await one('SELECT 1 FROM jugadoras WHERE clave=$1', [c])))
      await q('INSERT INTO jugadoras(clave,nombre,nacimiento,habitacion,tutor_nombre,tutor_tel,emergencia_nombre,emergencia_tel,alergias,pin_hash,qr) VALUES($1,$2,$3,$4,$5,$6,$5,$6,$7,$8,$9)', [c, n, nac, hab, 'Tutor de ' + n.split(' ')[0], '8112345678', c === 'ana' ? 'Penicilina' : null, hashPin('1234'), crypto.randomBytes(12).toString('hex')]);
  if (!(await one('SELECT 1 FROM avisos'))) {
    const d = new Date(); d.setHours(0, 0, 0, 0); const t = d.getTime(), h = (x) => t + x * 36e5;
    await q("INSERT INTO avisos(titulo,cuerpo,fijo,creado_at) VALUES('Bienvenidas a Casa Club','Recuerden escanear su QR cada vez que salgan y regresen. Sin permiso autorizado no hay salida.',TRUE,$1)", [Date.now()]);
    for (const [ti, tp, a, b, l] of [['Desayuno', 'comida', 7, 8, 'Comedor'], ['Entrenamiento', 'entrenamiento', 9.5, 11.5, 'Cancha 2'], ['Comida', 'comida', 14, 15, 'Comedor'], ['Tutoría escolar', 'estudio', 17, 18.5, 'Sala de estudio'], ['Cena', 'comida', 20, 21, 'Comedor']])
      await q('INSERT INTO agenda(titulo,tipo,inicio_at,fin_at,lugar) VALUES($1,$2,$3,$4,$5)', [ti, tp, h(a), h(b), l]);
  }
}
process.exit(0);
