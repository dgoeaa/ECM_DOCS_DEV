#!/usr/bin/env node
/**
 * Reference minting — F-031.
 *
 * The defect being guarded: `NITDA-${Date.now().toString().slice(-6)}` in
 * modules/correspondence.js. The last six digits of a millisecond timestamp cycle every
 * ~16.7 minutes, so it collides; and it is a different shape from the reference the
 * registry issues, so the registry held two key formats at once.
 *
 * Run: node tests/reference-minter.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  mintReference, highestSequence, sequenceOf, isReference,
  REFERENCE_PATTERN, REFERENCE_PREFIX, LEGACY_SEQUENCE_WIDTH,
} from '../core/reference-minter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0, failed = 0;
/* Async-aware. A sync helper silently PASSES an async test whose assertion rejects — the
   rejection becomes an unhandled promise and the counter has already been incremented. */
const t = async (label, fn) => {
  try { await fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const at = y => () => new Date(Date.UTC(y, 5, 1));

console.log('\nReference minting');

/* ── the format ────────────────────────────────────────────────────────────── */
section('One format, shared with the server');

await t('a minted reference has the registry shape', () => {
  const { reference } = mintReference([], { now: at(2026) });
  assert.match(reference, REFERENCE_PATTERN);
  assert.equal(reference, 'NITDA-2026-1');
});

await t('it is the SAME shape the registry issues', () => {
  // The whole point of F-031's second half. If these diverge the registry holds two key
  // formats again, and this is the assertion that catches it.
  //
  // The server-side minter is a Power Automate flow now, so it cannot be imported and
  // compared directly. What CAN be pinned inside this repository is the format itself and
  // the contract the flow author reads — so both are asserted, and a change to either
  // without the other fails here.
  assert.equal(REFERENCE_PREFIX, 'NITDA');
  assert.equal(LEGACY_SEQUENCE_WIDTH, 6);
  assert.equal(mintReference([], { now: at(2026) }).reference, 'NITDA-2026-1');

  const contract = read('document-portal/README.md');
  const stated = (contract.match(/`(NITDA-YYYY-(?:<sequence>|N+))`/) || [, ''])[1];
  assert.ok(stated, 'the intake contract must state the reference format the flow must mint');
  const sample = stated.replace('YYYY', '2026').replace(/(?:<sequence>|N+)$/, '1');
  assert.match(sample, REFERENCE_PATTERN,
    `the documented format ${stated} does not match the one this module implements`);

  /* D1: the register issues an UNPADDED sequence — the live SUBMISSION flow mints
     `NITDA-2026-217`. The deployment guides used to instruct implementers to zero-pad to
     six digits, which would have put a second key format back into the registry through
     the front door. Pinning the guides here is what stops that instruction returning. */
  assert.doesNotMatch(stated, /N{2,}/,
    'the contract must not specify a fixed-width padded sequence; the register does not pad');
  for (const guide of ['docs/deployment/FLOW-BUILD-WALKTHROUGH.md', 'docs/deployment/MINIMAL-PILOT.md']) {
    assert.doesNotMatch(read(guide), /NITDA-YYYY-N{2,}/,
      `${guide} still instructs implementers to mint a padded reference`);
  }
});

await t('the retired shape is not produced', () => {
  const { reference } = mintReference([], { now: at(2026) });
  assert.ok(!/^NITDA-\d{6}$/.test(reference), 'the six-digit timestamp form must not return');
});

await t('the year comes from the clock', () => {
  assert.equal(mintReference([], { now: at(2031) }).reference, 'NITDA-2031-1');
});

/* ── it does not collide ───────────────────────────────────────────────────── */
section('It does not collide');

await t('successive mints are distinct and monotonic', () => {
  const records = [];
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const { reference } = mintReference(records, { now: at(2026) });
    assert.ok(!seen.has(reference), `duplicate at iteration ${i}: ${reference}`);
    seen.add(reference);
    records.unshift({ id: reference, referenceId: reference });
  }
  assert.equal(seen.size, 500);
});

await t('minting many times inside one millisecond does not repeat', () => {
  // The original expression collided outright here: same millisecond, same reference.
  const records = [];
  const fixed = () => new Date(Date.UTC(2026, 5, 1, 12, 0, 0, 0));
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const { reference } = mintReference(records, { now: fixed });
    assert.ok(!seen.has(reference), 'a fixed clock must not produce a repeat');
    seen.add(reference);
    records.unshift({ id: reference, referenceId: reference });
  }
});

