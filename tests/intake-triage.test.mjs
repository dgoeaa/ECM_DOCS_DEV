/**
 * Dual-spine intake triage — decision D2.
 *
 * D2 has three properties and each is asserted directly rather than assumed from the shape
 * of the code:
 *
 *   at par        — neither spine is the record's default classification
 *   human in loop — an AI proposal can never commit itself
 *   AI cannot     — every AI failure mode leaves the record exactly as committable as one
 *   cripple it      never sent to AI at all
 *
 * The third gets the most coverage, because it is the one that fails quietly in production:
 * an AI integration that works until the day the endpoint is down, and then blocks a
 * registry.
 */
import assert from 'node:assert/strict';
import {
  SPINES, TRIAGE_FIELDS, AI_STATUS,
  humanProposal, aiProposal, aiUnavailable, aiSkipped, isAiUsable,
  compareProposals, canCommit, commitTriage,
} from '../core/intake-triage.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; };

const H = (f, by = 'clerk@nitda.gov.ng') => humanProposal(f, { by });

// ── at par ────────────────────────────────────────────────────────────────────────────
ok('there are exactly two spines and neither is named default', () => {
  assert.deepEqual(SPINES.slice().sort(), ['ai', 'human']);
});

ok('both spines produce the same field set', () => {
  const h = H({ category: 'Operations', priority: 'high' });
  const a = aiProposal({ data: { category: 'Operations', priority: 'high' } });
  assert.deepEqual(Object.keys(h.fields).sort(), Object.keys(a.fields).sort());
});

ok('neither spine can smuggle a field outside the agreed shape', () => {
  const h = H({ category: 'Operations', status: 'Approved', assignmentStatus: 'done' });
  assert.deepEqual(Object.keys(h.fields), ['category']);
  const a = aiProposal({ data: { category: 'Operations', status: 'Approved' } });
  assert.deepEqual(Object.keys(a.fields), ['category']);
  for (const f of ['status', 'assignmentStatus']) assert.ok(!TRIAGE_FIELDS.includes(f));
});

ok('an AI proposal is never the record\'s classification on its own', () => {
  // The easy wrong implementation lets AI write record.category. Then the AI silently wins
  // every case nobody looks at.
  const gate = canCommit({ human: null, ai: aiProposal({ data: { category: 'Operations' } }) });
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /cannot commit itself/);
});

// ── human in the loop ─────────────────────────────────────────────────────────────────
ok('committing requires a human decision', () => {
  assert.throws(() => commitTriage({ ai: aiProposal({ data: { category: 'Operations' } }) }),
    /human decision is required/);
});

ok('a human proposal must name its author', () => {
  assert.throws(() => humanProposal({ category: 'Operations' }, { by: '' }), /must name who made it/);
  assert.throws(() => humanProposal({ category: 'Operations' }), /must name who made it/);
});

ok('accepting the AI is recorded as a person accepting, not as the AI deciding', () => {
  const fields = { category: 'Operations', priority: 'high' };
  const out = commitTriage({ human: H(fields), ai: aiProposal({ data: fields }) });
  assert.equal(out.triage.decidedBy, 'clerk@nitda.gov.ng');
  assert.equal(out.triage.basis, 'accepted-ai');
  assert.equal(out.category, 'Operations');
});

ok('deciding against the AI is recorded as the officer\'s own', () => {
  const out = commitTriage({
    human: H({ category: 'Executive Correspondence' }),
    ai: aiProposal({ data: { category: 'Operations' } }),
  });
  assert.equal(out.triage.basis, 'own');
  assert.equal(out.category, 'Executive Correspondence', 'the human decision is what is stored');
});

ok('what the AI said is kept when the two diverged', () => {
  // Flattening it away is how a second spine stops being worth running.
  const out = commitTriage({
    human: H({ category: 'Executive Correspondence' }),
    ai: aiProposal({ data: { category: 'Operations' } }),
  });
  assert.deepEqual(out.triage.aiProposal, { category: 'Operations' });
  assert.deepEqual(out.triage.divergedFields, ['category']);
});

// ── AI cannot cripple the process ─────────────────────────────────────────────────────
ok('THE PROPERTY: with no AI at all, a record commits normally', () => {
  const out = commitTriage({ human: H({ category: 'Operations' }) });
  assert.equal(out.category, 'Operations');
  assert.equal(out.triage.aiStatus, AI_STATUS.skipped);
  assert.equal(out.triage.basis, 'own');
});

