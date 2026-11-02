import { $, esc, ACT, st, api, toast, dt, hm, mins, badge, sev, modal, foot, ask, sure, ic } from './ui.js';
export const tabs = [['scan', 'Escanear', 'scan'], ['fuera', 'Afuera', 'out'], ['conteo', 'Conteo', 'check'], ['visitas', 'Visitas', 'users'], ['incid', 'Incidencias', 'alert']];
export const live = ['fuera', 'visitas', 'incid'];
export const badges = async () => { const d = await api('/dashboard'); return { fuera: d.atrasadas || '', incid: d.incidencias || '' }; };

let dentroN = 0, stream = null, found = null, jugs = [], sel = new Set();
export const camOn = () => !!stream;
export const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };

function verdict(r) {
  const p = r.permiso || {}, e = r.emergencia || {};
  const ficha = `<details><summary>Ficha de emergencia</summary><p>Hab. ${esc(r.habitacion || '—')} · Contacto: ${esc(e.nombre || '—')} ${e.tel ? `<a href="tel:${esc(e.tel)}">${esc(e.tel)}</a>` : ''}<br>Alergias: <b>${esc(e.alergias || 'ninguna registrada')}</b></p></details>`;
  if (r.estado === 'autorizada') return `<div class="verdict ok"><h2>Puede salir</h2><div class="who">${esc(r.nombre)}</div><p>${esc(p.destino)} · con ${esc(p.acompanante)}<br>Regreso: ${dt(p.regreso_at)}</p>${p.metodo_auth === 'emergencia' ? '<span class="badge bad">SALIDA DE EMERGENCIA</span>' : ''}<button class="btn big" data-act="mov" data-id="${r.id}" data-tipo="salida">Registrar salida</button>${ficha}</div>`;
  if (r.estado === 'fuera') { const tarde = p.regreso_at < Date.now(); return `<div class="verdict ${tarde ? 'bad' : 'warn'}"><h2>${tarde ? 'Regreso tarde' : 'Estaba afuera'}</h2><div class="who">${esc(r.nombre)}</div><p>Esperada: ${hm(p.regreso_at)}${tarde ? ` · ${mins(Date.now() - p.regreso_at)} de retraso` : ''}</p><button class="btn big" data-act="mov" data-id="${r.id}" data-tipo="regreso">Registrar regreso</button>${ficha}</div>`; }
  return `<div class="verdict bad"><h2>No puede salir</h2><div class="who">${esc(r.nombre)}</div><p>Sin permiso autorizado vigente.${r.proximo ? `<br>Su próximo permiso inicia ${dt(r.proximo.salida_at)}` : ''}</p>
    <div class="row" style="justify-content:center">${st.cfg.tel_coordinacion ? `<a class="btn" href="tel:${esc(st.cfg.tel_coordinacion)}">Llamar a Coordinación</a>` : ''}<button class="btn ghost" data-act="incidencia" data-jid="${r.id}" data-tipo="intento_salida">Reportar intento</button></div>${ficha}</div>`;
}

