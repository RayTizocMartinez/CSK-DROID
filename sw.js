/* Service worker: network first, cache as fallback.
   Visitors always get your newest upload when online, and the phone
   still opens offline with whatever they've already seen.
   You do NOT need to edit this when you add media. */
var CACHE = 'eclair-phone-v31';
var SHELL = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/content.js', './js/gallery-index.js', './js/os.js', './js/main.js',
  './js/apps/phone.js', './js/apps/messages.js', './js/apps/gallery.js', './js/apps/settings.js', './js/apps/wallpaper.js', './js/apps/podstack.js', './js/apps/flappynick.js', './js/apps/match3.js', './js/apps/flyer.js', './js/apps/jar.js', './js/apps/maps.js', './js/apps/characters.js', './js/apps/nickrun.js', './js/apps/sled.js', './js/apps/balloons.js', './js/apps/topple.js', './js/apps/clikcok.js', './js/apps/barkpod.js', './js/apps/csktcg.js', './js/apps/promptmachine.js', './js/cards.js', './js/tcg-engine.js', './js/tcg-core.js', './js/lib/matter.min.js', './js/prompts-data.js', './js/prompts.js',
  './media/app-icon/icon-192.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.headers.get('range')) return;              // audio/video streaming: let the browser handle it
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok && res.status === 200 && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(r, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(r).then(function (m) { return m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()); });
  }));
});
