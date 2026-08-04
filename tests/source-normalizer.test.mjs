#!/usr/bin/env node
/**
 * The convergence layer, tested against the shapes the live payloads actually carry.
 *
 * Written as negative controls wherever possible: removing a rule must fail its matching
 * case. Each block names the measured finding it defends, so a future reader can tell
 * whether a rule is still needed or was for a defect that has since been fixed upstream.
 *
 * Run: node tests/source-normalizer.test.mjs
 */
import assert from 'node:assert/strict';
import {
  isSentinel, realValue, decodeFieldName, encodeFieldName, field, decodeRecord,
  canonicalId, sameId, parseCompositeReference, canonicalTerm, groupByTerm,
  documentIdFromTitle, resolveDocumentId, normalizeTask, normalizeDocument,
  splitAddresses, linkTasksToDocuments,
} from '../core/source-normalizer.js';

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

console.log('\nConvergence layer — core/source-normalizer.js');

/* ── sentinels ─────────────────────────────────────────────────────────────── */
section('Sentinels: the placeholders the flows coalesce nulls into');

t('every placeholder observed in the live payloads is caught', () => {
  for (const v of ['No RefIDD', 'No Reference ID', 'No Due Date', 'No Start Date',
                   'No Editor Email', 'No Author', 'No Assigned Value', 'No Title',
                   'No 3rdAssigned Value', 'No Route', 'No Classification', 'No Description',
                   'Unassigned', 'Not Assigned', 'N/A', '----', '', '   ', null, undefined]) {
    assert.equal(isSentinel(v), true, `not detected: ${JSON.stringify(v)}`);
  }
});

t('real values are not mistaken for placeholders', () => {
  for (const v of ['18106', '20260123-18106-GOV-REA-14143', 'GOV TO GOV', 'High',
                   'dgs@nitda.gov.ng', 0, 'Northern Region', 'Nothing to report']) {
    assert.equal(isSentinel(v), false, `wrongly rejected: ${JSON.stringify(v)}`);
  }
});

t('"Nothing to report" survives — the rule is "No <word>", not "starts with n"', () => {
  // A blunter rule would silently delete legitimate prose. This is the negative control.
  assert.equal(isSentinel('Nothing to report'), false);
  assert.equal(isSentinel('Nomination received'), false);
  assert.equal(isSentinel('No RefIDD'), true);
});

t('zero and false are treated correctly', () => {
  assert.equal(isSentinel(0), false, '0 is a value');
  assert.equal(isSentinel(false), true, 'the flows emit false for an absent Description');
  assert.equal(realValue(0), 0);
});

t('empty containers are placeholders', () => {
  assert.equal(isSentinel([]), true);   // tasks.DSULookUp is [] on every record
  assert.equal(isSentinel({}), true);
  assert.equal(isSentinel([1]), false);
});

/* ── encoded internal names ────────────────────────────────────────────────── */
section("SharePoint internal-name encoding (the two paths that silently returned nothing)");

t('the two field names the JSON-path sheet got wrong now decode', () => {
  assert.equal(decodeFieldName('CC_x0027_dTo'), "CC'dTo");
  assert.equal(decodeFieldName('_x0033_rdAssigned'), '3rdAssigned');
});

t('encoding round-trips', () => {
  assert.equal(decodeFieldName(encodeFieldName("CC'dTo")), "CC'dTo");
  assert.equal(decodeFieldName(encodeFieldName('3rdAssigned')), '3rdAssigned');
});

t('a field is readable by its display name whatever the record uses as a key', () => {
  const rec = { CC_x0027_dTo: 'a@x.ng;b@x.ng', _x0033_rdAssigned: 'c@x.ng', Title: 'T' };
  assert.equal(field(rec, "CC'dTo"), 'a@x.ng;b@x.ng');
  assert.equal(field(rec, '3rdAssigned'), 'c@x.ng');
  assert.equal(field(rec, 'Title'), 'T');
  assert.equal(field(rec, 'Absent'), null);
});

t('reading a field never returns a placeholder', () => {
  assert.equal(field({ RefIDD: 'No RefIDD' }, 'RefIDD'), null);
});

t('decodeRecord yields display names and drops placeholders', () => {
  const out = decodeRecord({ CC_x0027_dTo: 'a@x.ng', RefIDD: 'No RefIDD', ID: 5 });
  assert.deepEqual(Object.keys(out).sort(), ["CC'dTo", 'ID']);
});

/* ── identifier typing ─────────────────────────────────────────────────────── */
section('Identifier typing — the whole of the "0/300 broken relationship" verdict');

t("the string '18106' and the number 18106 are the same identifier", () => {
  assert.equal(sameId('18106', 18106), true);
  assert.equal(canonicalId('18106'), canonicalId(18106));
});

t('leading zeros do not create a second identity', () => {
  assert.equal(sameId('018106', 18106), true);
});

t('a placeholder is never equal to anything, including another placeholder', () => {
  assert.equal(sameId('No RefIDD', 'No RefIDD'), false);
  assert.equal(canonicalId('No RefIDD'), null);
});

/* ── composite key ─────────────────────────────────────────────────────────── */
section('The composite business key');

t('a live Reference_ID parses into its four components', () => {
  const r = parseCompositeReference('20260123-18106-GOV-REA-14143');
  assert.equal(r.date, '2026-01-23');
  assert.equal(r.documentId, '18106');
  assert.equal(r.classCode, 'GOV-REA');
  assert.equal(r.taskId, '14143');
});

