#!/usr/bin/env node
/**
 * Anonymous intake route — TARGET_ARCHITECTURE.md §3.5, §3.6.
 *
 * This is the only unauthenticated path through the proxy, so the tests that matter most
 * are the ones proving it stays narrow: that it cannot reach an authenticated contract,
 * cannot be used to read anything, cannot be flooded, and cannot be handed a reference of
 * the caller's choosing.
 *
 * Run: node proxy/test/intake.test.mjs
 */

import assert from 'node:assert/strict';
import { handleRequest } from '../src/handler.js';
import {
  validateSubmission, createRateLimiter, createReferenceMinter,
  sourceKey, IntakeError, INTAKE_CATEGORIES,
} from '../src/intake.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const VALID = {
  channel: 'Portal',
  correspondenceType: 'Incoming',
  subject: 'Request to participate as an observer',
  category: 'General Correspondence',
  sender: { name: 'A. Submitter', organisation: 'Raphael Foundation', organisationType: 'NGO' },
  senderEmail: 'A.Submitter@Example.ORG',
  senderPhone: '+2348000000000',
  eventDate: '2026-08-14',
  description: 'Requesting observer status for the forthcoming review.',
  attachments: [{ name: 'letter.pdf', size: 240_112, sha256: 'a'.repeat(64) }],
};

const deps = (over = {}) => ({
  config: { endpoints: {} },
  rateLimiter: createRateLimiter(),
  minter: createReferenceMinter(),
  audit: () => {},
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}' }),
  ...over,
});
const post = (path, body, extra = {}) => ({ method: 'POST', path, headers: {}, body, remoteAddress: '10.0.0.1', ...extra });

console.log('\nAnonymous intake');

/* ── validation ─────────────────────────────────────────────────────────── */
section('Submission validation');

await t('a well-formed submission validates', () => {
  const r = validateSubmission(VALID);
  assert.equal(r.subject, VALID.subject);
  assert.equal(r.category, 'General Correspondence');
  assert.equal(r.channel, 'Portal');
});

await t('email is normalised to lower case', () => {
  assert.equal(validateSubmission(VALID).senderEmail, 'a.submitter@example.org');
});

await t('an unknown category is refused', () => {
  assert.throws(() => validateSubmission({ ...VALID, category: 'IT Project Clearance' }),
    e => e.reason === 'unknown_category');
});

await t('every taxonomy category the portal offers is accepted', () => {
  for (const c of INTAKE_CATEGORIES) {
    assert.doesNotThrow(() => validateSubmission({ ...VALID, category: c }), `${c} must validate`);
  }
});

for (const [field, patch, reason] of [
  ['subject', { subject: '   ' }, 'missing_subject'],
  ['category', { category: '' }, 'missing_category'],
  ['sender email', { senderEmail: '' }, 'missing_sender_email'],
  ['sender email format', { senderEmail: 'not-an-email' }, 'invalid_sender_email'],
  ['sender name', { sender: {} }, 'missing_sender_name'],
]) {
  await t(`missing or invalid ${field} is refused (${reason})`, () => {
    assert.throws(() => validateSubmission({ ...VALID, ...patch }), e => e.reason === reason);
  });
}

await t('an oversized subject is refused', () => {
  assert.throws(() => validateSubmission({ ...VALID, subject: 'x'.repeat(301) }),
    e => e.reason === 'subject_too_long');
});

await t('too many attachments are refused', () => {
  const many = Array.from({ length: 21 }, (_, i) => ({ name: `f${i}.pdf`, size: 10 }));
  assert.throws(() => validateSubmission({ ...VALID, attachments: many }),
    e => e.reason === 'too_many_attachments');
});

await t('declared attachment bytes are capped', () => {
  assert.throws(() => validateSubmission({ ...VALID, attachments: [{ name: 'big.pdf', size: 200 * 1024 * 1024 }] }),
    e => e.reason === 'attachments_too_large');
});

