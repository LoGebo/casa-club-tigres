// Shell offline mínimo; la API nunca se cachea (los registros deben ser siempre en vivo).
const C = 'cc-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(['/', '/styles.css', '/app.js', '/ui.js', '/v-jugadora.js', '/v-seguridad.js', '/v-coord.js', '/vendor/jsQR.js', '/icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/') || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(C).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('push', (e) => { const d = e.data?.json() || {}; e.waitUntil(self.registration.showNotification(d.title || 'Casa Club', { body: d.body, tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', requireInteraction: /urgente|alerta|retraso/i.test(d.title || '') })); });
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(clients.matchAll({ type: 'window' }).then((l) => (l[0] ? l[0].focus() : clients.openWindow('/')))); });
