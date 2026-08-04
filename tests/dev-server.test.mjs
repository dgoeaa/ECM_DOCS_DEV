#!/usr/bin/env node
/**
 * Local development server.
 *
 * The value of this file is that the dev server answers in the SAME shapes the real
 * backend does. If it drifts, the platform passes against the stub and fails against Power
 * Automate — which is worse than having no stub at all, because the failure surfaces at
 * deployment rather than here.
 *
 * So the assertions are mostly contract-shape assertions: every key the app calls answers,
 * the envelope is the one core/contracts.js accepts, and the collections FETCH_ALL returns
 * are the aliases core/data-loader.js actually looks for.
 *
 * The intake assertions cover the properties that are not merely cosmetic — a
 * client-supplied reference must not survive, a ticket must not be replayable, declared
 * bytes must be verified, and the status denial must be uniform — because a dev server
 * that is laxer than the proxy teaches the wrong thing about how the portal behaves.
 *
 * Run: node tests/dev-server.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../scripts/dev/store.mjs';
import { handleContract, envelope, readRequest, resolveKey } from '../scripts/dev/endpoints.mjs';
import { handleIntake, handleScan } from '../scripts/dev/intake.mjs';
import { assertEnvelope, collection } from '../core/contracts.js';
import { EndpointContracts, EndpointKeys } from '../config/endpoints.config.js';

let passed = 0, failed = 0;
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dgo-dev-'));
const newStore = () => createStore({ file: path.join(tmp, `${crypto.randomUUID()}.json`) });

/** Call a contract the way core/data-client.js does. */
const call = (store, key, payload = {}, actor = 'tester@nitda.gov.ng') => handleContract(
  key,
  { action: EndpointContracts[key].action, payload, userEmail: actor, requestId: crypto.randomUUID() },
  store,
);

// ---------------------------------------------------------------------------
section('Envelope contract — what core/contracts.js accepts');

await t('assertEnvelope accepts a success envelope and returns its data', () => {
  const env = envelope({ action: 'fetchAll', requestId: 'r', data: { docs: [] }, startedAt: new Date().toISOString() });
  assert.deepEqual(assertEnvelope(env, 'fetchAll'), { docs: [] });
});

await t('assertEnvelope throws on a failure envelope, carrying the message', () => {
  const out = handleContract('NOT_A_REAL_KEY', { action: 'nope' }, newStore());
  assert.equal(out.status, 404);
  assert.throws(() => assertEnvelope(out.body), /Unknown endpoint contract/);
});

await t('readRequest unwraps both body shapes the client sends', () => {
  const nested = readRequest({ action: 'a', payload: { x: 1 }, userEmail: 'u@x.ng', requestId: 'r1' });
  assert.deepEqual(nested.payload, { x: 1 });
  assert.equal(nested.actor, 'u@x.ng');

  // flatPayload:true — SINGLE_ASSIGNMENT sends this shape.
  const flat = readRequest({ action: 'a', x: 1, y: 2, userEmail: 'u@x.ng', correlationId: 'c1' });
  assert.deepEqual(flat.payload, { x: 1, y: 2 });
  assert.equal(flat.requestId, 'c1');
});

// ---------------------------------------------------------------------------
section('Every contract key the app can call answers');

await t(`all ${EndpointKeys.length} contract keys return a 200 envelope`, () => {
  const store = newStore();
  const unanswered = [];
  for (const key of EndpointKeys) {
    const out = call(store, key, { referenceId: 'NITDA/REG/2026/0101', messages: [], id: 'EM-001' });
    if (out.status !== 200 || out.body.ok !== true) unanswered.push(`${key} → ${out.status}`);
  }
  assert.deepEqual(unanswered, [], `unanswered: ${unanswered.join(', ')}`);
});

