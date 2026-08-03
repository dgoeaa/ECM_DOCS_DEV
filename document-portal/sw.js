/* NITDA Intelligent Portal — offline shell.
   Cache-first for the application shell, network-first for navigations so a
   redeployed build is picked up on the next online visit. */
/* Bump CACHE on every release, and ALWAYS when the workflow endpoints are rotated.
   Asset requests below are cache-first, so a stale entry survives a redeploy: rotating a
   signature without bumping this constant leaves returning visitors pinned to an endpoint
   that no longer exists. */
const CACHE = 'nitda-portal-v4';

/* js/data.js is deliberately NOT precached — it carries the workflow endpoints, and
   precaching wrote them durably into Cache Storage where they outlived the tab.
   admin.html is deliberately NOT precached either: it is the staff console, robots.txt
   excludes it, and there is no reason to make it available offline. Both are still fetched
   normally on demand; they are simply not persisted by the install step. */
const SHELL = [
  './', './index.html', './submit.html', './track.html', './support.html', './404.html',
  './portal.css', './favicon.svg', './manifest.webmanifest',
  './ds/ds.css', './ds/colors_and_type.css',
  './ds/tokens/tokens.primitive.css', './ds/tokens/tokens.semantic.css',
  './ds/tokens/tokens.theme-light.css', './ds/tokens/tokens.theme-dark.css',
  './ds/tokens/tokens.theme-hc.css', './ds/tokens/tokens.component.css',
  './ds/tokens/tokens.density.css',
  './ds/styles/reset.css', './ds/styles/base.css', './ds/styles/layout.css',
  './ds/styles/components.css', './ds/styles/components/command-palette.css',
  './ds/fonts/CascadiaMono-Regular.woff2',
  './ds/logo/nitda-symbol.png', './ds/logo/nitda-lockup.png', './ds/logo/nitda-lockup-white.png',
  './js/icons.js', './js/core.js', './js/home.js',
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
