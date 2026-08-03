#!/usr/bin/env node
/**
 * Registry scan intake — TARGET_ARCHITECTURE.md §3.2 channel C, step 7.
 *
 * `PUT /documents/scan` brings a physically-received document into the registry. It is the
 * counterpart of the portal's anonymous ticketed upload, and the tests that matter are the
 * ones proving the difference is confined to WHO may call it:
 *
 *   1. It is authenticated and role-checked. A viewer cannot deposit; an unsigned or
 *      wrong-key token cannot deposit; no token cannot deposit.
 *   2. The depositing officer comes from the verified token, never from the request.
 *   3. The bytes get exactly the same treatment as the anonymous path — same ceiling, same
 *      declared-size check, same digest check — because both call verifyBytes.
 *   4. The reference is minted server-side.
 *
 * Run: node proxy/test/scan.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handleRequest } from '../src/handler.js';
import { createJwks } from '../src/jwt.js';
import { createReferenceMinter } from '../src/intake.js';
import { verifyBytes, UploadError, UPLOAD_LIMITS } from '../src/upload.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

/* ── a real key and a real token, as proxy.test.mjs does ── */
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherPriv } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'scan-key-1';
const ISSUER = 'https://login.microsoftonline.com/tenant-guid/v2.0';
const AUDIENCE = 'api://dgo-platform';

const jwks = createJwks({
  jwksUri: 'https://example/keys',
  fetchImpl: async () => ({ ok: true, json: async () => ({
    keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }],
  }) }),
});

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload = {}, { key = privateKey, alg = 'RS256' } = {}) {
  const head = b64({ alg, typ: 'JWT', kid: KID });
  const body = b64({
    iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'clerk-sub-1', oid: 'clerk-oid-1', preferred_username: 'Registry.Clerk@nitda.gov.ng',
    name: 'Registry Clerk', roles: ['DGO.Operator'], ...payload,
  });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const FILE = Buffer.from('%PDF-1.7 scanned letter from the registry counter');
const DIGEST = crypto.createHash('sha256').update(FILE).digest('hex');

const baseConfig = {
  issuer: ISSUER, audience: AUDIENCE, rolesClaim: 'roles',
  roleClaimMap: { 'DGO.Operator': 'operator', 'DGO.Viewer': 'viewer', 'DGO.SystemAdmin': 'systemAdmin' },
  clockSkewSec: 60,
  endpoints: { SCAN_UPLOAD: 'https://sharepoint.invalid/library' },
};

let lastUpstream = null;
const storingFetch = async (url, opts) => {
  lastUpstream = { url, headers: opts.headers, body: opts.body };
  return { ok: true, status: 200, json: async () => ({ webUrl: 'https://sharepoint.invalid/doc/1' }) };
};

const deps = (over = {}) => ({
  config: baseConfig,
  jwks,
  minter: createReferenceMinter({ seed: 318 }),
  audit: () => {},
  fetchImpl: storingFetch,
  ...over,
});

const put = (token, headers = {}, body = FILE, d = deps()) => handleRequest({
  method: 'PUT', path: '/documents/scan',
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'x-dgo-filename': 'counter-scan.pdf',
    'x-dgo-sha256': DIGEST,
    'x-dgo-size': String(FILE.length),
    ...headers,
  },
  body,
}, d);

console.log('\nRegistry scan intake');

/* ── the trust boundary ────────────────────────────────────────────────────── */
section('It is on the authenticated side of the boundary');

await t('a valid operator token deposits the document', async () => {
  const out = await put(sign());
  assert.equal(out.status, 201);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.stored, true);
  assert.equal(out.body.attachmentLink, 'https://sharepoint.invalid/doc/1');
});

await t('no token is refused', async () => {
  const out = await put('');
  assert.equal(out.status, 401);
  assert.equal(out.body.error, 'unauthorized');
});

await t('a token signed with the wrong key is refused', async () => {
  const out = await put(sign({}, { key: otherPriv }));
  assert.equal(out.status, 401);
});

await t('alg=none is refused', async () => {
  const head = b64({ alg: 'none', typ: 'JWT', kid: KID });
  const body = b64({ iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now() / 1000) + 3600, sub: 'x', roles: ['DGO.Operator'] });
  const out = await put(`${head}.${body}.`);
  assert.equal(out.status, 401);
});

await t('an expired token is refused', async () => {
  const out = await put(sign({ exp: Math.floor(Date.now() / 1000) - 7200 }));
  assert.equal(out.status, 401);
});

await t('a viewer is refused — depositing is operational, not reporting', async () => {
  const out = await put(sign({ roles: ['DGO.Viewer'] }));
  assert.equal(out.status, 403);
  assert.equal(out.body.error, 'forbidden');
});

await t('a token with no mapped role is refused', async () => {
  const out = await put(sign({ roles: ['SomeOther.Role'] }));
  assert.equal(out.status, 403);
});

await t('the route is not reachable anonymously through the intake namespace', async () => {
  // /intake/* is documented as THE anonymous namespace. The scan route must not be in it,
  // or the trust boundary becomes a matter of reading code rather than reading the path.
  const out = await handleRequest({
    method: 'PUT', path: '/intake/scan', headers: { 'x-dgo-filename': 'x.pdf' }, body: FILE,
  }, deps());
  assert.notEqual(out.status, 201, 'an anonymous PUT must not reach the scan handler');
  assert.notEqual(out.body?.depositedBy, 'Registry.Clerk@nitda.gov.ng');
});

/* ── attribution ───────────────────────────────────────────────────────────── */
section('Attribution comes from the token');