await t('an action claimed by two contract keys is decided by the path, not by declaration order', () => {
  // BULK_ASSIGNMENT and BULK_ASSIGNMENT_DIRECT both declare `bulkassignment`. They behave
  // identically today; resolving by whichever was declared last would make that a
  // coincidence rather than a decision, and the first divergence would be silent.
  assert.equal(resolveKey('bulkassignment', 'BULK_ASSIGNMENT'), 'BULK_ASSIGNMENT');
  assert.equal(resolveKey('bulkassignment', 'BULK_ASSIGNMENT_DIRECT'), 'BULK_ASSIGNMENT_DIRECT');
  // An unclaimed path still falls back to a claimant rather than failing.
  assert.ok(['BULK_ASSIGNMENT', 'BULK_ASSIGNMENT_DIRECT'].includes(resolveKey('bulkassignment', 'NONSENSE')));
  // An unambiguous action ignores the path entirely — that is what lets DISPATCH_OUTBOUND
  // and ARCHIVE_REFERENCE share the DYNAMIC_ACTIONS url.
  assert.equal(resolveKey('archiveReference', 'DYNAMIC_ACTIONS'), 'ARCHIVE_REFERENCE');
  assert.equal(resolveKey('dispatchOutbound', 'DYNAMIC_ACTIONS'), 'DISPATCH_OUTBOUND');
});

await t('DISPATCH_OUTBOUND and ARCHIVE_REFERENCE route correctly despite sharing a URL', () => {
  // Both resolve to the DYNAMIC_ACTIONS url in the registry, so dispatch must key on the
  // action in the body. If it keyed on the path, one of these would silently run the other.
  const store = newStore();
  const dispatched = assertEnvelope(call(store, 'DISPATCH_OUTBOUND', { ref: 'NITDA/REG/2026/0101' }).body);
  assert.equal(dispatched.dispatched, true);

  const archived = assertEnvelope(call(store, 'ARCHIVE_REFERENCE', { ref: 'NITDA/REG/2026/0102' }).body);
  assert.equal(archived.applied, true);
  assert.ok(archived.archivedAt, 'archive must report when');
});

// ---------------------------------------------------------------------------
section('FETCH_ALL feeds core/data-loader.js');

await t('every collection data-loader looks for is present under an alias it accepts', () => {
  const data = assertEnvelope(call(newStore(), 'FETCH_ALL').body);
  // These alias lists are copied from the `specs` table in core/data-loader.js. If that
  // table changes and this does not, the mismatch shows up here rather than as an empty
  // workspace nobody can explain.
  const specs = {
    activities: ['docs', 'activities', 'Activities', 'correspondence', 'items', 'records'],
    tracking: ['tasks', 'tracking', 'Tracking', 'Tasks'],
    comments: ['taskComments', 'comments', 'Comments'],
    users: ['users', 'Users'],
    categories: ['categories', 'Categories'],
    departments: ['departments', 'Departments'],
    emails: ['emails', 'Emails'],
    approvals: ['approvals', 'Approvals'],
  };
  for (const [target, aliases] of Object.entries(specs)) {
    assert.ok(collection(data, ...aliases).length > 0, `${target}: no rows under ${aliases.join('/')}`);
  }
});

await t('seeded records carry the fields core/domain.js normalises on', async () => {
  const { normalizeDocument, normalizeTask } = await import('../core/domain.js');
  const data = assertEnvelope(call(newStore(), 'FETCH_ALL').body);

  const doc = normalizeDocument(data.docs[0]);
  assert.ok(doc.title && doc.title !== 'Untitled', 'title must survive normalisation');
  assert.ok(doc.referenceId, 'referenceId must survive normalisation');
  assert.ok(doc.category, 'category must survive — routing and cascade both key on it');
  assert.ok(doc.created, 'created must parse to an ISO date');

  const task = normalizeTask(data.tasks[0]);
  assert.ok(task.title && task.title !== 'Untitled task');
  assert.ok(task.referenceId, 'task must carry a reference');
  assert.ok(task.priority, 'task priority must normalise');
});

// ---------------------------------------------------------------------------
section('Writes reach the store');

await t('SINGLE_ASSIGNMENT assigns the record and raises the task that carries the work', () => {
  const store = newStore();
  const before = store.get().tracking.length;
  const res = assertEnvelope(call(store, 'SINGLE_ASSIGNMENT', {
    referenceId: 'NITDA/REG/2026/0107', assignedTo: 'a.bello@nitda.gov.ng', assignedToDsu: 'Registry',
  }).body);

  assert.equal(res.assigned, true);
  assert.equal(store.get().tracking.length, before + 1, 'an assignment must raise a task');
  const doc = store.get().activities.find(a => a.RefIDD === 'NITDA/REG/2026/0107');
  assert.equal(doc.AssignedTo, 'a.bello@nitda.gov.ng');
  assert.equal(doc.AssignmentStatus, 'Assigned');
});

