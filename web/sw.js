// Minimaler Service Worker: App-Shell offline, Kartenkacheln network-first.
const C = 'on2ueats-v0.2';
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(['./index.html', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin === location.origin) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
