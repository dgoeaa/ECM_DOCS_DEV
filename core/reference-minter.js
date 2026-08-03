// Correspondence reference minting — one implementation, one format. F-031.
//
// WHAT WAS WRONG
// modules/correspondence.js minted `NITDA-${Date.now().toString().slice(-6)}` in the browser.
// Two separate defects sat in that one expression:
//
//   1. IT COLLIDES. The last six digits of a millisecond timestamp cycle every 10^6 ms —
//      about 16.7 minutes. Two records logged 16.7 minutes apart can receive the same
//      reference, and two clerks logging in the same millisecond collide outright. A
//      registry reference that repeats is not a reference.
//
//   2. IT IS A DIFFERENT SHAPE FROM THE SERVER'S. proxy/src/intake.js mints
//      `NITDA-YYYY-NNNNNN`. After step 7 the registry holds both shapes depending on which
//      channel a record arrived through — `NITDA-2026-000318` from the portal and the
//      counter, `NITDA-483920` from manual logging. One registry, two key formats.
//
// PROVISIONAL VERSUS ISSUED
// A reference minted here is derived from the records this browser can see, which is not
// the whole registry. It is therefore PROVISIONAL, and records carrying one are flagged so
// a later reconciliation can find them. A reference minted by the proxy is ISSUED: the
// server holds the sequence and no client can collide with it.
//
// The durable answer is that every creation path goes through the proxy, as scan intake
// already does. Until then this makes local minting correct within its own scope and
// honest about where that scope ends, rather than quietly wrong everywhere.

/** The one format. Matches proxy/src/intake.js createReferenceMinter. */
export const REFERENCE_PREFIX = 'NITDA';
export const REFERENCE_PATTERN = /^([A-Z]+)-(\d{4})-(\d{6})$/;
export const SEQUENCE_WIDTH = 6;

/** Does this string have the registry's reference shape? */
export function isReference(value, { prefix = REFERENCE_PREFIX } = {}) {
  const m = REFERENCE_PATTERN.exec(String(value || ''));
  return !!m && m[1] === prefix;
}

/** The sequence number inside a reference, or 0 for anything that is not one. */
export function sequenceOf(value, { prefix = REFERENCE_PREFIX, year } = {}) {
  const m = REFERENCE_PATTERN.exec(String(value || ''));
  if (!m || m[1] !== prefix) return 0;
  if (year !== undefined && Number(m[2]) !== year) return 0;
  return Number(m[3]);
}

/**
 * Highest sequence already used this year, across every reference the caller can see.
 *
 * Scans `referenceId` AND `id`: manual records set both to the same value, and older ones
 * may carry a reference in only one of them. Reading one field would let the other hold a
 * higher number and mint a duplicate.
 */
export function highestSequence(records, { prefix = REFERENCE_PREFIX, year } = {}) {
  let max = 0;
  for (const r of records || []) {
    if (!r) continue;
    max = Math.max(max, sequenceOf(r.referenceId, { prefix, year }), sequenceOf(r.id, { prefix, year }));
  }
  return max;
}

/**
 * Mint the next reference.
 *
 * Returns `{ reference, provisional, sequence }`. `provisional` is always true here — a
 * client cannot issue an authoritative registry reference — and is written onto the record
 * so the two kinds stay distinguishable.
 *
 * The collision guard is not belt-and-braces. `highestSequence` only sees loaded records,
 * so when the platform is backed by a real store a partial page can under-report the
 * maximum; advancing past anything already present is what stops that becoming a duplicate
 * key in the set the user is actually looking at.
 */
export function mintReference(records = [], { prefix = REFERENCE_PREFIX, now = () => new Date() } = {}) {
  const year = now().getFullYear();
  const taken = new Set();
  for (const r of records || []) {
    if (!r) continue;
    if (r.referenceId) taken.add(String(r.referenceId));
    if (r.id) taken.add(String(r.id));
  }

  let seq = highestSequence(records, { prefix, year }) + 1;
  let reference = format(prefix, year, seq);
  // Advance past anything already present rather than returning a value that is visibly
  // taken. Bounded so a pathological set cannot spin.
  for (let guard = 0; taken.has(reference) && guard < 10_000; guard++) {
    seq += 1;
    reference = format(prefix, year, seq);
  }

  return { reference, provisional: true, sequence: seq, year };
}

function format(prefix, year, seq) {
  return `${prefix}-${year}-${String(seq).padStart(SEQUENCE_WIDTH, '0')}`;
}