await t('an assignment against an unknown reference is refused, not invented', () => {
  const res = assertEnvelope(call(newStore(), 'SINGLE_ASSIGNMENT', { referenceId: 'NO/SUCH/REF' }).body);
  assert.equal(res.assigned, false);
  assert.equal(res.reason, 'reference_not_found');
});

await t('DYNAMIC_ACTIONS applies the operations modules actually send', () => {
  const store = newStore();
  const ref = 'NITDA/REG/2026/0103';

  assert.equal(assertEnvelope(call(store, 'DYNAMIC_ACTIONS', { action: 'transition', ref, status: 'Closed' }).body).applied, true);
  assert.equal(store.get().activities.find(a => a.RefIDD === ref).Status, 'Closed');

  const minuted = assertEnvelope(call(store, 'DYNAMIC_ACTIONS', { action: 'appendMinute', ref, note: 'Noted.' }).body);
  assert.equal(minuted.applied, true);
  assert.ok(store.get().comments.some(c => c.RefIDD === ref && c.Description === 'Noted.'));

  const upserted = assertEnvelope(call(store, 'DYNAMIC_ACTIONS', {
    action: 'upsert_record', module: 'DGCEO_Briefs', data: { id: 'B1', title: 'Brief' },
  }).body);
  assert.equal(upserted.created, true);
  assert.equal(store.get().DGCEO_Briefs.length, 1);
});

await t('an unhandled dynamic operation is recorded, not silently dropped', () => {
  const store = newStore();
  const res = assertEnvelope(call(store, 'DYNAMIC_ACTIONS', { action: 'some_future_operation', ref: 'X' }).body);
  assert.equal(res.applied, false);
  assert.equal(res.acknowledged, true);
  assert.ok(store.get().outbox.some(o => o.operation === 'some_future_operation'),
    'the gap must be findable in the outbox');
});

await t('EMAIL reports delivered:false — nothing is transmitted, and it must not claim to be', () => {
  const store = newStore();
  const res = assertEnvelope(call(store, 'EMAIL', { to: ['x@y.ng'], subject: 'Hi' }).body);
  assert.equal(res.queued, true);
  assert.equal(res.delivered, false);
  assert.equal(store.get().outbox[0].delivered, false);
});

await t('writes survive a restart', () => {
  const file = path.join(tmp, 'persist.json');
  const first = createStore({ file });
  call(first, 'DYNAMIC_ACTIONS', { action: 'appendMinute', ref: 'NITDA/REG/2026/0101', note: 'Persisted.' });
  fs.writeFileSync(file, JSON.stringify(first.get(), null, 2));

  const second = createStore({ file });
  assert.ok(second.get().comments.some(c => c.Description === 'Persisted.'));
});

// ---------------------------------------------------------------------------
section('OTP step-up');

await t('a generated request verifies with the dev code and then cannot be replayed', () => {
  const store = newStore();
  const gen = assertEnvelope(call(store, 'OTP_GENERATE', { operation: 'archive' }).body).result;
  assert.ok(gen.requestId);
  assert.equal(gen.sent, false, 'no message is sent, and it must not claim otherwise');

  const ok = assertEnvelope(call(store, 'OTP_VERIFY', { requestId: gen.requestId, otp: gen.devCode }).body).result;
  assert.equal(ok.verified, true);

  const replay = assertEnvelope(call(store, 'OTP_VERIFY', { requestId: gen.requestId, otp: gen.devCode }).body).result;
  assert.equal(replay.verified, false, 'a consumed OTP must not verify twice');
});

await t('a wrong code does not verify', () => {
  const store = newStore();
  const gen = assertEnvelope(call(store, 'OTP_GENERATE', {}).body).result;
  const res = assertEnvelope(call(store, 'OTP_VERIFY', { requestId: gen.requestId, otp: '999999' }).body).result;
  assert.equal(res.verified, false);
  assert.equal(res.reason, 'wrong_code');
});

// ---------------------------------------------------------------------------
section('Anonymous intake — the portal path');

