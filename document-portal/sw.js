/* NITDA Intelligent Portal — offline shell.
   Cache-first for the application shell, network-first for navigations so a
   redeployed build is picked up on the next online visit. */
const CACHE = 'nitda-portal-v2';
const SHELL = [
  './', './index.html', './submit.html', './track.html', './support.html', './admin.html', './404.html',
  './portal.css', './favicon.svg', './manifest.webmanifest',
  './ds/ds.css', './ds/colors_and_type.css',
  './ds/tokens/tokens.primitive.css', './ds/tokens/tokens.semantic.css',
  './ds/tokens/tokens.theme-light.css', './ds/tokens/tokens.theme-dark.css',
  './ds/tokens/tokens.theme-hc.css', './ds/tokens/tokens.component.css',
  './ds/tokens/tokens.density.css',
  './ds/styles/reset.css', './ds/styles/base.css', './ds/styles/layout.css',
  './ds/styles/components.css', './ds/styles/components/command-palette.css',
  './ds/fonts/CascadiaMono-Regular.woff2',
  './ds/logo/mark.svg', './ds/logo/nitda-endorsed.svg',
  './js/icons.js', './js/data.js', './js/core.js', './js/home.js',
  './js/submit.js', './js/track.js', './js/support.js', './js/admin-panels.js', './js/admin.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return r;
  }).catch(() => hit)));
});
