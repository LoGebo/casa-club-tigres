import * as liga from './v-liga.js';
import { $, esc, ACT, st, api, toast, dt, hm, dia, mins, badge, sev, modal, foot, ask, sure, localInput, fromInput, hoyStr } from './ui.js';
export const tabs = [['hoy', 'Hoy', 'home'], ['permisos', 'Permisos', 'out'], ['cal', 'Calendario', 'cal'], ['jug', 'Jugadoras', 'users'], ['visitas', 'Visitas', 'door'], ['incid', 'Incidencias', 'alert'], ['serv', 'Servicios', 'tool'], ['com', 'Comunicar', 'bell'], ['rep', 'Reportes', 'chart'], ['equipo', 'Equipo', 'cog']];
export const live = ['hoy', 'permisos', 'incid'];
export const badges = async () => { const d = await api('/dashboard'); return { permisos: d.por_resolver || '', visitas: d.visitas_pend || '', incid: d.incidencias || '', serv: d.tickets || '' }; };

const S = { com: 'avisos', rep: 'hist', fecha: hoyStr(), agDia: hoyStr() };
const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([k, l]) => `<button data-act="sub" data-key="${key}" data-v="${k}" aria-pressed="${S[key] === k}">${l}</button>`).join('')}</div>`;
const empty = (t) => `<div class="empty">${t}</div>`;
const jugOpts = (js, sel) => js.filter((j) => j.activa).map((j) => `<option value="${j.id}" ${+sel === j.id ? 'selected' : ''}>${esc(j.nombre)}</option>`).join('');
const tel = (t) => (t ? `<a href="tel:${esc(t)}">${esc(t)}</a>` : '—');

function permCard(p) {
  const abierta = ['pendiente', 'esperando_padres'].includes(p.estado);
  const auth = { tutor_digital: `tutor (digital, ${p.padre_decision_at ? dt(p.padre_decision_at) : ''})`, coordinacion_manual: 'Coordinación — ' + esc(p.nota || ''), mayor_de_edad: 'Coordinación (mayor de edad)', emergencia: 'EMERGENCIA — ' + esc(p.nota || '') }[p.metodo_auth];
  return `<div class="card tight"><div class="row between"><b>${esc(p.jugadora)} ${p.menor ? '<span class="badge">menor</span>' : ''}</b>${badge(p.estado)}</div>
    <div>${p.tipo === 'pernocta' ? '<span class="badge gold">Pernocta</span> ' : ''}${esc(p.destino)}${p.ubicacion ? ' · ' + esc(p.ubicacion) : ''}</div><small>Con ${esc(p.acompanante)} · ${dt(p.salida_at)} → ${dt(p.regreso_at)}</small>${p.motivo ? `<small>Motivo: ${esc(p.motivo)}</small>` : ''}
    ${auth ? `<small>Autorizado por: ${auth}</small>` : ''}${p.estado === 'rechazado' && p.nota ? `<small>Rechazo: ${esc(p.nota)}</small>` : ''}
    ${abierta ? `<div class="row">${p.menor ? `<button class="btn sm wa" data-act="padres" data-id="${p.id}">${p.estado === 'pendiente' ? 'Enviar a tutor por WhatsApp' : 'Reenviar WhatsApp'}</button>` : ''}<button class="btn sm ghost" data-act="autorizar" data-id="${p.id}" data-menor="${p.menor ? 1 : ''}">Autorizar yo</button><button class="btn sm danger" data-act="rechazar" data-id="${p.id}">Rechazar</button></div>` : ''}</div>`;
}
const jugCard = (j) => `<div class="card tight" ${j.activa ? '' : 'style="opacity:.55"'}><div class="row between"><b>${esc(j.nombre)}</b><span class="badge">${j.menor ? 'menor' : 'mayor'}${j.habitacion ? ' · hab ' + esc(j.habitacion) : ''}</span></div>
  <small>Clave: ${esc(j.clave)} · Tutor: ${esc(j.tutor_nombre || '—')} ${tel(j.tutor_tel)}</small>${j.alergias ? `<small>Alergias: <b>${esc(j.alergias)}</b></small>` : ''}
  <img alt="QR de ${esc(j.nombre)}" width="130" height="130" loading="lazy" src="/api/qr?d=${encodeURIComponent(j.qr)}"><div class="row no-print"><button class="btn sm ghost" data-act="jugForm" data-id="${j.id}">Editar</button></div></div>`;

export async function view(tab) {
  if (tab === 'cal') return liga.view();
  if (tab === 'permisos') {
    const ps = (await api('/permisos')).filter((p) => p.estado !== 'regreso');
    const G = [['Por resolver', ps.filter((p) => ['pendiente', 'esperando_padres'].includes(p.estado))], ['Autorizados', ps.filter((p) => p.estado === 'autorizado')], ['Afuera / recientes', ps.filter((p) => ['salio', 'rechazado', 'vencido'].includes(p.estado))]];
    return { html: `<div class="sec"><h2>Permisos</h2><button class="btn gold" data-act="permisoPara">+ Crear permiso</button></div>${G.map(([t, l]) => `<h3>${t} (${l.length})</h3><div class="list cols">${l.map(permCard).join('') || empty('Nada por aquí')}</div>`).join('')}` };
  }
  if (tab === 'jug') {
    const js = await api('/jugadoras');
    const lista = (v) => js.filter((j) => !v || (j.nombre + (j.habitacion || '')).toLowerCase().includes(v.toLowerCase())).map(jugCard).join('') || empty('Sin resultados');
    return { html: `<div class="sec no-print"><h2>Jugadoras (${js.filter((j) => j.activa).length})</h2><div class="row"><button class="btn sm ghost" onclick="print()">Imprimir QRs</button><button class="btn sm gold" data-act="jugForm">+ Agregar</button></div></div>
      <label class="no-print">Buscar<input id="qj" type="search" placeholder="Nombre o habitación" autocomplete="off"></label><div class="list cols print-grid" id="jl">${lista('')}</div>`,
    after: () => { $('#qj').oninput = (e) => { $('#jl').innerHTML = lista(e.target.value.trim()); }; } };
  }
  if (tab === 'visitas') {
    const vs = await api('/visitas'), g = (f) => vs.filter(f);
    const card = (v) => `<div class="card tight"><div class="row between"><b>${esc(v.visitante)}</b>${badge(v.estado, 1)}</div><small>Visita a ${esc(v.jugadora)} · ${esc(v.relacion || '')} · ${dt(v.fecha_at)}</small>${v.estado === 'pendiente' ? `<div class="row"><button class="btn sm" data-act="visitaDec" data-id="${v.id}" data-a="autorizar">Autorizar</button><button class="btn sm danger" data-act="visitaDec" data-id="${v.id}" data-a="rechazar">Rechazar</button></div>` : ''}</div>`;
    return { html: `<div class="sec"><h2>Visitas</h2><button class="btn gold" data-act="visitaNueva">+ Autorizar visita</button></div><h3>Por autorizar</h3><div class="list cols">${g((v) => v.estado === 'pendiente').map(card).join('') || empty('Sin solicitudes')}</div><h3>Autorizadas y en curso</h3><div class="list cols">${g((v) => ['autorizada', 'dentro'].includes(v.estado)).map(card).join('') || empty('Ninguna')}</div><h3>Historial reciente</h3><div class="list cols">${g((v) => ['salio', 'rechazada'].includes(v.estado)).map(card).join('') || empty('Ninguna')}</div>` };
  }
  if (tab === 'incid') {
    const is = await api('/incidencias');
    return { html: `<div class="sec"><h2>Incidencias</h2><button class="btn gold" data-act="incNueva">+ Registrar</button></div>${is.length ? `<div class="list cols">${is.map((i) => `<div class="card tight ${i.severidad === 'urgente' && i.estado === 'abierta' ? 'late' : ''}"><div class="row between"><b>${esc(i.tipo.replace('_', ' '))}${i.jugadora ? ' · ' + esc(i.jugadora) : ''}</b><span class="row">${sev(i.severidad)}${badge(i.estado)}</span></div><p>${esc(i.descripcion)}</p><small>${dt(i.creado_at)}${i.resolucion ? ' · Resolución: ' + esc(i.resolucion) : ''}</small>${i.estado === 'abierta' ? `<button class="btn sm" data-act="atender" data-id="${i.id}">Marcar atendida</button>` : ''}</div>`).join('')}</div>` : empty('Sin incidencias 🎉')}` };
  }
  if (tab === 'serv') {
    const ts = await api('/tickets'), C = { mantenimiento: 'Mantenimiento', lavanderia: 'Lavandería', medico: 'Médico', alimentos: 'Alimentos', otro: 'Otro' };
    return { html: `<h2>Solicitudes de servicio</h2>${ts.length ? `<div class="list cols">${ts.map((t) => `<div class="card tight ${t.categoria === 'medico' && t.estado !== 'resuelto' ? 'late' : ''}"><div class="row between"><b>${C[t.categoria]} · ${esc(t.jugadora)}${t.habitacion ? ' (hab ' + esc(t.habitacion) + ')' : ''}</b>${badge(t.estado)}</div><p>${esc(t.descripcion)}</p>${t.respuesta ? `<small>Respuesta: ${esc(t.respuesta)}</small>` : ''}<small>${dt(t.creado_at)}</small>
      ${t.estado !== 'resuelto' ? `<div class="row">${t.estado === 'abierto' ? `<button class="btn sm ghost" data-act="ticket" data-id="${t.id}" data-e="en_proceso">En proceso</button>` : ''}<button class="btn sm" data-act="ticket" data-id="${t.id}" data-e="resuelto">Resuelto</button></div>` : ''}</div>`).join('')}</div>` : empty('Sin solicitudes')}` };
  }
  if (tab === 'com') {
    if (S.com === 'avisos') {
      const av = await api('/avisos');
      return { html: `<div class="sec"><h2>Comunicar</h2><button class="btn gold" data-act="avisoNuevo">+ Nuevo aviso</button></div>${seg('com', [['avisos', 'Avisos'], ['agenda', 'Agenda']])}<p class="muted">Los avisos aparecen en el inicio de todas las jugadoras.</p>
        <div class="list cols">${av.map((a) => `<div class="card tight ${a.fijo ? 'note' : ''}"><b>${esc(a.titulo)}</b>${a.cuerpo ? `<p>${esc(a.cuerpo)}</p>` : ''}<small>${dt(a.creado_at)}${a.fijo ? ' · fijo' : ''}</small><button class="btn sm danger" data-act="del" data-r="avisos" data-id="${a.id}">Quitar</button></div>`).join('') || empty('Sin avisos publicados')}</div>` };
    }
    const ag = await api('/agenda?dia=' + S.agDia + '&dias=1');
    return { html: `<div class="sec"><h2>Comunicar</h2><button class="btn gold" data-act="agendaNueva">+ Actividad</button></div>${seg('com', [['avisos', 'Avisos'], ['agenda', 'Agenda']])}
      <label>Día<input type="date" id="agd" value="${S.agDia}"></label><div class="card">${ag.length ? `<div class="tl">${ag.map((e) => `<div><time>${hm(e.inicio_at)}</time><div><b>${esc(e.titulo)}</b> <span class="badge">${esc(e.tipo)}</span><br><small>${esc(e.lugar || '')}${e.fin_at ? ` · hasta ${hm(e.fin_at)}` : ''}</small><br><button class="btn sm danger" data-act="del" data-r="agenda" data-id="${e.id}">Quitar</button></div></div>`).join('')}</div>` : empty('Sin actividades este día')}</div>`,
    after: () => { $('#agd').onchange = (e) => { S.agDia = e.target.value; st.rerender(); }; } };
  }
  if (tab === 'rep') {
    const head = `<h2>Reportes</h2>${seg('rep', [['hist', 'Historial'], ['est', 'Estadísticas'], ['cont', 'Conteos'], ['bit', 'Bitácora']])}`;
    if (S.rep === 'est') {
      const e = await api('/estadisticas?dias=30');
      return { html: `${head}<p class="muted">Últimos 30 días. “Tardes” = regresó después de su hora más la tolerancia.</p><div class="card scroll-x"><table><thead><tr><th>Jugadora</th><th class="num">Salidas</th><th class="num">Tardes</th></tr></thead><tbody>${e.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="num">${x.salidas}</td><td class="num">${x.tardes ? `<span class="badge bad">${x.tardes}</span>` : 0}</td></tr>`).join('')}</tbody></table></div>
        <div class="card"><h3>Exportar movimientos (CSV / Excel)</h3><div class="two"><label>Desde<input type="date" id="d1" value="${hoyStr().slice(0, 8)}01"></label><label>Hasta<input type="date" id="d2" value="${hoyStr()}"></label></div><button class="btn" data-act="csv">Descargar CSV</button></div>` };
    }
    if (S.rep === 'cont') {
      const c = await api('/conteos');
      return { html: `${head}<div class="list cols">${c.map((x) => { const d = JSON.parse(x.detalle || '{}'); return `<div class="card tight"><div class="row between"><b>${dt(x.at)}</b><span class="badge ${d.ausentes?.length ? 'bad' : 'ok'}">${x.presentes}/${x.total}</span></div><small>Registró ${esc(x.staff || '—')}</small>${d.ausentes?.length ? `<small>No localizadas: <b>${d.ausentes.map(esc).join(', ')}</b></small>` : ''}</div>`; }).join('') || empty('Aún no hay conteos')}</div>` };
    }
    if (S.rep === 'bit') {
      const a = await api('/audit');
      return { html: `${head}<p class="muted">Acciones del personal (últimas 150).</p><div class="card scroll-x"><table><thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th></tr></thead><tbody>${a.map((x) => `<tr><td>${dt(x.at)}</td><td>${esc(x.actor || x.rol || '—')}</td><td>${esc(x.accion)} <small>${esc(x.detalle || '')}</small></td></tr>`).join('')}</tbody></table></div>` };
    }
    const h = await api('/historial?fecha=' + S.fecha);
    return { html: `${head}<label>Día<input type="date" id="fh" value="${S.fecha}"></label>${h.length ? `<div class="list cols">${h.map((m) => `<div class="card tight"><div class="row between"><b>${esc(m.jugadora)}</b><span class="badge ${m.tipo === 'salida' ? 'gold' : 'ok'}">${m.tipo === 'salida' ? 'Salida' : 'Regreso'} ${hm(m.at)}</span></div><small>${esc(m.destino)} · con ${esc(m.acompanante)} · registró ${esc(m.staff || '—')}</small></div>`).join('')}</div>` : empty('Sin movimientos este día')}`,
    after: () => { $('#fh').onchange = (e) => { S.fecha = e.target.value; st.rerender(); }; } };
  }
  if (tab === 'equipo') {
    const [sf, c] = await Promise.all([api('/staff'), api('/config')]);
    return { html: `<div class="sec"><h2>Equipo y reglas</h2><button class="btn gold" data-act="staffNuevo">+ Agregar personal</button></div>
      <div class="list cols">${sf.map((x) => `<div class="card tight"><div class="row between"><b>${esc(x.nombre)}</b><span class="badge ${x.activo ? '' : 'bad'}">${x.rol}${x.activo ? '' : ' · inactivo'}</span></div><small>Usuario: ${esc(x.usuario)}</small><div class="row"><button class="btn sm ghost" data-act="staffPin" data-id="${x.id}">Nuevo PIN</button><button class="btn sm ghost" data-act="staffActivo" data-id="${x.id}" data-a="${x.activo ? 0 : 1}">${x.activo ? 'Desactivar' : 'Activar'}</button></div></div>`).join('')}</div>
      <form id="cf" class="card"><h3>Reglas de la casa club</h3><div class="two"><label>Toque de queda<input type="time" name="toque_queda" value="${esc(c.toque_queda)}"></label><label>Puede salir X min antes<input type="number" name="gracia_min" min="0" max="240" value="${esc(c.gracia_min)}"></label></div>
        <div class="two"><label>Tolerancia de regreso (min)<input type="number" name="tolerancia_min" min="0" max="240" value="${esc(c.tolerancia_min)}"></label><label>Máx. solicitudes en espera<input type="number" name="max_pendientes" min="1" max="10" value="${esc(c.max_pendientes)}"></label></div>
        <label>Teléfono de Coordinación (para Seguridad)<input name="tel_coordinacion" inputmode="tel" value="${esc(c.tel_coordinacion)}"></label><label>Nombre del club<input name="nombre_club" value="${esc(c.nombre_club)}"></label><button class="btn">Guardar reglas</button></form>`,
    after: () => { $('#cf').onsubmit = async (e) => { e.preventDefault(); try { await api('/config', 'PUT', Object.fromEntries(new FormData(e.target))); toast('Reglas guardadas'); } catch (er) { toast(er.message); } }; } };
  }
  const [d, fu, ag] = await Promise.all([api('/dashboard'), api('/fuera'), api('/agenda')]);
  const late = fu.filter((p) => p.atrasada), now = Date.now();
  return { html: `<div class="hero"><p>${dia(now)}</p><h1>${d.total - d.fuera} de ${d.total} en casa club</h1></div>
    <div class="stats"><button class="stat ${d.atrasadas ? 'alert' : ''}" data-act="tab" data-t="permisos"><b>${d.atrasadas}</b><span>Atrasadas</span></button><button class="stat ${d.por_resolver ? 'warn' : ''}" data-act="tab" data-t="permisos"><b>${d.por_resolver}</b><span>Permisos por resolver</span></button><button class="stat" data-act="tab" data-t="permisos"><b>${d.fuera}</b><span>Afuera</span></button><button class="stat ${d.incidencias ? 'alert' : ''}" data-act="tab" data-t="incid"><b>${d.incidencias}</b><span>Incidencias</span></button><button class="stat" data-act="tab" data-t="visitas"><b>${d.visitas_pend}</b><span>Visitas por autorizar</span></button><button class="stat" data-act="tab" data-t="serv"><b>${d.tickets}</b><span>Servicios abiertos</span></button></div>
    <div class="grid2"><div class="stack"><div class="sec"><h3>Requiere atención</h3><button class="btn sm danger" data-act="emergencia">Salida de emergencia</button></div>${late.map((p) => `<div class="card tight late"><div class="row between"><b>${esc(p.jugadora)}</b><span class="badge bad">${mins(now - p.regreso_at)} tarde</span></div><small>${esc(p.destino)} · con ${esc(p.acompanante)}</small>${p.tutor_tel ? `<a class="btn sm ghost" href="tel:${esc(p.tutor_tel)}">Llamar a ${esc(p.tutor_nombre || 'tutor')}</a>` : ''}</div>`).join('') || empty('Todo en orden ✓')}</div>
    <div class="stack"><div class="sec"><h3>Agenda de hoy</h3></div><div class="card">${ag.length ? `<div class="tl">${ag.map((e) => `<div><time>${hm(e.inicio_at)}</time><div><b>${esc(e.titulo)}</b><br><small>${esc(e.lugar || '')}</small></div></div>`).join('')}</div>` : empty('Sin actividades. Agrégalas en Comunicar → Agenda.')}</div></div></div>` };
}

