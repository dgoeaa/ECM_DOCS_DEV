// Dual-spine intake triage — decision D2.
//
// THE DECISION, IN THE WORDS IT WAS MADE IN
//   "Both a human-triage and ai pipeline should be at par, none should drown the other,
//    be it as it may, AI is always integrated with 'human in the loop' and not allowed to
//    cripple the process where ai is not available or functional."
//
// Three properties, and each one is testable rather than aspirational:
//
//   AT PAR          Both spines produce the SAME shape, into the same taxonomy, and neither
//                   is stored as "the" classification with the other as an annotation on it.
//                   A record carries two proposals side by side.
//
//   HUMAN IN THE    An AI proposal never commits itself. Committing requires a human
//   LOOP            decision, always — including when the human simply accepts the AI's
//                   proposal, which is recorded as an acceptance by that person rather than
//                   as the AI having decided.
//
//   AI CANNOT       Every path works with the AI spine absent. Not degraded-with-a-warning:
//   CRIPPLE IT      absent. An unreachable, unconfigured or failed AI produces a proposal
//                   marked unavailable, and a record so marked is exactly as committable as
//                   one that was never sent to AI at all.
//
// WHY "AT PAR" IS A DATA-SHAPE DECISION AND NOT A POLICY
// The easy implementation is to let AI write `record.category` and have a human correct it.
// That is not parity — it makes the AI's answer the default state of the record and the
// human's a subsequent edit, so the AI silently wins every case nobody looks at. Here
// neither proposal is the record's classification. The classification is what a human
// COMMITTED, and until that happens the record has proposals and no classification.
//
// The corollary is that divergence is first-class: when the two spines disagree the
// disagreement is visible and enumerated, because the whole value of running two is lost if
// the interesting cases are the ones that get flattened.

import { AssignmentCascade } from './assignment-cascade.js';

export const SPINES = Object.freeze(['human', 'ai']);

/** The fields both spines must produce. Same shape, same taxonomy, no privileged spine. */
export const TRIAGE_FIELDS = Object.freeze([
  'category', 'subcategory', 'categoryCode', 'subcategoryCode',
  'dsu', 'supportDsu', 'assignedTo', 'priority',
]);

export const AI_STATUS = Object.freeze({
  ok: 'ok',
  unavailable: 'unavailable',   // not configured, unreachable, timed out, or errored
  skipped: 'skipped',           // deliberately not consulted
});

const str = v => String(v ?? '').trim();

/** Keep only the agreed fields, so neither spine can smuggle extra authority into a record. */
function shape(input = {}) {
  const out = {};
  for (const f of TRIAGE_FIELDS) {
    const v = str(input[f]);
    if (v) out[f] = v;
  }
  return out;
}

/**
 * A human proposal.
 *
 * `by` is required. A proposal with no author cannot later evidence who classified a record,
 * and "the system decided" is the outcome this module exists to prevent.
 */
export function humanProposal(input = {}, { by = '', at = new Date().toISOString() } = {}) {
  if (!str(by)) throw new Error('a human proposal must name who made it');
  return Object.freeze({
    spine: 'human', by: str(by), at,
    fields: Object.freeze(shape(input)),
    status: AI_STATUS.ok,
  });
}

/**
 * An AI proposal, built from whatever the analysis flow returned.
 *
 * Reads defensively and NEVER throws on a malformed response: a flow returning nonsense must
 * degrade to "unavailable", which is a state this module already handles, rather than raising
 * into a caller whose job is to keep triage working. An AI that breaks the page when it
 * misbehaves is an AI that can cripple the process.
 */
export function aiProposal(response, { at = new Date().toISOString(), model = '' } = {}) {
  const d = (response && typeof response === 'object')
    ? (response.data ?? response.result ?? response) : null;
  if (!d || typeof d !== 'object') return aiUnavailable('the analysis returned nothing usable', { at });

  const fields = shape({
    category: d.category ?? d.Category ?? d.classification,
    subcategory: d.subcategory ?? d.Subcategory ?? d.subClassification,
    categoryCode: d.categoryCode ?? d.CategoryCode,
    subcategoryCode: d.subcategoryCode ?? d.SubcategoryCode,
    dsu: d.dsu ?? d.DSU ?? d.department,
    supportDsu: d.supportDsu ?? d.SupportDSU,
    assignedTo: d.assignedTo ?? d.AssignedTo ?? d.suggestedAssignee,
    priority: d.priority ?? d.Priority,
  });
  if (!Object.keys(fields).length) {
    return aiUnavailable('the analysis proposed no classification', { at });
  }

  const raw = Number(d.confidence ?? d.Confidence ?? d.score);
  return Object.freeze({
    spine: 'ai', at, model: str(model || d.model),
    fields: Object.freeze(fields),
    /* Normalised to 0–1, and null rather than 0 when absent. A missing confidence is not
       "no confidence" — reporting it as zero would make an unscored proposal look like a
       rejected one. */
    confidence: Number.isFinite(raw) ? Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw)) : null,
    rationale: str(d.rationale ?? d.reason ?? d.explanation),
    status: AI_STATUS.ok,
  });
}

