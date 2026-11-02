// Calendario: partidos de la liga, viajes del equipo y convocatorias. Lo usan las tres vistas; edita solo Coordinación.
import { crest, esc, ACT, st, api, toast, dt, hm, dia, modal, foot, sure, localInput, fromInput } from './ui.js';

const L = { sub: 'tigres' };
const TIGRES = /tigres/i, esTigres = (p) => TIGRES.test(p.local) || TIGRES.test(p.visitante);
const ETQ = { convocada: ['Convocada', 'gold'], confirmada: ['Confirmada', 'ok'], quiere: ['Quiere ir', 'warn'], baja: ['No puede', 'bad'] };
const chip = (e) => (e ? `<span class="badge ${ETQ[e][1]}">${ETQ[e][0]}</span>` : '');
const edita = () => st.S.rol === 'coordinacion';

ACT.ligaSub = ({ v }) => { L.sub = v; st.rerender(); };

function partidoCard(p, viaje) {
  const t = esTigres(p), lejos = t && !TIGRES.test(p.local), past = p.inicio_at < Date.now() - 3 * 36e5;
  return `<button class="match ${t ? 'tigres' : ''} ${past ? 'past' : ''}" data-act="partido" data-id="${p.id}">
    <span class="when"><b>${new Date(p.inicio_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</b>${p.jornada ? `<small>J${p.jornada}</small>` : ''}</span>
    <span class="vs"><span class="tm">${crest(p.local)}<b>${esc(p.local)}</b></span><span class="tm">${crest(p.visitante)}<b>${esc(p.visitante)}</b></span></span>
    <span class="meta">${p.resultado ? `<b class="res">${esc(p.resultado)}</b>` : viaje ? '<span class="badge gold">Viaje</span>' : lejos ? '<span class="badge">Visita</span>' : ''}${p.demo ? '<small>Ejemplo</small>' : ''}</span>
    ${p.sede ? `<small class="sede">${esc(p.sede)}</small>` : ''}</button>`;
}

function partidos(ps, vs) {
  const lista = L.sub === 'tigres' ? ps.filter(esTigres) : ps;
  const grupos = Object.values(lista.reduce((o, p) => { (o[new Date(p.inicio_at).toDateString()] ||= []).push(p); return o; }, {})).map((g) => [0, g]);
  const proximo = lista.find((p) => p.inicio_at >= Date.now() - 3 * 36e5);
  const hero = proximo && L.sub === 'tigres' ? `<div class="next"><small>Próximo partido</small><div class="faceoff"><span>${crest(proximo.local)}<b>${esc(proximo.local)}</b></span><i>vs</i><span>${crest(proximo.visitante)}<b>${esc(proximo.visitante)}</b></span></div><p>${dia(proximo.inicio_at)} · ${hm(proximo.inicio_at)}${proximo.sede ? ' · ' + esc(proximo.sede) : ''}</p></div>` : '';
  return hero + (grupos.map(([, g]) => `<h3 class="dayh">${dia(g[0].inicio_at)}</h3><div class="list">${g.map((p) => partidoCard(p, vs.some((v) => v.partido_id === p.id))).join('')}</div>`).join('')
    || `<div class="empty">Aún no hay partidos cargados.${edita() ? '<br>Toca “+ Partido” o “Importar”.' : '<br>Coordinación los publicará aquí.'}</div>`);
}

