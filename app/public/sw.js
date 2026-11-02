// Service worker solo para notificaciones push en web (la app no se guarda en caché aquí: siempre en vivo).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'Casa Club', { body: d.body, tag: d.tag, data: { ruta: d.ruta || '/' }, icon: '/icon-192.png', badge: '/icon-192.png', requireInteraction: /urgente|alerta|retraso/i.test(d.title || '') }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const ruta = (e.notification.data && e.notification.data.ruta) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((l) => { if (l[0]) { l[0].navigate(ruta); return l[0].focus(); } return self.clients.openWindow(ruta); }));
});