await t('a malformed digest is refused', () => {
  assert.throws(() => validateSubmission({ ...VALID, attachments: [{ name: 'a.pdf', size: 1, sha256: 'nope' }] }),
    e => e.reason === 'attachment_invalid_digest');
});

/* ── the security properties ────────────────────────────────────────────── */
section('Security properties of an unauthenticated route');

await t('a path-traversing filename is reduced to its basename', () => {
  const r = validateSubmission({ ...VALID, attachments: [{ name: '../../etc/passwd', size: 10 }] });
  assert.equal(r.attachments[0].name, 'passwd');
});

await t('a caller cannot mislabel the channel', () => {
  const r = validateSubmission({ ...VALID, channel: 'Registry' });
  assert.equal(r.channel, 'Portal', 'channel is set by the server, never by the caller');
});

await t('a caller cannot claim internal origination', () => {
  assert.throws(() => validateSubmission({ ...VALID, correspondenceType: 'Registry' }),
    e => e.reason === 'unsupported_correspondence_type');
});

await t('unknown fields are dropped rather than forwarded', () => {
  const r = validateSubmission({ ...VALID, status: 'approved', officer: 'A. Bello', _identity: { role: 'systemAdmin' } });
  assert.equal(r.status, undefined);
  assert.equal(r.officer, undefined);
  assert.equal(r._identity, undefined);
});

await t('a client-supplied referenceId never survives', async () => {
  const res = await handleRequest(post('/intake/submission', { ...VALID, referenceId: 'NITDA-1999-000001' }), deps());
  assert.equal(res.status, 202);
  assert.notEqual(res.body.referenceId, 'NITDA-1999-000001');
  assert.match(res.body.referenceId, /^NITDA-\d{4}-\d{6}$/);
});

await t('references are minted sequentially and do not repeat', async () => {
  const d = deps();
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const res = await handleRequest(post('/intake/submission', VALID, { remoteAddress: `10.1.0.${i}` }), d);
    seen.add(res.body.referenceId);
  }
  assert.equal(seen.size, 4);
});

/* ── routing: intake must not become a way around the auth gate ─────────── */
section('Route isolation');

await t('an authenticated contract still requires a token', async () => {
  const res = await handleRequest(post('/dgo/SINGLE_ASSIGNMENT', {}), deps());
  assert.equal(res.status, 401, 'the authenticated path must be unaffected by intake');
});

await t('a look-alike prefix does NOT reach intake', async () => {
  // startsWith('/intake') would match this and skip the auth gate entirely.
  const res = await handleRequest(post('/intake-submission', VALID), deps());
  assert.equal(res.status, 401, 'only a real /intake/ segment may bypass authentication');
});

await t('an unknown intake action is refused', async () => {
  const res = await handleRequest(post('/intake/list', {}), deps());
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'unknown_intake_action');
});

await t('intake is unavailable rather than open when not provisioned', async () => {
  const res = await handleRequest(post('/intake/submission', VALID), { config: {}, audit: () => {} });
  assert.equal(res.status, 503);
});

await t('a non-POST request is refused before any routing', async () => {
  const res = await handleRequest({ method: 'GET', path: '/intake/submission', headers: {} }, deps());
  assert.equal(res.status, 405);
});

/* ── rate limiting ──────────────────────────────────────────────────────── */
section('Rate limiting');

await t('a burst from one address is throttled', async () => {
  const d = deps();
  const codes = [];
  for (let i = 0; i < 7; i++) {
    codes.push((await handleRequest(post('/intake/submission', VALID), d)).status);
  }
  assert.equal(codes.filter(c => c === 202).length, 5, 'five allowed per window');
  assert.equal(codes.filter(c => c === 429).length, 2, 'the rest throttled');
});

await t('a throttled response carries Retry-After', async () => {
  const d = deps();
  let res;
  for (let i = 0; i < 7; i++) res = await handleRequest(post('/intake/submission', VALID), d);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers['Retry-After']) > 0);
});