function viajeCard(v) {
  const c = v.cuentas, esJ = st.S.rol === 'jugadora';
  const acc = esJ ? (v.yo === 'convocada' ? `<div class="row"><button class="btn sm grow" data-act="yo" data-id="${v.id}" data-e="confirmada">Confirmo que voy</button><button class="btn sm ghost" data-act="yo" data-id="${v.id}" data-e="baja">No puedo</button></div>`
    : v.yo === 'confirmada' ? `<button class="btn sm ghost" data-act="yo" data-id="${v.id}" data-e="baja">Ya no puedo ir</button>`
    : v.yo === 'quiere' ? `<button class="btn sm ghost" data-act="yo" data-id="${v.id}" data-e="quitar">Cancelar mi solicitud</button>`
    : v.yo === 'baja' ? '' : `<button class="btn sm gold" data-act="yo" data-id="${v.id}" data-e="quiere">Quiero ir</button>`) : '';
  const roster = !esJ && v.jugadoras?.length ? `<div class="chips">${v.jugadoras.map((j) => `<span class="badge ${ETQ[j.estado][1]}" title="${ETQ[j.estado][0]}">${esc(j.nombre.split(' ')[0])} · ${ETQ[j.estado][0]}</span>`).join('')}</div>` : '';
  return `<div class="card trip"><div class="row between"><b>${esc(v.titulo)}</b>${esJ ? chip(v.yo) : ''}</div>
    <div class="kv"><div><span>Destino</span><b>${esc(v.destino)}</b></div><div><span>Sale</span><b>${dt(v.salida_at)}</b></div><div><span>Regresa</span><b>${dt(v.regreso_at)}</b></div>${v.transporte ? `<div><span>Transporte</span><b>${esc(v.transporte)}</b></div>` : ''}${v.hospedaje ? `<div><span>Hospedaje</span><b>${esc(v.hospedaje)}</b></div>` : ''}</div>
    ${v.nota ? `<small>${esc(v.nota)}</small>` : ''}
    <div class="counts"><span><b>${c.convocada + c.confirmada}</b> convocadas</span><span><b>${c.confirmada}</b> confirmadas</span><span><b>${c.quiere}</b> quieren ir</span></div>${roster}
    ${acc}${edita() ? `<div class="row"><button class="btn sm grow" data-act="convocar" data-id="${v.id}">Convocar jugadoras</button><button class="btn sm danger" data-act="delViaje" data-id="${v.id}">Quitar</button></div>` : ''}</div>`;
}

export async function view() {
  const [ps, vs] = await Promise.all([api('/partidos'), api('/viajes')]);
  const nuevo = L.sub === 'viajes' ? (edita() ? '<button class="btn gold" data-act="viajeNuevo">+ Viaje</button>' : '') : edita() ? '<button class="btn gold" data-act="partidoNuevo">+ Partido</button>' : '';
  const tools = edita() && L.sub !== 'viajes' ? `<div class="row no-print"><button class="btn sm ghost" data-act="importar">Importar CSV</button>${ps.some((p) => p.demo) ? '<button class="btn sm ghost" data-act="quitarDemo">Quitar ejemplos</button>' : ''}</div>` : '';
  const demo = ps.some((p) => p.demo) ? '<p class="note-demo">Los partidos marcados “Ejemplo” son de muestra. Coordinación carga el calendario real.</p>' : '';
  const body = L.sub === 'viajes' ? (vs.length ? `<div class="list cols">${vs.map(viajeCard).join('')}</div>` : '<div class="empty">No hay viajes programados.</div>') : demo + tools + partidos(ps, vs);
  return { html: `<div class="sec"><h2>Calendario</h2>${nuevo}</div><div class="seg" role="group">${[['tigres', 'Tigres'], ['liga', 'Liga'], ['viajes', 'Viajes']].map(([k, l]) => `<button data-act="ligaSub" data-v="${k}" aria-pressed="${L.sub === k}">${l}</button>`).join('')}</div>${body}` };
}

// ---- acciones de jugadora ----
ACT.yo = async ({ id, e }) => { await api(`/viajes/${id}/yo`, 'POST', { estado: e }); toast({ quiere: 'Solicitud enviada ✓', confirmada: 'Confirmado ✓', baja: 'Avisaste que no puedes', quitar: 'Solicitud cancelada' }[e]); st.rerender(); };

