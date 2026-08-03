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
import { createRateLimiter, createReferenceMinter } from './intake.js';

const cfg = assertUsable(loadConfig());
const jwks = createJwks({ jwksUri: cfg.jwksUri });
const idempotency = createIdempotencyStore();

// Anonymous intake (TARGET_ARCHITECTURE.md §3.6). Both are in-memory and therefore
// per-instance: behind more than one replica the rate limit is N times more permissive
// than it reads, and two instances can mint the same reference. Back them with a shared
// store, or a front-door rate limit and the registry's own numbering, before scaling out.
const rateLimiter = createRateLimiter();
const minter = createReferenceMinter({ prefix: cfg.intakeRefPrefix });

// Structured single-line JSON so any log pipeline can ingest it. §2.7 — the identity
// recorded here is always the token-derived one.
const audit = e => console.log(JSON.stringify(e));

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > 8 * 1024 * 1024) { reject(new Error('payload_too_large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return resolve({});
    try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
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
  let body;
  try { body = await readBody(req); }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: String(e.message) }));
  }
  const out = await handleRequest(
    { method: req.method, path: new URL(req.url, 'http://x').pathname, headers: req.headers, body },
    { config: cfg, jwks, idempotency, audit, rateLimiter, minter }
  );
  res.writeHead(out.status, out.headers);
  res.end(JSON.stringify(out.body));
});

server.listen(cfg.port, () => {
  audit({ event: 'proxy:started', port: cfg.port, issuer: cfg.issuer,
          configuredEndpoints: cfg.configuredEndpoints.length,
          unconfiguredEndpoints: cfg.unconfiguredEndpoints.length, at: new Date().toISOString() });
});
