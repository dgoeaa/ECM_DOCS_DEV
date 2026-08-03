#!/usr/bin/env node
/**
 * Upload brokering — TARGET_ARCHITECTURE.md §3.3, step 4.
 *
 * A ticket is a grant to write into the document library, so most of what follows is about
 * what a ticket must NOT allow: forging, replaying, outliving its window, or being pointed
 * at a different file than the one it was issued for.
 *
 * Run: node proxy/test/upload.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handleRequest } from '../src/handler.js';
import { createUploadBroker, handleUpload, UploadError, UPLOAD_LIMITS } from '../src/upload.js';
import { createRateLimiter, createReferenceMinter } from '../src/intake.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const SECRET = 'a'.repeat(48);
const FILE = Buffer.from('%PDF-1.7 a small but genuine looking document body');
const DIGEST = crypto.createHash('sha256').update(FILE).digest('hex');

const VALID = {
  subject: 'Request to participate as an observer',
  category: 'General Correspondence',
  sender: { name: 'A. Submitter' },
  senderEmail: 'a@example.org',
  attachments: [{ name: 'letter.pdf', size: FILE.length, sha256: DIGEST }],
};

const deps = (over = {}) => ({
  config: { endpoints: {} },
  rateLimiter: createRateLimiter(),
  minter: createReferenceMinter(),
  broker: createUploadBroker({ secret: SECRET }),
  audit: () => {},
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}', json: async () => ({}) }),
  ...over,
});
const put = (ticket, body, path = '/intake/upload') =>
  ({ method: 'PUT', path, headers: { 'x-upload-ticket': ticket }, body, remoteAddress: '10.0.0.1' });
const post = (path, body) => ({ method: 'POST', path, headers: {}, body, remoteAddress: '10.0.0.1' });

console.log('\nUpload brokering');

/* ── the broker refuses to exist insecurely ─────────────────────────────── */
section('Broker construction');

await t('a broker cannot be built without a secret', async () => {
  assert.throws(() => createUploadBroker({}), /secret/);
});

await t('a short secret is refused', async () => {
  assert.throws(() => createUploadBroker({ secret: 'short' }), /at least 32/);
});

/* ── intake issues tickets ──────────────────────────────────────────────── */
section('Ticket issuance');

await t('a submission returns one ticket per attachment', async () => {
  const res = await handleRequest(post('/intake/submission', {
    ...VALID, attachments: [{ name: 'a.pdf', size: 10 }, { name: 'b.pdf', size: 20 }],
  }), deps());
  assert.equal(res.status, 202);
  assert.equal(res.body.uploads.length, 2);
  assert.equal(res.body.uploads[0].name, 'a.pdf');
  assert.ok(res.body.uploads[0].ticket);
  assert.ok(res.body.uploads[0].expiresAt);
});

await t('no broker means no tickets, not unsigned tickets', async () => {
  const res = await handleRequest(post('/intake/submission', VALID), deps({ broker: null }));
  assert.equal(res.status, 202);
  assert.deepEqual(res.body.uploads, []);
});

await t('tickets from one submission are distinct', async () => {
  const res = await handleRequest(post('/intake/submission', {
    ...VALID, attachments: [{ name: 'a.pdf', size: 1 }, { name: 'b.pdf', size: 2 }],
  }), deps());
  assert.notEqual(res.body.uploads[0].ticket, res.body.uploads[1].ticket);
});

/* ── forgery, replay, expiry ────────────────────────────────────────────── */
section('What a ticket must not allow');

await t('a forged ticket is refused', async () => {
  const body = Buffer.from(JSON.stringify({
    id: 'x', referenceId: 'NITDA-2026-000001', index: 0, name: 'evil.pdf',
    size: FILE.length, sha256: '', exp: Date.now() + 60000,
  })).toString('base64url');
  const forged = `${body}.${Buffer.from('not-a-real-mac').toString('base64url')}`;
  const res = await handleRequest(put(forged, FILE), deps());
  assert.equal(res.status, 403);
  assert.equal(res.body.reason, 'bad_ticket_signature');
});

await t('a ticket signed with a different secret is refused', async () => {
  const other = createUploadBroker({ secret: 'b'.repeat(48) });
  const { ticket } = await other.issue({ referenceId: 'R', index: 0, name: 'x.pdf', size: FILE.length });
  const res = await handleRequest(put(ticket, FILE), deps());
  assert.equal(res.status, 403);
});

await t('a tampered payload invalidates the signature', async () => {
  const b = createUploadBroker({ secret: SECRET });
  const { ticket } = await b.issue({ referenceId: 'R', index: 0, name: 'small.pdf', size: 10 });
  const [body, mac] = ticket.split('.');
  const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  p.size = 999999;                                   // widen the grant
  const tampered = `${Buffer.from(JSON.stringify(p)).toString('base64url')}.${mac}`;
  await assert.rejects(async () => await b.redeem(tampered), e => e.reason === 'bad_ticket_signature');
});

await t('a ticket cannot be replayed', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const { ticket } = issued.body.uploads[0];
  const first = await handleRequest(put(ticket, FILE), d);
  const second = await handleRequest(put(ticket, FILE), d);
  assert.equal(first.status, 202);
  assert.equal(second.status, 409);
  assert.equal(second.body.reason, 'ticket_already_used');
});

