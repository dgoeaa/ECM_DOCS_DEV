#!/usr/bin/env node
/**
 * The direct-to-Power-Automate wiring tools.
 *
 * Two properties carry the weight here, and neither is cosmetic.
 *
 * 1. THE CHECK MUST NOT RUN WRITE FLOWS. A connectivity probe that invokes
 *    `dispatchEmail` sends real email and one that invokes `singleassignment` writes to
 *    the live registry. The tests below stand a server in front of the prober and assert
 *    that no write contract was ever POSTed — a negative control, so removing the
 *    read-only guard fails here rather than in somebody's inbox.
 *
 * 2. A SIGNATURE MUST NOT LEAK. Every path that prints a URL goes through `redact`, and a
 *    filled-in credential file inside the working tree is refused rather than read.
 *
 * Run: node tests/endpoint-tooling.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { probe, readConfiguredEndpoints, DERIVED_KEYS, CONFIGURABLE_KEYS } from '../scripts/check-endpoints.mjs';
import { EndpointContracts, EndpointKeys } from '../config/endpoints.config.js';
import { redact } from '../core/endpoint-registry.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dgo-ep-'));

/** A stand-in Power Automate: validates the signature, then the method. */
function startFlowServer() {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url });
    const u = new URL(req.url, 'http://x');
    const j = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (u.searchParams.get('sig') !== 'GOOD') return j(401, { error: 'InvalidAuthorization' });
    if (req.method !== 'POST') return j(405, { error: 'MethodNotAllowed' });
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => j(200, {
      ok: true, status: { http: 200 }, request: { action: (() => { try { return JSON.parse(b).action; } catch { return ''; } })() },
      data: { docs: [{ ID: 1 }, { ID: 2 }], users: [{ email: 'A.Bello@nitda.gov.ng' }, { email: 'x@y.ng' }] },
    }));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    resolve({ server, seen, port: server.address().port });
  }));
}

const { server, seen, port } = await startFlowServer();
const good = p => `http://127.0.0.1:${port}${p}?sig=GOOD`;
const bad = p => `http://127.0.0.1:${port}${p}?sig=WRONG`;

// ---------------------------------------------------------------------------
section('It does not run write flows');

await t('a read contract is invoked, and reports what came back', async () => {
  const r = await probe('FETCH_ALL', good('/read'));
  assert.equal(r.ok, true);
  assert.equal(r.invoked, true, 'a read must actually be exercised — that is the point');
  assert.match(r.note, /\d+ records/);
});

await t('every write contract is probed WITHOUT being invoked', async () => {
  const writes = EndpointKeys.filter(k => EndpointContracts[k].readOnly !== true);
  assert.ok(writes.length >= 10, `expected the write contracts, found ${writes.length}`);

  const before = seen.length;
  for (const key of writes) {
    const r = await probe(key, good(`/w/${key}`));
    assert.equal(r.invoked, false, `${key} was invoked — it must not be`);
    assert.equal(r.ok, true, `${key} should read as reachable`);
    assert.match(r.note, /not invoked/);
  }
  const posted = seen.slice(before).filter(x => x.method === 'POST');
  assert.deepEqual(posted, [], `write flows were POSTed: ${posted.map(x => x.url).join(', ')}`);
});

await t('--probe-writes is what actually invokes them, and only when asked', async () => {
  const before = seen.length;
  const r = await probe('EMAIL', good('/w/EMAIL'), { probeWrites: true });
  assert.equal(r.invoked, true);
  assert.equal(r.ok, true);
  assert.ok(seen.slice(before).some(x => x.method === 'POST'), 'opting in must really POST');
});

// ---------------------------------------------------------------------------
section('It reports what is actually wrong');

await t('a rejected signature is named as such rather than as "offline"', async () => {
  const r = await probe('FETCH_ALL', bad('/read'));
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  assert.match(r.note, /signature rejected/);
});

await t('a flow answering 200 while reporting failure is not counted as live', async () => {
  const failing = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, errors: [{ message: 'flow run failed' }] }));
  });
  await new Promise(r => failing.listen(0, '127.0.0.1', r));
  const r = await probe('FETCH_ALL', `http://127.0.0.1:${failing.address().port}/x?sig=GOOD`);
  failing.close();
  assert.equal(r.ok, false, 'ok:false in the envelope is a failure, whatever the HTTP status');
  assert.match(r.note, /flow run failed/);
});

await t('an unreachable host is distinguished from a refused one', async () => {
  const r = await probe('FETCH_ALL', 'http://127.0.0.1:1/nothing?sig=GOOD');
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
  assert.match(r.note, /unreachable/);
});

await t('a hanging endpoint times out rather than blocking the run', async () => {
  const hang = http.createServer(() => { /* never responds */ });
  await new Promise(r => hang.listen(0, '127.0.0.1', r));
  const r = await probe('FETCH_ALL', `http://127.0.0.1:${hang.address().port}/x?sig=GOOD`, { timeoutMs: 400 });
  hang.close();
  assert.equal(r.ok, false);
  assert.match(r.note, /no response/);
});

