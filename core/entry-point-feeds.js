// First-line feeds, one per entry point — decision D4.
//
// Each entry point admits its own records and STAMPS them as it does so. Everything
// downstream — the normaliser, the unified collections, the source-view filters — reads the
// stamp instead of re-deriving it. A record's origin is a fact known at ingestion; anything
// that reconstructs it later is re-deriving something it was already told.
//
// This module is the door. It does not fetch — `core/data-loader.js` does that, because
// which endpoint serves which lane is a deployment concern and this file should not care.
// What it owns is the partition and the stamp: given rows, decide which entry point each
// belongs to, say so on the record, and report anything it could not place rather than
// letting it default into a channel it was never seen at.
//
// WHY "UNPLACED" IS A CATEGORY AND NOT A FALLBACK
// The previous inference fell back to `physical-scanned-documents`, so a record with no
// channel at all was indistinguishable from one scanned at the counter. That is the worse
// failure: it is silent, and it inflates exactly the channel an operator is least likely to
// audit. Here an unplaceable record is stamped `null` and counted, so the number is visible
// and someone can go and find out why.

import {
  EntryPoints, ENTRY_POINT_FIELD, CHANNEL_FIELDS, entryPointForChannel,
} from '../config/entry-points.config.js';

/**
 * The entry point a record DECLARES, by reading declared channel fields in order.
 *
 * Returns `{ id, field, value }` when a field claims one, or null. Nothing here reads free
 * text: if no declared field names a channel, this says so rather than inventing one.
 */
export function declaredEntryPoint(record) {
  if (!record || typeof record !== 'object') return null;
  for (const field of CHANNEL_FIELDS) {
    const raw = record[field];
    if (raw == null || raw === '') continue;
    const ep = entryPointForChannel(raw);
    if (ep) return { id: ep.id, field, value: String(raw) };
  }
  return null;
}

/**
 * Stamp a record with the entry point that admitted it.
 *
 * `assume` is the lane doing the admitting. A record that declares a DIFFERENT entry point
 * than the lane it arrived on is a genuine disagreement and is recorded as one rather than
 * being quietly overwritten: the scan endpoint returning something stamped `Portal` means
 * either the endpoint or the producer is wrong, and silently picking a winner destroys the
 * evidence needed to tell which.
 *
 * The DECLARATION wins when the two disagree, because the producer of a record knows its
 * origin better than the pipe it happened to travel down. The conflict is recorded either
 * way.
 */
export function stampRecord(record, { assume = null } = {}) {
  if (!record || typeof record !== 'object') return record;
  const declared = declaredEntryPoint(record);
  const resolved = declared ? declared.id : (assume || null);

  const stamped = { ...record, [ENTRY_POINT_FIELD]: resolved };
  stamped.entryPointSource = declared ? `declared:${declared.field}` : (assume ? 'lane' : 'unplaced');
  if (declared && assume && declared.id !== assume) {
    stamped.entryPointConflict = { lane: assume, declared: declared.id, field: declared.field };
  }
  return stamped;
}

/**
 * Run one lane: stamp every row with `entryPointId`, honouring any declaration on the row.
 * Returns the stamped rows — the caller decides where they converge.
 */
export function lane(rows, entryPointId) {
  return (rows || []).map(r => stampRecord(r, { assume: entryPointId }));
}

/**
 * Partition rows that arrived through a SHARED endpoint into their entry points.
 *
 * This is what `FETCH_ALL` needs: one response carrying traffic from several channels, split
 * at the door by what each row declares. Rows declaring nothing are stamped `null` and
 * collected under `unplaced` — not assigned to a channel, and not dropped either.
 */
export function partition(rows, { assume = null } = {}) {
  const byEntryPoint = Object.fromEntries(EntryPoints.map(e => [e.id, []]));
  const unplaced = [];
  const conflicts = [];
  const stamped = [];

  for (const row of rows || []) {
    const s = stampRecord(row, { assume });
    stamped.push(s);
    if (s && s.entryPointConflict) conflicts.push(s.entryPointConflict);
    const id = s ? s[ENTRY_POINT_FIELD] : null;
    if (id && byEntryPoint[id]) byEntryPoint[id].push(s);
    else unplaced.push(s);
  }
  return { stamped, byEntryPoint, unplaced, conflicts };
}

/** Counts per entry point, plus the two numbers worth watching. */
export function feedCounts(rows) {
  const { byEntryPoint, unplaced, conflicts } = partition(rows);
  return {
    ...Object.fromEntries(Object.entries(byEntryPoint).map(([k, v]) => [k, v.length])),
    unplaced: unplaced.length,
    conflicts: conflicts.length,
    total: (rows || []).length,
  };
}
