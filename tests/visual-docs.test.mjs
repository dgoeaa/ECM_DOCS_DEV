#!/usr/bin/env node
/**
 * The Platform Atlas must not drift from the platform.
 *
 * docs/visual/ is the artefact most likely to be believed and least likely to be checked.
 * A slide that says "25 routes" is accepted by a room of forty people and nobody opens
 * config/routes.config.js to confirm it — which is exactly why visual documentation goes
 * stale faster than anything else in a repository, and why it is usually deleted rather
 * than maintained.
 *
 * So the atlas asserts nothing by hand. scripts/visual-docs-data.mjs derives every figure
 * from the source tree, and this file asserts that derivation against the LIVE
 * configuration. A route added without running `npm run visual` fails here instead of
 * quietly making the atlas wrong.
 *
 * Assertion-by-value, not snapshot: a snapshot test fails on a colour change and passes on
 * a wrong number, which is precisely backwards.
 *
 * Run: node tests/visual-docs.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
const has = p => existsSync(path.join(ROOT, p));

const { Routes } = await import('../config/routes.config.js');
const { VisibleWorkspaces, HiddenTechnicalRoutes } = await import('../config/workflow-clarity.config.js');
const { RequiredStateCollections } = await import('../config/state-schema.config.js');
const { EndpointKeys } = await import('../config/endpoints.config.js');
const rbac = await import('../config/rbac.config.js');
const { ModuleBoundaries } = await import('../config/module-boundaries.config.js');
const { LifecycleTransitions } = await import('../core/lifecycle.js');

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

const DIR = 'docs/visual';
const DATA = `${DIR}/platform-data.js`;
const PAGE = `${DIR}/index.html`;
const APP = `${DIR}/app.js`;
const CSS = `${DIR}/visual.css`;

console.log('\nPlatform Atlas — docs/visual/');

/* ── the artefact exists and stands alone ──────────────────────────────────── */
section('It stands alone');

t('every file of the atlas is present', () => {
  for (const f of [PAGE, APP, CSS, DATA, `${DIR}/README.md`]) {
    assert.ok(has(f), `${f} is missing`);
  }
});

t('the generator still runs', () => {
  /* THE GAP THIS CLOSES. Every other assertion in this file reads the COMMITTED
     platform-data.js and compares it with the live configuration. That catches a figure
     going stale. It cannot catch the generator being broken, because a broken generator
     writes nothing and the committed file keeps answering — correctly, for as long as
     nothing has changed.

     That is not hypothetical. Removing the identity-provider integration deleted
     `AuthConfig.scopes`, and
     `scripts/visual-docs-data.mjs` still spread it: `npm run visual` died with
     "AuthConfig.scopes is not iterable" while this suite stayed green on the last file it
     had successfully produced. A drift test that cannot tell "nothing drifted" from
     "nothing was measured" is reporting success over a narrower scope than it claims —
     which is the exact failure this repository keeps finding in its own controls.

     Run it read-only. `--write` would repair the drift this suite exists to detect. */
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/visual-docs-data.mjs')],
    { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0,
    `npm run visual cannot produce the dataset:\n       ${(run.stderr || run.stdout || '').trim().split('\n').slice(0, 4).join('\n       ')}`);
});

t('the committed dataset is what the generator produces now', () => {
  /* And the other half: a generator that RUNS but whose output no longer matches what is
     committed means someone changed the tree and did not re-run `npm run visual`.

     Compared on the DERIVED values only. `provenance` — commit sha, branch, commit date —
     is read from git HEAD rather than from the tree, so it changes on every commit
     including the one that adds this test. Comparing it would make the assertion fail
     permanently and for a reason that is not drift, which is how a test gets marked flaky
     and then ignored on the run where it is right. */
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/visual-docs-data.mjs'), '--print'],
    { cwd: ROOT, encoding: 'utf8' });
  if (run.status !== 0) return;   // the assertion above owns that failure
  const fresh = run.stdout.trim();
  if (!fresh.startsWith('{')) return;  // no --print support; the check above still holds
  const committed = /=\s*(\{[\s\S]*?\});?\s*$/.exec(read(DATA));
  if (!committed) return;
  const VOLATILE = new Set(['provenance', 'generatedAt', 'builtAt']);
  const strip = o => JSON.stringify(o, (k, v) => (VOLATILE.has(k) ? undefined : v));
  assert.equal(strip(JSON.parse(fresh)), strip(JSON.parse(committed[1])),
    'docs/visual/platform-data.js is stale — run `npm run visual`');
});

