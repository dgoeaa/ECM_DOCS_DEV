#!/usr/bin/env node
/**
 * Correspondence categories and assignment routing — F-032.
 *
 * The defect: the record has one `category` field, two vocabularies wrote to it (document
 * kind, from the intake forms) and a third read it (routing domain, in the assignment
 * cascade). Nothing matched, so every kind fell through to `rows[0]` — the first row of the
 * matrix, "Executive Correspondence → ODG → urgent, 2 days". The Director-General's office
 * was the default destination for substantially all correspondence.
 *
 * The routing assertions below are the ones that matter: they are written against the
 * OUTCOME (which desk, which priority), not against the mapping table, so they fail if the
 * fallthrough returns however it is reintroduced.
 *
 * Run: node tests/categories.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DocumentKinds, DocumentKindRouting, DEFAULT_ROUTING_CATEGORY, PUBLIC_DOCUMENT_KINDS,
  routingCategoryFor, isRoutingDomain,
} from '../config/correspondence-categories.config.js';
import { AssignmentCascadeConfig } from '../config/assignment-cascade.config.js';
import { cascade, matrix } from '../core/assignment-cascade.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const STATE = { categories: [], departments: [], users: [] };
const routeFor = category => {
  const out = cascade({ activity: { category }, draft: {}, state: STATE, changed: 'category' });
  const d = out.draft || out;
  return { dsu: d.dsu || d.dsuKey || '', assignedTo: d.assignedTo || '', priority: d.priority || '' };
};
const ROUTING_DOMAINS = AssignmentCascadeConfig.fallbackMatrix.map(r => r.category);

console.log('\nCorrespondence categories and routing');

/* ── the defect ────────────────────────────────────────────────────────────── */
section('No document kind falls through to the executive queue');

t('every document kind routes somewhere deliberate', () => {
  const toDg = DocumentKinds.filter(k => routeFor(k).dsu === 'ODG');
  // Ministerial Directive genuinely belongs to the DG's office. Nothing else does by
  // default, and before the fix EVERY kind landed there.
  assert.deepEqual(toDg, ['Ministerial Directive'],
    `these kinds route to ODG: ${toDg.join(', ')}`);
});

t('no document kind is urgent by accident', () => {
  const urgent = DocumentKinds.filter(k => routeFor(k).priority === 'urgent');
  assert.deepEqual(urgent, ['Ministerial Directive'],
    `an urgent default makes the priority signal meaningless: ${urgent.join(', ')}`);
});

t('an unknown category lands on the registry, not on whatever sorts first', () => {
  // `rows[0]` is an accident of ordering. The default has to be a named decision.
  for (const junk of ['Total Nonsense', 'ZZZ', '', null, undefined]) {
    const r = routeFor(junk);
    assert.equal(r.dsu, 'Registry', `"${junk}" routed to ${r.dsu}`);
    assert.equal(r.priority, 'normal');
  }
});

t('surrounding whitespace does not change routing', () => {
  // Trimmed, so a stray space in reference data or a pasted value routes as intended
  // rather than defaulting. Asserted because it is behaviour, not an accident.
  assert.equal(routeFor('Application ').dsu, routeFor('Application').dsu);
  assert.equal(routeFor('  Policy Submission').dsu, routeFor('Policy Submission').dsu);
});

t('reordering the matrix does not change where unknown categories land', () => {
  // The negative control for the whole finding. Under the old code this moved the default
  // destination, because the default WAS the first row.
  const reversed = { ...STATE, categories: [...AssignmentCascadeConfig.fallbackMatrix].reverse() };
  const out = cascade({ activity: { category: 'Total Nonsense' }, draft: {}, state: reversed, changed: 'category' });
  const d = out.draft || out;
  assert.equal(d.dsu || d.dsuKey, 'Registry',
    'the default must be named, not positional');
});

/* ── the two axes ──────────────────────────────────────────────────────────── */
section('Document kind and routing domain are different axes');

t('a routing domain passes through untouched', () => {
  for (const domain of ROUTING_DOMAINS) {
    assert.equal(routingCategoryFor(domain, ROUTING_DOMAINS), domain);
  }
});

t('a document kind resolves to a routing domain that exists', () => {
  for (const kind of DocumentKinds) {
    const resolved = routingCategoryFor(kind, ROUTING_DOMAINS);
    assert.ok(isRoutingDomain(resolved, ROUTING_DOMAINS),
      `${kind} -> ${resolved}, which is not a routing domain`);
  }
});

t('every mapping target is a real routing domain', () => {
  for (const [kind, domain] of Object.entries(DocumentKindRouting)) {
    assert.ok(ROUTING_DOMAINS.includes(domain), `${kind} -> ${domain} is not in the matrix`);
  }
});

t('every mapped kind is a known document kind', () => {
  for (const kind of Object.keys(DocumentKindRouting)) {
    assert.ok(DocumentKinds.includes(kind), `${kind} is mapped but is not a document kind`);
  }
});

t('the named default is itself a routing domain', () => {
  assert.ok(ROUTING_DOMAINS.includes(DEFAULT_ROUTING_CATEGORY),
    `${DEFAULT_ROUTING_CATEGORY} must exist in the matrix or the default cannot resolve`);
});

