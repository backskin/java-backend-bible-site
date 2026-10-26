const CACHE = 'jbb-20261026093053';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'glossary.js', 'search-index.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'fonts/lora-cyr-italic.woff2', 'fonts/lora-cyr.woff2', 'fonts/lora-lat-italic.woff2', 'fonts/lora-lat.woff2', 'fonts/mono-cyr-italic.woff2', 'fonts/mono-cyr.woff2', 'fonts/mono-lat-italic.woff2', 'fonts/mono-lat.woff2', 'fonts/plex-cyr-italic.woff2', 'fonts/plex-cyr.woff2', 'fonts/plex-lat-italic.woff2', 'fonts/plex-lat.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(f => new Request(f, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('jbb-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // метки ?v= у стилей и скриптов нужны HTTP-кэшу браузера; внутри одной сборки кэш и так согласован
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
