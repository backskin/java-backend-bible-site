const CACHE = 'jbb-20261027082347';
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
  // страницы глав — сначала из сети (3 с), иначе первый заход после выката показывает прошлую сборку;
  // без сети или при медленной сети — из кэша
  if (req.mode === 'navigate') {
    const net = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    const slow = new Promise(r => setTimeout(r, 3000)).then(() => caches.match(req, {ignoreSearch: true}));
    e.respondWith(Promise.race([net, slow.then(hit => hit || net)]).then(r => r || net)
      .catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || caches.match('index.html'))));
    return;
  }
  // метки ?v= у стилей и скриптов нужны HTTP-кэшу браузера; внутри одной сборки кэш и так согласован
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