export function aiUnavailable(reason = '', { at = new Date().toISOString() } = {}) {
  return Object.freeze({
    spine: 'ai', at, fields: Object.freeze({}), confidence: null,
    status: AI_STATUS.unavailable, reason: str(reason),
  });
}

export function aiSkipped(reason = '', { at = new Date().toISOString() } = {}) {
  return Object.freeze({
    spine: 'ai', at, fields: Object.freeze({}), confidence: null,
    status: AI_STATUS.skipped, reason: str(reason),
  });
}

export const isAiUsable = p => !!p && p.spine === 'ai' && p.status === AI_STATUS.ok
  && Object.keys(p.fields || {}).length > 0;

/**
 * Compare the two spines field by field.
 *
 * Returns `{ agree, differ, onlyHuman, onlyAi, agreementRatio }` — enumerated rather than
 * reduced to a boolean, because which fields disagree is the useful part. A category
 * disagreement matters differently from a priority one, and a caller that only knows "they
 * disagree" has to go and work that out again.
 */
export function compareProposals(human, ai) {
  const h = (human && human.fields) || {};
  const a = (isAiUsable(ai) ? ai.fields : {}) || {};
  const agree = [], differ = [], onlyHuman = [], onlyAi = [];

  for (const f of TRIAGE_FIELDS) {
    const hv = h[f], av = a[f];
    if (hv && av) (hv.toLowerCase() === av.toLowerCase() ? agree : differ).push(f);
    else if (hv) onlyHuman.push(f);
    else if (av) onlyAi.push(f);
  }
  const compared = agree.length + differ.length;
  return {
    agree, differ, onlyHuman, onlyAi,
    comparable: compared,
    agreementRatio: compared ? agree.length / compared : null,
  };
}

/**
 * Whether this record can be committed, and why not if it cannot.
 *
 * The AI spine appears nowhere in this decision, deliberately. That is the whole of "AI is
 * not allowed to cripple the process": no AI state — missing, unavailable, low-confidence,
 * or disagreeing — can make `ok` false.
 */
export function canCommit({ human } = {}) {
  if (!human || human.spine !== 'human') {
    return { ok: false, reason: 'a human decision is required; an AI proposal cannot commit itself' };
  }
  if (!str(human.by)) return { ok: false, reason: 'the deciding officer is not recorded' };
  if (!str(human.fields?.category)) return { ok: false, reason: 'a category is required' };
  return { ok: true, reason: '' };
}

/**
 * Commit a triage decision.
 *
 * `basis` records how the human arrived at it — `own` or `accepted-ai` — so an acceptance is
 * evidenced as a person accepting, never as the AI having decided. Both are human decisions;
 * distinguishing them is what makes it possible to audit how much the AI is being rubber-
 * stamped, which is the question that matters once the two spines have been running a while.
 */
export function commitTriage({ human, ai } = {}, { at = new Date().toISOString() } = {}) {
  const gate = canCommit({ human });
  if (!gate.ok) throw new Error(gate.reason);

  const comparison = compareProposals(human, ai);
  const accepted = isAiUsable(ai) && comparison.differ.length === 0
    && comparison.onlyHuman.length === 0 && comparison.comparable > 0;

  return Object.freeze({
    ...human.fields,
    triage: Object.freeze({
      decidedBy: human.by,
      decidedAt: at,
      basis: accepted ? 'accepted-ai' : 'own',
      aiStatus: ai ? ai.status : AI_STATUS.skipped,
      aiConfidence: isAiUsable(ai) ? ai.confidence : null,
      agreedFields: Object.freeze(comparison.agree),
      divergedFields: Object.freeze(comparison.differ),
      /* Kept whole, not merged. When the two disagreed, what the AI said is evidence about
         the AI, and flattening it away is how a second spine stops being worth running. */
      aiProposal: isAiUsable(ai) ? ai.fields : null,
    }),
  });
}

/**
 * A starting human proposal seeded from the category cascade.
 *
 * The point of routing this through the same cascade the AI's category feeds is parity in
 * the literal sense: both spines land in one taxonomy, so their answers are comparable at
 * all. Two classifiers writing different vocabularies cannot be said to agree or disagree.
 */
export function seedFromCascade({ record = {}, state = {}, by = '' } = {}) {
  const draft = AssignmentCascade.cascade({ activity: record, state });
  return humanProposal(draft, { by });
}
