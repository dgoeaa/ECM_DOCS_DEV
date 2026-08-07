/* V-04 — one governed status vocabulary, shared by both platforms.
 *
 * The design audit listed "Status vocabulary: Received · Validation · Under review ·
 * Action required · Approved reads the same on both sides" under CONSISTENT — PRESERVE.
 * It did not. Measured on main:
 *
 *   document portal   received · validation · review · action-required · approved ·
 *                     declined · withdrawn      (js/data.js, PF.STATUS)
 *   internal platform Pending · Accepted · Declined · Delegated · Archived
 *                     (modules/correspondence.js, statusList)
 *
 * Only "Declined" was common to both, and a submission arriving from the portal was
 * normalised to "Pending" by trackerShape() with no mapping in either direction. A citizen
 * reading "Under review" and the registry officer holding the same record were looking at
 * different words for different states, and a shared design system made them look like one
 * vocabulary.
 *
 * This file is the governed list. The portal's lifecycle is canonical because it is the one
 * published to the public. The internal platform keeps its own stored values — they drive
 * workflow logic and renaming them is a business change, not a UX one — and maps onto the
 * governed list wherever a status is DISPLAYED, so both sides say the same word about the
 * same record.
 */

export const StatusVocabulary = Object.freeze([
  { key: 'received',        label: 'Received',        stage: 1, blurb: 'Logged in the registry and queued for validation.' },
  { key: 'validation',      label: 'Validation',      stage: 2, blurb: 'Documents are being checked for completeness.' },
  { key: 'review',          label: 'Under review',    stage: 3, blurb: 'With the assigned unit for technical assessment.' },
  { key: 'action-required', label: 'Action required', stage: 3, blurb: 'Something is needed from the submitter before this can continue.' },
  { key: 'approved',        label: 'Approved',        stage: 4, blurb: 'Decision issued. Outcome sent to the submitter.' },
  { key: 'declined',        label: 'Declined',        stage: 4, blurb: 'Not approved on this submission.' },
  { key: 'withdrawn',       label: 'Withdrawn',       stage: 4, blurb: 'Closed at the request of the submitter.' },
]);

export const StatusLabels = Object.freeze(
  Object.fromEntries(StatusVocabulary.map(s => [s.key, s.label]))
);

/* The internal platform's stored values, mapped onto the governed list.
 *
 * Two of these edges are readings, not facts, and are flagged for agency confirmation in
 * docs/audits/DESIGN_AUDIT_BRIEF_ASSESSMENT.md rather than settled here:
 *
 *   Accepted → review     "Accepted" means the registry accepted the item for handling,
 *                         which is the public "Under review". If it instead means the
 *                         request itself was granted, it maps to "approved".
 *   Archived → approved   Archive is a closure step, and closure in the internal model does
 *                         not record an outcome. If a matter can be archived without being
 *                         granted, this needs a distinct public state.
 */
export const InternalStatusToGoverned = Object.freeze({
  Pending:   'received',
  Accepted:  'review',
  Delegated: 'review',
  Declined:  'declined',
  Archived:  'approved',
});

/* Returns the governed public label for an internal status, or the value unchanged when it
 * is not one this map knows about — a status nobody agreed on is better shown verbatim than
 * silently relabelled as something it is not. */
export function governedStatusLabel(internalStatus) {
  const key = InternalStatusToGoverned[String(internalStatus || '').trim()];
  return key ? StatusLabels[key] : String(internalStatus || '');
}

export const GovernedStatusKeys = Object.freeze(StatusVocabulary.map(s => s.key));
