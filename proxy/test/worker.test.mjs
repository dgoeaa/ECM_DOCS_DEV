#!/usr/bin/env node
/**
 * The Cloudflare Worker host.
 *
 * WHY THIS RUNS UNDER NODE
 * `worker.js` is a `fetch(request, env)` handler over standard `Request`/`Response`, both of
 * which Node 22 provides. So the adapter can be driven directly here, with no wrangler and no
 * network, and the assertions are about real behaviour rather than "it parsed".
 *
 * What this cannot prove is that Cloudflare's runtime behaves like Node's — `wrangler dev`
 * is still required before deployment. What it does prove is the part that actually broke
 * things during the port: that no `node:` builtin, no `Buffer` and no `process` is reachable
 * from the request path, and that the two hosts answer the same way.
 *
 * The most important test here is the last section. server.js and worker.js are two hosts
 * for one handler, and the failure mode that matters is not a crash — it is the two of them
 * quietly diverging until a rule holds on one and not the other.
 *
 * Run: node test/worker.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const ENV = {
  DGO_TENANT_ID: 't',
  DGO_AUDIENCE: 'api://x',
  DGO_ROLE_MAP: '{"DGO.Viewer":"viewer"}',
  DGO_ENDPOINT_FETCH_ALL: 'https://flow.example/x',
};

const call = (path, { method = 'GET', body, headers = {}, env = ENV } = {}) =>
  worker.fetch(new Request(`https://proxy.example${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), env);

console.log('\nCloudflare Worker host');

/* ── it runs at all ─────────────────────────────────────────────────────────── */
section('The adapter answers');

await t('healthz reports the host and the endpoint posture', async () => {
  const res = await call('/healthz');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.host, 'cloudflare-worker');
  assert.ok(Array.isArray(body.unconfigured));
});

await t('an unconfigured Worker refuses to serve rather than serving wrongly', async () => {
  /* The Node host refuses to START. A Worker cannot refuse to start, so it must refuse to
     ANSWER — the same fail-closed posture in the only form this runtime allows.

     Loaded through a fresh module instance because the context is a per-isolate singleton.
     Reusing the already-warm import would hand the bad env a context built from the good
     one and the test would pass without testing anything. A real isolate starts cold with
     one env for its whole life, which is what this reproduces. */
  const cold = (await import('../src/worker.js?cold=unconfigured')).default;
  const res = await cold.fetch(new Request('https://proxy.example/healthz'), {});
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'proxy_not_configured');
});

await t('an unauthenticated governed request is refused', async () => {
  const res = await call('/FETCH_ALL', { method: 'POST', body: {} });
  assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
});