// ---- acciones de Coordinación ----
const fechaHora = (ms) => localInput(ms || Date.now() + 864e5);
const partidoForm = () => `<label>Local<input name="local" required></label><label>Visitante<input name="visitante" required></label><div class="two"><label>Fecha y hora<input type="datetime-local" name="ini" required value="${fechaHora()}"></label><label>Jornada<input name="jornada" type="number" min="1" inputmode="numeric"></label></div><label>Sede<input name="sede"></label>`;
ACT.partidoNuevo = () => modal(`<h2>Nuevo partido</h2>${partidoForm()}${foot('Agregar')}`, async (f, d) => {
  await api('/partidos', 'POST', { local: f.local, visitante: f.visitante, inicio_at: fromInput(f.ini), jornada: f.jornada, sede: f.sede, torneo: 'Liga MX Femenil' }); d.close(); st.rerender(); });

ACT.partido = async ({ id }) => {
  const p = (await api('/partidos?atras=365')).find((x) => x.id === +id); if (!p) return;
  const v = (await api('/viajes?atras=365')).find((x) => x.partido_id === p.id);
  const lejos = esTigres(p) && !TIGRES.test(p.local);
  if (!edita()) return modal(`<h2>${esc(p.local)} vs ${esc(p.visitante)}</h2><p>${dt(p.inicio_at)}${p.sede ? '<br>' + esc(p.sede) : ''}${p.resultado ? `<br>Resultado: <b>${esc(p.resultado)}</b>` : ''}</p>${v ? '<p class="muted">Hay un viaje programado. Revisa la pestaña Viajes.</p>' : ''}<button type="button" class="btn ghost" data-act="cerrar">Cerrar</button>`, () => {});
  const d = modal(`<h2>${esc(p.local)} vs ${esc(p.visitante)}</h2><p class="muted">${dt(p.inicio_at)}</p><label>Resultado<input name="resultado" value="${esc(p.resultado || '')}" placeholder="2-1"></label><label>Sede<input name="sede" value="${esc(p.sede || '')}"></label>${foot()}
    ${esTigres(p) && !v ? `<button type="button" class="btn ghost" id="mkv">${lejos ? 'Crear viaje para este partido' : 'Crear convocatoria (local)'}</button>` : ''}<button type="button" class="btn danger" id="delp">Quitar partido</button>`,
    async (f, dl) => { await api('/partidos/' + id, 'PATCH', f); dl.close(); st.rerender(); });
  d.querySelector('#mkv')?.addEventListener('click', () => { d.close(); ACT.viajeNuevo({}, null, p); });
  d.querySelector('#delp').addEventListener('click', async () => { d.close(); if (await sure('¿Quitar el partido?', `${p.local} vs ${p.visitante}`, 'Quitar')) { await api('/partidos/' + id, 'DELETE'); st.rerender(); } });
};

ACT.viajeNuevo = (_, __, p) => {
  const ini = p ? p.inicio_at : Date.now() + 864e5;
  modal(`<h2>Nuevo viaje</h2><label>Título<input name="titulo" required value="${esc(p ? `${p.local} vs ${p.visitante}` : '')}"></label><label>Destino<input name="destino" required value="${esc(p && !TIGRES.test(p.local) ? p.sede || p.local : p?.sede || 'Casa Club')}"></label>
    <div class="two"><label>Sale<input type="datetime-local" name="sal" required value="${fechaHora(ini - 24 * 36e5)}"></label><label>Regresa<input type="datetime-local" name="reg" required value="${fechaHora(ini + 8 * 36e5)}"></label></div>
    <label>Transporte<input name="transporte" placeholder="Autobús del club"></label><label>Hospedaje<input name="hospedaje"></label><label>Nota<input name="nota"></label>${foot('Crear')}`,
    async (f, d) => { await api('/viajes', 'POST', { partido_id: p?.id, titulo: f.titulo, destino: f.destino, salida_at: fromInput(f.sal), regreso_at: fromInput(f.reg), transporte: f.transporte, hospedaje: f.hospedaje, nota: f.nota }); d.close(); L.sub = 'viajes'; st.rerender(); });
};
ACT.delViaje = async ({ id }) => { if (await sure('¿Quitar el viaje?', 'Se borra también la lista de convocadas.', 'Quitar')) { await api('/viajes/' + id, 'DELETE'); st.rerender(); } };

