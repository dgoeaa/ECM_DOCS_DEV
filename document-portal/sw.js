/* NITDA Intelligent Portal — offline shell.
   Cache-first for the application shell, network-first for navigations so a
   redeployed build is picked up on the next online visit. */
/* Cache version. BUMP THIS whenever a cached file's contents change in a way that must not
   persist on a visitor's device.
   v3: js/data.js previously carried three SAS-signed Power Automate URLs and is cached
   here cache-first. Without a version bump, every browser that had already visited the
   portal would keep serving the credential-bearing copy from Cache Storage indefinitely —
   the activate handler below deletes every cache whose key is not the current one. */
const CACHE = 'nitda-portal-v3';
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
  './ds/logo/nitda-symbol.png', './ds/logo/nitda-lockup.png', './ds/logo/nitda-lockup-white.png',
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
