/**
 * Document flags.
 *
 * The defect these cover is not "flagging is wrong" but "flagging never happened": the
 * controls existed, the ownership entry existed, the chip renderer existed, and no code
 * path wrote a flag. So the assertions here are mostly about the write actually producing
 * something, and about it staying idempotent — a watchlist that lists one document twice
 * is the failure mode a naive fix introduces.
 */
import assert from 'node:assert/strict';
import {
  DocumentFlags, normalizeFlagCode, isFlagCode, flagLabel, flagSpec,
  flagsOf, hasFlag, applyFlag, flagPayload,
} from '../core/document-flags.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; };

// ── the catalogue ─────────────────────────────────────────────────────────────────────
ok('the four controls lookup renders all exist as flags', () => {
  const codes = DocumentFlags.map(f => f.code);
  for (const c of ['dg', 'followup', 'int', 'unc']) {
    assert.ok(codes.includes(c), `${c} must be a known flag — lookup.js renders a button for it`);
  }
});

ok('DG Attention is the descendant of the SPA markDG and is distinguishable', () => {
  const dg = flagSpec('dg');
  assert.equal(dg.label, 'DG Attention');
  assert.equal(dg.tone, 'danger', 'the DG watchlist must not render as an ordinary chip');
});

// ── normalisation ─────────────────────────────────────────────────────────────────────
ok('a code, a label and mixed case all resolve to the same flag', () => {
  assert.equal(normalizeFlagCode('dg'), 'dg');
  assert.equal(normalizeFlagCode('DG'), 'dg');
  assert.equal(normalizeFlagCode('DG Attention'), 'dg');
  assert.equal(normalizeFlagCode('Follow-Up'), 'followup');
  assert.equal(normalizeFlagCode('  follow-up  '), 'followup', 'trimmed and case-folded');
  assert.equal(normalizeFlagCode('followup'), 'followup');
});

ok('an unknown flag is rejected rather than invented', () => {
  assert.equal(normalizeFlagCode('urgent'), '');
  assert.equal(isFlagCode('urgent'), false);
  assert.throws(() => applyFlag({}, 'urgent'), /Unknown document flag/);
  assert.throws(() => flagPayload({}, 'urgent'), /Unknown document flag/);
});

ok('flagLabel passes unknown values through rather than blanking the UI', () => {
  assert.equal(flagLabel('dg'), 'DG Attention');
  assert.equal(flagLabel('mystery'), 'mystery');
});

// ── reading what is already there ─────────────────────────────────────────────────────
ok('a record with no flags reads as empty, not as broken', () => {
  assert.deepEqual(flagsOf(null), []);
  assert.deepEqual(flagsOf({}), []);
  assert.deepEqual(flagsOf({ flags: null }), []);
});

ok('historic bare-string flags are read, not silently dropped', () => {
  // Dropping these would lose marks that are genuinely on the record — the same class of
  // silent loss this module exists to fix.
  const rec = { flags: ['dg', 'followup'] };
  assert.deepEqual(flagsOf(rec).map(f => f.flag), ['dg', 'followup']);
});

ok('unknown entries are discarded but do not discard their neighbours', () => {
  const rec = { flags: [{ flag: 'dg' }, { flag: 'nonsense' }, null, { flag: 'unc' }] };
  assert.deepEqual(flagsOf(rec).map(f => f.flag), ['dg', 'unc']);
});

ok('a duplicated flag on a stored record reads once', () => {
  const rec = { flags: [{ flag: 'dg', at: 'first' }, { flag: 'dg', at: 'second' }] };
  const flags = flagsOf(rec);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].at, 'first', 'first occurrence wins so the reading is stable');
});

ok('hasFlag answers by code or label', () => {
  const rec = { flags: [{ flag: 'dg' }] };
  assert.equal(hasFlag(rec, 'dg'), true);
  assert.equal(hasFlag(rec, 'DG Attention'), true);
  assert.equal(hasFlag(rec, 'unc'), false);
  assert.equal(hasFlag(rec, ''), false);
});

