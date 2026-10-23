const CACHE = 'jbb-20261023092010';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('jbb-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function put(req, res) {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    const net = fetch(req).then(r => put(req, r));
    const timeout = new Promise(ok => setTimeout(ok, 3000));
    e.respondWith(Promise.race([net, timeout.then(() => caches.match(req))])
      .then(r => r || net)
      .catch(() => caches.match(req, {ignoreSearch: true}))
      .then(r => r || caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => put(req, r)).catch(() => hit);
    return hit || net;
  }));
});