t('placeholders and other shapes return null rather than a half-parse', () => {
  assert.equal(parseCompositeReference('No Reference ID'), null);
  assert.equal(parseCompositeReference('NITDA-2026-217'), null);
  assert.equal(parseCompositeReference(''), null);
});

/* ── vocabularies ──────────────────────────────────────────────────────────── */
section('Case-variant vocabularies (two writers, one status)');

t("'Not started' and 'Not Started' are one term", () => {
  assert.equal(canonicalTerm('Not started'), canonicalTerm('Not Started'));
});

t('grouping does not split one status into two', () => {
  const rows = [{ Progress: 'Not started' }, { Progress: 'Not Started' }, { Progress: 'Completed' }];
  const g = groupByTerm(rows, 'Progress');
  assert.equal(g.size, 2, 'the two spellings must fold into one group');
  assert.equal(g.get('not started').length, 2);
});

/* ── document linkage ──────────────────────────────────────────────────────── */
section('Document linkage — three carriers, ranked by measured reliability');

t('the title prefix yields the document id', () => {
  assert.equal(documentIdFromTitle('20361 -2026-06-11 -FCDO ( INVITATION ).PDF'), '20361');
  assert.equal(documentIdFromTitle('No Title'), null);
});

t('all three carriers agreeing resolves cleanly and reports no conflict', () => {
  const task = { ID: 14143, Title: '18106 -2026-01-21 -ONSA (X).PDF',
                 RefIDD: '18106', Reference_ID: '20260123-18106-GOV-REA-14143' };
  const r = resolveDocumentId(task);
  assert.equal(r.documentId, '18106');
  assert.equal(r.conflict, false);
});

t('the title alone still resolves when both other carriers are placeholders', () => {
  // This is the shell-cohort shape: 200 live records look exactly like this.
  const task = { ID: 15127, Title: '19877 -2026-05-11 -ONSA (REQUEST).PDF',
                 RefIDD: 'No RefIDD', Reference_ID: 'No Reference ID' };
  const r = resolveDocumentId(task);
  assert.equal(r.documentId, '19877');
  assert.equal(r.source, 'title');
});

t('disagreement between carriers is reported, not silently resolved', () => {
  const task = { Title: '111 -x.PDF', RefIDD: '222', Reference_ID: 'No Reference ID' };
  assert.equal(resolveDocumentId(task).conflict, true);
});

t('a task with no carrier at all resolves to nothing and says so', () => {
  const r = resolveDocumentId({ Title: 'No Title', RefIDD: 'No RefIDD' });
  assert.equal(r.documentId, null);
  assert.equal(r.source, 'none');
});

/* ── whole-record passes ───────────────────────────────────────────────────── */
section('The pass every feed makes');

t('a fully populated task normalises with its linkage and folded terms', () => {
  const n = normalizeTask({
    ID: 14143, Title: '18106 -2026-01-21 -ONSA (X).PDF', RefIDD: '18106',
    Reference_ID: '20260123-18106-GOV-REA-14143', Progress: 'Not Started',
    Classification: 'GOV TO GOV', AssignedTo: 'cerrt@nitda.gov.ng',
  });
  assert.equal(n.id, '14143');
  assert.equal(n.documentId, '18106');
  assert.equal(n.statusTerm, 'not started');
  assert.equal(n.reference.classCode, 'GOV-REA');
  assert.equal(n.assigned, true);
});

t('a shell task normalises without inventing data', () => {
  const n = normalizeTask({
    ID: 15127, Title: '19877 -2026-05-11 -ONSA (REQUEST).PDF', RefIDD: 'No RefIDD',
    Reference_ID: 'No Reference ID', Progress: 'Not Started', Classification: 'GOV TO GOV',
    AssignedTo: 'Unassigned', DueDate: 'No Due Date', Priority: '----',
  });
  assert.equal(n.documentId, '19877', 'the title still carries the link');
  assert.equal(n.assigned, false, 'an unassigned task must report unassigned');
  assert.equal(n.reference, null);
  assert.ok(!('DueDate' in n), 'a placeholder must not survive as a field');
  assert.ok(!('Priority' in n));
});

t('the original record is preserved for audit', () => {
  const raw = { ID: 1, Title: 'No Title' };
  assert.equal(normalizeTask(raw)._raw, raw);
});

t('multi-value person columns split into addresses', () => {
  assert.deepEqual(splitAddresses('dgs@nitda.gov.ng;dg@nitda.gov.ng;fzanna@nitda.gov.ng'),
                   ['dgs@nitda.gov.ng', 'dg@nitda.gov.ng', 'fzanna@nitda.gov.ng']);
  assert.deepEqual(splitAddresses('N/A'), []);
});

t('a document normalises with its person columns split, via the encoded key', () => {
  const n = normalizeDocument({ ID: 17913, Category: 'Administrative Matters',
                                CC_x0027_dTo: 'a@x.ng;b@x.ng', AssignedTo: 'N/A' });
  assert.equal(n.id, '17913');
  assert.deepEqual(n.ccdTo, ['a@x.ng', 'b@x.ng']);
  assert.deepEqual(n.assignedTo, []);
  assert.equal(n.categoryTerm, 'administrative matters');
});

t('the join works across the string/number type boundary', () => {
  const tasks = [{ ID: 1, Title: '18106 -x.PDF', RefIDD: '18106' },
                 { ID: 2, Title: '99999 -y.PDF', RefIDD: 'No RefIDD' }];
  const docs = [{ ID: 18106 }];            // number, as docs actually arrive
  const { linked, unresolved } = linkTasksToDocuments(tasks, docs);
  assert.equal(linked.length, 1);
  assert.equal(linked[0].document.ID, 18106);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'not-in-set');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