// ── applying ──────────────────────────────────────────────────────────────────────────
ok('flagging an unflagged record produces a flag — the defect this closes', () => {
  const rec = { id: 7, flags: [] };
  const r = applyFlag(rec, 'dg', { actor: 'clerk@nitda.gov.ng', at: '2026-08-04T10:00:00Z' });
  assert.equal(r.changed, true);
  assert.equal(r.applied, true);
  assert.deepEqual(r.flags, [{ flag: 'dg', at: '2026-08-04T10:00:00Z', by: 'clerk@nitda.gov.ng' }]);
});

ok('applying does not mutate the record it was given', () => {
  const rec = { id: 7, flags: [] };
  applyFlag(rec, 'dg', { actor: 'a@b.c' });
  assert.deepEqual(rec.flags, [], 'the caller must be able to preview before committing');
});

ok('flagging twice is agreement, not duplication', () => {
  const rec = { id: 7, flags: [{ flag: 'dg', at: 'earlier', by: 'first@nitda.gov.ng' }] };
  const r = applyFlag(rec, 'dg', { actor: 'second@nitda.gov.ng' });
  assert.equal(r.changed, false, 'so the caller can skip a write that would do nothing');
  assert.equal(r.applied, true, 'but the flag IS on the document, which is what was asked');
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0].by, 'first@nitda.gov.ng', 'the original mark is not overwritten');
});

ok('different flags coexist', () => {
  let rec = { id: 7, flags: [] };
  rec = { ...rec, flags: applyFlag(rec, 'dg', { actor: 'a@b.c' }).flags };
  rec = { ...rec, flags: applyFlag(rec, 'followup', { actor: 'a@b.c' }).flags };
  assert.deepEqual(rec.flags.map(f => f.flag), ['dg', 'followup']);
});

ok('a flag can be lifted — a watchlist nobody can leave stops being read', () => {
  const rec = { id: 7, flags: [{ flag: 'dg', at: 'x', by: 'a@b.c' }, { flag: 'unc' }] };
  const r = applyFlag(rec, 'dg', { remove: true });
  assert.equal(r.changed, true);
  assert.equal(r.applied, false);
  assert.deepEqual(r.flags.map(f => f.flag), ['unc'], 'only the named flag is lifted');
});

ok('lifting a flag that is not there changes nothing and is not an error', () => {
  const r = applyFlag({ flags: [{ flag: 'unc' }] }, 'dg', { remove: true });
  assert.equal(r.changed, false);
  assert.deepEqual(r.flags.map(f => f.flag), ['unc']);
});

// ── the backend payload ───────────────────────────────────────────────────────────────
ok('the payload carries the discriminator, the document and the actor', () => {
  const p = flagPayload({ id: 18106, referenceId: 'NITDA-2026-217' }, 'dg',
                        { actor: 'clerk@nitda.gov.ng' });
  assert.equal(p.action, 'flagDocument');
  assert.equal(p.operation, 'update');
  assert.equal(p.flag, 'dg');
  assert.equal(p.flagLabel, 'DG Attention');
  assert.equal(p.docId, 18106);
  assert.equal(p.referenceId, 'NITDA-2026-217');
  assert.equal(p.userEmail, 'clerk@nitda.gov.ng');
});

ok('lifting posts a distinct action so the flow cannot mistake it for a flag', () => {
  const p = flagPayload({ id: 1 }, 'dg', { remove: true });
  assert.equal(p.action, 'unflagDocument');
});

ok('a record with no reference still produces a usable payload', () => {
  const p = flagPayload({ id: 5 }, 'unc', {});
  assert.equal(p.referenceId, '');
  assert.equal(p.docId, 5);
  assert.equal(p.userEmail, null);
});

console.log(`document-flags: ${passed} assertions passed`);
