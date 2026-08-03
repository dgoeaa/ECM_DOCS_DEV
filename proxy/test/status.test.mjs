#!/usr/bin/env node
/**
 * Status read-back — TARGET_ARCHITECTURE.md §3.4, step 6.
 *
 * This route is the first unauthenticated READ in the proxy, so the tests that matter are
 * the ones proving it cannot be turned into an enumeration tool or a leak of the
 * correspondence itself. Three properties carry that weight and each is asserted directly:
 *
 *   1. Unknown reference and wrong email are indistinguishable in the response.
 *   2. The projection is an allow-list — an unexpected upstream field never reaches a caller.
 *   3. The proxy re-checks the email itself rather than trusting the upstream to have done it.
 *
 * Each is written as a negative control: break the property and the case fails.
 *
 * Run: node proxy/test/status.test.mjs
 */

import assert from 'node:assert/strict';
import { handleRequest } from '../src/handler.js';
import {
  validateStatusQuery, projectStatus, createRateLimiter, createReferenceMinter,
  STATUS_LIMITS,
} from '../src/intake.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const REF = 'NITDA-2026-000318';
const EMAIL = 'a.submitter@example.org';

/** A registry record as an upstream might return it — including fields that must NOT escape. */
const UPSTREAM = {
  referenceId: REF,
  senderEmail: EMAIL,
  status: 'in-review',
  statusLabel: 'Under review',
  category: 'General Correspondence',
  subject: 'Request to participate as an observer',
  receivedAt: '2026-08-01T09:12:00Z',
  acknowledgedAt: '2026-08-01T09:12:04Z',
  updatedAt: '2026-08-02T14:40:00Z',
  actionRequired: false,
  timeline: [
    { at: '2026-08-01T09:12:04Z', status: 'received', label: 'Received', public: true, note: 'Logged by the registry.' },
    { at: '2026-08-02T14:40:00Z', status: 'in-review', label: 'Under review', note: 'Sender is a known problem correspondent — handle carefully.' },
  ],
  // Everything below is internal and must never appear in a response.
  description: 'Requesting observer status for the forthcoming review.',
  attachments: [{ name: 'letter.pdf', size: 240112 }],
  assignedOfficer: 'A. Bello',
  unit: 'Registry & Correspondence',
  internalNotes: 'Escalate if it recurs.',
  senderPhone: '+2348000000000',
};

const upstreamOk = (rec = UPSTREAM) => async () => ({ ok: true, status: 200, json: async () => rec });
const upstream404 = () => async () => ({ ok: false, status: 404, json: async () => ({}) });

const deps = (over = {}) => ({
  config: { endpoints: { INTAKE_STATUS: 'https://registry.invalid/status' } },
  rateLimiter: createRateLimiter(),
  statusRateLimiter: createRateLimiter({ windowMs: STATUS_LIMITS.windowMs, perWindow: STATUS_LIMITS.perWindow }),
  minter: createReferenceMinter(),
  audit: () => {},
  fetchImpl: upstreamOk(),
  ...over,
});
const post = (body, extra = {}) =>
  ({ method: 'POST', path: '/intake/status', headers: {}, body, remoteAddress: '10.0.0.1', ...extra });

console.log('\nStatus read-back');

/* ── validation ─────────────────────────────────────────────────────────── */
section('Query validation');

await t('a well-formed pair validates and is normalised', () => {
  const q = validateStatusQuery({ referenceId: 'nitda-2026-000318', email: 'A.Submitter@Example.ORG' });
  assert.equal(q.referenceId, REF, 'reference is upper-cased');
  assert.equal(q.email, EMAIL, 'email is lower-cased');
});

await t('a missing reference is refused', () => {
  assert.throws(() => validateStatusQuery({ email: EMAIL }), e => e.reason === 'missing_reference');
});

await t('a missing email is refused — the reference alone is not a credential', () => {
  assert.throws(() => validateStatusQuery({ referenceId: REF }), e => e.reason === 'missing_email');
});

await t('a malformed email is refused', () => {
  assert.throws(() => validateStatusQuery({ referenceId: REF, email: 'not-an-email' }),
    e => e.reason === 'invalid_email');
});

await t('a reference of junk is refused before it reaches the upstream', () => {
  assert.throws(() => validateStatusQuery({ referenceId: '../../etc/passwd', email: EMAIL }),
    e => e.reason === 'invalid_reference');
});

await t('an over-long reference is refused', () => {
  assert.throws(() => validateStatusQuery({ referenceId: 'N'.repeat(200), email: EMAIL }),
    e => e.reason === 'reference_too_long');
});