ok('every AI failure mode leaves the record exactly as committable', () => {
  const human = H({ category: 'Operations' });
  const failures = [
    ['not consulted', undefined],
    ['explicitly skipped', aiSkipped('endpoint not configured')],
    ['unavailable', aiUnavailable('timed out')],
    ['returned null', aiProposal(null)],
    ['returned a string', aiProposal('service unavailable')],
    ['returned an empty object', aiProposal({})],
    ['returned no classification', aiProposal({ data: { rationale: 'unsure' } })],
    ['returned junk fields only', aiProposal({ data: { nonsense: true } })],
  ];
  for (const [label, ai] of failures) {
    assert.equal(canCommit({ human, ai }).ok, true, `${label} must not block a commit`);
    assert.doesNotThrow(() => commitTriage({ human, ai }), `${label} must not throw`);
  }
});

ok('a malformed AI response degrades to unavailable rather than throwing', () => {
  // An AI that breaks the page when it misbehaves is an AI that can cripple the process.
  for (const bad of [null, undefined, 'text', 42, [], { data: null }, { data: 'oops' }]) {
    assert.doesNotThrow(() => aiProposal(bad));
    assert.equal(aiProposal(bad).status, AI_STATUS.unavailable);
    assert.equal(isAiUsable(aiProposal(bad)), false);
  }
});

ok('low confidence and disagreement are not blockers either', () => {
  const human = H({ category: 'Operations' });
  const lowConf = aiProposal({ data: { category: 'Finance / Procurement', confidence: 0.01 } });
  assert.equal(canCommit({ human, ai: lowConf }).ok, true);
});

// ── the gate's own requirements ───────────────────────────────────────────────────────
ok('a category is required, and its absence is named', () => {
  const gate = canCommit({ human: H({ priority: 'high' }) });
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /category is required/);
});

// ── comparison ────────────────────────────────────────────────────────────────────────
ok('agreement, divergence and one-sided fields are enumerated separately', () => {
  const c = compareProposals(
    H({ category: 'Operations', priority: 'high', dsu: 'Ops' }),
    aiProposal({ data: { category: 'Operations', priority: 'low', assignedTo: 'a@b.ng' } }),
  );
  assert.deepEqual(c.agree, ['category']);
  assert.deepEqual(c.differ, ['priority']);
  assert.deepEqual(c.onlyHuman, ['dsu']);
  assert.deepEqual(c.onlyAi, ['assignedTo']);
  assert.equal(c.agreementRatio, 0.5);
});

ok('comparison is case-insensitive — a casing difference is not a disagreement', () => {
  const c = compareProposals(H({ category: 'Operations' }),
                             aiProposal({ data: { category: 'operations' } }));
  assert.deepEqual(c.agree, ['category']);
  assert.deepEqual(c.differ, []);
});

ok('comparing against an unusable AI proposal reports no divergence, not false agreement', () => {
  const c = compareProposals(H({ category: 'Operations' }), aiUnavailable('down'));
  assert.deepEqual(c.differ, []);
  assert.deepEqual(c.onlyHuman, ['category']);
  assert.equal(c.agreementRatio, null, 'nothing was comparable, which is not 100% agreement');
});

// ── confidence normalisation ──────────────────────────────────────────────────────────
ok('confidence is normalised to 0–1 whether sent as a fraction or a percentage', () => {
  assert.equal(aiProposal({ data: { category: 'x', confidence: 0.8 } }).confidence, 0.8);
  assert.equal(aiProposal({ data: { category: 'x', confidence: 80 } }).confidence, 0.8);
  assert.equal(aiProposal({ data: { category: 'x', confidence: 500 } }).confidence, 1);
  assert.equal(aiProposal({ data: { category: 'x', confidence: -5 } }).confidence, 0);
});

ok('an absent confidence is null, not zero', () => {
  // Reporting it as zero would make an unscored proposal look like a rejected one.
  assert.equal(aiProposal({ data: { category: 'x' } }).confidence, null);
  assert.equal(aiProposal({ data: { category: 'x', confidence: 'high' } }).confidence, null);
});

ok('the AI response is read through its common envelope shapes', () => {
  for (const r of [{ data: { category: 'Operations' } },
                   { result: { category: 'Operations' } },
                   { category: 'Operations' }]) {
    assert.equal(aiProposal(r).fields.category, 'Operations');
  }
});

console.log(`intake-triage: ${passed} assertions passed`);