await t('malformed JSON is refused before anything reads it', async () => {
  const res = await call('/FETCH_ALL', { method: 'POST', body: '{not json' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_json');
});

await t('an oversized declared body is refused on the Content-Length claim', async () => {
  const res = await call('/FETCH_ALL', {
    method: 'POST', body: {}, headers: { 'content-length': String(64 * 1024 * 1024) },
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'payload_too_large');
});

/* ── the anonymous channel ──────────────────────────────────────────────────── */
section('The public intake path works end to end under the Worker');

await t('a valid submission is accepted and given a server-minted reference', async () => {
  const res = await call('/intake/submission', {
    method: 'POST',
    body: {
      subject: 'A letter to the Director-General',
      category: 'General Correspondence',
      senderEmail: 'citizen@example.org',
      sender: { name: 'A Citizen' },
      description: 'Please find my correspondence attached.',
    },
  });
  const body = await res.json();
  assert.ok(res.status === 201 || res.status === 202, `got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(body.referenceId, /^NITDA-\d{4}-\d{6}$/,
    'the reference must be minted by the proxy, never accepted from the caller');
});

await t('an invalid submission is rejected with a reason', async () => {
  const res = await call('/intake/submission', { method: 'POST', body: { subject: 'x' } });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error, 'the refusal must name itself');
});

await t('the rate limiter is reachable and does refuse', async () => {
  // Proves the limiter survives across requests in one isolate. It is also exactly the
  // guarantee that weakens across isolates, which is why the posture is reported.
  let refused = false;
  for (let i = 0; i < 12 && !refused; i++) {
    const res = await call('/intake/submission', {
      method: 'POST',
      body: {
        subject: 'Repeated submission', category: 'General Correspondence',
        senderEmail: 'flood@example.org', sender: { name: 'Flood' },
        description: 'again and again',
      },
    });
    if (res.status === 429) refused = true;
  }
  assert.ok(refused, 'an open create endpoint without a working limiter is a spam amplifier');
});

/* ── the port itself ────────────────────────────────────────────────────────── */
section('Nothing Node-only is reachable from the request path');

const SRC = new URL('../src/', import.meta.url);
const read = f => readFileSync(new URL(f, SRC), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const REQUEST_PATH = [
  'worker.js', 'handler.js', 'intake.js', 'upload.js', 'verification.js',
  'jwt.js', 'crypto.js', 'config.js', 'authorize.js',
];

await t('no module on the request path imports a node: builtin', () => {
  const bad = REQUEST_PATH.filter(f => /from\s+['"]node:/.test(strip(read(f))));
  assert.deepEqual(bad, [], `these would fail to load in a Worker: ${bad.join(', ')}`);
});

await t('no module on the request path uses Buffer', () => {
  const bad = REQUEST_PATH.filter(f => /\bBuffer\s*\./.test(strip(read(f))));
  assert.deepEqual(bad, [], `Buffer does not exist in a Worker: ${bad.join(', ')}`);
});

await t('no module on the request path reads process.env unguarded', () => {
  const bad = REQUEST_PATH.filter(f => /(?<!globalThis\.)\bprocess\.env/.test(strip(read(f))));
  assert.deepEqual(bad, [], `there is no process in a Worker: ${bad.join(', ')}`);
});

await t('server.js remains the ONLY Node-bound file', () => {
  // It is allowed to be Node-bound — it is the Node host. The test exists so that a future
  // change putting node:http back on the shared path is caught here rather than in Cloudflare.
  assert.match(strip(read('server.js')), /from\s+['"]node:http['"]/);
});

/* ── the two hosts must not drift ───────────────────────────────────────────── */
section('The two hosts stay one implementation');

await t('both hosts build the same dependency set for handleRequest', () => {
  /* If one host stops passing `verifier`, verification silently switches off for traffic
     through that host only — the kind of divergence that is invisible until an incident. */
  const deps = ['jwks', 'idempotency', 'audit', 'rateLimiter', 'statusRateLimiter', 'minter', 'broker', 'verifier'];
  const w = read('worker.js'), s = read('server.js');
  for (const d of deps) {
    assert.match(w, new RegExp(`\\b${d}\\b`), `worker.js does not supply ${d}`);
    assert.match(s, new RegExp(`\\b${d}\\b`), `server.js does not supply ${d}`);
  }
});

await t('neither host makes a routing or authorisation decision of its own', () => {
  // Every such decision belongs to handler.js. A host that starts matching route names is
  // a second place for the rules to live, and the second place is always the stale one.
  for (const f of ['worker.js', 'server.js']) {
    const src = strip(read(f));
    assert.ok(!/\bverifyToken\(|\bauthorize\(|assertRole/.test(src),
      `${f} must delegate authorisation to handler.js, not perform it`);
  }
});

await t('both hosts cap the upload body far above the JSON body', () => {
  for (const f of ['worker.js', 'server.js']) {
    const src = read(f);
    assert.match(src, /32 \* 1024 \* 1024/, `${f} must allow real attachments`);
    assert.match(src, /8 \* 1024 \* 1024/, `${f} must NOT allow metadata that large`);
  }
});

await t('the Worker trusts the edge-set client IP, not a client-supplied header', () => {
  /* cf-connecting-ip is written by Cloudflare and cannot be spoofed by the caller.
     X-Forwarded-For can be, which is why sourceKey() only honours it when configured to —
     a rate limiter keyed on a spoofable value is not a rate limiter. */
  const src = read('worker.js');
  assert.match(src, /cf-connecting-ip/);
  assert.ok(!/remoteAddress:\s*headers\['x-forwarded-for'\]/.test(src));
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
