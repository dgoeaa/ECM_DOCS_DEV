// Document flags — the marks an officer puts on a document to change who looks at it next.
//
// WHAT WAS WRONG
// `config/action-ownership.config.js` has registered `flag-document` from the start: owned
// by `activities`, with `lookup` named as an allowed invoker, an audit event, and an
// optional backend. `config/module-boundaries.config.js` declares `activities` owns
// `flag-document`. `modules/lookup.js` renders four flag controls and renders `record.flags`
// as chips.
//
// Nothing wrote a flag. `flagActivity()` raised a dialog reading "Complete this in
// Activities" and navigated to `#/activities`, and that workspace had no flag control at
// all. So the officer was confirmed, redirected, and left somewhere that could not finish
// the act — while the detail view went on rendering a chip list that nothing could populate.
//
// That is worse than a missing feature. A missing button is visibly missing. A button that
// confirms and redirects reads as success, and the officer walks away believing a document
// is on the DG's list when it is on nobody's.
//
// WHY THIS IS A SEPARATE MODULE
// The flag catalogue and the rules for applying one are decisions, not rendering. Keeping
// them here means both surfaces that flag — the owner (`activities`) and its allowed invoker
// (`lookup`) — apply identical rules, and the rules can be tested without a browser.

/**
 * The catalogue. Codes are the stable identifiers written onto records and sent to the
 * backend; labels are for people and may be reworded freely.
 *
 * `dg` is the descendant of the source SPA's `markDG` ("DG Watchlist", posted to
 * SUBSIDIARY_ACTIONS). The other three come from the four controls `lookup` already
 * rendered, so an officer who used the old buttons finds the same vocabulary.
 */
export const DocumentFlags = Object.freeze([
  Object.freeze({ code: 'dg', label: 'DG Attention', tone: 'danger',
    description: "Raise this document to the Director-General's watchlist." }),
  Object.freeze({ code: 'followup', label: 'Follow-Up', tone: '',
    description: 'Mark for deliberate follow-up; it will not close quietly.' }),
  Object.freeze({ code: 'int', label: 'INT', tone: '',
    description: 'Internal handling marker.' }),
  Object.freeze({ code: 'unc', label: 'UNC', tone: '',
    description: 'Unclassified / no further action marker.' }),
]);

const BY_CODE = new Map(DocumentFlags.map(f => [f.code, f]));

/** Normalise anything a caller might pass — a code, a label, mixed case — to a code. */
export function normalizeFlagCode(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (BY_CODE.has(raw)) return raw;
  const byLabel = DocumentFlags.find(f => f.label.toLowerCase() === raw);
  return byLabel ? byLabel.code : '';
}

export function isFlagCode(value) {
  return normalizeFlagCode(value) !== '';
}

export function flagLabel(value) {
  const code = normalizeFlagCode(value);
  return code ? BY_CODE.get(code).label : String(value ?? '');
}

export function flagSpec(value) {
  const code = normalizeFlagCode(value);
  return code ? BY_CODE.get(code) : null;
}

/**
 * The flags already on a record, normalised.
 *
 * Reads defensively. Records reach the browser from SharePoint through the source
 * normaliser and from local state, and historic rows carry flags as bare strings rather
 * than objects. Treating a string row as "no flag" would silently drop marks that are
 * genuinely there, which is the same class of defect this module exists to fix.
 */
export function flagsOf(record) {
  const raw = record && Array.isArray(record.flags) ? record.flags : [];
  const out = [];
  for (const entry of raw) {
    if (!entry) continue;
    const code = normalizeFlagCode(typeof entry === 'string' ? entry : entry.flag ?? entry.code);
    if (!code) continue;
    if (out.some(f => f.flag === code)) continue;       // first occurrence wins
    out.push(Object.freeze({
      flag: code,
      at: (typeof entry === 'object' && entry.at) ? entry.at : '',
      by: (typeof entry === 'object' && (entry.by || entry.actor)) ? (entry.by || entry.actor) : '',
    }));
  }
  return out;
}

export function hasFlag(record, value) {
  const code = normalizeFlagCode(value);
  return !!code && flagsOf(record).some(f => f.flag === code);
}

/**
 * Apply or lift a flag, returning what the record's `flags` should become.
 *
 * Returns `{ flags, changed, applied, code, label }` and never mutates its input — the
 * caller decides whether to commit, and a governed write must be able to preview the
 * outcome before the officer confirms it.
 *
 * Applying a flag that is already present is NOT an error and does not duplicate it: two
 * officers reaching the same conclusion is agreement, not a conflict, and a watchlist that
 * lists the same document twice is a defect. `changed:false` lets the caller skip a pointless
 * write rather than sending one that does nothing.
 *
 * Lifting is supported because a watchlist nobody can leave fills up and stops being read.
 */
export function applyFlag(record, value, { actor = '', at = new Date().toISOString(), remove = false } = {}) {
  const code = normalizeFlagCode(value);
  if (!code) throw new Error(`Unknown document flag: ${value}`);
  const current = flagsOf(record);
  const present = current.some(f => f.flag === code);
  const label = BY_CODE.get(code).label;

  if (remove) {
    return {
      flags: current.filter(f => f.flag !== code),
      changed: present, applied: false, code, label,
    };
  }
  if (present) {
    return { flags: current, changed: false, applied: true, code, label };
  }
  return {
    flags: [...current, { flag: code, at, by: actor }],
    changed: true, applied: true, code, label,
  };
}

/**
 * The payload for the backend write.
 *
 * Mirrors the shape the source SPA posted for `markDG` — an action discriminator, the
 * document id, the acting user and a source tag — so the existing flow contract recognises
 * it rather than requiring a new one.
 */
export function flagPayload(record, value, { actor = '', remove = false, source = 'DGO_FAST_Track_WEB_OPS' } = {}) {
  const code = normalizeFlagCode(value);
  if (!code) throw new Error(`Unknown document flag: ${value}`);
  return {
    action: remove ? 'unflagDocument' : 'flagDocument',
    operation: 'update',
    mode: 'single',
    flag: code,
    flagLabel: BY_CODE.get(code).label,
    docId: record?.id ?? null,
    referenceId: record?.referenceId || '',
    userEmail: actor || null,
    source,
  };
}