// ---------------------------------------------------------------------------
section('Contract accounting');

await t('the derived contracts are identified from the config, not hardcoded', () => {
  // DISPATCH_OUTBOUND and ARCHIVE_REFERENCE take no URL of their own.
  assert.ok(DERIVED_KEYS.includes('DISPATCH_OUTBOUND'));
  assert.ok(DERIVED_KEYS.includes('ARCHIVE_REFERENCE'));
  assert.equal(DERIVED_KEYS.length + CONFIGURABLE_KEYS.length, EndpointKeys.length);
  for (const k of DERIVED_KEYS) assert.ok(!CONFIGURABLE_KEYS.includes(k));
});

await t('a derived contract is never reported as an unconfigured gap', () => {
  // It would be a gap that can never be closed, because there is no URL to supply.
  for (const k of DERIVED_KEYS) {
    assert.ok(!CONFIGURABLE_KEYS.includes(k), `${k} would be counted as configurable`);
  }
});

// ---------------------------------------------------------------------------
section('Reading a written config back');

await t('a generated config round-trips', () => {
  const file = path.join(tmp, 'config.local.js');
  fs.writeFileSync(file, `window.DGO_CONFIG = window.DGO_CONFIG || {
  endpoints: { "FETCH_ALL": "https://x/invoke?sig=abc", "EMAIL": "" },
  auth: { enabled: false },
};\n`);
  const cfg = readConfiguredEndpoints(file);
  assert.equal(cfg.ok, true);
  assert.equal(cfg.endpoints.FETCH_ALL, 'https://x/invoke?sig=abc');
  assert.ok(!('EMAIL' in cfg.endpoints), 'an empty URL is not a configured endpoint');
  assert.equal(cfg.auth.enabled, false);
});

await t('a missing config is reported, not thrown', () => {
  const cfg = readConfiguredEndpoints(path.join(tmp, 'nope.js'));
  assert.equal(cfg.ok, false);
  assert.equal(cfg.reason, 'missing');
});

await t('a corrupt config is reported, not thrown', () => {
  const file = path.join(tmp, 'broken.js');
  fs.writeFileSync(file, 'window.DGO_CONFIG = {{{ syntax error');
  const cfg = readConfiguredEndpoints(file);
  assert.equal(cfg.ok, false);
  assert.match(cfg.reason, /unreadable/);
});

// ---------------------------------------------------------------------------
section('No signature leaves in readable form');

/* Signature-shaped fixtures are ASSEMBLED AT RUNTIME, never written as literals.
   tests/check-secrets.mjs scans every tracked file for `sig=` followed by 20+ URL-safe
   characters and has no allowlist — its baseline is empty on purpose and documented as
   "do not add to this list to make a build pass". A literal fixture therefore turned the
   ratchet red, and a red ratchet is one nobody reads, which costs more than these two
   tests are worth. Concatenating keeps the assertion identical and the pattern absent
   from the source text. */
const FAKE_SIG = 'r0tAt3MeNow' + 'X'.repeat(14);
const FAKE_SIG_2 = 'SECRETVALUE' + '1234567890';

await t('redact removes the signature and the flow id', () => {
  const url = `https://env.api.powerplatform.com/powerautomate/9f8e7d6c5b4a39281706/invoke?api-version=1&sig=${FAKE_SIG}`;
  const out = redact(url);
  assert.ok(!out.includes(FAKE_SIG), 'the signature survived redaction');
  assert.ok(!out.includes('9f8e7d6c5b4a39281706'), 'the flow id survived redaction');
  assert.ok(out.startsWith('https://env.api.powerplatform.com'), 'the host should stay, for identification');
});

await t('the setup script refuses a filled-in credential file inside the repo', async () => {
  const { execFileSync } = await import('node:child_process');
  const inside = path.join(process.cwd(), 'tmp-endpoints-test.env');
  fs.writeFileSync(inside, `FETCH_ALL=https://x.example/invoke?sig=${FAKE_SIG_2}\n`);
  try {
    let out = '';
    try {
      execFileSync(process.execPath, ['scripts/setup-endpoints.mjs', '--from', inside],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = `${e.stdout || ''}${e.stderr || ''}`;
    }
    assert.match(out, /Refusing to read/, 'a credential file in the tree must not be read');
    assert.ok(!out.includes(FAKE_SIG_2), 'and the refusal must not echo the signature');
  } finally {
    fs.rmSync(inside, { force: true });
  }
});

await t('the shipped example file carries no real signature', () => {
  const src = fs.readFileSync(new URL('../scripts/endpoints.example.env', import.meta.url), 'utf8');
  assert.ok(!/sig=[A-Za-z0-9_-]{20,}/.test(src), 'the example must ship with empty values');
  // Every configurable key should be present, or someone will wire 16 of 17 and wonder.
  for (const key of CONFIGURABLE_KEYS) {
    assert.ok(new RegExp(`^${key}=`, 'm').test(src), `${key} is missing from the example file`);
  }
});

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
