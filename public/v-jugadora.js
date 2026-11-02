import { esc, ACT, st, api, toast, dt, hm, dia, badge, modal, foot, localInput, fromInput, ic } from './ui.js';
export const tabs = [['inicio', 'Inicio', 'home'], ['permisos', 'Permisos', 'out'], ['visitas', 'Visitas', 'users'], ['servicios', 'Servicios', 'tool']];
export const live = ['inicio'];
export const badges = async () => ({});

const agendaHtml = (ag) => {
  const now = Date.now();
  return ag.length ? `<div class="tl">${ag.map((e) => `<div class="${e.inicio_at <= now && (e.fin_at || e.inicio_at + 36e5) >= now ? 'now' : ''}"><time>${hm(e.inicio_at)}</time><div><b>${esc(e.titulo)}</b><br><small>${esc(e.lugar || '')}${e.fin_at ? ` · hasta ${hm(e.fin_at)}` : ''}</small></div></div>`).join('')}</div>` : '<div class="empty">Nada programado hoy.</div>';
};

export async function view(tab) {
  if (tab === 'permisos') {
    const ps = await api('/permisos');
    return { html: `<div class="sec"><h2>Mis permisos</h2><button class="btn gold" data-act="nuevoPermiso">+ Solicitar</button></div>
      ${ps.length ? `<div class="list">${ps.map((p) => `<div class="card tight"><div class="row between"><b>${esc(p.destino)}</b>${badge(p.estado)}</div><small>${p.tipo === 'pernocta' ? 'Pernocta · ' : ''}${dt(p.salida_at)} → ${dt(p.regreso_at)} · con ${esc(p.acompanante)}</small>${p.estado === 'rechazado' && p.nota ? `<small>Motivo: ${esc(p.nota)}</small>` : ''}${p.estado === 'esperando_padres' ? '<small>Coordinación ya avisó a tu tutor. Falta su respuesta.</small>' : ''}${p.estado === 'autorizado' ? '<small>Muestra tu QR a Seguridad al salir y al regresar.</small>' : ''}</div>`).join('')}</div>` : '<div class="empty">Aún no has pedido permisos.<br>Toca “Solicitar” para empezar.</div>'}` };
  }
  if (tab === 'visitas') {
    const vs = await api('/visitas');
    return { html: `<div class="sec"><h2>Mis visitas</h2><button class="btn gold" data-act="nuevaVisita">+ Registrar</button></div><p class="muted">Registra con anticipación a quién esperas. Coordinación debe autorizarla y Seguridad la verá en la entrada.</p>
      ${vs.length ? `<div class="list">${vs.map((v) => `<div class="card tight"><div class="row between"><b>${esc(v.visitante)}</b>${badge(v.estado, 1)}</div><small>${esc(v.relacion || '')} · ${dt(v.fecha_at)}</small></div>`).join('')}</div>` : '<div class="empty">Sin visitas registradas.</div>'}` };
  }
  if (tab === 'servicios') {
    const ts = await api('/tickets'), C = { mantenimiento: 'Mantenimiento', lavanderia: 'Lavandería', medico: 'Médico', alimentos: 'Alimentos', otro: 'Otro' };
    return { html: `<div class="sec"><h2>Servicios</h2><button class="btn gold" data-act="nuevoTicket">+ Nueva solicitud</button></div><p class="muted">¿Se descompuso algo, necesitas lavandería o atención médica? Avísale a Coordinación desde aquí.</p>
      ${ts.length ? `<div class="list">${ts.map((t) => `<div class="card tight"><div class="row between"><b>${C[t.categoria]}</b>${badge(t.estado)}</div><p>${esc(t.descripcion)}</p>${t.respuesta ? `<small>Respuesta: ${esc(t.respuesta)}</small>` : ''}<small>${dt(t.creado_at)}</small></div>`).join('')}</div>` : '<div class="empty">Sin solicitudes.</div>'}` };
  }
  const [me, ag, av] = await Promise.all([api('/me'), api('/agenda'), api('/avisos')]);
  const f = me.fuera;
  return { html: `<div class="hero"><h1>Hola, ${esc(me.nombre.split(' ')[0])}</h1>
      <div class="status-chip"><span class="dot ${f ? '' : 'ok'}"></span>${f ? `Afuera · regresas a las ${hm(f.regreso_at)}` : 'Dentro de Casa Club'}</div></div>
    <div class="grid2"><div class="qrbox"><img alt="Mi código QR de acceso" src="/api/qr?d=${encodeURIComponent(me.qr)}"><b>Mi pase</b><small>Muéstralo a Seguridad al salir y al regresar</small></div>
    <div class="stack"><div class="sec"><h3>Hoy en casa club · ${dia(Date.now())}</h3></div><div class="card">${agendaHtml(ag)}</div></div></div>
    ${av.length ? `<h3>Avisos</h3><div class="list">${av.map((a) => `<div class="card tight ${a.fijo ? 'note' : ''}"><b>${esc(a.titulo)}</b>${a.cuerpo ? `<p>${esc(a.cuerpo)}</p>` : ''}<small>${dt(a.creado_at)}</small></div>`).join('')}</div>` : ''}
    <p class="muted">Sin permiso autorizado no es posible salir. Pídelo en la pestaña Permisos.</p>` };
}

ACT.nuevoPermiso = () => {
  const now = Date.now();
  modal(`<h2>Solicitar permiso</h2>
    <label>Tipo<select name="tipo"><option value="salida">Salida del día</option><option value="pernocta">Pernocta fuera</option></select></label>
    <label>Destino<input name="destino" required placeholder="Ej. Casa de mi familia"></label>
    <label>Lugar / dirección<input name="ubicacion" placeholder="Colonia, calle, referencia"></label>
    <label>¿Con quién vas?<input name="acompanante" required placeholder="Nombre y parentesco"></label>
    <label>Motivo<input name="motivo" placeholder="Opcional"></label>
    <div class="two"><label>Salida<input type="datetime-local" name="salida" required value="${localInput(now + 36e5)}"></label><label>Regreso<input type="datetime-local" name="regreso" required value="${localInput(now + 4 * 36e5)}"></label></div>${foot('Enviar solicitud')}`,
  async (f, d) => { await api('/permisos', 'POST', { ...f, salida_at: fromInput(f.salida), regreso_at: fromInput(f.regreso) }); d.close(); toast('Solicitud enviada a Coordinación'); st.rerender(); });
};
ACT.nuevaVisita = () => modal(`<h2>Registrar visita</h2><label>Nombre del visitante<input name="visitante" required></label><label>Relación<input name="relacion" placeholder="Mamá, tía, amiga…"></label><label>Fecha y hora<input type="datetime-local" name="fecha" required value="${localInput(Date.now() + 864e5)}"></label>${foot('Enviar')}`,
  async (f, d) => { await api('/visitas', 'POST', { ...f, fecha_at: fromInput(f.fecha) }); d.close(); toast('Visita enviada a Coordinación'); st.rerender(); });
ACT.nuevoTicket = () => modal(`<h2>Nueva solicitud</h2><label>Categoría<select name="categoria"><option value="mantenimiento">Mantenimiento</option><option value="lavanderia">Lavandería</option><option value="medico">Médico</option><option value="alimentos">Alimentos</option><option value="otro">Otro</option></select></label><label>¿Qué necesitas?<textarea name="descripcion" required></textarea></label>${foot('Enviar')}`,
  async (f, d) => { await api('/tickets', 'POST', f); d.close(); toast('Solicitud enviada'); st.rerender(); });