const jForm = (j = {}) => `<h2>${j.id ? 'Editar jugadora' : 'Nueva jugadora'}</h2><label>Nombre completo<input name="nombre" required value="${esc(j.nombre)}"></label>
  <div class="two"><label>Clave de acceso<input name="clave" required autocapitalize="none" value="${esc(j.clave)}" ${j.id ? 'disabled' : ''}></label><label>${j.id ? 'Nuevo PIN (opcional)' : 'PIN (4–8 dígitos)'}<input name="pin" inputmode="numeric" pattern="\\d{4,8}" ${j.id ? '' : 'required'}></label></div>
  <div class="two"><label>Nacimiento<input type="date" name="nacimiento" required value="${esc(j.nacimiento)}" ${j.id ? 'disabled' : ''}></label><label>Habitación<input name="habitacion" value="${esc(j.habitacion)}"></label></div>
  <div class="two"><label>Tutor<input name="tutor_nombre" value="${esc(j.tutor_nombre)}"></label><label>WhatsApp tutor<input name="tutor_tel" inputmode="tel" value="${esc(j.tutor_tel)}"></label></div>
  <div class="two"><label>Contacto de emergencia<input name="emergencia_nombre" value="${esc(j.emergencia_nombre)}"></label><label>Tel. emergencia<input name="emergencia_tel" inputmode="tel" value="${esc(j.emergencia_tel)}"></label></div>
  <label>Alergias<input name="alergias" value="${esc(j.alergias)}"></label><label>Notas médicas (solo Coordinación)<textarea name="notas_medicas">${esc(j.notas_medicas)}</textarea></label>
  ${j.id ? `<label class="chk" style="min-height:48px"><input type="checkbox" name="activa" ${j.activa ? 'checked' : ''}><span>Jugadora activa en casa club</span></label>` : ''}${foot()}`;