await t('a non-object body is refused', () => {
  assert.throws(() => validateStatusQuery('NITDA-2026-000318'), e => e.reason === 'malformed_body');
  assert.throws(() => validateStatusQuery([REF, EMAIL]), e => e.reason === 'malformed_body');
});

/* ── projection ─────────────────────────────────────────────────────────── */
section('Projection is an allow-list');

await t('the citizen-visible fields survive', () => {
  const p = projectStatus(UPSTREAM);
  assert.equal(p.referenceId, REF);
  assert.equal(p.status, 'in-review');
  assert.equal(p.statusLabel, 'Under review');
  assert.equal(p.category, 'General Correspondence');
  assert.equal(p.receivedAt, '2026-08-01T09:12:00Z');
  assert.equal(p.acknowledgedAt, '2026-08-01T09:12:04Z');
  assert.equal(p.actionRequired, false);
});

await t('the correspondence body and its attachments do not', () => {
  const p = projectStatus(UPSTREAM);
  assert.equal(p.description, undefined);
  assert.equal(p.attachments, undefined);
});

await t('internal routing and deliberation do not', () => {
  const p = projectStatus(UPSTREAM);
  assert.equal(p.assignedOfficer, undefined);
  assert.equal(p.unit, undefined);
  assert.equal(p.internalNotes, undefined);
  assert.equal(p.senderPhone, undefined);
  assert.equal(p.senderEmail, undefined, 'the caller supplied the email; echoing it back adds nothing');
});

await t('a field the upstream invents tomorrow does not leak', () => {
  // The point of an allow-list: nobody has to remember to block this.
  const p = projectStatus({ ...UPSTREAM, nationalIdNumber: '12345678901', reviewerVerdict: 'reject' });
  assert.equal(p.nationalIdNumber, undefined);
  assert.equal(p.reviewerVerdict, undefined);
});

await t('a timeline note is carried only when the registry marked the entry public', () => {
  const p = projectStatus(UPSTREAM);
  assert.equal(p.timeline.length, 2, 'both entries are shown');
  assert.equal(p.timeline[0].note, 'Logged by the registry.');
  assert.equal(p.timeline[1].note, '', 'an unmarked note is withheld, it is not a default-open field');
  assert.ok(!JSON.stringify(p).includes('known problem correspondent'));
});

await t('the timeline is bounded and its notes are truncated', () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ at: `t${i}`, label: 'x', public: true, note: 'z'.repeat(9000) }));
  const p = projectStatus({ ...UPSTREAM, timeline: many });
  assert.equal(p.timeline.length, STATUS_LIMITS.maxTimelineEntries);
  assert.equal(p.timeline[0].note.length, STATUS_LIMITS.maxNoteChars);
});

await t('a malformed timeline does not throw', () => {
  assert.doesNotThrow(() => projectStatus({ ...UPSTREAM, timeline: 'not an array' }));
  assert.doesNotThrow(() => projectStatus({ ...UPSTREAM, timeline: [null, 7, 'x'] }));
  assert.equal(projectStatus({ timeline: [null] }).timeline.length, 0, 'empty entries are dropped');
});

/* ── the route ──────────────────────────────────────────────────────────── */
section('Route behaviour');

await t('a matching pair returns the projected record', async () => {
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }), deps());
  assert.equal(out.status, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.record.status, 'in-review');
});

await t('a lookup carries no credential and needs none', async () => {
  const req = post({ referenceId: REF, email: EMAIL });
  assert.equal(req.headers.authorization, undefined);
  const out = await handleRequest(req, deps());
  assert.equal(out.status, 200);
});

await t('an unknown reference and a wrong email are indistinguishable', async () => {
  const miss = await handleRequest(post({ referenceId: 'NITDA-2026-999999', email: EMAIL }),
    deps({ fetchImpl: upstream404() }));
  const wrong = await handleRequest(post({ referenceId: REF, email: 'someone.else@example.org' }),
    deps());

  assert.equal(miss.status, wrong.status, 'the status codes must match');
  // correlationId differs per request by design; everything else must be identical.
  const shape = o => JSON.stringify({ ...o.body, correlationId: undefined });
  assert.equal(shape(miss), shape(wrong), 'the bodies must be byte-identical');
  assert.equal(miss.body.error, 'not_found');
  assert.ok(!('reason' in miss.body), 'no field may hint at which of the two it was');
});