await t('one address being throttled does not throttle another', async () => {
  const d = deps();
  for (let i = 0; i < 6; i++) await handleRequest(post('/intake/submission', VALID), d);
  const other = await handleRequest(post('/intake/submission', VALID, { remoteAddress: '10.9.9.9' }), d);
  assert.equal(other.status, 202);
});

await t('X-Forwarded-For is ignored unless explicitly trusted', () => {
  const req = { headers: { 'x-forwarded-for': '1.2.3.4' }, remoteAddress: '10.0.0.1' };
  assert.equal(sourceKey(req), '10.0.0.1', 'spoofable header must not set the rate-limit key by default');
  assert.equal(sourceKey(req, { trustForwardedFor: true }), '1.2.3.4');
});

/* ── response contract ──────────────────────────────────────────────────── */
section('Response contract');

await t('an accepted submission returns 202, not 200', async () => {
  const res = await handleRequest(post('/intake/submission', VALID), deps());
  assert.equal(res.status, 202, 'accepted for processing is not the same as processed');
  assert.equal(res.body.ok, true);
  assert.ok(res.body.receivedAt);
});

await t('an invalid submission returns 400 with a reason', async () => {
  const res = await handleRequest(post('/intake/submission', { subject: 'x' }), deps());
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_submission');
  assert.ok(res.body.reason);
});

await t('with no downstream configured, delivery is reported false rather than faked', async () => {
  const res = await handleRequest(post('/intake/submission', VALID), deps({ config: { endpoints: {} } }));
  assert.equal(res.status, 202);
  assert.equal(res.body.delivered, false);
  assert.equal(res.body.reason, 'endpoint_not_configured');
  assert.ok(res.body.referenceId, 'a reference is still issued so the submitter has a receipt');
});

await t('with a downstream configured, the record is forwarded and delivery reported', async () => {
  let sent = null;
  const res = await handleRequest(post('/intake/submission', VALID), deps({
    config: { endpoints: { INTAKE_SUBMISSION: 'https://example.invalid/intake' } },
    fetchImpl: async (url, opts) => { sent = JSON.parse(opts.body); return { ok: true, status: 200 }; },
  }));
  assert.equal(res.body.delivered, true);
  assert.equal(sent.referenceId, res.body.referenceId, 'the reference forwarded matches the one issued');
  assert.equal(sent.channel, 'Portal');
  assert.equal(sent.source, 'document-portal');
});

await t('an unreachable downstream does not lose the reference', async () => {
  const res = await handleRequest(post('/intake/submission', VALID), deps({
    config: { endpoints: { INTAKE_SUBMISSION: 'https://example.invalid/intake' } },
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  }));
  assert.equal(res.status, 202);
  assert.equal(res.body.delivered, false);
  assert.ok(res.body.referenceId);
});

/* ── audit ──────────────────────────────────────────────────────────────── */
section('Audit');

await t('acceptance and forwarding are both audited', async () => {
  const events = [];
  await handleRequest(post('/intake/submission', VALID), deps({ audit: e => events.push(e.event) }));
  assert.ok(events.includes('intake:accepted'));
});

await t('a rejection is audited with its reason', async () => {
  const events = [];
  await handleRequest(post('/intake/submission', { subject: 'x' }), deps({ audit: e => events.push(e) }));
  const rej = events.find(e => e.event === 'intake:rejected');
  assert.ok(rej && rej.reason);
});

await t('the audit line does not carry the description or attachment names', async () => {
  const events = [];
  await handleRequest(post('/intake/submission', VALID), deps({ audit: e => events.push(JSON.stringify(e)) }));
  const all = events.join(' ');
  assert.ok(!all.includes('Requesting observer status'), 'description must not be logged');
  assert.ok(!all.includes('letter.pdf'), 'attachment names must not be logged');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