const html = read(PAGE);
const app = read(APP);
const css = read(CSS);

t('it loads nothing from the network', () => {
  // Same rule as every other shipped asset. A briefing pack that needs the internet is a
  // briefing pack that fails in the room where it matters.
  for (const [name, src] of [[PAGE, html], [APP, app], [CSS, css]]) {
    const remote = src.match(/(?:src|href|url)\s*[=(]\s*["']?https?:\/\/[^"')\s]+/gi) || [];
    assert.deepEqual(remote, [], `${name} reaches the network: ${remote.join(', ')}`);
  }
});

t('it opens from a file path — no server, no build step', () => {
  /* The atlas is meant to be copied to a memory stick and opened on a projector laptop.
     Two properties make that work, and both are easy to break by accident:

       1. CLASSIC SCRIPTS, NOT MODULES. A file:// page has an opaque origin and ES modules
          are fetched with CORS semantics, so `type="module"` is blocked from disk in every
          browser. That is exactly why the platform's own index.html needs `npm start`.
       2. NOTHING OUTSIDE THIS DIRECTORY. Firefox refuses a file:// subresource above the
          page's own folder, so a single `../` reference — the favicon was one — makes the
          folder non-portable the moment somebody copies it on its own. */
  const modules = html.match(/<script[^>]*type\s*=\s*["']module["'][^>]*>/gi) || [];
  assert.deepEqual(modules, [], 'an ES module cannot load from a file:// page');

  const refs = [...html.matchAll(/(?:src|href)\s*=\s*"([^"#][^"]*)"/g)].map(m => m[1])
    .filter(u => !/^(data:|https?:|mailto:)/.test(u));
  const escaping = refs.filter(u => u.startsWith('../') || u.startsWith('/'));
  assert.deepEqual(escaping, [],
    `these leave docs/visual/ and break the copied-folder case: ${escaping.join(', ')}`);

  for (const u of refs) assert.ok(has(`${DIR}/${u}`), `${u} is referenced but not present`);

  // Same rule for the stylesheet: url() must not climb out either.
  const cssRefs = [...css.matchAll(/url\(\s*["']?([^"')]+)/g)].map(m => m[1])
    .filter(u => !/^(data:|https?:)/.test(u));
  assert.deepEqual(cssRefs.filter(u => u.startsWith('../') || u.startsWith('/')), [],
    'visual.css reaches outside docs/visual/');
});

t('it renders in both themes, and the explicit toggle wins', () => {
  assert.match(css, /prefers-color-scheme:\s*dark/, 'no dark-scheme support');
  assert.match(css, /\[data-theme="dark"\]/, 'the explicit toggle must win too');
  assert.match(css, /\[data-theme="light"\]/);
});

t('it carries a print stylesheet, because it is used as a handout', () => {
  assert.match(css, /@media print/);
});

t('reduced motion is honoured', () => {
  assert.match(css, /prefers-reduced-motion/);
});

/* ── the dataset is current ────────────────────────────────────────────────── */
section('The dataset is current');

/* platform-data.js is a classic script that assigns a global, so it can be read from a
   file:// page. Evaluating it in a bare scope is how the test reads what the page reads. */
const P = (() => {
  const src = read(DATA).replace('window.DGO_PLATFORM =', 'globalThis.__ATLAS__ =');
  // eslint-disable-next-line no-eval
  (0, eval)(src);
  return globalThis.__ATLAS__;
})();

t('the dataset parses and declares its provenance', () => {
  assert.ok(P, 'platform-data.js did not assign the global');
  assert.equal(P.provenance.generatedFrom, 'scripts/visual-docs-data.mjs');
  assert.match(P.provenance.commit, /^[0-9a-f]{7,40}$|^unknown$/);
});

const claims = [
  ['routes', () => P.headline.routes, Routes.length],
  ['visible workspaces', () => P.headline.visibleWorkspaces, VisibleWorkspaces.length],
  ['technical routes', () => P.headline.technicalRoutes, Object.keys(HiddenTechnicalRoutes).length],
  ['state collections', () => P.headline.stateCollections, RequiredStateCollections.length],
  ['contract keys', () => P.headline.contractKeys, EndpointKeys.length],
  ['roles', () => P.headline.roles, rbac.RoleList.length],
  ['permissions', () => P.headline.permissions, Object.values(rbac.Permissions).length],
];
for (const [label, actual, expected] of claims) {
  t(`the dataset states ${expected} ${label}`, () => {
    assert.equal(actual(), expected, `stale dataset — run: npm run visual`);
  });
}

t('every declared route is in the dataset, with nothing invented', () => {
  assert.deepEqual(
    P.routes.map(r => r.path).sort(),
    Routes.map(r => r.path).sort(),
    'route list differs from config/routes.config.js — run: npm run visual');
});

t('each route carries the boundary contract that governs it', () => {
  for (const r of P.routes) {
    const b = ModuleBoundaries[r.path];
    if (!b) continue;
    assert.equal(r.boundaryRole, b.role, `${r.path}: boundary role drifted`);
    assert.deepEqual(r.owns, b.owns || [], `${r.path}: owns drifted`);
    assert.deepEqual(r.mustNotOwn, b.mustNotOwn || [], `${r.path}: mustNotOwn drifted`);
  }
});

t('the role/route matrix is the live one, not a copy of it', () => {
  assert.deepEqual(P.security.roleRouteAccess, JSON.parse(JSON.stringify(rbac.RoleRouteAccess)));
  for (const r of rbac.RoleList) {
    const got = P.security.roles.find(x => x.id === r.id);
    assert.ok(got, `role ${r.id} missing from the dataset`);
    assert.deepEqual(got.permissions, r.permissions, `${r.id}: permissions drifted`);
  }
});

t('the endpoint contract keys match, and no URL leaked into the dataset', () => {
  assert.deepEqual(P.endpoints.keys, [...EndpointKeys]);
  const raw = read(DATA);
  assert.ok(!/https:\/\/[^"']*(?:logic\.azure|powerautomate|sig=)/i.test(raw),
    'a signed workflow URL reached the generated dataset');
});

t('the lifecycle includes states that are only ever transition TARGETS', () => {
  /* `rejected`, `duplicate`, `on_hold` and `reopened_as_new_ref` have no outgoing
     transition, so reading only the keys draws a lifecycle with no way to refuse
     anything. The first version of this generator did exactly that. */
  const all = new Set(Object.keys(LifecycleTransitions));
  for (const targets of Object.values(LifecycleTransitions)) targets.forEach(x => all.add(x));
  assert.deepEqual(P.lifecycle.states.slice().sort(), [...all].sort());
  assert.equal(P.headline.lifecycleStates, all.size);
  assert.ok(P.lifecycle.terminalStates.length > 0, 'no terminal state was detected');
  for (const s of P.lifecycle.terminalStates) {
    assert.ok(!(LifecycleTransitions[s] || []).length, `${s} is not terminal`);
  }
});

t('the file inventories are the files on disk', () => {
  for (const layer of ['config', 'core', 'shared', 'modules']) {
    /* `*.local.js` is git-ignored deploy-time configuration written by `npm run setup`.
       It is not source, and including it here would fail this suite for every operator
       who has wired their endpoints — which the commissioning path asks them to do
       first. The generator applies the same exclusion. */
    const onDisk = readdirSync(path.join(ROOT, layer))
      .filter(f => f.endsWith('.js') && !f.endsWith('.local.js')).sort();
    assert.deepEqual(P.inventory[layer].map(f => f.name + '.js').sort(), onDisk,
      `${layer}/ inventory is stale — run: npm run visual`);
    assert.equal(P.layers.files[layer], onDisk.length);
  }
});

t('the atlas describes one topology, and it is the one on disk', () => {
  /* This test used to assert either topology, because two platform variants were
     maintained: one fronted by an enforcing proxy, one calling the flows directly. That
     variant is retired — the architecture decision is direct invocation and the proxy
     branch was withdrawn rather than deployed — so the generator no longer detects, and
     this no longer accepts, a shape that cannot occur.

     The dangerous failure was never a missing inventory. It is an inventory that disagrees
     with the tree: a page claiming a proxy tier this repository does not ship is exactly
     the confident wrong picture the generated-documentation approach exists to prevent.
     That is asserted here in both directions, and it now also catches the reverse — a
     `proxy/` reappearing on disk while the atlas denies it, which under the current
     decision means someone has reintroduced an intermediary. */
  assert.ok(!existsSync(path.join(ROOT, 'proxy/src')),
    'proxy/src exists — an intermediary has been reintroduced into a request path the '
    + 'architecture requires to be direct, and the atlas no longer draws it');

  assert.equal(P.backend.present, false, 'the dataset claims a proxy tier this tree does not ship');
  assert.deepEqual(P.backend.modules, [], 'no proxy on disk, so no modules may be listed');
  assert.deepEqual(P.quality.proxyTests, [], 'no proxy on disk, so no proxy tests may be listed');
  assert.ok(P.backend.note, 'the absence must be stated, not left as a silent zero');
  assert.match(P.backend.note, /directly/,
    'the note must say what the platform does instead, not only what it lacks');
});

t('no zone in the atlas is an enforcement tier this repository ships', () => {
  /* The enforcement boundary is the flow endpoint. A zone diagram that draws a component
     in front of it would describe a system that does not exist and would quietly
     contradict the architecture the packages are built to. */
  const ids = P.zones.map(z => z.id);
  assert.ok(!ids.includes('enforcement'),
    'the atlas draws an enforcement zone; there is no component between the browser and the flow');
  assert.equal(ids.length, 3, `expected three zones, got ${ids.length}: ${ids.join(', ')}`);
  const record = P.zones.find(z => z.id === 'record');
  assert.match(record.rule, /enforcement boundary sits here/,
    'the systems-of-record zone must carry the enforcement rule, since nothing stands in front of it');
});

t('the data model totals match the provisioning specification', () => {
  const spec = JSON.parse(read('docs/reference/sharepoint-provisioning-spec.json'));
  assert.equal(P.dataModel.listCount, spec.lists.length);
  assert.equal(P.dataModel.fieldCount, spec.fields.length);
  const listed = P.dataModel.lists.reduce((n, l) => n + l.fields.length, 0);
  assert.equal(listed, spec.fields.length, 'a field belongs to no list on the page');
});

t('the brand values are the design system’s, not a look-alike', () => {
  const prim = read('styles/dgo-design-system/tokens/tokens.primitive.css');
  for (const b of P.design.brand) {
    assert.ok(prim.includes(`${b.token}:`), `${b.token} is not a design-system token`);
    assert.ok(new RegExp(`${b.token}:\\s*${b.value}`, 'i').test(prim),
      `${b.token} is ${b.value} on the page but not in tokens.primitive.css`);
  }
  // The stylesheet restates the two brand greens; they must be the real ones.
  for (const hex of ['#05583B', '#17B255']) {
    assert.ok(css.toUpperCase().includes(hex), `visual.css does not use brand ${hex}`);
    assert.ok(prim.toUpperCase().includes(hex), `${hex} is not in the design system`);
  }
});

t('the cascade drawn is the cascade declared', () => {
  const declared = (read('styles/index.css')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .match(/@layer\s+([^;]+);/) || [])[1]
    .split(',').map(s => s.trim());
  assert.deepEqual(P.design.layerOrder, declared,
    'the layer order on the page is not the one in styles/index.css');
});

/* ── the page renders what the dataset holds ───────────────────────────────── */
section('The page is built from the dataset');

t('the page states no count of its own', () => {
  /* The failure mode this whole design exists to prevent: a number typed into the markup.
     Any figure the page shows must come from window.DGO_PLATFORM, so the HTML shell must
     contain no standalone numeric claim about the platform. */
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const numeric = body.match(/\b\d+\s+(routes?|workspaces?|modules?|roles?|fields?|lists?|states?|collections?)\b/gi) || [];
  assert.deepEqual(numeric, [], `hardcoded counts in the shell: ${numeric.join(', ')}`);
});

t('every figure is inline SVG, drawn rather than linked', () => {
  assert.ok(!/<img\b/i.test(html) && !/<img\b/i.test(app), 'diagrams must be drawn, not linked');
  const opens = app.match(/svgOpen\(/g) || [];
  assert.ok(opens.length >= 8, `expected at least 8 figures, found ${opens.length}`);
});

t('every SVG is built through the one helper that gives it a viewBox and a label', () => {
  /* Enforced structurally rather than by inspection: a raw <svg opening tag in app.js
     would be one that skipped the accessibility contract. The brand mark in index.html is
     static markup and is checked separately below. */
  const withoutHelper = app.replace(/function svgOpen[\s\S]*?\n  }/, '');
  const raw = withoutHelper.match(/'<svg[^']*/g) || [];
  assert.deepEqual(raw, [], `raw <svg> in app.js bypasses svgOpen(): ${raw.join(' | ')}`);
  assert.match(app, /function svgOpen[\s\S]*viewBox="[\s\S]*role="img"[\s\S]*aria-label=/,
    'svgOpen must supply viewBox, role and aria-label');
  assert.ok(!/function svgOpen[\s\S]{0,400}\swidth="\d/.test(app),
    'a hardcoded width breaks the responsive container');
});

t('the static SVG in the shell is labelled too', () => {
  for (const tag of html.match(/<svg[^>]*>/g) || []) {
    const decorative = /aria-hidden="true"/.test(tag);
    assert.ok(decorative || (/role="img"/.test(tag) && /aria-label="/.test(tag)),
      `unlabelled and not marked decorative: ${tag.slice(0, 70)}`);
  }
});

t('every route is rendered as an addressable card', () => {
  // The drift this test exists to catch: a route that exists but is not drawn.
  for (const r of Routes) {
    assert.ok(app.includes("'route-'"), 'route cards are not given stable ids');
  }
  assert.match(app, /id="route-'\s*\+\s*h\(r\.path\)/, 'route card ids are not derived from the route');
});

t('the page escapes everything it interpolates', () => {
  /* Every value here comes off disk — a filename, a sender-shaped string, a field name.
     The atlas is not exempt from the platform's own encoding rule. */
  assert.match(app, /function h\(s\)[\s\S]{0,400}replace\(\/&\/g/, 'no escaper defined');
  assert.match(app, /&lt;/, 'the escaper does not handle <');
  assert.match(app, /&quot;/, 'the escaper does not handle "');
});

t('search, lens, theme and print are all wired', () => {
  for (const [what, re] of [
    ['search palette', /openPalette/],
    ['audience lens', /function applyLens/],
    ['theme toggle', /dgo\.visual\.theme/],
    ['print', /window\.print\(\)/],
    ['scroll spy', /IntersectionObserver/],
  ]) assert.match(app, re, `${what} is not wired`);
});

t('the four audience lenses named in the shell are the ones the page implements', () => {
  const inShell = [...html.matchAll(/data-lens="([a-z]+)"/g)].map(m => m[1]).filter(x => x !== 'all');
  assert.ok(inShell.length >= 4, 'fewer than four lenses offered');
  const used = new Set();
  for (const m of app.matchAll(/aud:\s*'([^']+)'/g)) m[1].split(/\s+/).forEach(x => used.add(x));
  for (const lens of inShell) {
    assert.ok(used.has(lens), `the ${lens} lens is offered but no section declares it`);
  }
});

t('every section declares at least one audience', () => {
  const sections = [...app.matchAll(/id:\s*'([a-z-]+)',\s*part:/g)].map(m => m[1]);
  const auds = [...app.matchAll(/id:\s*'[a-z-]+',\s*part:[^}]*?aud:\s*'([^']+)'/g)];
  assert.ok(sections.length >= 15, `expected a full atlas, found ${sections.length} sections`);
  assert.equal(auds.length, sections.length,
    'a section has no audience and would vanish from every lens');
});

/* ── the generator keeps working ───────────────────────────────────────────── */
section('The generator itself');

t('the generator reads configuration rather than re-stating it', () => {
  const gen = read('scripts/visual-docs-data.mjs');
  for (const mod of ['routes.config.js', 'rbac.config.js', 'module-boundaries.config.js',
                     'workflow-clarity.config.js', 'endpoints.config.js', 'lifecycle.js']) {
    assert.ok(gen.includes(mod), `the generator does not read ${mod}`);
  }
});

t('the generator counts dynamic and bare imports, not only `from`', () => {
  const gen = read('scripts/visual-docs-data.mjs');
  assert.match(gen, /DYNAMIC_IMPORT\s*=/, 'dynamic imports are not extracted');
  assert.match(gen, /\^\\s\*import\\s\+/, 'bare side-effect imports are not extracted');
});

t('the composition root stays disclosed rather than tidied away', () => {
  assert.equal(P.layers.compositionRoot.file, 'core/boot.js');
  assert.equal(P.layers.compositionRoot.dynamicModuleImports, Routes.length,
    'boot must lazily import exactly one module per route');
  assert.equal(P.layers.acyclicIncludingDynamic, false,
    'if this became true the composition root changed — the layer figure needs redrawing');
  assert.ok(/[Cc]omposition root/.test(app) && app.includes('core/boot.js'),
    'the layer figure does not name the composition root');
});

t('the static layer graph is acyclic, and the page says which graph that is', () => {
  assert.equal(P.layers.acyclic, true,
    'a static cycle makes the layer figure false — fix the import, not the diagram');
  assert.match(app, /Static graph:/, 'the page must say WHICH graph is acyclic');
});

t('regenerating is a documented one-liner', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts.visual, 'no `npm run visual` script');
  assert.match(pkg.scripts.visual, /visual-docs-data\.mjs --write/);
  assert.ok(pkg.scripts['test:visual'], 'no `npm run test:visual` script');
  assert.match(pkg.scripts.test, /test:visual/, 'the atlas check is not in `npm test`');
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
