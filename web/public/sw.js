// Minimaler Service Worker: App-Shell offline, sonst network-first.
// Nie gecacht: fremde Origins (Supabase-API, Storage, Kartenkacheln, Fonts).
const CACHE = 'on2ueats-shell-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nur eigene Origin. Supabase, OSM-Kacheln, Google Fonts gehen immer ans Netz.
  if (url.origin !== self.location.origin) return;

  // Navigation: Netz zuerst, sonst die gecachte Shell.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }

  // Gehashte Build-Assets: Cache zuerst, dann Netz und nachlegen.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  // Rest (Manifest, Icon): Netz zuerst, Cache als Reserve.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
