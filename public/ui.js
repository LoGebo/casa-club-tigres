// Utilidades compartidas: sesión, API, formato, modales, iconos.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ACT = {}; // acciones por data-act
export const st = { S: JSON.parse(localStorage.getItem('cc') || 'null'), tab: null, cfg: {}, onLogout: () => {}, rerender: () => {} };

const L = 'es-MX';
export const dt = (ms) => new Date(ms).toLocaleString(L, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const hm = (ms) => new Date(ms).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' });
export const dia = (ms) => new Date(ms).toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long' });
export const mins = (ms) => { const m = Math.max(1, Math.round(ms / 6e4)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
export const localInput = (ms) => { const d = new Date(ms - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
export const hoyStr = () => localInput(Date.now()).slice(0, 10);
export const fromInput = (v) => new Date(v).getTime();

const ESTADO = { pendiente: ['Pendiente', 'warn'], esperando_padres: ['Esperando tutor', 'warn'], autorizado: ['Autorizado', 'ok'], rechazado: ['Rechazado', 'bad'], salio: ['Afuera', 'gold'], regreso: ['Regresó', ''], vencido: ['Vencido', 'bad'],
  autorizada: ['Autorizada', 'ok'], rechazada: ['Rechazada', 'bad'], dentro: ['Dentro', 'gold'], salio_v: ['Salió', ''], abierta: ['Abierta', 'bad'], atendida: ['Atendida', 'ok'], abierto: ['Abierto', 'warn'], en_proceso: ['En proceso', 'gold'], resuelto: ['Resuelto', 'ok'] };
export const badge = (e, vis) => { const x = ESTADO[vis && e === 'salio' ? 'salio_v' : e] || [e, '']; return `<span class="badge ${x[1]}">${x[0]}</span>`; };
export const sev = (s) => `<span class="badge ${{ urgente: 'bad', media: 'warn', baja: '' }[s] || ''}">${esc(s)}</span>`;

export function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800); }
export async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(st.S && { authorization: 'Bearer ' + st.S.token }) }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && st.S) { st.onLogout(); throw new Error('Tu sesión expiró. Entra de nuevo.'); }
  if (!r.ok) throw new Error(j.error || 'Algo salió mal');
  return j;
}
export const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

// Modal accesible (dialog nativo: foco atrapado, Esc cierra). onSubmit(datos, dlg) → lanzar Error para mostrar mensaje.
export function modal(html, onSubmit, { onOpen } = {}) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" novalidate>${html}<p class="err" role="alert"></p></form>`;
  document.body.append(d); d.showModal(); d.addEventListener('close', () => d.remove());
  const f = $('form', d);
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  f.onsubmit = async (e) => {
    e.preventDefault(); if (!f.reportValidity()) return;
    const b = $('button:not([type=button])', f); b?.classList.add('loading'); $('.err', d).textContent = '';
    try { await onSubmit(Object.fromEntries(new FormData(f)), d); } catch (er) { $('.err', d).textContent = er.message; } finally { b?.classList.remove('loading'); }
  };
  onOpen?.(d); $('input,select,textarea', d)?.focus();
  return d;
}
export const foot = (ok = 'Guardar') => `<div class="row"><button class="btn grow">${ok}</button><button type="button" class="btn ghost" data-act="cerrar">Cancelar</button></div>`;
ACT.cerrar = (_, b) => b.closest('dialog').close();
// Pregunta de una línea (reemplaza prompt()); devuelve texto o null
export const ask = (title, label, { required = true, ok = 'Confirmar', placeholder = '', hint = '' } = {}) => new Promise((res) => {
  let done = false;
  const d = modal(`<h2>${esc(title)}</h2>${hint ? `<p class="muted">${esc(hint)}</p>` : ''}<label>${esc(label)}<input name="v" ${required ? 'required' : ''} placeholder="${esc(placeholder)}" autocomplete="off"></label>${foot(ok)}`, (f, dlg) => { done = true; res(f.v?.trim() || ''); dlg.close(); });
  d.addEventListener('close', () => { if (!done) res(null); });
});
export const sure = (title, text, ok = 'Confirmar') => new Promise((res) => {
  let done = false;
  const d = modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p>${foot(ok)}`, (_, dlg) => { done = true; res(true); dlg.close(); });
  d.addEventListener('close', () => { if (!done) res(false); });
});

// Iconos (trazo, 24px)
const P = { scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10', out: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9', list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01', users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M16 5.1a3 3 0 0 1 0 5.8', home: 'M4 11l8-7 8 7M6 10v9h4v-5h4v5h4v-9', cal: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M4 10h16M8 3v4M16 3v4', bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4', alert: 'M12 4l9 16H3zM12 10v4M12 17h.01', tool: 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2', chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3', cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5q.1-.6.1-1.2', door: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14 12h.01', check: 'M5 12l5 5 9-10', more: 'M5 12h.01M12 12h.01M19 12h.01', chev: 'M9 6l6 6-6 6', qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2' };
export const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || P.list}"/></svg>`;

// Alertas push (opcional)
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
ACT.push = async () => {
  if ((await Notification.requestPermission()) !== 'granted') return toast('No se activaron las alertas');
  const { key } = await api('/push/key'), reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await api('/push/sub', 'POST', { sub: sub.toJSON() }); toast('Alertas activadas ✓'); st.rerender();
};
ACT.pin = () => modal(`<h2>Cambiar mi PIN</h2><label>PIN actual<input name="actual" type="password" inputmode="numeric" required autocomplete="current-password"></label><label>PIN nuevo (4 a 8 dígitos)<input name="nuevo" type="password" inputmode="numeric" pattern="\\d{4,8}" required autocomplete="new-password"></label>${foot()}`,
  async (f, d) => { await api('/pin', 'PATCH', f); d.close(); toast('PIN actualizado'); });