await t('the depositing officer is taken from the verified token', async () => {
  const out = await put(sign());
  assert.equal(out.body.depositedBy, 'registry.clerk@nitda.gov.ng');
});

await t('a header cannot override who deposited it', async () => {
  const out = await put(sign(), { 'x-dgo-depositedby': 'someone.else@nitda.gov.ng' });
  assert.equal(out.body.depositedBy, 'registry.clerk@nitda.gov.ng',
    'the request must not be able to reassign custody');
});

await t('the deposit is audited against the subject before storage is attempted', async () => {
  const events = [];
  await put(sign(), {}, FILE, deps({ audit: e => events.push(e) }));
  const accepted = events.find(e => e.event === 'scan:accepted');
  assert.ok(accepted, 'acceptance must be recorded separately from storage');
  assert.equal(accepted.subject, 'clerk-oid-1', 'identity is the stable Entra object id, not sub');
  assert.equal(accepted.sha256, DIGEST);
  const order = events.map(e => e.event);
  assert.ok(order.indexOf('scan:accepted') < order.indexOf('scan:stored'),
    'accepted must precede stored, so a failed filing is distinguishable from no deposit');
});

/* ── the bytes ─────────────────────────────────────────────────────────────── */
section('Bytes get the same treatment as the anonymous path');

await t('a digest mismatch is refused, not reconciled', async () => {
  const out = await put(sign(), { 'x-dgo-sha256': 'b'.repeat(64) });
  assert.equal(out.status, 409);
  assert.equal(out.body.error, 'digest_mismatch');
});

await t('a size mismatch is refused', async () => {
  const out = await put(sign(), { 'x-dgo-size': String(FILE.length + 10) });
  assert.equal(out.status, 409);
  assert.equal(out.body.error, 'size_mismatch');
});

await t('a malformed digest is rejected before the bytes are read', async () => {
  const out = await put(sign(), { 'x-dgo-sha256': 'not-a-digest' });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'invalid_digest');
});

await t('an oversize file is refused at the same ceiling as intake', async () => {
  const big = Buffer.alloc(UPLOAD_LIMITS.maxFileBytes + 1);
  const out = await put(sign(), {
    'x-dgo-sha256': crypto.createHash('sha256').update(big).digest('hex'),
    'x-dgo-size': String(big.length),
  }, big);
  assert.equal(out.status, 413);
});

await t('a missing body is refused', async () => {
  const out = await put(sign(), {}, null);
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'missing_body');
});

await t('verifyBytes is one implementation, shared with the anonymous path', async () => {
  // If these diverge, the two channels give different guarantees about the same library.
  assert.equal(await verifyBytes(FILE, { declaredSha256: DIGEST, declaredSize: FILE.length }), DIGEST);
  await assert.rejects(async () => verifyBytes(FILE, { declaredSha256: 'c'.repeat(64) }),
    e => e instanceof UploadError && e.reason === 'digest_mismatch');
  await assert.rejects(async () => verifyBytes(FILE, { declaredSize: 1 }),
    e => e.reason === 'size_mismatch');
  await assert.rejects(async () => verifyBytes('not a buffer'), e => e.reason === 'missing_body');
});

/* ── filename and reference ────────────────────────────────────────────────── */
section('Filename and reference');

await t('a missing filename is refused', async () => {
  const out = await put(sign(), { 'x-dgo-filename': '' });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'missing_filename');
});

await t('a path separator in the filename is stripped to a basename', async () => {
  const out = await put(sign(), { 'x-dgo-filename': encodeURIComponent('../../etc/passwd') });
  assert.equal(out.status, 201);
  assert.equal(out.body.name, 'passwd', 'a declared filename must not influence where it lands');
});

await t('the reference is minted server-side when the client does not supply one', async () => {
  const out = await put(sign());
  assert.match(out.body.referenceId, /^NITDA-\d{4}-\d{6}$/);
});

await t('the reference reaches the library as a header, with the digest', async () => {
  lastUpstream = null;
  const out = await put(sign());
  assert.equal(lastUpstream.headers['X-DGO-Reference'], out.body.referenceId);
  assert.equal(lastUpstream.headers['X-DGO-Sha256'], DIGEST);
  assert.equal(lastUpstream.headers['Content-Type'], 'application/octet-stream',
    'bytes travel as bytes, never base64 inside JSON');
});

/* ── degraded configurations ───────────────────────────────────────────────── */
section('Degraded configurations');

await t('an unconfigured library accepts and reports stored:false', async () => {
  // The deposit was real and is audited; claiming it was filed would be false.
  const out = await put(sign(), {}, FILE, deps({ config: { ...baseConfig, endpoints: {} } }));
  assert.equal(out.status, 202);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.stored, false);
  assert.equal(out.body.reason, 'endpoint_not_configured');
  assert.ok(out.body.referenceId, 'a reference is still issued');
});

await t('an unreachable library is 202 with stored:false, not a crash', async () => {
  const out = await put(sign(), {}, FILE, deps({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }));
  assert.equal(out.status, 202);
  assert.equal(out.body.stored, false);
});

await t('a library that refuses the write reports stored:false', async () => {
  const out = await put(sign(), {}, FILE, deps({
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  }));
  assert.equal(out.status, 202);
  assert.equal(out.body.stored, false);
  assert.equal(out.body.attachmentLink, '');
});

await t('SCAN_UPLOAD falls back to the intake library when unset', async () => {
  const out = await put(sign(), {}, FILE, deps({
    config: { ...baseConfig, endpoints: { INTAKE_UPLOAD: 'https://sharepoint.invalid/shared' } },
  }));
  assert.equal(out.status, 201);
  assert.equal(lastUpstream.url, 'https://sharepoint.invalid/shared');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