await t('the proxy re-checks the email rather than trusting the upstream', async () => {
  // An upstream that ignores the email parameter and matches on the reference alone.
  const careless = async () => ({ ok: true, status: 200, json: async () => UPSTREAM });
  const out = await handleRequest(post({ referenceId: REF, email: 'attacker@example.org' }),
    deps({ fetchImpl: careless }));
  assert.equal(out.status, 404, 'the proxy must deny even though the upstream said yes');
  assert.equal(out.body.record, undefined);
});

await t('a record with no email on file is denied, not served', async () => {
  const noEmail = { ...UPSTREAM };
  delete noEmail.senderEmail;
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }),
    deps({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => noEmail }) }));
  assert.equal(out.status, 404, 'absent must not compare equal to absent');
});

await t('an upstream that nests the record under `record` is understood', async () => {
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }),
    deps({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, record: UPSTREAM }) }) }));
  assert.equal(out.status, 200);
  assert.equal(out.body.record.subject, UPSTREAM.subject);
});

await t('an unconfigured read-back answers 503, not a denial', async () => {
  // A 404 here would tell the submitter their request does not exist, which is a claim
  // about the registry this proxy is in no position to make.
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }),
    deps({ config: { endpoints: {} } }));
  assert.equal(out.status, 503);
  assert.equal(out.body.error, 'status_not_available');
});

await t('an upstream error is 502 and is not reported as not-found', async () => {
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }),
    deps({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }));
  assert.equal(out.status, 502);
  assert.equal(out.body.error, 'status_upstream_error');
});

await t('an unreachable upstream is 502, not a crash', async () => {
  const out = await handleRequest(post({ referenceId: REF, email: EMAIL }),
    deps({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }));
  assert.equal(out.status, 502);
});

await t('a malformed query is 400 and never reaches the upstream', async () => {
  let called = false;
  const out = await handleRequest(post({ referenceId: 'x', email: EMAIL }),
    deps({ fetchImpl: async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; } }));
  assert.equal(out.status, 400);
  assert.equal(called, false, 'junk must be rejected at the edge');
});

/* ── rate limiting ──────────────────────────────────────────────────────── */
section('Rate limiting');

await t('status lookups are capped per source', async () => {
  const d = deps();
  let last;
  for (let i = 0; i < STATUS_LIMITS.perWindow + 2; i++) {
    last = await handleRequest(post({ referenceId: REF, email: EMAIL }), d);
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers['Retry-After']) > 0);
});

await t('exhausting the status budget does not block a submission', async () => {
  // The two budgets are separate precisely so a guessing run cannot deny service to a
  // legitimate submitter, and so it cannot hide inside the more generous allowance.
  const d = deps({ config: { endpoints: { INTAKE_STATUS: 'https://registry.invalid/status' } } });
  for (let i = 0; i < STATUS_LIMITS.perWindow + 2; i++) {
    await handleRequest(post({ referenceId: REF, email: EMAIL }), d);
  }
  const sub = await handleRequest({
    method: 'POST', path: '/intake/submission', headers: {}, remoteAddress: '10.0.0.1',
    body: {
      subject: 'A letter', category: 'General Correspondence', senderEmail: EMAIL,
      sender: { name: 'A. Submitter' },
    },
  }, d);
  assert.notEqual(sub.status, 429, 'the submission budget must be untouched');
  assert.equal(sub.status, 202);
});

/* ── audit ──────────────────────────────────────────────────────────────── */
section('Audit');

await t('a served lookup is audited with the reference', async () => {
  const events = [];
  await handleRequest(post({ referenceId: REF, email: EMAIL }), deps({ audit: e => events.push(e) }));
  const served = events.find(e => e.event === 'intake:status-served');
  assert.ok(served, 'a successful read must leave a trace');
  assert.equal(served.referenceId, REF);
});

await t('a denial is audited without echoing the attempted email', async () => {
  const events = [];
  await handleRequest(post({ referenceId: REF, email: 'attacker@example.org' }),
    deps({ audit: e => events.push(JSON.stringify(e)) }));
  const all = events.join(' ');
  assert.ok(all.includes('intake:status-denied'), 'a denial must be visible to detection');
  assert.ok(!all.includes('attacker@example.org'), 'the audit log is not a place to collect guessed addresses');
});

await t('the audit line does not carry the correspondence', async () => {
  const events = [];
  await handleRequest(post({ referenceId: REF, email: EMAIL }), deps({ audit: e => events.push(JSON.stringify(e)) }));
  const all = events.join(' ');
  assert.ok(!all.includes('Requesting observer status'));
  assert.ok(!all.includes('known problem correspondent'));
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