ACT.convocar = async ({ id }) => {
  const [js, vs] = await Promise.all([api('/jugadoras'), api('/viajes')]);
  const v = vs.find((x) => x.id === +id), est = Object.fromEntries((v.jugadoras || []).map((j) => [j.id, j.estado]));
  const dentro = (e) => e === 'convocada' || e === 'confirmada';
  modal(`<h2>Convocar · ${esc(v.titulo)}</h2><p class="muted">Marca a quienes viajan. Las que pidieron ir aparecen señaladas.</p>
    <div class="list chklist">${js.filter((j) => j.activa).map((j) => `<label class="chk"><input type="checkbox" name="j${j.id}" ${dentro(est[j.id]) ? 'checked' : ''}><span class="grow">${esc(j.nombre)}</span>${chip(est[j.id])}</label>`).join('')}</div>${foot('Guardar convocatoria')}`,
    async (f, d) => {
      const on = js.filter((j) => j.activa && f['j' + j.id] === 'on').map((j) => j.id);
      const nuevas = on.filter((i) => !dentro(est[i])), quitar = js.filter((j) => dentro(est[j.id]) && !on.includes(j.id)).map((j) => j.id);
      if (nuevas.length) await api(`/viajes/${id}/jug`, 'PUT', { ids: nuevas, estado: 'convocada' });
      if (quitar.length) await api(`/viajes/${id}/jug`, 'PUT', { ids: quitar, estado: null });
      d.close(); st.rerender();
    });
};

// ---- importar calendario (CSV: jornada, fecha, hora, local, visitante, sede) ----
function parseCsv(txt) {
  const rows = [], bad = [];
  txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
    const c = l.split(/[;\t,]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /fecha/i.test(l)) return;
    const [jor, fecha, hora, local, visitante, sede] = c;
    const m = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/) || fecha?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = m ? (m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : '';
    const t = new Date(`${iso}T${/^\d{1,2}:\d{2}$/.test(hora || '') ? hora.padStart(5, '0') : '12:00'}`).getTime();
    if (!local || !visitante || !(t > 0)) return bad.push(i + 1);
    rows.push({ jornada: jor, inicio_at: t, local, visitante, sede, torneo: 'Liga MX Femenil' });
  });
  return { rows, bad };
}
ACT.importar = () => {
  const d = modal(`<h2>Importar calendario</h2><p class="muted">Una fila por partido: <b>jornada, fecha, hora, local, visitante, sede</b>. Fecha como 2027-01-10 o 10/01/2027. Puedes copiarlas desde Excel o Sheets.</p>
    <label>Archivo CSV<input type="file" accept=".csv,.txt" id="csvf"></label><label>…o pega aquí<textarea name="csv" rows="7" placeholder="1,2027-01-10,19:00,Tigres,Rayadas,Estadio Universitario"></textarea></label>${foot('Importar')}`,
    async (f, dl) => { const { rows, bad } = parseCsv(f.csv || ''); if (!rows.length) throw new Error('No encontré partidos válidos' + (bad.length ? ` (revisa las filas ${bad.slice(0, 5).join(', ')})` : '')); const r = await api('/partidos', 'POST', { rows }); dl.close(); toast(`${r.agregados} partidos agregados${bad.length ? `, ${bad.length} filas omitidas` : ''}`); st.rerender(); });
  d.querySelector('#csvf').addEventListener('change', async (e) => { d.querySelector('textarea').value = await e.target.files[0].text(); });
};
ACT.quitarDemo = async () => { if (await sure('¿Quitar los ejemplos?', 'Se borran los partidos de muestra; los que tú cargues se quedan.', 'Quitar')) { await api('/partidos', 'DELETE'); st.rerender(); } };
