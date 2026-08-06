// Universal Filename Policy — the agency standard, made executable.
//
// The policy is real and it is written down: `docs/policies/universal-filename-policy/`
// carries it as an SOP, a memo, a handbook and a machine-readable JSON, dated 2026-06-16,
// owned by Document Control / Operations. It states a mandatory pattern, a validation regex
// and ten rules.
//
// Nothing enforced any of it. The two paths by which a file actually enters the registry —
// anonymous portal intake and authenticated registry scan deposit — took the basename and
// capped the length, and that was all. A policy that exists only as a PDF is a policy the
// registry does not have.
//
// WHAT THIS MODULE IS FOR
//
//   1. THE POLICY. Lowercase, underscore-separated, no punctuation, optional `_v#` and
//      optional terminal ISO date. Files that arrive as `Letter to the DG (final) !!.PDF`
//      become `letter_to_the_dg_final.pdf` and stay sortable and machine-readable.
//   2. THE HAZARDS THE POLICY DOES NOT MENTION. Filenames arriving from an anonymous
//      submitter reach a Windows/SharePoint document library. Reserved device names, NUL
//      and control characters, trailing dots and spaces, and right-to-left override
//      characters are all real and none of them appear in an SOP written for humans naming
//      their own documents. Normalising for the policy happens to neutralise most of them;
//      the rest are handled explicitly, because "happens to" is not a control.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
//   It does not REJECT. A citizen's correspondence must not be refused because their phone
//   named the scan `IMG_20260101_093211(1).jpg`. The file is accepted and stored under a
//   compliant name, and the name they sent is recorded alongside it. Refusing here would
//   convert a naming standard into a barrier to petitioning the government, which is not
//   what the policy is for and not a trade this registry should make.
//
//   It does not GUESS. The policy's ordering rule — subject, document type, descriptor,
//   version, date — describes an authoring convention. It cannot be recovered from an
//   arbitrary string, and inventing a `subject` would produce a compliant-looking filename
//   that asserts something untrue. Normalisation is mechanical: case, separators,
//   punctuation, duplicates. Anything requiring judgement is left to the human who names
//   the file.

/** The written policy, quoted so the code and the SOP cannot drift apart silently. */
export const FilenamePolicy = Object.freeze({
  id: 'universal-filename-policy-v1.0',
  version: 'v1.0',
  effective: '2026-06-16',
  owner: 'Document Control / Operations',
  source: 'docs/policies/universal-filename-policy/universal_filename_policy_sop.md',
  pattern: 'subject_document_type[_descriptor][_v#][_yyyy-mm-dd]',
  /** The SOP's own regex, applied to the filename BODY (extension excluded). */
  bodyPattern: /^[a-z0-9]+(?:_[a-z0-9]+)*(?:_v[0-9]+(?:_[0-9]+)?)?(?:_[0-9]{4}-[0-9]{2}-[0-9]{2})?$/,
  /** Rule 6: names that describe nothing. Flagged, never rejected — see the header. */
  vagueTerms: Object.freeze(['final', 'latest', 'new', 'misc', 'updated', 'use_this_one', 'copy', 'untitled']),
});

export const FILENAME_LIMITS = Object.freeze({
  maxBodyChars: 120,      // the whole name stays under the 200 the transport allows
  maxExtensionChars: 12,  // .compressed, .markdown; anything longer is not an extension
  fallbackBody: 'document',
});

/* Windows and SharePoint reserved device names. A file called `con.pdf` is not a naming
   nuisance — on a Windows host it can fail to open, fail to delete, or resolve to a device.
   SharePoint refuses them outright, so a scan deposited under one is silently lost. */
const RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/* Control characters, NUL, and the bidirectional overrides. The last of these is the reason
   this list is not just "printable ASCII please": U+202E renders `photo‮gnp.exe` as
   `photoexe.png` in most file listings, which is a disguise, not a typo. */
// eslint-disable-next-line no-control-regex
const DANGEROUS = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Latin letters with diacritics, mapped rather than dropped: `Ségou` → `segou`, not `sgou`. */
const FOLD = {
  a: 'àáâãäåāăą', c: 'çćĉċč', d: 'ďđ', e: 'èéêëēĕėęě', g: 'ĝğġģ', h: 'ĥħ',
  i: 'ìíîïĩīĭįı', j: 'ĵ', k: 'ķ', l: 'ĺļľŀł', n: 'ñńņňŉ', o: 'òóôõöøōŏő',
  r: 'ŕŗř', s: 'śŝşš', t: 'ţťŧ', u: 'ùúûüũūŭůűų', w: 'ŵ', y: 'ýÿŷ', z: 'źżž',
  ss: 'ß', ae: 'æ', oe: 'œ',
};
const FOLD_MAP = new Map();
for (const [to, from] of Object.entries(FOLD)) for (const ch of from) FOLD_MAP.set(ch, to);

const fold = s => [...s].map(ch => FOLD_MAP.get(ch) ?? ch).join('');

/**
 * Split a filename into body and extension.
 *
 * A leading dot is part of the body, not an extension: `.htaccess` has no extension, and
 * treating it as one produces an empty body and a file called `.htaccess` with nothing in
 * front of it.
 */
export function splitExtension(name) {
  const s = String(name || '');
  const i = s.lastIndexOf('.');
  if (i <= 0 || i === s.length - 1) return { body: s, extension: '' };
  const ext = s.slice(i + 1);
  if (ext.length > FILENAME_LIMITS.maxExtensionChars || /[^A-Za-z0-9]/.test(ext)) {
    return { body: s, extension: '' };
  }
  return { body: s.slice(0, i), extension: ext.toLowerCase() };
}