t('runtime reference data wins over the provisional mapping', () => {
  // The mapping must never override a real feed. Here reference data claims Application is
  // its own routing domain; the resolver must not rewrite it to Operations.
  const withRefData = {
    ...STATE,
    categories: [{ category: 'Application', categoryCode: 'APP', dsuKey: 'Standards',
                   assignedTo: 'standards@nitda.gov.ng', priority: 'high', ackDays: 1, dueDays: 3,
                   instruction: 'Assess.' }],
  };
  const out = cascade({ activity: { category: 'Application' }, draft: {}, state: withRefData, changed: 'category' });
  const d = out.draft || out;
  assert.equal(d.dsu || d.dsuKey, 'Standards', 'reference data must take precedence');
  assert.equal(d.assignedTo, 'standards@nitda.gov.ng');
});

/* ── one vocabulary across the trees ───────────────────────────────────────── */
section('One document-kind vocabulary');

t('the platform modules read the shared list, not their own literal', () => {
  const corr = read('modules/correspondence.js');
  assert.match(corr, /categoryList=DocumentKinds/);
  assert.ok(!/categoryList=\['Ministerial Directive'/.test(corr), 'the local literal must be gone');

  const scan = read('modules/scan-intake.js');
  assert.match(scan, /DocumentKinds\.map/);
  assert.ok(!/const CATEGORIES = \[/.test(scan), 'the local literal must be gone');
});

t('every category the portal maps to is a known document kind', () => {
  /* The portal is a separate zero-build tree of classic scripts — it cannot import an ES
     module from config/. So it keeps its own literal and this assertion is what stops the
     two drifting apart, which is the mechanism that produced F-032 in the first place. */
  const data = read('document-portal/js/data.js');
  const block = (data.match(/PF\.CORRESPONDENCE_TYPES = \[([\s\S]*?)\n\];/) || [, ''])[1];
  const categories = [...block.matchAll(/category:\s*'([^']+)'/g)].map(m => m[1]);

  assert.ok(categories.length >= 7, `found ${categories.length} portal categories`);
  for (const c of new Set(categories)) {
    assert.ok(DocumentKinds.includes(c),
      `the portal maps to "${c}", which is not in DocumentKinds — add it there or correct the portal`);
  }
});

t('every portal category routes somewhere other than the executive queue', () => {
  const data = read('document-portal/js/data.js');
  const block = (data.match(/PF\.CORRESPONDENCE_TYPES = \[([\s\S]*?)\n\];/) || [, ''])[1];
  const categories = [...new Set([...block.matchAll(/category:\s*'([^']+)'/g)].map(m => m[1]))];
  for (const c of categories) {
    const r = routeFor(c);
    assert.notEqual(r.dsu, 'ODG', `a public submission categorised "${c}" routed to the DG's office`);
    assert.notEqual(r.priority, 'urgent', `a public submission categorised "${c}" defaulted to urgent`);
  }
});

t('the public channel offers exactly the shared public subset', () => {
  // This list HAD drifted: it carried 'Invitation' where the platform used
  // 'Event Invitation', so every portal invitation arrived with a category no routing rule
  // and no report would match. The portal is now the only place the public vocabulary is
  // presented, so the whole allow-list is compared, not merely spot-checked.
  const data = read('document-portal/js/data.js');
  const block = (data.match(/PF\.CORRESPONDENCE_TYPES = \[([\s\S]*?)\n\];/) || [, ''])[1];
  const offered = [...new Set([...block.matchAll(/category:\s*'([^']+)'/g)].map(m => m[1]))].sort();
  assert.deepEqual(offered, [...PUBLIC_DOCUMENT_KINDS].sort(),
    'the portal must offer the shared public subset, not a private copy of it');
  assert.ok(!/'Invitation'/.test(data), 'the drifted value must not survive anywhere');
});

t('the flow that receives a public submission is told to enforce the same allow-list', () => {
  // Nothing stands between the public and the intake flow any more, so the allow-list is
  // only a control if the flow applies it. A portal that merely declines to OFFER a
  // category stops nobody who posts to the endpoint directly.
  const contract = read('document-portal/README.md');
  assert.match(contract, /restrict `category` to the public subset/i,
    'the intake contract must require the flow to enforce the public subset');
});

t('the public subset is narrower than the full vocabulary', () => {
  // An anonymous caller must not be able to label their own letter a Ministerial Directive
  // and route it to the Director-General.
  for (const k of PUBLIC_DOCUMENT_KINDS) {
    assert.ok(DocumentKinds.includes(k), `${k} is public but not a document kind`);
  }
  assert.ok(!PUBLIC_DOCUMENT_KINDS.includes('Ministerial Directive'),
    'the one kind that routes to the DG must not be publicly selectable');
  assert.ok(PUBLIC_DOCUMENT_KINDS.length < DocumentKinds.length);
});

t('the mapping is marked provisional where a reader will see it', () => {
  // Which kind belongs to which directorate is an operating-model decision, not a technical
  // one. It must not read as settled.
  const cfg = read('config/correspondence-categories.config.js');
  assert.match(cfg, /PROVISIONAL/);
  assert.match(cfg, /reference data/i);
});

/* ── the matrix itself ─────────────────────────────────────────────────────── */
section('The matrix is intact');

t('every fallback rule still resolves to its own desk', () => {
  for (const rule of AssignmentCascadeConfig.fallbackMatrix) {
    const r = routeFor(rule.category);
    assert.equal(r.assignedTo, rule.assignedTo,
      `${rule.category} should route to ${rule.assignedTo}, got ${r.assignedTo}`);
  }
});

t('the matrix has no duplicate routing domains', () => {
  assert.equal(new Set(ROUTING_DOMAINS).size, ROUTING_DOMAINS.length);
});

t('matrix() still returns rows', () => {
  assert.ok(matrix(STATE).length >= AssignmentCascadeConfig.fallbackMatrix.length);
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
