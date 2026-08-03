#!/usr/bin/env node
// Authenticating proxy — node:http host.
//
// One of several possible hosts for handler.js, which is transport-agnostic. Deploy this
// as a Container App or App Service, or call handleRequest() directly from an Azure
// Function. No hosting SDK is bound anywhere in this directory.

import http from 'node:http';
import { loadConfig, assertUsable } from './config.js';
import { createJwks } from './jwt.js';
import { handleRequest, createIdempotencyStore } from './handler.js';
import { createRateLimiter, createReferenceMinter, STATUS_LIMITS } from './intake.js';
import { createUploadBroker } from './upload.js';

const cfg = assertUsable(loadConfig());
const jwks = createJwks({ jwksUri: cfg.jwksUri });
const idempotency = createIdempotencyStore();

// Anonymous intake (TARGET_ARCHITECTURE.md §3.6). Both are in-memory and therefore
// per-instance: behind more than one replica the rate limit is N times more permissive
// than it reads, and two instances can mint the same reference. Back them with a shared
// store, or a front-door rate limit and the registry's own numbering, before scaling out.
const rateLimiter = createRateLimiter();
// Status reads get a separate, tighter budget. Sharing one limiter would let a guessing run
// spend the submission allowance, and would let a burst of legitimate lookups block a
// submission — the two operations have nothing to do with each other.
const statusRateLimiter = createRateLimiter({
  windowMs: STATUS_LIMITS.windowMs, perWindow: STATUS_LIMITS.perWindow,
});
const minter = createReferenceMinter({ prefix: cfg.intakeRefPrefix });

// Upload brokering is optional and fails CLOSED: without DGO_UPLOAD_SECRET no tickets are
// issued and PUT /intake/upload answers 503. Starting with unsigned tickets would be worse
// than starting without uploads.
let broker = null;
if (cfg.uploadSecret) {
  broker = createUploadBroker({ secret: cfg.uploadSecret });
} else {
  console.log(JSON.stringify({ event: 'proxy:upload-disabled', reason: 'DGO_UPLOAD_SECRET not set' }));
}

// Structured single-line JSON so any log pipeline can ingest it. §2.7 — the identity
// recorded here is always the token-derived one.
const audit = e => console.log(JSON.stringify(e));

/**
 * Read a request body.
 *
 * `raw` mode is for upload redemption: attachment bytes are binary and must not be
 * JSON-parsed or decoded to UTF-8, which would corrupt every non-text file. The cap
 * differs too — a metadata payload has no business being megabytes, while an attachment
 * legitimately is.
 */
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

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true, configuredEndpoints: cfg.configuredEndpoints.length,
      unconfigured: cfg.unconfiguredEndpoints, idempotencyEntries: idempotency.size(),
    }));
  }
  const path = new URL(req.url, 'http://x').pathname;
  const isUpload = req.method === 'PUT' && /^\/+intake\/+upload\/*$/.test(path);

  let body;
  try {
    body = isUpload
      ? await readBody(req, { raw: true, maxBytes: 32 * 1024 * 1024 })
      : await readBody(req);
  }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: String(e.message) }));
  }
  const out = await handleRequest(
    { method: req.method, path, headers: req.headers, body, remoteAddress: req.socket?.remoteAddress },
    { config: cfg, jwks, idempotency, audit, rateLimiter, statusRateLimiter, minter, broker }
  );
  res.writeHead(out.status, out.headers);
  res.end(JSON.stringify(out.body));
});

server.listen(cfg.port, () => {
  audit({ event: 'proxy:started', port: cfg.port, issuer: cfg.issuer,
          configuredEndpoints: cfg.configuredEndpoints.length,
          unconfiguredEndpoints: cfg.unconfiguredEndpoints.length, at: new Date().toISOString() });
});
