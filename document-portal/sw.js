/* NITDA Intelligent Portal — offline shell.
   Cache-first for the application shell, network-first for navigations so a
   redeployed build is picked up on the next online visit. */
/* Asset requests below are cache-first, so a stale entry survives a redeploy: rotating a
   signature without changing the cache name leaves returning visitors pinned to an endpoint
   that no longer exists — still calling a URL that has just been revoked, which is the one
   failure rotation exists to prevent.

   That used to depend on a human remembering to bump a constant. It no longer does.
   `scripts/package.mjs` rewrites BUILD with the package's build id, which is a digest of the
   provisioned endpoint set: rotate a signature and the id necessarily changes, so the cache
   is necessarily new. BUILD stays 'dev' in the working tree, where the endpoints come from a
   git-ignored file and no deployment is being replaced.

   The packager fails the build if this line stops matching the shape it rewrites. */
const BUILD = 'dev';
const CACHE = 'nitda-portal-v6-' + BUILD;

/* The endpoint configuration is never served from cache while the network is reachable.
   Cache-first on this file was the second half of the same defect: it is the file holding
   the trigger URLs, and a cached copy outlives the tab, the deployment and the rotation. It
   is still cached as a fallback, because a URL is only ever used online — so a stale copy
   can never be the one that gets called, and an offline visitor keeps the behaviour they
   had. */
const CONFIG_PATH = /(?:^|\/)config\.local\.js$/;

/* js/data.js is deliberately NOT precached. It once carried the signed workflow endpoints
   and precaching wrote them durably into Cache Storage, where they outlived the tab. Step 5
   removed the endpoints from it, but keeping it out of the install shell is still right: it
   is the file most likely to change with registry reference data, and a cache-first copy of
   a stale correspondence taxonomy is the wrong thing to serve offline.

   admin.html, js/admin.js and js/admin-panels.js are gone entirely — the staff console was
   retired in step 6 (TARGET_ARCHITECTURE.md §3.4). Leaving them listed here would make
   install() fail on the addAll, taking the whole offline shell down with it. */
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
  './js/submit.js', './js/track.js', './js/support.js'
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
  if (CONFIG_PATH.test(new URL(req.url).pathname)) {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return r;
  }).catch(() => hit)));
});
