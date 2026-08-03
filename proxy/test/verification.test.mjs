#!/usr/bin/env node
/**
 * Email verification for anonymous intake — decision D4.
 *
 * The control is only worth having if it cannot be walked around, so the tests that matter
 * are the bypasses:
 *
 *   1. A proof is single-use. Otherwise one verified address submits forever.
 *   2. A proof is bound to its address. Otherwise verify one mailbox, submit as anyone.
 *   3. A forged or tampered proof is refused. It is signed for exactly this reason.
 *   4. Every redemption failure looks identical to the caller. Distinguishing "no challenge"
 *      from "wrong code" tells a prober whether an address has a live challenge.
 *   5. Verification is checked BEFORE a reference is minted, so a rejected submission does
 *      not burn a registry sequence number.
 *
 * Run: node proxy/test/verification.test.mjs
 */

import assert from 'node:assert/strict';
import { handleRequest } from '../src/handler.js';
import { createVerificationService, VerificationError, VERIFY_LIMITS } from '../src/verification.js';
import { createRateLimiter, createReferenceMinter } from '../src/intake.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);
const throws = (fn, reason) => assert.throws(fn,
  e => e instanceof VerificationError && e.reason === reason,
  `expected VerificationError(${reason})`);

const SECRET = 'x'.repeat(48);
const EMAIL = 'submitter@example.org';
const svc = (over = {}) => createVerificationService({ secret: SECRET, ...over });

const VALID_SUBMISSION = {
  subject: 'A letter to the Director-General',
  category: 'General Correspondence',
  senderEmail: EMAIL,
  sender: { name: 'A. Submitter' },
};

const deps = (over = {}) => ({
  config: { endpoints: {}, requireVerification: true, ...(over.config || {}) },
  rateLimiter: createRateLimiter(),
  minter: createReferenceMinter(),
  // `??` falls through on null, so an explicit `verifier: null` needs `in`.
  verifier: 'verifier' in over ? over.verifier : svc(),
  audit: over.audit || (() => {}),
  fetchImpl: over.fetchImpl || (async () => ({ ok: true, status: 200, text: async () => '{}' })),
});
const post = (path, body, d) =>
  handleRequest({ method: 'POST', path, headers: {}, body, remoteAddress: '10.0.0.1' }, d);

console.log('\nIntake email verification (D4)');

/* ── the service ───────────────────────────────────────────────────────────── */
section('Issuing and redeeming');

await t('a secret is required, and a short one is refused', () => {
  assert.throws(() => createVerificationService({}), /secret of at least 32/);
  assert.throws(() => createVerificationService({ secret: 'tooshort' }), /secret of at least 32/);
});

await t('a challenge issues a code of the declared length', () => {
  const s = svc();
  const { code, expiresAt } = s.issue(EMAIL);
  assert.equal(code.length, VERIFY_LIMITS.codeLength);
  assert.match(code, /^\d+$/);
  assert.ok(Date.parse(expiresAt) > Date.now());
});

await t('the right code yields a proof', () => {
  const s = svc();
  const { code } = s.issue(EMAIL);
  const { token } = s.redeem(EMAIL, code);
  assert.ok(token && token.includes('.'));
});

await t('the address is normalised, so case and spacing do not matter', () => {
  const s = svc();
  const { code } = s.issue('  Submitter@Example.ORG ');
  assert.doesNotThrow(() => s.redeem(EMAIL, code));
});

await t('the code is never stored in clear', () => {
  // A dump of this structure must not hand anyone a working code.
  const s = svc();
  const { code } = s.issue(EMAIL);
  assert.ok(!JSON.stringify([...Object.values(s)]).includes(code));
});

await t('a wrong code is refused', () => {
  const s = svc();
  s.issue(EMAIL);
  throws(() => s.redeem(EMAIL, '000000'), 'mismatch');
});

await t('a code for one address does not work for another', () => {
  const s = svc();
  const { code } = s.issue(EMAIL);
  throws(() => s.redeem('someone.else@example.org', code), 'no_challenge');
});

await t('an expired challenge is refused', () => {
  let t0 = 1_000_000;
  const s = createVerificationService({ secret: SECRET, now: () => t0 });
  const { code } = s.issue(EMAIL);
  t0 += VERIFY_LIMITS.ttlMs + 1;
  throws(() => s.redeem(EMAIL, code), 'expired');
});

