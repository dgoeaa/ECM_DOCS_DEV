#!/usr/bin/env node
/**
 * The architecture diagrams must not drift from the code.
 *
 * A hand-drawn diagram is accurate the day it is drawn and misleading a month later, and the
 * reader has no way to tell which. Every count and every named route on
 * docs/architecture/components.html is asserted here against the live configuration, so a
 * route added without updating the sheet fails the build instead of quietly making the
 * picture wrong.
 *
 * This is deliberately assertion-by-value rather than a snapshot: a snapshot test would fail
 * on a colour change and pass on a wrong number, which is exactly backwards.
 *
 * Run: node tests/architecture.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');

const { Routes } = await import('../config/routes.config.js');
const { VisibleWorkspaces, HiddenTechnicalRoutes } = await import('../config/workflow-clarity.config.js');
const { RequiredStateCollections } = await import('../config/state-schema.config.js');
const { EndpointKeys } = await import('../config/endpoints.config.js');

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const PAGE = 'docs/architecture/components.html';
const html = read(PAGE);
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

console.log('\nArchitecture diagrams');

/* ── the page exists and is self-contained ─────────────────────────────────── */
section('The page stands alone');

t('the components sheet exists', () => assert.ok(existsSync(path.join(ROOT, PAGE))));

t('it loads nothing from the network', () => {
  // Same rule as every other shipped asset: no CDN, no remote font, no external script.
  const remote = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [];
  assert.deepEqual(remote, [], `remote references: ${remote.join(', ')}`);
});

t('every diagram is inline SVG, not an image reference', () => {
  const svgs = html.match(/<svg[\s>]/g) || [];
  assert.ok(svgs.length >= 4, `expected at least 4 sheets, found ${svgs.length}`);
  assert.ok(!/<img\b/i.test(html), 'diagrams must be drawn, not linked');
});

