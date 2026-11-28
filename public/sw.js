// Keeps the app's own files on the phone so it opens fast on a weak signal.
// Only the app shell is cached: client data always comes from the database
// and is never stored here.
const CACHE = 'tr-field-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // database calls go straight through
  if (e.request.mode === 'navigate') {
    // The page itself: newest version when online, saved copy when not.
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('/', c)); return r; }).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Built files have a fingerprint in their name, so a saved copy is always right.
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })));
  }
});

// Notifications from the office: show them, and open the right screen on tap.
self.addEventListener('push', e => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch (x) { n = { title: 'Turn & River', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(n.title || 'Turn & River', {
    body: n.body || '', icon: '/icon-192.png', badge: '/favicon-32.png', tag: n.tag || undefined, renotify: !!n.tag,
    data: { url: n.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    if (open) { open.postMessage({ go: new URL(url, location.origin).searchParams.get('go') || '' }); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