await t('a re-issued challenge replaces the first', () => {
  // Two live codes for one address doubles the guessing surface for no benefit.
  const s = svc();
  const first = s.issue(EMAIL).code;
  const second = s.issue(EMAIL).code;
  if (first !== second) throws(() => s.redeem(EMAIL, first), 'mismatch');
  assert.doesNotThrow(() => s.redeem(EMAIL, second));
});

await t('attempts are capped and the challenge is burned, not merely slowed', () => {
  const s = svc();
  s.issue(EMAIL);
  for (let i = 0; i < VERIFY_LIMITS.maxAttempts; i++) {
    try { s.redeem(EMAIL, '111111'); } catch { /* expected */ }
  }
  throws(() => s.redeem(EMAIL, '111111'), 'too_many_attempts');
  assert.equal(s.outstanding(), 0, 'the challenge must be gone, not just rate-limited');
});

await t('issuance is throttled per address', () => {
  const s = svc();
  for (let i = 0; i < VERIFY_LIMITS.perWindow; i++) s.issue(EMAIL);
  throws(() => s.issue(EMAIL), 'too_many_requests');
});

/* ── the bypasses ──────────────────────────────────────────────────────────── */
section('The proof cannot be reused, retargeted or forged');

await t('a proof is single-use', () => {
  const s = svc();
  const { code } = s.issue(EMAIL);
  const { token } = s.redeem(EMAIL, code);
  assert.doesNotThrow(() => s.consume(token, EMAIL));
  throws(() => s.consume(token, EMAIL), 'verification_already_used');
});

await t('a proof is bound to the address it was earned for', () => {
  const s = svc();
  const { code } = s.issue(EMAIL);
  const { token } = s.redeem(EMAIL, code);
  throws(() => s.consume(token, 'victim@example.org'), 'verification_email_mismatch');
});

await t('a tampered payload is refused', () => {
  const s = svc();
  const { code } = s.issue(EMAIL);
  const { token } = s.redeem(EMAIL, code);
  const [body, mac] = token.split('.');
  const forged = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
    email: 'victim@example.org',
  })).toString('base64url');
  throws(() => s.consume(`${forged}.${mac}`, 'victim@example.org'), 'bad_verification_signature');
});

await t('a proof signed with another secret is refused', () => {
  const a = svc(), b = createVerificationService({ secret: 'y'.repeat(48) });
  const { code } = b.issue(EMAIL);
  const { token } = b.redeem(EMAIL, code);
  throws(() => a.consume(token, EMAIL), 'bad_verification_signature');
});

await t('a missing or malformed proof is refused', () => {
  const s = svc();
  throws(() => s.consume('', EMAIL), 'missing_verification');
  throws(() => s.consume('not-a-token', EMAIL), 'malformed_verification');
});

await t('a proof whose challenge was never redeemed does not exist', () => {
  const s = svc();
  s.issue(EMAIL);
  throws(() => s.consume('abc.def', EMAIL), 'bad_verification_signature');
});

/* ── the routes ────────────────────────────────────────────────────────────── */
section('Routes');

await t('POST /intake/verify issues a challenge without returning the code', async () => {
  let mailed = null;
  const out = await post('/intake/verify', { email: EMAIL }, deps({
    config: { endpoints: { INTAKE_VERIFY_EMAIL: 'https://mail.invalid/send' }, requireVerification: true },
    fetchImpl: async (url, o) => { mailed = JSON.parse(o.body); return { ok: true, status: 200 }; },
  }));
  assert.equal(out.status, 202);
  assert.equal(out.body.sent, true);
  assert.equal(out.body.code, undefined, 'returning the code would make the round-trip decorative');
  assert.ok(!JSON.stringify(out.body).includes(mailed.code));
  assert.equal(mailed.to, EMAIL);
});

await t('with no mail endpoint the challenge is still issued and says sent:false', async () => {
  const out = await post('/intake/verify', { email: EMAIL }, deps());
  assert.equal(out.status, 202);
  assert.equal(out.body.sent, false, 'a deployment must be able to see verification is unreachable');
});

await t('an invalid address is refused before a challenge exists', async () => {
  const out = await post('/intake/verify', { email: 'not-an-email' }, deps());
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'invalid_email');
});

await t('every confirm failure looks identical to the caller', async () => {
  // "no challenge", "expired" and "wrong code" are three different facts about an address.
  const d = deps();
  const noChallenge = await post('/intake/verify-confirm', { email: EMAIL, code: '123456' }, d);
  await post('/intake/verify', { email: EMAIL }, d);
  const wrongCode = await post('/intake/verify-confirm', { email: EMAIL, code: '000000' }, d);

  assert.equal(noChallenge.status, wrongCode.status);
  const shape = o => JSON.stringify({ ...o.body, correlationId: undefined });
  assert.equal(shape(noChallenge), shape(wrongCode), 'the bodies must be identical');
  assert.equal(noChallenge.body.error, 'verification_failed');
  assert.ok(!('reason' in noChallenge.body), 'no field may hint at which failure it was');
});