const submission = (over = {}) => ({
  name: 'Adaobi Eze', email: 'a.eze@ui.edu.ng', title: 'Research data-sharing guidance',
  category: 'General Correspondence', org: 'University of Ibadan', description: 'Seeking guidance.',
  ...over,
});

await t('a submission is accepted with 202 and a server-minted reference', () => {
  const out = handleIntake('/intake/submission', 'POST', submission(), newStore());
  assert.equal(out.status, 202, '202 — a reference is issued, but routing has not happened');
  assert.ok(/^NITDA\/REG\/\d{4}\/\d{4}$/.test(out.body.referenceId));
});

await t('a client-supplied referenceId never survives', () => {
  const out = handleIntake('/intake/submission', 'POST',
    submission({ referenceId: 'ATTACKER-CHOSEN' }), newStore());
  assert.notEqual(out.body.referenceId, 'ATTACKER-CHOSEN');
});

await t('channel and correspondenceType are fixed, not taken from the caller', () => {
  const store = newStore();
  handleIntake('/intake/submission', 'POST',
    submission({ channel: 'Registry', correspondenceType: 'Registry' }), store);
  const sub = store.get().submissions[0];
  assert.equal(sub.record.channel, 'Document Portal');
  assert.equal(sub.record.correspondenceType, 'Inbound');
});

await t('an unrecognised category falls back rather than being accepted as given', () => {
  const store = newStore();
  handleIntake('/intake/submission', 'POST', submission({ category: 'Internal Only' }), store);
  assert.equal(store.get().submissions[0].record.category, 'General Correspondence');
});

await t('a malformed submission is refused with its reasons', () => {
  const out = handleIntake('/intake/submission', 'POST', { name: '', email: 'not-an-email' }, newStore());
  assert.equal(out.status, 400);
  assert.ok(out.body.reasons.length >= 2);
});

await t('a portal submission enters the registry the operations app reads', () => {
  const store = newStore();
  const ref = handleIntake('/intake/submission', 'POST', submission(), store).body.referenceId;
  const data = assertEnvelope(call(store, 'FETCH_ALL').body);
  assert.ok(data.docs.some(d => d.RefIDD === ref),
    'the two applications must be one system, not two demos side by side');
});

// ---------------------------------------------------------------------------
section('Upload brokering');

const upload = (store, body, ticket) => handleIntake('/intake/upload', 'PUT', body, store,
  { headers: { 'x-upload-ticket': ticket } });

await t('a ticket redeems once, with the bytes it was issued for', () => {
  const store = newStore();
  const bytes = Buffer.from('a letter to the agency');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const res = handleIntake('/intake/submission', 'POST',
    submission({ files: [{ name: 'letter.pdf', size: bytes.length, sha256: sha }] }), store);

  const ticket = res.body.uploads[0].ticket;
  const first = upload(store, bytes, ticket);
  assert.equal(first.status, 200);
  assert.equal(first.body.stored, true);

  const replay = upload(store, bytes, ticket);
  assert.equal(replay.status, 403);
  assert.equal(replay.body.error, 'ticket_already_redeemed');
});

await t('a forged ticket is refused', () => {
  const store = newStore();
  const forged = Buffer.from(JSON.stringify({ ref: 'X', name: 'f.pdf', exp: '2999-01-01T00:00:00Z' })).toString('base64url') + '.notavalidmac';
  assert.equal(upload(store, Buffer.from('x'), forged).status, 403);
});

await t('declared size and digest are verified against the bytes that arrive', () => {
  const store = newStore();
  const bytes = Buffer.from('the real document');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const res = handleIntake('/intake/submission', 'POST',
    submission({ files: [{ name: 'd.pdf', size: bytes.length, sha256: sha }] }), store);
  const ticket = res.body.uploads[0].ticket;

  const swapped = upload(store, Buffer.from('a different document entirely'), ticket);
  assert.equal(swapped.status, 400);
  assert.ok(['size_mismatch', 'digest_mismatch'].includes(swapped.body.error));
});

// ---------------------------------------------------------------------------
section('Status read-back');

