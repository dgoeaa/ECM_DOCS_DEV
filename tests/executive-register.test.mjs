#!/usr/bin/env node
/**
 * Briefs, meetings and projects — the ported capabilities. Decision D6(b).
 *
 * These are the three Activity Hub pages with no root equivalent
 * (docs/architecture/CONSOLIDATION_ANALYSIS.md §2.1). The tests that matter are the ones
 * covering what the port CHANGED, because a straight transcription would have carried three
 * defects across:
 *
 *   1. The Activity Hub applied any decision to any record, so a rejected brief could be
 *      re-decided and an unsubmitted one approved.
 *   2. It spread an arbitrary patch object onto a project, so a caller could overwrite `id`.
 *   3. Its meeting→tasks conversion existed only as a remote call, so with no backend the
 *      user was told to create tasks by hand.
 *
 * Run: node tests/executive-register.test.mjs
 */

import assert from 'node:assert/strict';
import {
  Briefs, Meetings, Projects, RegisterError,
  BriefStates, MeetingStates, ProjectStates,
} from '../core/executive-register.js';

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);
const throws = (fn, reason) => assert.throws(fn, e => e instanceof RegisterError && e.reason === reason,
  `expected RegisterError(${reason})`);

console.log('\nExecutive register — briefs, meetings, projects');

/* ── briefs ────────────────────────────────────────────────────────────────── */
section('Briefs');

t('a brief is created as a draft with a BRF identifier', () => {
  const b = Briefs.create({ title: 'Cloud First implementation', theme: 'DPI' }, 'officer@nitda.gov.ng');
  assert.match(b.id, /^BRF-[0-9a-f-]{36}$/);
  assert.equal(b.status, 'Draft');
  assert.equal(b.title, 'Cloud First implementation');
  assert.equal(b.raisedBy, 'officer@nitda.gov.ng');
});

t('a brief without a title is refused', () => {
  throws(() => Briefs.create({ summary: 'no title' }), 'missing_title');
  throws(() => Briefs.create({ title: '   ' }), 'missing_title');
});

t('the identifier is not a registry reference', () => {
  // A brief is not correspondence and must not consume the correspondence sequence.
  const b = Briefs.create({ title: 'x' });
  assert.ok(!/^NITDA-/.test(b.id));
});

t('Draft → Submitted → Approved is legal', () => {
  let b = Briefs.create({ title: 'x' });
  b = Briefs.transition(b, 'Submitted', { by: 'a@b.ng' });
  assert.equal(b.status, 'Submitted');
  assert.ok(b.submittedAt);
  b = Briefs.transition(b, 'Approved', { by: 'dg@nitda.gov.ng', comments: 'Proceed.' });
  assert.equal(b.status, 'Approved');
  assert.equal(b.decidedBy, 'dg@nitda.gov.ng');
  assert.equal(b.decisionComments, 'Proceed.');
});

t('a draft cannot be approved without being submitted', () => {
  // The Activity Hub allowed this: decideBrief rewrote status from any state.
  const b = Briefs.create({ title: 'x' });
  throws(() => Briefs.transition(b, 'Approved'), 'illegal_transition');
  throws(() => Briefs.transition(b, 'Rejected'), 'illegal_transition');
});

t('a decided brief cannot be re-decided', () => {
  let b = Briefs.transition(Briefs.create({ title: 'x' }), 'Submitted');
  const rejected = Briefs.transition(b, 'Rejected');
  throws(() => Briefs.transition(rejected, 'Approved'), 'illegal_transition');
  const approved = Briefs.transition(b, 'Approved');
  throws(() => Briefs.transition(approved, 'Rejected'), 'illegal_transition');
});

t('a transition to an unknown state is refused', () => {
  const b = Briefs.create({ title: 'x' });
  throws(() => Briefs.transition(b, 'Elsewhere'), 'unknown_state');
});

t('transition does not mutate the record it was given', () => {
  const b = Briefs.create({ title: 'x' });
  const next = Briefs.transition(b, 'Submitted');
  assert.equal(b.status, 'Draft', 'the original must be untouched');
  assert.equal(next.status, 'Submitted');
});

t('nextStates reflects the lifecycle, and terminal states are terminal', () => {
  assert.deepEqual(Briefs.nextStates({ status: 'Draft' }), ['Submitted']);
  assert.deepEqual(Briefs.nextStates({ status: 'Submitted' }), ['Approved', 'Rejected']);
  assert.deepEqual(Briefs.nextStates({ status: 'Approved' }), []);
  assert.deepEqual(Briefs.nextStates({ status: 'Rejected' }), []);
  assert.deepEqual(Briefs.nextStates(undefined), []);
});

/* ── meetings ──────────────────────────────────────────────────────────────── */
section('Meetings');

t('a meeting request is created with an MTG identifier', () => {
  const m = Meetings.create({ title: 'Quarterly review', date: '2026-09-01' }, 'officer@nitda.gov.ng');
  assert.match(m.id, /^MTG-[0-9a-f-]{36}$/);
  assert.equal(m.status, 'Requested');
  assert.equal(m.requestor, 'officer@nitda.gov.ng', 'the requestor defaults to the caller');
  assert.equal(m.location, 'Virtual', 'a sensible default rather than an empty field');
});

t('a meeting without a title or a date is refused', () => {
  throws(() => Meetings.create({ date: '2026-09-01' }), 'missing_title');
  throws(() => Meetings.create({ title: 'x' }), 'missing_date');
});

