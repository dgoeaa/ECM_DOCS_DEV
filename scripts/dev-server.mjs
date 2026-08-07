#!/usr/bin/env node
// DGO local development server.
//
// One process, one origin, no dependencies. It serves both applications and answers every
// endpoint they call, so the platform runs end to end with nothing installed and nothing
// provisioned: no Power Automate, no SharePoint, no Cloudflare, and no identity provider.
//
//   http://127.0.0.1:8080/          the operations platform
//   http://127.0.0.1:8080/portal/   the public document portal
//   http://127.0.0.1:8080/api/…     the endpoints both of them call
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS NOT
//
// It is not the production backend and it is not a replacement for one. It validates no
// token, maps no role and authorizes no action — it answers whatever it is asked. That is
// acceptable on a loopback interface during development and is a wide-open door anywhere
// else, which is why this binds to 127.0.0.1 and refuses to start in production.
//
// In production there is no intermediary at all: the browser calls each Power Automate flow
// directly, and every flow authenticates and authorizes its own callers. That enforcement is
// the flow's, not this file's. See docs/deployment/LOCAL-DEV.md for what changes between
// local development and a real deployment.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from './dev/store.mjs';
import { handleContract, DEV_OTP } from './dev/endpoints.mjs';
import { handleIntake, handleScan, DEV_VERIFY_CODE, LIMITS } from './dev/intake.mjs';
import { VIRTUAL_CONFIGS, API_BASE } from './dev/runtime-config.mjs';
import { EndpointKeys } from '../config/endpoints.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = Number(process.env.PORT || 8080);
/* `localhost` rather than the literal 127.0.0.1, so the bound address is whatever this
   machine resolves localhost to — the same answer the browser will get. Pinning the
   literal binds IPv4 only, and on a host that resolves localhost to ::1 the page then
   fails to connect at the address the banner just printed. */
const HOST = process.env.DGO_DEV_HOST || 'localhost';
/* Outside the repository, deliberately. Writing it into the checkout means a gitignore
   entry, a directory that shows up in `git status`, and eventually one that gets committed.
   Keyed by the checkout's path so two clones do not share one registry. */
const DATA_FILE = process.env.DGO_DEV_DATA || path.join(
  os.tmpdir(),
  `dgo-dev-store-${Buffer.from(ROOT).toString('base64url').slice(-16)}`,
  'store.json',
);

/* A development server that answers every governed request without checking anything has
   no business running in production, and the failure mode if it did would be silent. */
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to start: NODE_ENV=production. This server enforces no authentication.\n' +
                'In production the browser calls the flows directly and each flow enforces its\n' +
                'own authentication — see docs/deployment/LOCAL-DEV.md.');
  process.exit(1);
}
if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !process.env.DGO_DEV_ALLOW_EXPOSE) {
  console.error(`Refusing to bind ${HOST}: this server authenticates nobody, so exposing it puts an\n` +
                'open write path to the registry on the network. Set DGO_DEV_ALLOW_EXPOSE=1 if you\n' +
                'genuinely intend that on a trusted, isolated network.');
  process.exit(1);
}

/* `--reset` deletes the store and exits. It lives here so the store's location is computed
   in exactly one place — an npm script that hardcoded a path would silently miss it the
   moment the default moved, which is how you end up "resetting" data that never changes. */
if (process.argv.includes('--reset')) {
  fs.rmSync(path.dirname(DATA_FILE), { recursive: true, force: true });
  console.log(`Dev store cleared: ${DATA_FILE}\nIt is reseeded on the next start.`);
  process.exit(0);
}

const store = createStore({ file: DATA_FILE });

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8',
};

function serveStatic(urlPath, res) {
  // Runtime config, answered from memory. These paths deliberately do not exist on disk —
  // see dev/runtime-config.mjs. Checked before the filesystem, but yielding to a real file
  // if one is there, so a config holding rotated Power Automate URLs is never shadowed.
  const generate = VIRTUAL_CONFIGS[urlPath];
  if (generate && !fs.existsSync(path.join(ROOT, urlPath))) {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-DGO-Dev-Server': 'generated',
    });
    return res.end(generate(API_BASE));
  }

  // The portal is mounted at /portal/ so both apps share one origin. Same-origin means the
  // portal's fetches are not cross-origin requests, which removes CORS from the picture
  // entirely rather than configuring it.
  let rel = urlPath === '/portal' || urlPath === '/portal/'
    ? 'document-portal/index.html'
    : urlPath.startsWith('/portal/')
      ? 'document-portal/' + urlPath.slice('/portal/'.length)
      : urlPath.replace(/^\/+/, '') || 'index.html';

  const full = path.resolve(ROOT, rel);
  // Containment check: a request path must never escape the repository root.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  let target = full;
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`Not found: ${urlPath}`);
  }

  fs.readFile(target, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`Not found: ${urlPath}`);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      // No caching: a dev server that serves a stale module costs more time than it saves.
      'Cache-Control': 'no-store',
      'X-DGO-Dev-Server': '1',
    });
    res.end(buf);
  });
}

// ---------------------------------------------------------------------------
// Body reading
// ---------------------------------------------------------------------------

const readBody = (req, { raw = false, maxBytes = 8 * 1024 * 1024 } = {}) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > maxBytes) { reject(new Error('payload_too_large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (raw) return resolve(buf);
    const text = buf.toString('utf8');
    if (!text) return resolve({});
    try { resolve(JSON.parse(text)); } catch { reject(new Error('invalid_json')); }
  });
  req.on('error', reject);
});

