// Caches the app shell so it opens instantly. Playing still needs internet (phones connect to each other).
// Bump VERSION when files change.
const VERSION = 'bodega-v3';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/main.js', 'js/net.js', 'js/table.js', 'js/games/snyd.js', 'js/games/meyer.js', 'js/games/tiotusind.js', 'js/games/cards.js', 'js/games/prompts.js', 'js/games/hestelob.js', 'js/games/kongens-kop.js', 'js/games/mest-sandsynligt.js', 'js/games/jeg-har-aldrig.js', 'js/ui/common.js', 'js/ui/snyd.js', 'js/ui/meyer.js', 'js/ui/tiotusind.js', 'js/ui/hestelob.js', 'js/ui/kongens-kop.js', 'js/ui/mest-sandsynligt.js', 'js/ui/jeg-har-aldrig.js', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.startsWith('https://cdn'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
