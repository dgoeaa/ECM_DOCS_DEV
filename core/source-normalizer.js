// The convergence layer — what every first-line feed passes through before the platform
// sees it (decision D3, and the second half of decision D4).
//
// Each entry point keeps its own dedicated feed. They meet here. Everything in this module
// exists because the verification in docs/reference/foundational/verification/FINDINGS.md
// measured it against the live payloads — not because it seemed prudent.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// WHY EACH RULE IS HERE
//
// 1. SENTINELS. The flows coalesce nulls into human placeholders:
//    `@coalesce(item()?['RefIDD'], 'No RefIDD')`. Every field arrives as a non-empty string
//    whether or not it holds data — 'No RefIDD', 'Unassigned', 'No Due Date', '----', 'N/A'.
//    A platform that treats those as values renders a register that looks fully populated
//    and is substantially empty, convincingly. In the reference payload this affects 23 of
//    82 fields, including EVERY field of the tasks projection.
//
// 2. ENCODED INTERNAL NAMES. SharePoint encodes characters it cannot use in an internal
//    name: `CC'dTo` arrives as `CC_x0027_dTo`, `3rdAssigned` as `_x0033_rdAssigned`. Any
//    reader written against the display name silently returns nothing — and CC'dTo is one
//    of the strongest person joins in the data (137/137 resolve).
//
// 3. IDENTIFIER TYPING. `tasks.RefIDD` is the string "18106"; `docs.ID` is the number 18106.
//    `'18106' === 18106` is false, and that single line is the whole of the "0/300, broken
//    relationship" verdict that nearly drove a data-repair project. Identifiers are
//    compared canonically or not at all.
//
// 4. THE COMPOSITE KEY. `Reference_ID` is not a foreign key that failed. It is
//    `{yyyymmdd}-{documentId}-{classCode}-{taskId}` — a self-describing business key that
//    already carries the whole relationship. It is parsed, not "standardised away".
//
// 5. CASE-VARIANT VOCABULARIES. Two writers produce 'Not started' and 'Not Started' for the
//    same state. Grouping or counting on the raw string splits one status into two.
// ─────────────────────────────────────────────────────────────────────────────────────────

/* ── 1 · sentinels ─────────────────────────────────────────────────────────────────────
   Detected structurally rather than by an ever-growing list. The flows follow a convention
   — 'No <FieldName>' — so the rule follows the convention, and the exact-match set covers
   the handful that predate it. */
const SENTINEL_EXACT = Object.freeze(new Set([
  '', 'n/a', 'na', 'none', 'null', 'nil', 'unassigned', 'not assigned',
  '----', '---', '--', '-', 'no route', 'tbd', 'undefined',
]));

const SENTINEL_PREFIX = /^no\s+\S/i;