/* Reflected CORS on the API.
 *
 * The generated config is origin-relative, so in the normal setup nothing here is
 * cross-origin and these headers go unused. They exist for the split setup — static files
 * from one port, this server on another — and for the fact that `localhost:8080` and
 * `127.0.0.1:8080` are different origins to a browser, which is a confusing afternoon to
 * lose. Reflecting the origin on a loopback dev server that already answers anybody is not
 * a further concession; in production each flow decides its own origin policy. */
const corsHeaders = req => ({
  'Access-Control-Allow-Origin': req.headers.origin || '*',
  'Vary': 'Origin',
});

const json = (res, status, body, req) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-DGO-Dev-Server': '1',
    ...(req ? corsHeaders(req) : {}),
  });
  res.end(JSON.stringify(body));
};

// ---------------------------------------------------------------------------
// Request pipeline
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  /* PREFLIGHT.
     Same origin means no preflight in practice when the platform is served from here, but
     two callers are cross-origin and both matter: the ENDPOINT-CHECK.html workbench, served
     from wherever a package happens to be, and any harness pointing a built package at this
     server. A preflight this server refuses is indistinguishable from an unreachable host —
     the browser throws with no status and no body — so a header missing from the allow-list
     reads as "the flow is down".

     `Access-Control-Allow-Headers` is echoed from the request rather than enumerated. The
     enumerated list had already fallen behind: it named X-DGO-Filename, X-DGO-Sha256 and
     X-DGO-Size but not X-DGO-Probe, so every scan-intake probe from the workbench failed
     preflight and was reported as unreachable. Echoing cannot fall behind, and this is a
     development server bound to localhost that authenticates nobody — there is nothing here
     an allow-list would protect. A REAL flow must enumerate. */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers']
        || 'Content-Type, Authorization, X-Correlation-Id, X-Upload-Ticket, '
           + 'X-DGO-Filename, X-DGO-Sha256, X-DGO-Size, X-DGO-Probe',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  if (pathname === '/healthz') {
    const d = store.get();
    return json(res, 200, {
      ok: true,
      devServer: true,
      enforcesAuthentication: false,
      configuredEndpoints: EndpointKeys.length,
      unconfigured: [],
      records: {
        activities: d.activities.length, tracking: d.tracking.length,
        submissions: d.submissions.length, supportCases: d.supportCases.length,
        attachments: d.attachments.length, outbox: d.outbox.length,
      },
      store: store.file,
    }, req);
  }

  // Inspect what the platform "sent" — the emails, dispatches and actions that a real
  // deployment would have transmitted. Without this they vanish and a write looks like a
  // no-op, which is the single most confusing thing about running against a stub.
  if (pathname === '/api/dev/outbox') return json(res, 200, { outbox: store.get().outbox }, req);
  if (pathname === '/api/dev/audit') return json(res, 200, { audit: store.get().auditLog.slice(0, 200) }, req);
  if (pathname === '/api/dev/store') return json(res, 200, store.get(), req);
  if (pathname === '/api/dev/reset' && req.method === 'POST') {
    store.reset();
    return json(res, 200, { ok: true, reset: true, note: 'Store returned to the seeded dataset.' }, req);
  }

  if (!pathname.startsWith('/api/')) return serveStatic(pathname, res);

  const apiPath = pathname.slice('/api'.length);
  const isRawBody =
    req.method === 'PUT' && (apiPath === '/intake/upload' || apiPath === '/documents/scan');

  let body;
  try {
    body = await readBody(req, {
      raw: isRawBody,
      maxBytes: isRawBody ? LIMITS.maxScanBytes + 1024 : 8 * 1024 * 1024,
    });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message) }, req);
  }

  try {
    if (apiPath === '/documents/scan') {
      const out = handleScan(req.method, body, store, { headers: req.headers });
      return json(res, out.status, out.body, req);
    }

    if (apiPath.startsWith('/intake/')) {
      const out = handleIntake(apiPath, req.method, body, store, { headers: req.headers });
      if (out) return json(res, out.status, out.body, req);
      return json(res, 404, { ok: false, error: 'unknown_intake_route' }, req);
    }

    // Everything else is a contract key: POST /api/dgo/<KEY>
    const key = apiPath.split('/').filter(Boolean).pop() || '';
    const out = handleContract(key, body, store);
    return json(res, out.status, out.body, req);
  } catch (e) {
    console.error('[dev-server]', e);
    return json(res, 500, { ok: false, error: e.message }, req);
  }
});

server.listen(PORT, HOST, () => {
  const base = `http://${HOST}:${PORT}`;
  const d = store.get();
  console.log(`
  DGO local development server

    Operations platform   ${base}/
    Document portal       ${base}/portal/
    Health                ${base}/healthz
    Dev outbox            ${base}/api/dev/outbox

    Endpoints served      ${EndpointKeys.length} contract keys, plus /intake/* and /documents/scan
    Store                 ${store.file}
                          ${d.activities.length} records, ${d.tracking.length} tasks — outside the repository
    Step-up OTP           ${DEV_OTP}
    Portal email code     ${DEV_VERIFY_CODE}

    Reset the data        curl -X POST ${base}/api/dev/reset

  Nothing is written into the working tree: the runtime config is generated in
  memory and served, never saved. Stop this process and the checkout is unchanged.

  This server authenticates nobody and authorizes nothing. It is a development
  backend bound to ${HOST}. In production each Power Automate flow enforces its
  own authentication — see docs/deployment/LOCAL-DEV.md.
`);
});

const shutdown = async () => {
  await store.flush();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