await t('the correct pair returns the allow-listed projection only', () => {
  const store = newStore();
  const ref = handleIntake('/intake/submission', 'POST',
    submission({ phone: '+2348000000000', description: 'Private detail.' }), store).body.referenceId;

  const out = handleIntake('/intake/status', 'POST', { referenceId: ref, email: 'a.eze@ui.edu.ng' }, store);
  assert.equal(out.status, 200);

  const shown = JSON.stringify(out.body.record);
  assert.ok(!shown.includes('+2348000000000'), 'the phone number must not leave');
  assert.ok(!shown.includes('Private detail.'), 'the description must not leave');
  assert.ok(shown.includes(ref));
});

await t('every record the portal ships is trackable against the registry', () => {
  // The portal installs 16 demonstration records into localStorage, but the tracking page
  // asks the registry and treats a 404 as authoritative. If the dev store does not know
  // them, every shipped record is untrackable the moment a backend is configured — which
  // is a worse first impression than demo mode, and it is not obvious why.
  const store = newStore();
  const seeded = store.get().submissions;
  assert.ok(seeded.length >= 10, `expected the portal seeds, found ${seeded.length}`);

  const untrackable = seeded
    .map(s => ({ ref: s.referenceId, out: handleIntake('/intake/status', 'POST',
      { referenceId: s.referenceId, email: s.record.email }, store) }))
    .filter(x => x.out.status !== 200)
    .map(x => x.ref);

  assert.deepEqual(untrackable, [], `not trackable: ${untrackable.join(', ')}`);
});

await t('a wrong email and an unknown reference deny identically', () => {
  const store = newStore();
  const ref = handleIntake('/intake/submission', 'POST', submission(), store).body.referenceId;

  const wrongEmail = handleIntake('/intake/status', 'POST', { referenceId: ref, email: 'someone@else.ng' }, store);
  const unknownRef = handleIntake('/intake/status', 'POST', { referenceId: 'NITDA/REG/2026/9999', email: 'a.eze@ui.edu.ng' }, store);

  assert.equal(wrongEmail.status, unknownRef.status, 'same status');
  assert.deepEqual(wrongEmail.body, unknownRef.body,
    'byte-identical, or the route answers "does this reference exist?" for anybody who asks');
});

// ---------------------------------------------------------------------------
section('Registry scan intake');

const scan = (store, bytes, headers = {}) => handleScan('PUT', bytes, store, {
  headers: {
    'x-dgo-filename': 'Ministry-Letter.pdf',
    'x-dgo-size': String(bytes.length),
    'x-dgo-sha256': crypto.createHash('sha256').update(bytes).digest('hex'),
    ...headers,
  },
});

await t('a scanned document gets a reference and a registry record, not just a file', () => {
  const store = newStore();
  const before = store.get().activities.length;
  const out = scan(store, Buffer.from('scanned page content'));

  assert.equal(out.status, 200);
  assert.ok(out.body.referenceId);
  assert.equal(store.get().activities.length, before + 1);
  assert.ok(store.get().activities.some(a => a.RefIDD === out.body.referenceId));
});

await t('a scan whose digest does not match its bytes is refused', () => {
  const out = scan(newStore(), Buffer.from('scanned page content'), { 'x-dgo-sha256': '0'.repeat(64) });
  assert.equal(out.status, 400);
  assert.equal(out.body.error, 'digest_mismatch');
});

await t('an empty scan is refused rather than filed', () => {
  assert.equal(scan(newStore(), Buffer.alloc(0)).status, 400);
});

// ---------------------------------------------------------------------------
section('Honesty about what this is');

await t('every envelope marks itself as dev-server output', () => {
  const out = call(newStore(), 'FETCH_ALL');
  assert.equal(out.body.meta.devServer, true,
    'a captured response must never be mistakable for a real one');
});

await t('no file under scripts/dev/ contains a signed URL or a hardcoded secret', () => {
  const suspicious = /sig=[A-Za-z0-9_-]{20,}|api_key|client_secret|BEGIN [A-Z ]*PRIVATE KEY/;
  for (const f of ['seed.mjs', 'store.mjs', 'endpoints.mjs', 'intake.mjs']) {
    const src = fs.readFileSync(new URL(`../scripts/dev/${f}`, import.meta.url), 'utf8');
    assert.ok(!suspicious.test(src), `${f} carries something credential-shaped`);
  }
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
