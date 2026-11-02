// Casa Club Acceso — SPA sin build. Roles: jugadora · seguridad · coordinacion · tutor (enlace /#/p/TOKEN)
import { $, esc, ACT, st, api, toast, guard, dt, ic, modal } from './ui.js';
import * as jugadora from './v-jugadora.js';
import * as seguridad from './v-seguridad.js';
import * as coord from './v-coord.js';

const app = $('#app');
const ROLES = { jugadora, seguridad, coordinacion: coord };
const MAX_TABS = 5; // iOS: la barra inferior admite hasta 5; si hay más, 4 + «Más»
let timer = null, io = null, hasLogo = false;
const logoReady = fetch('/brand/logo.png', { method: 'HEAD' }).then((r) => { hasLogo = r.ok; }).catch(() => {});

st.onLogout = () => { localStorage.removeItem('cc'); st.S = null; st.tab = null; seguridad.stop(); location.hash = ''; render(); };
st.rerender = () => render();
ACT.logout = () => st.onLogout();
ACT.tab = ({ t }) => { st.tab = t; seguridad.stop(); render(); scrollTo(0, 0); };
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !ACT[b.dataset.act]) return;
  b.classList.add('loading');
  Promise.resolve(guard(ACT[b.dataset.act])(b.dataset, b)).finally(() => b.classList.remove('loading')); // evita doble toque (doble registro)
});

const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v6c0 4.3 3 7.4 7.5 9 4.5-1.6 7.500-4.7 7.500-9V6z"/><path d="m9 12 2 2 4-4"/></svg>';
const logo = () => `<span class="logo" aria-hidden="true">${hasLogo ? '<img src="/brand/logo.png" alt="">' : SHIELD}</span>`;
const iniciales = (n) => n.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

// Cuenta: hoja con acciones (como el menú de perfil en iOS)
ACT.cuenta = () => {
  const push = st.S.rol !== 'jugadora' && 'PushManager' in window && Notification.permission !== 'granted';
  const d = modal(`<h2>${esc(st.S.nombre)}</h2><p class="muted">${{ jugadora: 'Jugadora', seguridad: 'Seguridad', coordinacion: 'Coordinación' }[st.S.rol]}</p>
    <div class="list menu">${push ? `<button type="button" data-act="alertas">${ic('bell')}<span class="grow">Activar alertas</span>${ic('chev').replace('class="ic"', 'class="ic chev"')}</button>` : ''}<button type="button" data-act="pin">${ic('cog')}<span class="grow">Cambiar PIN</span>${ic('chev').replace('class="ic"', 'class="ic chev"')}</button><button type="button" class="red" data-act="logout">${ic('out')}<span class="grow">Cerrar sesión</span></button></div>
    <button type="button" class="btn ghost" data-act="cerrar">Listo</button>`, () => {});
  d.addEventListener('click', (e) => { if (e.target.closest('[data-act=logout],[data-act=pin],[data-act=alertas]')) d.close(); });
};
ACT.alertas = () => ACT.push();