export async function view(tab) {
  if (tab === 'fuera') {
    const f = await api('/fuera');
    return { html: `<div class="sec"><h2>Afuera ahora</h2><span class="badge gold">${f.length}</span></div>${f.length ? `<div class="list">${f.map((p) => `<div class="card tight ${p.atrasada ? 'late' : ''}"><div class="row between"><b>${esc(p.jugadora)}</b>${p.atrasada ? `<span class="badge bad">${mins(Date.now() - p.regreso_at)} tarde</span>` : `<span class="badge">regresa ${hm(p.regreso_at)}</span>`}</div>
      <small>${esc(p.destino)} · con ${esc(p.acompanante)}${p.salio_at ? ` · salió ${hm(p.salio_at)}` : ''}</small>${p.atrasada && p.tutor_tel ? `<a class="btn sm ghost" href="tel:${esc(p.tutor_tel)}">Llamar a ${esc(p.tutor_nombre || 'tutor')}</a>` : ''}</div>`).join('')}</div>` : '<div class="empty">Todas las jugadoras están dentro de Casa Club ✓</div>'}` };
  }
  if (tab === 'conteo') {
    const l = await api('/conteo'), dentro = l.filter((j) => !j.fuera);
    sel = new Set([...sel].filter((id) => dentro.some((j) => j.id === id)));
    return { html: `<h2>Conteo nocturno</h2><p class="muted">Recorre las habitaciones y marca a cada jugadora que veas dentro. Las que están afuera con permiso no se cuentan.</p>
      <div class="sticky-bar"><progress id="prog" max="${dentro.length}" value="${sel.size}"></progress><div class="row between"><b id="cnt">${sel.size} de ${dentro.length} localizadas</b><button class="btn gold" data-act="conteoOk">Registrar conteo</button></div></div>
      <div class="list cols">${l.map((j) => j.fuera ? `<div class="chk off"><span class="grow"><b>${esc(j.nombre)}</b><br><small>Afuera con permiso · ${esc(j.destino || '')}</small></span><span class="badge gold">Afuera</span></div>`
        : `<label class="chk"><input type="checkbox" data-act="chk" data-id="${j.id}" ${sel.has(j.id) ? 'checked' : ''}><span class="grow"><b>${esc(j.nombre)}</b><br><small>${j.habitacion ? 'Hab. ' + esc(j.habitacion) : ''}</small></span></label>`).join('')}</div>`, after: () => (dentroN = dentro.length) };
  }
  if (tab === 'visitas') {
    const vs = await api('/visitas');
    return { html: `<h2>Visitas</h2>${vs.length ? `<div class="list">${vs.map((v) => `<div class="card tight"><div class="row between"><b>${esc(v.visitante)}</b>${badge(v.estado, 1)}</div><small>Visita a ${esc(v.jugadora)} · ${esc(v.relacion || '')} · ${dt(v.fecha_at)}${v.entrada_at ? ` · entró ${hm(v.entrada_at)}` : ''}</small>
      ${v.estado === 'autorizada' ? `<button class="btn sm" data-act="visita" data-id="${v.id}" data-a="entrada">Registrar entrada</button>` : ''}${v.estado === 'dentro' ? `<button class="btn sm gold" data-act="visita" data-id="${v.id}" data-a="salida">Registrar salida</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">No hay visitas autorizadas para hoy.<br>Las visitas sin autorización de Coordinación no pueden entrar.</div>'}` };
  }
  if (tab === 'incid') {
    const is = await api('/incidencias');
    return { html: `<div class="sec"><h2>Incidencias</h2><button class="btn gold" data-act="incidencia">+ Reportar</button></div>${is.length ? `<div class="list">${is.map((i) => `<div class="card tight ${i.severidad === 'urgente' && i.estado === 'abierta' ? 'late' : ''}"><div class="row between"><b>${esc(i.tipo.replace('_', ' '))}${i.jugadora ? ' · ' + esc(i.jugadora) : ''}</b><span class="row">${sev(i.severidad)}${badge(i.estado)}</span></div><p>${esc(i.descripcion)}</p><small>${dt(i.creado_at)}${i.resolucion ? ' · Resolución: ' + esc(i.resolucion) : ''}</small></div>`).join('')}</div>` : '<div class="empty">Sin incidencias recientes.</div>'}` };
  }
  const d = await api('/dashboard');
  return { html: `<h2>Acceso</h2><div class="stats"><button class="stat" data-act="tab" data-t="conteo"><b>${d.total - d.fuera}</b><span>Dentro</span></button><button class="stat" data-act="tab" data-t="fuera"><b>${d.fuera}</b><span>Afuera</span></button><button class="stat ${d.atrasadas ? 'alert' : ''}" data-act="tab" data-t="fuera"><b>${d.atrasadas}</b><span>Atrasadas</span></button><button class="stat" data-act="tab" data-t="visitas"><b>${d.visitas_dentro}</b><span>Visitas dentro</span></button></div>
    <div id="cam"></div><button class="btn big gold" data-act="cam">${ic('qr')} Escanear QR</button><div id="res">${found ? verdict(found) : ''}</div>
    <div class="card"><label>O busca por nombre<input id="q" type="search" placeholder="Nombre de la jugadora" autocomplete="off"></label><div id="hits" class="list"></div></div>`,
  after: async () => {
    jugs = jugs.length ? jugs : await api('/jugadoras');
    $('#q').oninput = (e) => { const v = e.target.value.toLowerCase().trim(); $('#hits').innerHTML = v ? jugs.filter((j) => j.activa && j.nombre.toLowerCase().includes(v)).slice(0, 6).map((j) => `<button class="btn ghost" data-act="pick" data-id="${j.id}">${esc(j.nombre)}${j.habitacion ? ' · ' + esc(j.habitacion) : ''}</button>`).join('') || '<small>Sin resultados</small>' : ''; };
  } };
}

Object.assign(ACT, {
  async cam() {
    if (stream) { stop(); $('#cam').innerHTML = ''; return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { return toast('No se pudo abrir la cámara. Usa la búsqueda por nombre.'); }
    $('#cam').innerHTML = '<div class="scanner"><video playsinline muted aria-label="Cámara para escanear QR"></video></div>';
    const v = $('#cam video'), c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    v.srcObject = stream; await v.play();
    const tick = async () => {
      if (!stream) return;
      if (v.videoWidth) {
        c.width = v.videoWidth; c.height = v.videoHeight; x.drawImage(v, 0, 0);
        const code = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (code?.data.startsWith('CCF:')) {
          stop(); $('#cam').innerHTML = ''; navigator.vibrate?.(60);
          try { found = await api('/scan/' + encodeURIComponent(code.data)); } catch (e) { toast(e.message); found = null; }
          $('#res').innerHTML = found ? verdict(found) : ''; $('#res').scrollIntoView({ behavior: 'smooth' }); return;
        }
      }
      setTimeout(tick, 150);
    };
    tick();
  },
  async pick({ id }) { found = await api(`/jugadoras/${id}/situacion`); $('#res').innerHTML = verdict(found); $('#res').scrollIntoView({ behavior: 'smooth' }); },
  async mov({ id, tipo }) {
    const r = await api('/mov', 'POST', { jugadora_id: +id, tipo }), j = found; found = null;
    $('#res').innerHTML = `<div class="verdict ok"><h2>${tipo === 'salida' ? 'Salida registrada' : 'Regreso registrado'}</h2><div class="who">${esc(j.nombre)}</div><p>${hm(Date.now())}</p>
      ${r.whatsapp ? `<a class="btn wa" target="_blank" rel="noopener" href="${r.whatsapp}">Avisar al tutor por WhatsApp</a>` : '<p class="muted">Sin teléfono de tutor registrado.</p>'}<button class="btn ghost" data-act="tab" data-t="scan">Siguiente</button></div>`;
  },
  chk({ id }, b) { b.checked ? sel.add(+id) : sel.delete(+id); const n = dentroN; $('#prog').value = sel.size; $('#cnt').textContent = `${sel.size} de ${n} localizadas`; },
  async conteoOk() {
    const l = await api('/conteo'), faltan = l.filter((j) => !j.fuera && !sel.has(j.id));
    if (faltan.length && !(await sure(`${faltan.length} sin localizar`, `Se generará una alerta URGENTE para: ${faltan.map((j) => j.nombre).join(', ')}.`, 'Registrar y alertar'))) return;
    const r = await api('/conteo', 'POST', { presentes: [...sel] }); sel = new Set();
    toast(r.ausentes.length ? 'Conteo registrado con alertas' : 'Conteo completo ✓'); st.rerender();
  },
  async visita({ id, a }) {
    const doc = a === 'entrada' ? await ask('Entrada de visita', 'Documento revisado', { placeholder: 'INE, pasaporte…', ok: 'Registrar entrada' }) : '';
    if (doc === null) return; await api(`/visitas/${id}/${a}`, 'POST', { documento: doc }); toast(a === 'entrada' ? 'Entrada registrada' : 'Salida registrada'); st.rerender();
  },
  async incidencia({ jid, tipo }) {
    jugs = jugs.length ? jugs : await api('/jugadoras');
    modal(`<h2>Reportar incidencia</h2><label>Tipo<select name="tipo">${[['intento_salida', 'Intento de salida sin permiso'], ['visita', 'Visita / persona externa'], ['seguridad', 'Seguridad / acceso'], ['salud', 'Salud'], ['convivencia', 'Convivencia'], ['otro', 'Otro']].map(([k, l]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Gravedad<select name="severidad"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="urgente">Urgente (avisa ya a Coordinación)</option></select></label>
      <label>Jugadora (opcional)<select name="jugadora_id"><option value="">—</option>${jugs.filter((j) => j.activa).map((j) => `<option value="${j.id}" ${+jid === j.id ? 'selected' : ''}>${esc(j.nombre)}</option>`).join('')}</select></label>
      <label>¿Qué pasó?<textarea name="descripcion" required></textarea></label>${foot('Enviar reporte')}`,
    async (f, d) => { await api('/incidencias', 'POST', f); d.close(); toast('Incidencia enviada a Coordinación'); st.rerender(); });
  },
});