/** Is this value a placeholder standing in for absent data? */
export function isSentinel(value) {
  if (value === null || value === undefined || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  const s = String(value).trim();
  if (!s) return true;
  const low = s.toLowerCase();
  return SENTINEL_EXACT.has(low) || SENTINEL_PREFIX.test(s);
}

/** The value, or null if it is a placeholder. Never returns a sentinel. */
export function realValue(value) {
  return isSentinel(value) ? null : value;
}

/* ── 2 · SharePoint internal-name encoding ─────────────────────────────────────────────
   `_x0027_` is a hex code point between underscores. Decoding is mechanical; the reverse
   is provided so a writer can address a column by the name the list actually uses. */
const ENCODED = /_x([0-9a-fA-F]{4})_/g;

/** `CC_x0027_dTo` → `CC'dTo`, `_x0033_rdAssigned` → `3rdAssigned`. */
export function decodeFieldName(name) {
  return String(name || '').replace(ENCODED, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** `CC'dTo` → `CC_x0027_dTo`. Leading digits are encoded, as SharePoint does. */
export function encodeFieldName(name) {
  const s = String(name || '');
  if (!s) return s;
  const head = /^[0-9]/.test(s) ? `_x${s.charCodeAt(0).toString(16).padStart(4, '0')}_` + s.slice(1) : s;
  return head.replace(/[^A-Za-z0-9_]/g, c => `_x${c.charCodeAt(0).toString(16).padStart(4, '0')}_`);
}

/**
 * Read a field by its DISPLAY name from a record keyed by internal names.
 * Tries the literal key first, then the encoded form, then a decoded scan — so callers
 * write `field(task, "CC'dTo")` and never learn that `_x0027_` exists.
 */
export function field(record, displayName) {
  if (!record) return null;
  if (displayName in record) return realValue(record[displayName]);
  const enc = encodeFieldName(displayName);
  if (enc in record) return realValue(record[enc]);
  for (const key of Object.keys(record)) {
    if (decodeFieldName(key) === displayName) return realValue(record[key]);
  }
  return null;
}

/** Every key of a record under its display name, sentinels dropped. */
export function decodeRecord(record) {
  const out = {};
  for (const [k, v] of Object.entries(record || {})) {
    const real = realValue(v);
    if (real !== null) out[decodeFieldName(k)] = real;
  }
  return out;
}

/* ── 3 · identifier typing ─────────────────────────────────────────────────────────── */

/** Canonical identifier: digits compare as digits, everything else casefolded. */
export function canonicalId(value) {
  const real = realValue(value);
  if (real === null) return null;
  const s = String(real).trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s.toLowerCase();
}

/** Do two identifiers denote the same thing, whatever their JSON types? */
export function sameId(a, b) {
  const x = canonicalId(a);
  return x !== null && x === canonicalId(b);
}

/* ── 4 · the composite business key ────────────────────────────────────────────────── */
const COMPOSITE = /^(\d{8})-(\d+)-([A-Za-z][A-Za-z\-]*)-(\d+)$/;

/**
 * `20260123-18106-GOV-REA-14143` → { date, documentId, classCode, taskId }.
 * Returns null for anything that is not the composite shape, including placeholders.
 */
export function parseCompositeReference(value) {
  const real = realValue(value);
  if (real === null) return null;
  const m = COMPOSITE.exec(String(real).trim());
  if (!m) return null;
  const [, ymd, documentId, classCode, taskId] = m;
  return {
    raw: String(real).trim(),
    date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    documentId: String(Number(documentId)),
    classCode,
    taskId: String(Number(taskId)),
  };
}

/* ── 5 · case-variant vocabularies ─────────────────────────────────────────────────── */

/**
 * Fold a status/vocabulary value to one canonical form.
 *
 * Two writers produce 'Not started' and 'Not Started' for the same state — a difference no
 * reader notices and every `groupBy` does, splitting one status into two columns of a
 * report. Comparison and counting use this; DISPLAY keeps whatever the record said.
 */
export function canonicalTerm(value) {
  const real = realValue(value);
  if (real === null) return null;
  return String(real).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Group records by a vocabulary field, folding case and spacing variants together. */
export function groupByTerm(records, accessor) {
  const out = new Map();
  for (const r of records || []) {
    const key = canonicalTerm(typeof accessor === 'function' ? accessor(r) : field(r, accessor));
    if (key === null) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(r);
  }
  return out;
}

/* ── 6 · document linkage ──────────────────────────────────────────────────────────────
   Three carriers, ranked by measured reliability rather than by which looks most like a
   foreign key:

     Title prefix   present on ~99% of tasks in every export and every period, and it agrees
                    with RefIDD 300/300 with zero conflicts wherever both exist.
     RefIDD         the document id directly, when the writer populated it.
     Reference_ID   the composite. Authoritative when present — but only 3% populated in
                    recent records, so it can never be the primary.

   Reading all three and reporting agreement is what makes this trustworthy: a caller can
   see WHICH carrier answered and whether the others disagreed. */
const TITLE_PREFIX = /^\s*(\d{3,7})\s*-/;

/** The document id embedded in a task title, or null. */
export function documentIdFromTitle(title) {
  const real = realValue(title);
  if (real === null) return null;
  const m = TITLE_PREFIX.exec(String(real));
  return m ? String(Number(m[1])) : null;
}

/**
 * Resolve the document a task belongs to.
 * @returns {{documentId: string|null, source: string, carriers: object, conflict: boolean}}
 */
export function resolveDocumentId(task) {
  const carriers = {
    title: documentIdFromTitle(field(task, 'Title')),
    refIdd: canonicalId(field(task, 'RefIDD')),
    composite: (parseCompositeReference(field(task, 'Reference_ID')) || {}).documentId || null,
  };
  const present = Object.entries(carriers).filter(([, v]) => v !== null);
  const distinct = new Set(present.map(([, v]) => v));
  const order = ['title', 'refIdd', 'composite'];
  const chosen = order.find(k => carriers[k] !== null) || null;
  return {
    documentId: chosen ? carriers[chosen] : null,
    source: chosen || 'none',
    carriers,
    conflict: distinct.size > 1,
  };
}

/* ── 7 · the pass every feed makes ─────────────────────────────────────────────────── */

/**
 * Normalise one record: display names, no sentinels, identifiers canonicalised, the
 * composite key parsed, and the document linkage resolved with its provenance.
 *
 * The original is preserved under `_raw` — a normaliser that discards what it was given
 * cannot be audited, and this one is making judgements a reader may need to check.
 */
export function normalizeTask(task) {
  const decoded = decodeRecord(task);
  const link = resolveDocumentId(task);
  const composite = parseCompositeReference(field(task, 'Reference_ID'));
  return {
    ...decoded,
    id: canonicalId(field(task, 'ID')),
    documentId: link.documentId,
    documentIdSource: link.source,
    documentIdConflict: link.conflict,
    reference: composite,
    statusTerm: canonicalTerm(field(task, 'Progress')),
    classificationTerm: canonicalTerm(field(task, 'Classification')),
    assigned: !!field(task, 'AssignedTo'),
    _raw: task,
  };
}

/** The same pass for a document record. */
export function normalizeDocument(doc) {
  const decoded = decodeRecord(doc);
  return {
    ...decoded,
    id: canonicalId(field(doc, 'ID')),
    categoryTerm: canonicalTerm(field(doc, 'Category')),
    statusTerm: canonicalTerm(field(doc, 'Status')),
    assignedTo: splitAddresses(field(doc, 'AssignedTo')),
    ccdTo: splitAddresses(field(doc, "CC'dTo")),
    assigned: splitAddresses(field(doc, 'Assigned')),
    _raw: doc,
  };
}

/** Person columns hold several addresses in one string. Split, trim, drop placeholders. */
export function splitAddresses(value) {
  const real = realValue(value);
  if (real === null) return [];
  return String(real)
    .split(/[;,]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.includes('@'));
}

/* ── 8 · the pre-pass every inbound row makes ──────────────────────────────────────────
   This is the function core/data-loader.js calls, and it is deliberately ADDITIVE rather
   than transformative.

   core/domain.js already maps source rows into the platform's record shapes, and it reads
   raw keys directly — `t._x0033_rdAssigned`, `a.CC_x0027_dTo`, `text(t.RefIDD)`. Replacing
   keys here would break every one of those readers. Two things happen instead:

     · SENTINEL KEYS ARE DROPPED. `text(t.RefIDD)` currently returns the literal
       'No RefIDD' and writes it into the record as a reference. Removing the key lets the
       existing fallback chain fall through to the next candidate, or to '' — which is what
       every downstream reader already expects for absent data. This is the single change
       that stops placeholders reaching the register.

     · DECODED ALIASES ARE ADDED alongside the encoded keys, never instead of them. Old
       readers keep working; new ones can use the display name.

   Nothing is renamed, nothing is coerced, and no value is invented. */
export function sanitizeSourceRecord(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSentinel(value)) continue;          // absent, so absent — not a placeholder
    out[key] = value;
    const display = decodeFieldName(key);
    if (display !== key && !(display in row)) out[display] = value;
  }
  return out;
}

/**
 * The pre-pass for a task row: sanitised, plus the resolved document linkage attached
 * under names the platform can read. Resolution runs on the ORIGINAL row so the carriers
 * are read before sentinel keys are dropped.
 */
export function sanitizeTaskRecord(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = sanitizeSourceRecord(row);
  const link = resolveDocumentId(row);
  if (link.documentId !== null) {
    clean.documentId = link.documentId;
    clean.documentIdSource = link.source;
    if (link.conflict) clean.documentIdConflict = true;
  }
  const composite = parseCompositeReference(field(row, 'Reference_ID'));
  if (composite) clean.referenceParts = composite;
  return clean;
}

/** Join tasks to documents. Returns the joined pairs and the ones that did not resolve. */
export function linkTasksToDocuments(tasks, documents) {
  const byId = new Map();
  for (const d of documents || []) {
    const id = canonicalId(d && (d.ID ?? d.id));
    if (id !== null) byId.set(id, d);
  }
  const linked = [];
  const unresolved = [];
  for (const t of tasks || []) {
    const link = resolveDocumentId(t);
    const doc = link.documentId !== null ? byId.get(link.documentId) : undefined;
    if (doc) linked.push({ task: t, document: doc, via: link.source, conflict: link.conflict });
    else unresolved.push({ task: t, documentId: link.documentId, reason: link.documentId === null ? 'no-carrier' : 'not-in-set' });
  }
  return { linked, unresolved };
}