await t('the routes answer 503 when no verifier is configured', async () => {
  for (const p of ['/intake/verify', '/intake/verify-confirm']) {
    const out = await post(p, { email: EMAIL }, deps({ verifier: null }));
    assert.equal(out.status, 503);
    assert.equal(out.body.error, 'verification_not_available');
  }
});

/* ── enforcement on submission ─────────────────────────────────────────────── */
section('Enforcement on submission');

await t('an unverified submission is refused when verification is required', async () => {
  const out = await post('/intake/submission', VALID_SUBMISSION, deps());
  assert.equal(out.status, 403);
  assert.equal(out.body.error, 'verification_required');
});

await t('a verified submission is accepted and says so', async () => {
  const v = svc();
  const { code } = v.issue(EMAIL);
  const { token } = v.redeem(EMAIL, code);
  const out = await post('/intake/submission', { ...VALID_SUBMISSION, verification: token }, deps({ verifier: v }));
  assert.equal(out.status, 202);
  assert.ok(out.body.referenceId);
  assert.equal(out.body.verified, true, 'the response must state the posture that issued it');
});

await t('a rejected submission does not burn a reference', async () => {
  // Verification is checked before minting; otherwise the registry sequence advances on
  // every refused attempt and the gaps are unexplainable later.
  const m = createReferenceMinter();
  const before = m.peek();
  const out = await post('/intake/submission', VALID_SUBMISSION, { ...deps(), minter: m });
  assert.equal(out.status, 403);
  assert.equal(m.peek(), before, 'the sequence must not advance on a refusal');
});

await t('a proof cannot be replayed for a second submission', async () => {
  const v = svc();
  const { code } = v.issue(EMAIL);
  const { token } = v.redeem(EMAIL, code);
  const d = deps({ verifier: v });
  const first = await post('/intake/submission', { ...VALID_SUBMISSION, verification: token }, d);
  const second = await post('/intake/submission', { ...VALID_SUBMISSION, verification: token }, d);
  assert.equal(first.status, 202);
  assert.equal(second.status, 403, 'one verification buys one submission');
});

await t('a proof for one address cannot submit under another', async () => {
  const v = svc();
  const { code } = v.issue(EMAIL);
  const { token } = v.redeem(EMAIL, code);
  const out = await post('/intake/submission',
    { ...VALID_SUBMISSION, senderEmail: 'victim@example.org', verification: token },
    deps({ verifier: v }));
  assert.equal(out.status, 403);
});

await t('with verification OFF the channel stays open and says so', async () => {
  // The default posture. A control that silently stops citizens writing to a government
  // registry is worse than the abuse it prevents, so this must keep working.
  const out = await post('/intake/submission', VALID_SUBMISSION,
    deps({ config: { endpoints: {}, requireVerification: false } }));
  assert.equal(out.status, 202);
  assert.ok(out.body.referenceId);
  assert.equal(out.body.verified, false);
});

await t('requiring verification without a verifier fails closed, not open', async () => {
  const out = await post('/intake/submission', VALID_SUBMISSION, deps({ verifier: null }));
  assert.equal(out.status, 503, 'it must refuse, never accept unverified');
  assert.notEqual(out.status, 202);
});

/* ── audit ─────────────────────────────────────────────────────────────────── */
section('Audit');

await t('a failed confirm is audited with its real reason, though the caller is not told', async () => {
  const events = [];
  const d = deps({ audit: e => events.push(e) });
  await post('/intake/verify-confirm', { email: EMAIL, code: '123456' }, d);
  const f = events.find(e => e.event === 'intake:verify-failed');
  assert.ok(f, 'detection needs the distinction the caller is denied');
  assert.equal(f.reason, 'no_challenge');
});

await t('no audit line carries a code or a proof token', async () => {
  const events = [];
  const v = svc();
  const { code } = v.issue(EMAIL);
  const { token } = v.redeem(EMAIL, code);
  const d = deps({ verifier: v, audit: e => events.push(JSON.stringify(e)) });
  await post('/intake/submission', { ...VALID_SUBMISSION, verification: token }, d);
  const all = events.join(' ');
  assert.ok(!all.includes(code), 'a code in the log is a code in everyone who reads the log');
  assert.ok(!all.includes(token));
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