await t('an expired ticket is refused', async () => {
  let clock = 1_000_000;
  const b = createUploadBroker({ secret: SECRET, ttlMs: 1000, now: () => clock });
  const { ticket } = await b.issue({ referenceId: 'R', index: 0, name: 'x.pdf', size: 1 });
  clock += 5000;
  await assert.rejects(async () => await b.redeem(ticket), e => e.reason === 'ticket_expired');
});

await t('a malformed ticket is refused before any field is read', async () => {
  const b = createUploadBroker({ secret: SECRET });
  for (const bad of ['', 'no-dot', 'a.b.c.d', '.', 'x.']) {
    await assert.rejects(async () => await b.redeem(bad), e => e instanceof UploadError, `"${bad}" must be refused`);
  }
});

await t('a missing ticket header is refused', async () => {
  const res = await handleUpload({ method: 'PUT', path: '/intake/upload', headers: {}, body: FILE }, deps());
  assert.equal(res.body.error, 'invalid_ticket');
});

/* ── the bytes are verified, not trusted ────────────────────────────────── */
section('Byte verification');

await t('a size that disagrees with the declaration is refused', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, Buffer.from('shorter')), d);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'size_mismatch');
});

await t('a digest that disagrees with the declaration is refused', async () => {
  const d = deps();
  const wrong = Buffer.alloc(FILE.length, 0x41);   // right length, wrong content
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, wrong), d);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'digest_mismatch');
});

await t('the computed digest is returned so the submitter can verify it', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  assert.equal(res.body.sha256, DIGEST);
  assert.equal(res.body.bytes, FILE.length);
});

await t('a file over the hard cap is refused regardless of the ticket', async () => {
  const d = deps({ config: { endpoints: {}, uploadLimits: { ...UPLOAD_LIMITS, maxFileBytes: 32 } } });
  const issued = await handleRequest(post('/intake/submission', {
    ...VALID, attachments: [{ name: 'big.pdf', size: 4096 }],
  }), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, Buffer.alloc(4096)), d);
  assert.equal(res.status, 413);
});

await t('a non-buffer body is refused', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleUpload(
    { method: 'PUT', path: '/intake/upload', headers: { 'x-upload-ticket': issued.body.uploads[0].ticket }, body: { not: 'bytes' } }, d);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'missing_body');
});

/* ── storage and honesty ────────────────────────────────────────────────── */
section('Storage');

await t('with no destination configured, stored is false rather than faked', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  assert.equal(res.status, 202);
  assert.equal(res.body.stored, false);
  assert.equal(res.body.reason, 'endpoint_not_configured');
});

await t('with a destination configured the bytes are relayed and a link returned', async () => {
  let seen = null;
  const d = deps({
    config: { endpoints: { INTAKE_UPLOAD: 'https://example.invalid/lib' } },
    fetchImpl: async (url, o) => { seen = o; return { ok: true, status: 201, json: async () => ({ webUrl: 'https://sp/doc/1' }) }; },
  });
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  assert.equal(res.status, 201);
  assert.equal(res.body.stored, true);
  assert.equal(res.body.attachmentLink, 'https://sp/doc/1');
  assert.ok(Buffer.isBuffer(seen.body), 'raw bytes are relayed, not base64 in JSON');
  assert.equal(seen.headers['X-DGO-Sha256'], DIGEST);
});

await t('an unreachable destination does not claim the file was stored', async () => {
  const d = deps({
    config: { endpoints: { INTAKE_UPLOAD: 'https://example.invalid/lib' } },
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  assert.equal(res.body.stored, false);
});

/* ── route isolation ────────────────────────────────────────────────────── */
section('Route isolation');

await t('a PUT to an authenticated contract is still refused', async () => {
  const res = await handleRequest({ method: 'PUT', path: '/dgo/SINGLE_ASSIGNMENT', headers: {}, body: FILE }, deps());
  assert.equal(res.status, 405, 'only /intake/upload accepts PUT');
});

await t('a look-alike upload path does not reach the broker', async () => {
  const d = deps();
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  const res = await handleRequest(put(issued.body.uploads[0].ticket, FILE, '/intake/upload-elsewhere'), d);
  assert.notEqual(res.status, 202);
});

await t('uploads are unavailable, not open, when no broker is provisioned', async () => {
  const res = await handleRequest(put('anything', FILE), deps({ broker: null }));
  assert.equal(res.status, 503);
});

/* ── audit ──────────────────────────────────────────────────────────────── */
section('Audit');

await t('acceptance and rejection are both audited', async () => {
  const events = [];
  const d = deps({ audit: e => events.push(e.event) });
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  await handleRequest(put('bogus.ticket', FILE), d);
  assert.ok(events.includes('upload:accepted'));
  assert.ok(events.includes('upload:rejected'));
});

await t('the audit line does not carry the file bytes', async () => {
  const events = [];
  const d = deps({ audit: e => events.push(JSON.stringify(e)) });
  const issued = await handleRequest(post('/intake/submission', VALID), d);
  await handleRequest(put(issued.body.uploads[0].ticket, FILE), d);
  assert.ok(!events.join(' ').includes('%PDF'), 'file content must never be logged');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
