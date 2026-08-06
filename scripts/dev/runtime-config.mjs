// The runtime configuration both applications look for, built in memory.
//
// The apps each load an optional, git-ignored config file:
//
//   config/config.local.js            index.html, via <script … onerror="void 0">
//   document-portal/config.local.js   every portal page, same handler
//
// The dev server ANSWERS for those paths rather than writing them. Three things follow,
// and the third is why this exists rather than being a tidiness preference:
//
//   1. Nothing is created inside the repository. No gitignore entry, no `git status`
//      noise, nothing to clean up, and no generated file to accidentally commit.
//
//   2. A real config.local.js holding rotated Power Automate URLs cannot be clobbered —
//      the server checks disk first and serves the file if it is there.
//
//   3. The repository's own browser suite becomes deterministic. Several of its tests
//      reach a governed action, and `core/data-client.js` throws "Endpoint … is not
//      configured" BEFORE the flow-confirmation gate those tests wait for. So they pass
//      only when endpoints happen to be configured — which, with a git-ignored file, meant
//      passing on a machine where someone had run setup and failing on a clean checkout.
//      Serving the config makes "the dev server is running" sufficient.

import { EndpointKeys } from '../../config/endpoints.config.js';

/**
 * Origin-relative on purpose.
 *
 * An absolute `http://127.0.0.1:8080` looks harmless and is not: a browser that reached
 * the page as `localhost:8080` then treats every API call as cross-origin, and CORS blocks
 * the lot for no reason but which spelling of loopback was typed. A path works from
 * whatever hostname the page was opened with, and this server hosts both apps, so the API
 * is always same-origin.
 */
export const API_BASE = '/api';

/**
 * The portal's flow names, and the local route that answers each one.
 *
 * These are the six keys `document-portal/js/core.js` resolves and the six
 * `document-portal/config.example.js` ships. The routes are the ones
 * `scripts/dev/intake.mjs` handles — the pairing is the whole contract, so it lives in one
 * table rather than being spelled out twice.
 */
const PORTAL_ROUTES = Object.freeze([
  ['SUBMISSION', '/intake/submission'],
  ['UPLOAD', '/intake/upload'],
  ['SUPPORT', '/intake/support'],
  ['VERIFY', '/intake/verify'],
  ['VERIFY_CONFIRM', '/intake/verify-confirm'],
  ['STATUS', '/intake/status'],
]);

/** `window.DGO_CONFIG` — the operations platform. */
export function appConfigScript(apiBase = API_BASE) {
  const endpoints = EndpointKeys.reduce((acc, key) => {
    acc[key] = `${apiBase}/dgo/${key}`;
    return acc;
  }, {});

  /* SCAN_INTAKE is configured but is not an EndpointContracts key, so it is absent from
     EndpointKeys. It is a raw-bytes PUT rather than a JSON POST, which is why it has its own
     route; without it here core/scan-intake-service.js reports itself unconfigured and
     Registry Scan Intake cannot be exercised locally. */
  endpoints.SCAN_INTAKE = `${apiBase}/documents/scan`;

  return `/* Served from memory by scripts/dev-server.mjs — this file does not exist on disk.
 *
 * It carries no credential; the dev server has none to hold. Under any other server this
 * path 404s, index.html absorbs that via onerror, and the platform behaves exactly as it
 * does on a clean checkout.
 *
 * Assigned only when nothing has set DGO_CONFIG already, so a harness that injects its own
 * configuration before this script runs keeps what it injected.
 */
window.DGO_CONFIG = window.DGO_CONFIG || {
  endpoints: ${JSON.stringify(endpoints, null, 4).replace(/\n/g, '\n  ')},

  auth: {
    /* Left FALSE deliberately.
     *
     * Turning it on makes the client acquire an Entra token and send a bearer header, and
     * this server has no tenant to validate one against — the app would sit at a sign-in it
     * cannot complete. Local development runs in the development posture the platform
     * already ships with: local profile, advisory RBAC, no token. Nothing is enforced.
     */
    enabled: false,
  },
};
`;
}

/**
 * `window.PF_CONFIG` — the public document portal.
 *
 * The portal resolves every call through `PF_CONFIG.endpoints[NAME]`, one URL per flow — the
 * shape `document-portal/config.example.js` documents. Leaving `SUBMISSION` unset is what
 * puts the portal in demo mode, where nothing is transmitted; naming each route here points
 * it at the local backend instead, so a letter submitted on the portal lands in the same
 * registry the operations platform reads.
 */
export function portalConfigScript(apiBase = API_BASE) {
  const endpoints = PORTAL_ROUTES.reduce((acc, [key, route]) => {
    acc[key] = `${apiBase}${route}`;
    return acc;
  }, {});

  return `/* Served from memory by scripts/dev-server.mjs — this file does not exist on disk.
 *
 * It carries no credential; the dev server has none to hold. Under any other server this
 * path 404s, the portal pages absorb that via onerror, and the portal falls back to demo
 * mode exactly as it does on a clean checkout.
 *
 * Assigned only when nothing has set PF_CONFIG already — the repository's portal tests
 * inject their own before page scripts run, and must keep it.
 */
window.PF_CONFIG = window.PF_CONFIG || {
  endpoints: ${JSON.stringify(endpoints, null, 4).replace(/\n/g, '\n  ')}
};
`;
}

/**
 * Paths answered from memory.
 *
 * `index.html` asks for `config/config.local.js`. The portal pages ask for
 * `config.local.js` relative to their own directory — `/portal/config.local.js` under this
 * server's mount, and `/document-portal/config.local.js` when they are opened at their
 * real path, which is what the repository's own suite does.
 */
export const VIRTUAL_CONFIGS = Object.freeze({
  '/config/config.local.js': appConfigScript,
  '/portal/config.local.js': portalConfigScript,
  '/document-portal/config.local.js': portalConfigScript,
});