/**
 * Bring a filename to the policy.
 *
 * Returns `{ name, body, extension, original, changed, reasons }`. `reasons` names each
 * transformation that fired, so an audit line can say WHY a name changed rather than only
 * that it did — the difference between a log entry and evidence.
 */
export function normaliseFilename(raw, { limits = FILENAME_LIMITS } = {}) {
  const original = String(raw ?? '');
  const reasons = [];

  // Path components first. A separator in a declared filename is either a mistake or an
  // attempt to choose where the file lands; neither survives.
  let work = original.split(/[\\/]/).pop() ?? '';
  if (work !== original) reasons.push('path_stripped');

  if (DANGEROUS.test(work)) { reasons.push('control_characters_removed'); }
  DANGEROUS.lastIndex = 0;
  work = work.replace(DANGEROUS, '');

  /* Trim leading/trailing whitespace and dots BEFORE splitting off the extension.
     `report.pdf ` — a single trailing space, which copy-paste and some scanners produce
     routinely — otherwise makes `pdf ` fail the extension check, so the whole string is
     treated as the body and the file arrives named `report_pdf` with no extension at all.
     Windows strips these characters silently anyway, so trimming here matches what the
     destination filesystem would do rather than fighting it. */
  const trimmed = work.replace(/^[\s.]+|[\s.]+$/g, '');
  if (trimmed !== work) reasons.push('trimmed');
  work = trimmed;

  let { body, extension } = splitExtension(work);

  const before = body;
  body = fold(body.toLowerCase());
  if (body !== before.toLowerCase()) reasons.push('diacritics_folded');
  if (before !== before.toLowerCase()) reasons.push('lowercased');

  // Everything that is not a policy character becomes a separator, then separators collapse.
  // Doing it in that order is what turns `Report (final) - v2.PDF` into `report_final_v2`
  // rather than `report__final___v2`.
  const punctuated = body;
  body = body.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (body !== punctuated) reasons.push('separators_normalised');

  /* Rule 8: a terminal ISO date is the one place a hyphen is allowed, and the substitution
     above has just turned it into underscores. Put it back, and only there. */
  const dated = body.replace(/_([0-9]{4})_([0-9]{2})_([0-9]{2})$/, '_$1-$2-$3');
  if (dated !== body) { body = dated; reasons.push('iso_date_restored'); }

  if (body.length > limits.maxBodyChars) {
    body = body.slice(0, limits.maxBodyChars).replace(/_+$/, '');
    reasons.push('truncated');
  }

  if (!body) { body = limits.fallbackBody; reasons.push('empty_after_normalisation'); }

  /* A reserved device name is suffixed rather than replaced. `con.pdf` becoming
     `document.pdf` loses what the submitter called it; `con_file.pdf` keeps it and is safe. */
  if (RESERVED.has(body)) { body = `${body}_file`; reasons.push('reserved_device_name'); }

  const name = extension ? `${body}.${extension}` : body;

  /* Steps can cancel out. A name already carrying a terminal ISO date has its hyphens turned
     into underscores and then turned back, so both steps fire and the net effect is nil. An
     audit line that reports "separators normalised" for a file nothing was done to is a
     small lie, and the trail is only worth reading if it does not tell them. */
  if (name === original) return { name, body, extension, original, changed: false, reasons: [] };
  return { name, body, extension, original, changed: true, reasons };
}

/** Does a name already satisfy the SOP? Used for reporting, never as a gate on intake. */
export function isPolicyCompliant(name) {
  const { body, extension } = splitExtension(String(name || ''));
  if (!body) return false;
  if (extension && extension !== extension.toLowerCase()) return false;
  return FilenamePolicy.bodyPattern.test(body);
}

/**
 * Advisory findings for a name that is already compliant in shape but poor in substance.
 *
 * Rule 6 (no vague terms) and rule 5 (3–8 tokens) are judgement calls. They are surfaced to
 * whoever is naming the file, and never enforced against a member of the public.
 */
export function advisoriesFor(name) {
  const { body } = splitExtension(String(name || ''));
  const tokens = body.split('_').filter(Boolean);
  const out = [];
  const vague = tokens.filter(t => FilenamePolicy.vagueTerms.includes(t));
  if (vague.length) out.push({ rule: 6, note: `vague term(s): ${vague.join(', ')}` });
  if (tokens.length && tokens.length < 3) out.push({ rule: 5, note: 'fewer than 3 tokens' });
  if (tokens.length > 8) out.push({ rule: 5, note: `${tokens.length} tokens; 3–8 preferred` });
  return out;
}

/**
 * The receipt half of the policy: what was renamed, and why.
 *
 * Renaming silently is the failure this prevents. Somebody who deposits
 * `Ministry Reply FINAL.pdf` and gets back a receipt saying `ministry_reply_final.pdf`
 * with no explanation reasonably concludes the system is unreliable; one who is told the
 * policy normalised it learns the standard. Returns `{}` when nothing changed, so a
 * compliant name produces no noise.
 */
export function renameNotice(policy) {
  if (!policy?.changed) return {};
  return {
    declaredName: policy.original,
    renamed: { to: policy.name, reasons: policy.reasons, policy: FilenamePolicy.id },
  };
}
