const CACHE = 'jbb-20261112120610';
const CORE = ["./","index.html","glossary.json","manifest.webmanifest","icons/icon.svg","icons/icon-small.svg","icons/icon-192.png","_astro/BookmarkList.DMjnpeB2.js","_astro/ChapterMark.B5xISDFM.js","_astro/chrome.CPWptF55.js","_astro/client.BAnyAon0.js","_astro/client.ChiJXsfH.js","_astro/client.CzWaolnw.js","_astro/ClientRouter.astro_astro_type_script_index_0_lang.cRmvXsZP.js","_astro/dialog.w8MP7sLv.js","_astro/DocLayout.astro_astro_type_script_index_0_lang.DyqkwkIG.js","_astro/ImageCredit.Bnukzde-.css","_astro/index.astro_astro_type_script_index_0_lang.DUILZ7JO.js","_astro/index.taBZvwEL.css","_astro/jsx-runtime.CVFlYIZn.js","_astro/layout.Dbug_WQd.css","_astro/mono-cyr-italic.D480shVt.woff2","_astro/mono-cyr.Buze_B52.woff2","_astro/mono-lat-italic.IQ9T9Kz-.woff2","_astro/mono-lat.6fWv1k7M.woff2","_astro/page.CFYkGvk_.js","_astro/planCore.Bly-WcE1.js","_astro/planStore.nfpBdOJL.js","_astro/prefetch.ColS803j.js","_astro/PrepPlan.DNr-Ljod.js","_astro/ptsans-cyr-400-italic.Bz2mnFoX.woff2","_astro/ptsans-cyr-400.BgFH0IXl.woff2","_astro/ptsans-cyr-700.TNhnPAH_.woff2","_astro/ptsans-lat-400-italic.BbeYrS_i.woff2","_astro/ptsans-lat-400.Cwy9XeGQ.woff2","_astro/ptsans-lat-700.DmHhLLdt.woff2","_astro/ptserif-cyr-400-italic.Bicg0I0x.woff2","_astro/ptserif-cyr-400.B-euljER.woff2","_astro/ptserif-cyr-700-italic.DIh_UURn.woff2","_astro/ptserif-cyr-700.DvVvs_4R.woff2","_astro/ptserif-lat-400-italic.zg5EJ2cW.woff2","_astro/ptserif-lat-400.Cx0mQj7e.woff2","_astro/ptserif-lat-700-italic.1LPsH2tA.woff2","_astro/ptserif-lat-700.Bsuo9jes.woff2","_astro/react.C1eXT9gT.js","_astro/Refresh.IJ4jaPY8.js","_astro/rolldown-runtime.DN1TCW_I.js","_astro/Search.DEDoz9JE.js","_astro/tool.CudpdJvr.css","_astro/vacancy-refresh.CuGCwbXf.css"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jbb-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const store = (req, res) => {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // страница и ее содержимое для перехода без перезагрузки - сначала из сети, через 3 с - из кэша.
  // Из сети - со сверкой с сервером (no-cache): GitHub Pages разрешает браузеру 10 минут держать страницу
  // в своем кэше, и без сверки после публикации читатель видел бы прежнюю версию
  const page = req.mode === 'navigate' || /\.html$|\/$/.test(new URL(req.url).pathname);
  if (page) {
    const net = fetch(req, { cache: 'no-cache' }).then((res) => store(req, res));
    const slow = new Promise((r) => setTimeout(r, 3000)).then(() => caches.match(req, { ignoreSearch: true }));
    e.respondWith(Promise.race([net, slow.then((hit) => hit || net)]).then((r) => r || net)
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
});