t('each SVG carries an accessible label', () => {
  for (const tag of html.match(/<svg[^>]*>/g) || []) {
    assert.match(tag, /role="img"/, `missing role: ${tag.slice(0, 60)}`);
    assert.match(tag, /aria-label="/, `missing aria-label: ${tag.slice(0, 60)}`);
  }
});

t('each SVG scales rather than fixing a pixel size', () => {
  for (const tag of html.match(/<svg[^>]*>/g) || []) {
    assert.match(tag, /viewBox="/, 'an SVG without a viewBox cannot scale');
    assert.ok(!/\swidth="\d/.test(tag), 'a hardcoded width breaks the responsive container');
  }
});

t('it renders in both themes', () => {
  assert.match(html, /prefers-color-scheme:\s*dark/, 'no dark-scheme support');
  assert.match(html, /\[data-theme="dark"\]/, 'the explicit theme toggle must win too');
  assert.match(html, /\[data-theme="light"\]/);
});

/* ── the counts on the page are the counts in the code ─────────────────────── */
section('Counts match the configuration');

const claims = [
  ['routes', Routes.length, /(\d+)\s+routes/],
  ['visible workspaces', VisibleWorkspaces.length, /(\d+)\s+visible workspaces/],
  ['technical routes', Object.keys(HiddenTechnicalRoutes).length, /(\d+)\s+technical routes/],
  ['state collections', RequiredStateCollections.length, /(\d+)\s+state collections/],
  ['contract keys', EndpointKeys.length, /(\d+)\s+contract keys/],
];

for (const [label, expected, re] of claims) {
  t(`the page states ${expected} ${label}`, () => {
    const m = text.match(re);
    assert.ok(m, `the page never states a ${label} count`);
    assert.equal(Number(m[1]), expected,
      `the page says ${m[1]} ${label}; the configuration says ${expected}`);
  });
}

t('the module and file counts in sheet 5 are real', () => {
  // `.json` counts as well as `.js`: config/ declares product-definition.config.json alongside
  // its modules, and the sheet counts declaration files, not only the executable ones.
  const dirCount = d => readdirSync(path.join(ROOT, d)).filter(f => /\.(js|json)$/.test(f)).length;
  for (const [dir, re] of [['config', /(\d+)\s+declaration files/], ['core', /(\d+)\s+files\s+—\s+state, auth/],
                           ['shared', /(\d+)\s+files\s+—\s+app shell/], ['modules', /(\d+)\s+workspaces, one per route/]]) {
    const m = text.match(re);
    assert.ok(m, `sheet 5 never states a count for ${dir}/`);
    assert.equal(Number(m[1]), dirCount(dir), `${dir}/ — page says ${m[1]}`);
  }
});

/* ── every route is drawn ──────────────────────────────────────────────────── */
section('Every route appears on the relationship sheet');

t('all 29 routes are named somewhere on the page', () => {
  // A route that exists but is not drawn is the drift this test exists to catch.
  const missing = Routes.map(r => r.path).filter(p => !text.includes(p));
  assert.deepEqual(missing, [], `routes absent from the diagrams: ${missing.join(', ')}`);
});

t('no route is drawn that does not exist', () => {
  // The other direction: a route deleted from config but left on the sheet.
  const declared = new Set(Routes.map(r => r.path));
  const drawn = [...html.matchAll(/class="t-mono"[^>]*>([a-z][a-z-]{3,})</g)].map(m => m[1]);
  const phantom = [...new Set(drawn)].filter(d => !declared.has(d) &&
    // Non-route mono labels that legitimately appear: layer names, field names, prose.
    !['config', 'core', 'shared', 'modules', 'closure', 'operations', 'correspondence',
      'approvals', 'dispatch', 'holds', 'channel', 'top', 'base'].includes(d));
  assert.deepEqual(phantom, [], `drawn but not declared: ${phantom.join(', ')}`);
});

t('every visible workspace is drawn with its label', () => {
  for (const w of VisibleWorkspaces) {
    assert.ok(text.includes(w.route), `${w.route} is not on the sheet`);
  }
});

t('the four intake channels are all present', () => {
  for (const c of ['Portal', 'Email', 'Registry', 'Document']) {
    assert.ok(text.includes(`channel: ${c}`), `channel ${c} is not drawn on the lifecycle sheet`);
  }
});

/* ── the derived dataset agrees ────────────────────────────────────────────── */
section('The derived dataset is current');

t('architecture-data.json exists and is regenerable', () => {
  const p = 'docs/architecture/architecture-data.json';
  assert.ok(existsSync(path.join(ROOT, p)), `${p} is missing — run scripts/architecture-data.mjs --write`);
});

t('the dataset matches the configuration it was derived from', () => {
  const d = JSON.parse(read('docs/architecture/architecture-data.json'));
  assert.equal(d.routes.total, Routes.length, 'stale dataset — regenerate it');
  assert.equal(d.routes.visible, VisibleWorkspaces.length);
  assert.equal(d.state.collections, RequiredStateCollections.length);
  assert.equal(d.endpoints.keys, EndpointKeys.length);
  assert.deepEqual(d.routeList, Routes.map(r => r.path).sort());
});

t('the STATIC layer graph is acyclic, and the page says so', () => {
  const d = JSON.parse(read('docs/architecture/architecture-data.json'));
  assert.equal(d.layers.acyclic, true,
    'a static cycle makes sheet 2 false — fix the import, not the diagram');
  assert.ok(/static graph is/.test(text) || /static layers: acyclic/.test(text),
    'the page must say WHICH graph is acyclic, not just that one is');
});

t('the composition root is disclosed rather than hidden', () => {
  /* core/boot.js dynamically imports every module — a genuine upward reference. An earlier
     generator matched only `from '…'` and so reported a tidier graph than the code has.
     The sheet must name this, because a diagram claiming a clean hierarchy while this exists
     is the exact failure these tests are for. */
  const d = JSON.parse(read('docs/architecture/architecture-data.json'));
  assert.equal(d.layers.compositionRoot.file, 'core/boot.js');
  assert.equal(d.layers.compositionRoot.dynamicModuleImports, Routes.length,
    'boot must lazily import exactly one module per route');
  assert.equal(d.layers.acyclicIncludingDynamic, false,
    'if this became true the composition root changed — redraw sheet 2');
  assert.ok(/[Cc]omposition root/.test(text), 'sheet 2 does not name the composition root');
  assert.ok(text.includes('core/boot.js'), 'sheet 2 does not name the file');
});

t('the extractor counts bare and dynamic imports, not only `from`', () => {
  // The regression that produced the wrong graph in the first place.
  const gen = read('scripts/architecture-data.mjs');
  assert.match(gen, /DYNAMIC\s*=/, 'dynamic imports are not extracted');
  assert.match(gen, /\^\\s\*import\\s\+/, 'bare side-effect imports are not extracted');
});

t('the edge counts drawn on sheet 2 are the measured ones', () => {
  const d = JSON.parse(read('docs/architecture/architecture-data.json'));
  for (const [edge, n] of Object.entries(d.layers.edges)) {
    assert.ok(text.includes(String(n)),
      `sheet 2 does not show the count ${n} for ${edge}`);
  }
});

/* ── the retirements stay retired ──────────────────────────────────────────── */
section('Retired components are recorded, not erased');

t('all four retired trees are named on the inventory sheet', () => {
  for (const tree of ['newack/', 'document-portal_Central_NITDA_/', 'ECM_ActivityHub_Portal/', 'proxy/']) {
    assert.ok(text.includes(tree), `${tree} is missing from the retired list`);
  }
});

t('the page does not describe a retired tree as present', () => {
  // It must appear only in the retired paragraph, never as a live component row.
  const inventory = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
  for (const tree of ['newack', 'ECM_ActivityHub_Portal', 'proxy']) {
    assert.ok(!inventory.includes(tree), `${tree} is listed as a live component`);
  }
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