await t('it advances past a reference that is already present', () => {
  const records = [{ id: 'NITDA-2026-000004', referenceId: 'NITDA-2026-000004' }];
  assert.equal(mintReference(records, { now: at(2026) }).reference, 'NITDA-2026-5');
});

await t('it reads the id field as well as referenceId', () => {
  // A record carrying the reference in only one field would otherwise let the other mint
  // a duplicate.
  assert.equal(mintReference([{ id: 'NITDA-2026-000009' }], { now: at(2026) }).reference,
    'NITDA-2026-10');
  assert.equal(mintReference([{ referenceId: 'NITDA-2026-000009' }], { now: at(2026) }).reference,
    'NITDA-2026-10');
});

await t('a gap in the sequence is not reused', () => {
  const records = [{ referenceId: 'NITDA-2026-000001' }, { referenceId: 'NITDA-2026-000007' }];
  assert.equal(mintReference(records, { now: at(2026) }).reference, 'NITDA-2026-8');
});

/* ── year boundaries and foreign values ────────────────────────────────────── */
section('Years and foreign values');

await t('last year\'s sequence does not carry into this one', () => {
  const records = [{ referenceId: 'NITDA-2025-000900' }];
  assert.equal(mintReference(records, { now: at(2026) }).reference, 'NITDA-2026-1');
});

await t('a reference from another year is still recognised as a reference', () => {
  assert.equal(isReference('NITDA-2025-000900'), true);
  assert.equal(sequenceOf('NITDA-2025-000900'), 900);
  assert.equal(sequenceOf('NITDA-2025-000900', { year: 2026 }), 0, 'but not counted for 2026');
});

await t('non-reference identifiers are ignored rather than parsed', () => {
  const junk = [
    { id: 'NITDA-483920' },              // the retired shape
    { id: 'REG-0f8c…' }, { id: '' }, { id: null },
    { referenceId: 'DGO/2026/000412' },  // a registry file number, a different concept
    null, undefined,
  ];
  assert.equal(highestSequence(junk, { year: 2026 }), 0);
  assert.equal(mintReference(junk, { now: at(2026) }).reference, 'NITDA-2026-1');
});

await t('a foreign prefix does not raise our sequence', () => {
  assert.equal(highestSequence([{ referenceId: 'OTHER-2026-000500' }], { year: 2026 }), 0);
});

await t('empty and malformed inputs do not throw', () => {
  assert.doesNotThrow(() => mintReference(undefined, { now: at(2026) }));
  assert.doesNotThrow(() => mintReference(null, { now: at(2026) }));
  assert.doesNotThrow(() => highestSequence(null, { year: 2026 }));
});

/* ── provenance ────────────────────────────────────────────────────────────── */
section('Provisional versus issued');

await t('a client-minted reference is marked provisional', () => {
  // A browser cannot issue an authoritative registry reference — it only sees the records
  // it has loaded. Saying so is what lets a later reconciliation find these.
  const { provisional } = mintReference([], { now: at(2026) });
  assert.equal(provisional, true);
});

await t('the module never claims to issue an authoritative reference', () => {
  const out = mintReference([], { now: at(2026) });
  assert.ok(!('issued' in out));
  assert.equal(out.sequence, 1);
  assert.equal(out.year, 2026);
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