function shell(inner, role, badges = {}) {
  const R = ROLES[role];
  const many = R.tabs.length > MAX_TABS, primary = many ? R.tabs.slice(0, MAX_TABS - 1) : R.tabs, more = many ? R.tabs.slice(MAX_TABS - 1) : [];
  const inMore = st.tab === 'mas' || more.some(([k]) => k === st.tab), moreN = more.reduce((n, [k]) => n + (+badges[k] || 0), 0);
  const label = st.tab === 'mas' ? 'Más' : (R.tabs.find(([k]) => k === st.tab) || [])[1];
  const btn = ([k, l, i], cur, n, cls = 'tab') => `<button data-act="tab" data-t="${k}" ${cur ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${n ? `<span class="n" aria-label="${n} pendientes">${n}</span>` : ''}</button>`;
  app.innerHTML = `<div class="shell"><header class="top"><div class="left">${more.some(([k]) => k === st.tab) ? `<button class="back" data-act="tab" data-t="mas">${ic('chev')}Más</button>` : ''}${logo()}<span class="club">${esc(st.cfg.nombre_club || 'Casa Club Femenil')}</span></div><div class="ttl">${esc(label || '')}</div><div class="right"><button class="avatar" data-act="cuenta" aria-label="Cuenta de ${esc(st.S.nombre)}">${esc(iniciales(st.S.nombre))}</button></div></header>
  <nav class="side" aria-label="Secciones">${R.tabs.map((t) => btn(t, t[0] === st.tab, badges[t[0]])).join('')}</nav>
  <main id="main" tabindex="-1">${inner}</main>
  <nav class="tabbar" aria-label="Secciones"><div>${primary.map((t) => btn(t, t[0] === st.tab, badges[t[0]])).join('')}${many ? btn(['mas', 'Más', 'more'], inMore, moreN) : ''}</div></nav></div>`;
  // el título del nav bar aparece al salir de pantalla el título grande (como iOS)
  io?.disconnect(); const h = $('main h1, main h2');
  if (h) { io = new IntersectionObserver(([e]) => $('.top')?.classList.toggle('scrolled', !e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-56px 0px 0px 0px' }); io.observe(h); }
}
const masView = (role, badges) => ({ html: `<h2>Más</h2><div class="list menu">${ROLES[role].tabs.slice(MAX_TABS - 1).map(([k, l, i]) => `<button data-act="tab" data-t="${k}">${ic(i)}<span class="grow">${l}</span>${badges[k] ? `<span class="n">${badges[k]}</span>` : ''}${ic('chev').replace('class="ic"', 'class="ic chev"')}</button>`).join('')}</div>` });

function loginView(msg = '') {
  app.innerHTML = `<div class="center"><div class="brandmark">${logo()}<div><h1>${esc(st.cfg.nombre_club || 'Casa Club Femenil')}</h1><p>Control de acceso</p></div></div>
  <form id="f"><div class="fields"><input name="usuario" placeholder="Usuario o clave" aria-label="Usuario o clave" autocomplete="username" autocapitalize="none" autocorrect="off" required><input name="pin" type="password" placeholder="PIN" aria-label="PIN" inputmode="numeric" autocomplete="current-password" required></div>
  <p class="err" role="alert">${esc(msg)}</p><button class="btn big">Entrar</button></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const b = $('#f .btn'); b.classList.add('loading');
    try { const r = await api('/login', 'POST', Object.fromEntries(new FormData(e.target))); st.S = r; localStorage.setItem('cc', JSON.stringify(r)); st.tab = null; render(); }
    catch (er) { loginView(er.message); }
  };
}

async function tutorView(tok) {
  app.innerHTML = '<div class="center"><p class="muted">Cargando…</p></div>';
  let p; try { p = await api('/p/' + tok); } catch { app.innerHTML = '<div class="center"><div class="verdict bad"><h2>Enlace no válido</h2><p>Pide uno nuevo a Coordinación.</p></div></div>'; return; }
  const done = p.estado !== 'esperando_padres';
  app.innerHTML = `<div class="center"><div class="brandmark">${logo()}<div><p>Casa Club Femenil Tigres</p><h1>${esc(p.jugadora)} solicita ${p.tipo === 'pernocta' ? 'pasar la noche fuera' : 'permiso de salida'}</h1></div></div>
  <div class="list"><div class="card"><div class="row between"><span class="muted">Destino</span><b>${esc(p.destino)}</b></div></div><div class="card"><div class="row between"><span class="muted">Acompañante</span><b>${esc(p.acompanante)}</b></div></div>
  ${p.ubicacion ? `<div class="card"><div class="row between"><span class="muted">Lugar</span><b>${esc(p.ubicacion)}</b></div></div>` : ''}${p.motivo ? `<div class="card"><div class="row between"><span class="muted">Motivo</span><b>${esc(p.motivo)}</b></div></div>` : ''}
  <div class="card"><div class="row between"><span class="muted">Sale</span><b>${dt(p.salida_at)}</b></div></div><div class="card"><div class="row between"><span class="muted">Regresa</span><b>${dt(p.regreso_at)}</b></div></div></div>
  ${done ? `<div class="verdict ${p.estado === 'autorizado' ? 'ok' : 'warn'}"><h2>${p.decision === 'aprobado' ? 'Ya autorizaste' : p.decision ? 'Rechazada' : 'Ya no admite respuesta'}</h2></div>`
    : `<p class="muted" style="text-align:center">Al responder queda registrada la fecha y hora de tu decisión como constancia.</p><button class="btn big wa" data-act="tutor" data-d="aprobar">Autorizar salida</button><button class="btn big danger" data-act="tutor" data-d="rechazar">No autorizar</button>`}</div>`;
  ACT.tutor = async ({ d }) => { await api('/p/' + tok, 'POST', { decision: d }); tutorView(tok); };
}

async function render() {
  clearTimeout(timer); await logoReady;
  const m = location.hash.match(/^#\/p\/(.+)$/); if (m) return tutorView(m[1]);
  if (!st.S) { try { st.cfg = await api('/config'); } catch {} return loginView(); }
  const role = st.S.rol, R = ROLES[role];
  st.tab = st.tab === 'mas' || R.tabs.some(([k]) => k === st.tab) ? st.tab : R.tabs[0][0];
  try {
    st.cfg = await api('/config');
    const badges = await R.badges().catch(() => ({}));
    const v = st.tab === 'mas' ? masView(role, badges) : await R.view(st.tab);
    shell(v.html, role, badges); v.after?.();
  } catch (e) { if (st.S) toast(e.message); return; }
  // refresco automático de pantallas en vivo; no interrumpe formularios abiertos ni la cámara
  if (R.live?.includes(st.tab)) timer = setTimeout(function tick() {
    const busy = document.querySelector('dialog[open]') || seguridad.camOn() || document.activeElement?.matches?.('input,textarea,select');
    busy ? (timer = setTimeout(tick, 5000)) : render();
  }, 30000);
}
addEventListener('hashchange', render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
render();