Object.assign(ACT, {
  sub({ key, v }) { S[key] = v; st.rerender(); },
  async padres({ id }) { const r = await api(`/permisos/${id}/enviar-padres`, 'POST'); if (r.whatsapp) window.open(r.whatsapp, '_blank'); else toast('La jugadora no tiene teléfono de tutor'); st.rerender(); },
  async autorizar({ id, menor }) { let nota = ''; if (menor) { nota = await ask('Autorizar sin respuesta digital', '¿Cómo se confirmó con el tutor?', { placeholder: 'Llamada a mamá, 14:05', hint: 'La jugadora es menor de edad: queda constancia en el registro.' }); if (!nota) return; } await api(`/permisos/${id}/autorizar`, 'POST', { nota }); toast('Autorizado'); st.rerender(); },
  async rechazar({ id }) { const nota = await ask('Rechazar permiso', 'Motivo (lo verá la jugadora)', { required: false, ok: 'Rechazar' }); if (nota === null) return; await api(`/permisos/${id}/rechazar`, 'POST', { nota }); st.rerender(); },
  async permisoPara() {
    const js = await api('/jugadoras'), now = Date.now();
    modal(`<h2>Crear permiso para una jugadora</h2><label>Jugadora<select name="jugadora_id" required>${jugOpts(js)}</select></label><label>Tipo<select name="tipo"><option value="salida">Salida del día</option><option value="pernocta">Pernocta fuera</option></select></label><label>Destino<input name="destino" required></label><label>Acompañante<input name="acompanante" required></label>
      <div class="two"><label>Salida<input type="datetime-local" name="salida" required value="${localInput(now + 36e5)}"></label><label>Regreso<input type="datetime-local" name="regreso" required value="${localInput(now + 4 * 36e5)}"></label></div>${foot('Crear')}`,
    async (f, d) => { await api('/permisos', 'POST', { ...f, jugadora_id: +f.jugadora_id, salida_at: fromInput(f.salida), regreso_at: fromInput(f.regreso) }); d.close(); toast('Permiso creado. Autorízalo o envíalo al tutor.'); st.rerender(); });
  },
  async emergencia() {
    const js = await api('/jugadoras');
    modal(`<h2>Salida de emergencia</h2><p class="muted">Crea un permiso ya autorizado (ambulancia, familiar, etc.). Queda en la bitácora. Seguridad registra la salida al escanear.</p><label>Jugadora<select name="jugadora_id" required>${jugOpts(js)}</select></label><label>Motivo<input name="motivo" required placeholder="Lesión, urgencia familiar…"></label><label>Destino<input name="destino" required placeholder="Hospital, domicilio…"></label><label>Acompañante<input name="acompanante" placeholder="Personal del club"></label><label>Horas fuera (previstas)<input type="number" name="horas" value="6" min="1" max="72"></label>${foot('Autorizar salida')}`,
    async (f, d) => { await api('/emergencia', 'POST', { ...f, jugadora_id: +f.jugadora_id, horas: +f.horas }); d.close(); toast('Salida de emergencia autorizada. Avisa a Seguridad.'); st.rerender(); });
  },
  async jugForm({ id }) {
    const j = id ? (await api('/jugadoras')).find((x) => x.id === +id) : {};
    modal(jForm(j), async (f, d) => {
      if (id) { const b = { ...f, activa: !!f.activa }; if (!b.pin) delete b.pin; await api('/jugadoras/' + id, 'PATCH', b); } else await api('/jugadoras', 'POST', f);
      d.close(); toast('Guardado'); st.rerender();
    });
  },
  async visitaDec({ id, a }) { const nota = a === 'rechazar' ? await ask('Rechazar visita', 'Motivo', { required: false, ok: 'Rechazar' }) : ''; if (nota === null) return; await api(`/visitas/${id}/${a}`, 'POST', { nota }); st.rerender(); },
  async visitaNueva() {
    const js = await api('/jugadoras');
    modal(`<h2>Autorizar visita</h2><label>Jugadora<select name="jugadora_id" required>${jugOpts(js)}</select></label><label>Visitante<input name="visitante" required></label><label>Relación<input name="relacion"></label><label>Fecha y hora<input type="datetime-local" name="fecha" required value="${localInput(Date.now() + 36e5)}"></label>${foot('Autorizar')}`,
    async (f, d) => { await api('/visitas', 'POST', { ...f, jugadora_id: +f.jugadora_id, fecha_at: fromInput(f.fecha) }); d.close(); toast('Visita autorizada'); st.rerender(); });
  },
  async incNueva() {
    const js = await api('/jugadoras');
    modal(`<h2>Registrar incidencia</h2><label>Tipo<select name="tipo"><option value="convivencia">Convivencia</option><option value="salud">Salud</option><option value="disciplina">Disciplina</option><option value="seguridad">Seguridad</option><option value="otro">Otro</option></select></label><label>Gravedad<select name="severidad"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="urgente">Urgente</option></select></label><label>Jugadora (opcional)<select name="jugadora_id"><option value="">—</option>${jugOpts(js)}</select></label><label>Descripción<textarea name="descripcion" required></textarea></label>${foot()}`,
    async (f, d) => { await api('/incidencias', 'POST', f); d.close(); st.rerender(); });
  },
  async atender({ id }) { const r = await ask('Marcar como atendida', 'Resolución / acciones tomadas', { required: false, ok: 'Atendida' }); if (r === null) return; await api(`/incidencias/${id}/atender`, 'POST', { resolucion: r }); st.rerender(); },
  async ticket({ id, e }) { const r = await ask(e === 'resuelto' ? 'Marcar como resuelto' : 'Poner en proceso', 'Respuesta para la jugadora (opcional)', { required: false }); if (r === null) return; await api('/tickets/' + id, 'PATCH', { estado: e, respuesta: r }); st.rerender(); },
  avisoNuevo: () => modal(`<h2>Nuevo aviso</h2><label>Título<input name="titulo" required></label><label>Mensaje<textarea name="cuerpo"></textarea></label><label class="chk" style="min-height:48px"><input type="checkbox" name="fijo"><span>Fijar arriba</span></label>${foot('Publicar')}`, async (f, d) => { await api('/avisos', 'POST', { ...f, fijo: !!f.fijo }); d.close(); toast('Aviso publicado'); st.rerender(); }),
  agendaNueva: () => modal(`<h2>Nueva actividad</h2><label>Título<input name="titulo" required></label><label>Tipo<select name="tipo"><option value="entrenamiento">Entrenamiento</option><option value="comida">Comida</option><option value="estudio">Estudio</option><option value="transporte">Transporte</option><option value="otro">Otro</option></select></label><div class="two"><label>Inicio<input type="datetime-local" name="ini" required value="${S.agDia}T09:00"></label><label>Fin<input type="datetime-local" name="fin" value="${S.agDia}T10:00"></label></div><label>Lugar<input name="lugar"></label>${foot('Agregar')}`, async (f, d) => { await api('/agenda', 'POST', { titulo: f.titulo, tipo: f.tipo, lugar: f.lugar, inicio_at: fromInput(f.ini), fin_at: f.fin ? fromInput(f.fin) : null }); d.close(); st.rerender(); }),
  async del({ r, id }) { if (!(await sure('¿Quitar?', 'Esta acción no se puede deshacer.', 'Quitar'))) return; await api(`/${r}/${id}`, 'DELETE'); st.rerender(); },
  async csv() {
    const r = await fetch(`/api/reporte.csv?desde=${$('#d1').value}&hasta=${$('#d2').value}`, { headers: { authorization: 'Bearer ' + st.S.token } });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: `movimientos_${$('#d1').value}_${$('#d2').value}.csv` }); a.click(); URL.revokeObjectURL(a.href);
  },
  staffNuevo: () => modal(`<h2>Agregar personal</h2><label>Nombre<input name="nombre" required></label><div class="two"><label>Usuario<input name="usuario" required autocapitalize="none"></label><label>PIN (4–8)<input name="pin" inputmode="numeric" pattern="\\d{4,8}" required></label></div><label>Rol<select name="rol"><option value="seguridad">Seguridad</option><option value="coordinacion">Coordinación</option></select></label>${foot('Crear')}`, async (f, d) => { await api('/staff', 'POST', f); d.close(); st.rerender(); }),
  async staffPin({ id }) { const p = await ask('Nuevo PIN', 'PIN (4 a 8 dígitos)', { ok: 'Cambiar' }); if (!p) return; await api('/staff/' + id, 'PATCH', { pin: p }); toast('PIN actualizado'); },
  async staffActivo({ id, a }) { await api('/staff/' + id, 'PATCH', { activo: !!+a }); st.rerender(); },
});