t('Requested → Approved → Held is legal', () => {
  let m = Meetings.create({ title: 'x', date: '2026-09-01' });
  m = Meetings.transition(m, 'Approved', { by: 'dg@nitda.gov.ng' });
  assert.equal(m.status, 'Approved');
  m = Meetings.transition(m, 'Held');
  assert.equal(m.status, 'Held');
  assert.ok(m.heldAt);
});

t('a declined meeting is terminal, and an unapproved one cannot be held', () => {
  const m = Meetings.create({ title: 'x', date: '2026-09-01' });
  const declined = Meetings.transition(m, 'Declined');
  throws(() => Meetings.transition(declined, 'Approved'), 'illegal_transition');
  throws(() => Meetings.transition(m, 'Held'), 'illegal_transition');
});

t('agreed actions become tasks locally, with no backend involved', () => {
  // The Activity Hub asked a remote action to do this and, absent a backend, told the user
  // to create the tasks by hand. Doing it here is what makes the capability work at all.
  const m = Meetings.create({ title: 'Quarterly review', date: '2026-09-01' });
  const tasks = Meetings.actionsToTasks(m, 'Draft the policy note\nCirculate the minutes\n\n  \nBook the follow-up',
    { by: 'officer@nitda.gov.ng', dueDate: '2026-09-15' });

  assert.equal(tasks.length, 3, 'blank lines are not tasks');
  assert.equal(tasks[0].title, 'Draft the policy note');
  assert.equal(tasks[2].title, 'Book the follow-up');
  for (const task of tasks) {
    assert.match(task.id, /^TSK-/);
    assert.equal(task.referenceId, m.id, 'each task points back at the meeting');
    assert.equal(task.source, 'meeting');
    assert.equal(task.status, 'Not Started');
    assert.equal(task.dueDate, '2026-09-15');
  }
});

t('converting with no actions is refused rather than producing nothing quietly', () => {
  const m = Meetings.create({ title: 'x', date: '2026-09-01' });
  throws(() => Meetings.actionsToTasks(m, ''), 'no_actions');
  throws(() => Meetings.actionsToTasks(m, '   \n  \n'), 'no_actions');
});

/* ── projects ──────────────────────────────────────────────────────────────── */
section('Projects');

t('a project is created with a PRJ identifier and a default status', () => {
  const p = Projects.create({ name: 'Registry digitisation' }, 'owner@nitda.gov.ng');
  assert.match(p.id, /^PRJ-[0-9a-f-]{36}$/);
  assert.equal(p.status, 'Planned');
  assert.equal(p.owner, 'owner@nitda.gov.ng');
});

t('a project without a name, or with an unknown status, is refused', () => {
  throws(() => Projects.create({ owner: 'x' }), 'missing_name');
  throws(() => Projects.create({ name: 'x', status: 'Elsewhere' }), 'unknown_state');
});

t('update changes only the four fields it is allowed to', () => {
  const p = Projects.create({ name: 'A', owner: 'a@b.ng', kpi: 'none' });
  const next = Projects.update(p, { name: 'B', owner: 'c@d.ng', kpi: '80%', status: 'Active' });
  assert.equal(next.name, 'B');
  assert.equal(next.owner, 'c@d.ng');
  assert.equal(next.kpi, '80%');
  assert.equal(next.status, 'Active');
});

t('update cannot overwrite the identifier or invent fields', () => {
  // The Activity Hub spread an arbitrary patch onto the record: `{...p, ...patch}`.
  const p = Projects.create({ name: 'A' });
  const next = Projects.update(p, { id: 'PRJ-hijacked', createdAt: '1999-01-01', injected: true });
  assert.equal(next.id, p.id, 'the identifier must not be patchable');
  assert.equal(next.createdAt, p.createdAt);
  assert.equal(next.injected, undefined, 'an unknown field must not be written');
});

t('update refuses an unknown status and an emptied name', () => {
  const p = Projects.create({ name: 'A' });
  throws(() => Projects.update(p, { status: 'Elsewhere' }), 'unknown_state');
  throws(() => Projects.update(p, { name: '  ' }), 'missing_name');
});

t('update does not mutate the record it was given', () => {
  const p = Projects.create({ name: 'A' });
  Projects.update(p, { name: 'B' });
  assert.equal(p.name, 'A');
});

/* ── shared ────────────────────────────────────────────────────────────────── */
section('Shared properties');

t('the three identifier prefixes are distinct', () => {
  const ids = [
    Briefs.create({ title: 'x' }).id,
    Meetings.create({ title: 'x', date: '2026-01-01' }).id,
    Projects.create({ name: 'x' }).id,
  ];
  assert.deepEqual(ids.map(i => i.split('-')[0]), ['BRF', 'MTG', 'PRJ']);
});

t('identifiers do not collide across rapid creation', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(Briefs.create({ title: 'x' }).id);
  assert.equal(seen.size, 300);
});

t('the state vocabularies are frozen and non-empty', () => {
  for (const [name, states] of [['BriefStates', BriefStates], ['MeetingStates', MeetingStates], ['ProjectStates', ProjectStates]]) {
    assert.ok(Object.isFrozen(states), `${name} must be frozen`);
    assert.ok(states.length >= 3, `${name} looks empty`);
  }
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
