// Correspondence categories — F-032.
//
// TWO AXES WERE SHARING ONE FIELD, AND THE WRONG ONE WAS WINNING
//
// The record has a single `category`. Two different vocabularies were writing to it and a
// third was reading it:
//
//   DOCUMENT KIND    what sort of document this is — "Event Invitation", "Application".
//                    Written by modules/correspondence.js, modules/scan-intake.js and the
//                    document portal.
//   ROUTING DOMAIN   which directorate handles it — "Policy / Regulation", "Operations".
//                    Read by core/assignment-cascade.js, which matches a rule on it and
//                    derives the DSU, the assignee, the priority and the due date.
//
// These are legitimately different things and both are worth having. The defect was that
// they shared a field name and a field, so the cascade matched document kinds against
// routing rules, found nothing, and fell through to `rows[0]` — the FIRST row of the
// matrix, which is "Executive Correspondence → ODG → dgs@nitda.gov.ng, urgent, 2 days".
//
// Measured, not inferred: every one of the five kinds the manual form offered and every one
// of the seven the portal maps to routed to the Director-General's office at urgent
// priority. The executive queue was the default destination for substantially all
// correspondence, which makes the priority signal meaningless.
//
// The fix is in two parts, and only one of them is mine to make:
//   1. An unmatched category must land on a NAMED default, not on whatever happens to sort
//      first. That is a bug regardless of any mapping decision, and it is fixed outright.
//   2. Which document kind belongs to which directorate is an operating-model decision.
//      The mapping below is a defensible starting point, marked PROVISIONAL, and it is for
//      the owner to confirm against the registry's reference data.
//
// Runtime reference data always wins: core/assignment-cascade.js only consults this mapping
// when the raw category matches no rule in the matrix, so a real `state.categories` feed
// overrides everything here.

/**
 * Document kinds — the union of what the platform and the portal each offered.
 *
 * One list, so a record can be re-categorised across channels and so a per-kind figure
 * means the same thing wherever it is counted. Some kinds only arise internally
 * (Ministerial Directive) and some only externally (Compliance Filing); both stay valid
 * everywhere, because a hand-delivered application is still an application.
 */
export const DocumentKinds = Object.freeze([
  'Official Correspondence',
  'Ministerial Directive',
  'Application',
  'Proposal',
  'Project Proposal',
  'Report',
  'Compliance Filing',
  'Policy Submission',
  'Event Invitation',
  'Meeting Request',
  'General Correspondence',
]);

/* Left deliberately unresolved: 'Proposal' and 'Project Proposal' are near-duplicates, as
   are 'Official Correspondence' and 'General Correspondence'. Collapsing them would change
   what existing records mean, and which distinctions the registry actually draws is the
   owner's call. They are listed here so the choice is visible rather than accidental. */

/**
 * The subset a PUBLIC submitter may choose.
 *
 * Narrower than DocumentKinds on purpose: an anonymous caller must not be able to label
 * their own letter a "Ministerial Directive" and route it to the Director-General. The
 * portal derives its offered vocabulary from this list rather than keeping a fourth copy of
 * it — which is how "Invitation" and "Event Invitation" came to be two names for one thing.
 * Nothing stands between the public and the intake flow, so declining to OFFER a category
 * stops nobody who posts to the endpoint directly: the SUBMISSION flow must enforce this
 * same subset server-side, as `document-portal/README.md` requires of it.
 */
export const PUBLIC_DOCUMENT_KINDS = Object.freeze([
  'General Correspondence', 'Application', 'Proposal', 'Report',
  'Compliance Filing', 'Policy Submission', 'Event Invitation',
]);

/** Where an unmatched category lands. Named, so it is a decision rather than an accident. */
export const DEFAULT_ROUTING_CATEGORY = 'General Administration';

/**
 * Document kind → routing domain.
 *
 * ⚠️ PROVISIONAL. These assignments are a reasonable reading of the fallback matrix in
 * config/assignment-cascade.config.js, not a statement of NITDA's operating model. Confirm
 * every row against the registry's reference data before go-live — an unconfirmed mapping
 * silently sends real correspondence to the wrong directorate, which is a quieter failure
 * than the one it replaces.
 *
 * Anything absent falls to DEFAULT_ROUTING_CATEGORY, which is the registry — the correct
 * destination for "we do not yet know", since classifying and minuting is what the registry
 * does.
 */
export const DocumentKindRouting = Object.freeze({
  'Ministerial Directive':   'Executive Correspondence',
  'Policy Submission':       'Policy / Regulation',
  'Compliance Filing':       'Policy / Regulation',
  'Application':             'Operations',
  'Project Proposal':        'Operations',
  'Proposal':                'Operations',
  'Report':                  'Operations',
  'Meeting Request':         'General Administration',
  'Event Invitation':        'General Administration',
  'Official Correspondence': 'General Administration',
  'General Correspondence':  'General Administration',
});

/** True when `value` is already a routing domain rather than a document kind. */
export function isRoutingDomain(value, routingCategories = []) {
  const v = String(value || '').trim().toLowerCase();
  return routingCategories.some(c => String(c || '').trim().toLowerCase() === v);
}

/**
 * Resolve whatever is in `category` to a routing domain.
 *
 * `routingCategories` is the set the matrix actually offers, passed in rather than imported
 * so runtime reference data is what decides — this module never overrides a real feed.
 */
export function routingCategoryFor(category, routingCategories = []) {
  const raw = String(category || '').trim();
  if (!raw) return DEFAULT_ROUTING_CATEGORY;
  if (isRoutingDomain(raw, routingCategories)) return raw;

  const mapped = DocumentKindRouting[raw]
    || DocumentKindRouting[DocumentKinds.find(k => k.toLowerCase() === raw.toLowerCase())];
  if (mapped && isRoutingDomain(mapped, routingCategories)) return mapped;
  // The mapping named a domain the matrix does not offer, or there is no mapping at all.
  // Either way the honest answer is the registry, not the first row of the matrix.
  return DEFAULT_ROUTING_CATEGORY;
}
