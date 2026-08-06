#!/usr/bin/env node
/**
 * Derive the complete platform dataset that docs/visual/ renders.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT HAND-WRITTEN
 * Visual documentation is the artefact most likely to be believed and least likely to be
 * checked. A slide that says "25 routes" is accepted by a room of forty people and nobody
 * opens config/routes.config.js to confirm it. So nothing in docs/visual/ is asserted by
 * hand: every count, every route, every role, every permission, every module boundary,
 * every file inventory and every field of the data model is read off disk here, and
 * tests/visual-docs.test.mjs asserts the rendered page against this output. A route added
 * without regenerating fails the build instead of quietly making the picture wrong.
 *
 * The prose in docs/visual/index.html is editorial and stays in the page. The FACTS come
 * from here. That split is the whole design: opinions are written, numbers are measured.
 *
 * Usage:  node scripts/visual-docs-data.mjs            print the JSON
 *         node scripts/visual-docs-data.mjs --write    write docs/visual/platform-data.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = ['config', 'core', 'shared', 'modules'];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));
const lines = p => read(p).split('\n').length;
/* `*.local.js` is the naming convention for deploy-time configuration: git-ignored,
   written by `npm run setup`, and holding the signed flow URLs. It is not part of the
   source inventory and must never enter a committed dataset — otherwise this generator
   describes whatever happens to be on the operator's disk, and `npm test` fails for
   everyone who follows the documented setup step. */
const isSource = f => f.endsWith('.js') && !f.endsWith('.local.js');
const listJs = d => fs.readdirSync(path.join(ROOT, d)).filter(isSource).sort();

/* ── live configuration, imported rather than parsed ───────────────────────────
   These are ES modules with no side effects, so importing them gives the real values
   instead of a regex's opinion of them. */
const { Routes } = await import('../config/routes.config.js');
const { VisibleWorkspaces, HiddenTechnicalRoutes } = await import('../config/workflow-clarity.config.js');
const { RequiredStateCollections, RequiredStateObjects } = await import('../config/state-schema.config.js');
const { EndpointKeys } = await import('../config/endpoints.config.js');
const rbac = await import('../config/rbac.config.js');
const { ModuleBoundaries } = await import('../config/module-boundaries.config.js');
const { AppConfig } = await import('../config/app.config.js');
const { AuthConfig, authPosture } = await import('../config/auth.config.js');
const categories = await import('../config/correspondence-categories.config.js');
const lifecycle = await import('../core/lifecycle.js');
const domainStates = await import('../core/enterprise-domain.js');
const filenamePolicy = await import('../config/filename-policy.config.js');
const refMinter = await import('../core/reference-minter.js');
const product = JSON.parse(read('config/product-definition.config.json'));

/* ── provenance ────────────────────────────────────────────────────────────────
   The commit, not a timestamp. A timestamp changes on every run and makes the generated
   file churn in every diff; the commit changes only when the code it describes does. */
function provenance() {
  const git = (...args) => {
    try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
    catch { return ''; }
  };
  return {
    commit: git('rev-parse', '--short', 'HEAD') || 'unknown',
    branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    commitDate: git('log', '-1', '--format=%cs') || 'unknown',
    generatedFrom: 'scripts/visual-docs-data.mjs',
  };
}

/* ── source inventory ──────────────────────────────────────────────────────────
   One record per JavaScript file in the four front-end layers: size, exported surface,
   and which layers it reaches into. This is what makes the module and service catalogues
   real inventories rather than a list somebody remembered to update. */
const EXPORTED = /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const STATIC_IMPORT = /(?:from\s*|^\s*import\s+)['"](\.[^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

/** The leading `//` or `/* *\/` block, if the file opens with one. Prose written by the
 *  author beats prose invented here, so it is used when present and absent otherwise. */
function leadingDoc(src) {
  const out = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('//')) { out.push(line.replace(/^\/\/\s?/, '')); continue; }
    if (!out.length && (line.startsWith('/*') || line.startsWith('*'))) {
      out.push(line.replace(/^\/\*+\s?|^\*+\s?|\*\/$/g, '')); continue;
    }
    if (!line && out.length) { out.push(''); continue; }
    break;
  }
  const text = out.join('\n').trim();
  if (!text) return '';
  // First sentence-ish paragraph only. The full essay stays in the file where it belongs.
  return text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
}

function inventory(dir) {
  return listJs(dir).map(name => {
    const rel = `${dir}/${name}`;
    const src = read(rel);
    const imports = [...src.matchAll(STATIC_IMPORT)].map(m => m[1]);
    const dynamic = [...src.matchAll(DYNAMIC_IMPORT)].map(m => m[1]);
    const reach = new Set();
    for (const spec of [...imports, ...dynamic]) {
      const target = path.normalize(path.join(dir, spec));
      const layer = target.split('/')[0];
      if (LAYERS.includes(layer) && layer !== dir) reach.add(layer);
    }
    return {
      file: rel,
      name: name.replace(/\.js$/, ''),
      lines: src.split('\n').length,
      exports: [...new Set([...src.matchAll(EXPORTED)].map(m => m[1]))],
      imports: imports.length,
      dynamicImports: dynamic.length,
      reaches: [...reach].sort(),
      doc: leadingDoc(src),
    };
  });
}

/* ── layer graph ───────────────────────────────────────────────────────────────
   Static and dynamic edges counted separately, because they mean different things: a
   static edge decides whether a layer can be built and tested alone, a dynamic one is how
   the composition root reaches the modules it registers. Collapsing them produces a graph
   that is either falsely tidy or falsely tangled. */
function layerGraph() {
  const files = LAYERS.flatMap(d => listJs(d).map(f => `${d}/${f}`));
  const layerOf = f => f.split('/')[0];
  const collect = re => {
    const edges = {};
    for (const f of files) {
      for (const m of read(f).matchAll(re)) {
        const target = path.normalize(path.join(path.dirname(f), m[1]));
        const a = layerOf(f), b = layerOf(target);
        if (!LAYERS.includes(b) || a === b) continue;
        const key = `${a}->${b}`;
        edges[key] = (edges[key] || 0) + 1;
      }
    }
    return edges;
  };
  const edges = collect(STATIC_IMPORT);
  const dynamicEdges = collect(DYNAMIC_IMPORT);
  const hasCycle = es => Object.keys(es).some(k => {
    const [a, b] = k.split('->');
    return es[`${b}->${a}`];
  });
  return {
    files: Object.fromEntries(LAYERS.map(l => [l, files.filter(f => layerOf(f) === l).length])),
    sloc: Object.fromEntries(LAYERS.map(l => [l, listJs(l).reduce((n, f) => n + lines(`${l}/${f}`), 0)])),
    edges,
    dynamicEdges,
    acyclic: !hasCycle(edges),
    acyclicIncludingDynamic: !hasCycle({ ...edges, ...dynamicEdges }),
    compositionRoot: {
      file: 'core/boot.js',
      dynamicModuleImports: (read('core/boot.js').match(/import\('\.\.\/modules\//g) || []).length,
    },
  };
}

/* ── the route table, joined to everything that governs a route ────────────────
   A route is described in five places: routes.config (identity), workflow-clarity
   (whether a human ever sees it in navigation), module-boundaries (what it may and may
   not own), rbac (who may open it), and modules/ (the code). Joining them here is what
   lets the page answer "what is this workspace" in one card instead of five files. */
function routeTable() {
  const visible = new Map(VisibleWorkspaces.map(w => [w.route, w]));
  const rolesFor = route => Object.entries(rbac.RoleRouteAccess)
    .filter(([, allowed]) => allowed.includes('*') || allowed.includes(route))
    .map(([role]) => role);
  return Routes.map(r => {
    const w = visible.get(r.path) || null;
    const b = ModuleBoundaries[r.path] || null;
    const file = `modules/${r.path}.js`;
    return {
      path: r.path,
      label: r.label,
      group: r.group,
      kind: r.kind,
      kpi: !!r.kpi,
      visible: !!w,
      reachedThrough: HiddenTechnicalRoutes[r.path]?.visibleThrough || null,
      purpose: w?.purpose || null,
      handoffs: w?.handoffs || [],
      boundaryRole: b?.role || null,
      owns: b?.owns || [],
      views: b?.views || [],
      mustNotOwn: b?.mustNotOwn || [],
      roles: rolesFor(r.path),
      file: exists(file) ? file : null,
      lines: exists(file) ? lines(file) : 0,
    };
  });
}

/* ── backend ───────────────────────────────────────────────────────────────────
   THERE IS NO BACKEND TIER, AND SAYING SO IS THE POINT.

   This generator used to detect `proxy/src` and draw either topology, because two platform
   variants were maintained: one fronting the flows with an enforcing proxy, one calling
   them directly. That variant is retired — the architecture decision is direct invocation,
   the proxy branch was withdrawn rather than deployed, and no branch carrying it remains
   live. Detection code for a topology that cannot occur is not flexibility; it is a second
   description of the system that nobody exercises, in the one artefact whose whole purpose
   is to be checkable against the tree.

   Returning an empty object would render as "0 proxy modules", which reads as a proxy that
   lost its files rather than a platform that has none. The absence is therefore stated. */
function backend() {
  return {
    present: false,
    modules: [], tests: [], totalLines: 0, worker: null,
    note: 'This platform calls the Power Automate flows directly. There is no proxy tier '
        + 'and no intermediary in the request path: each flow enforces its own contract, '
        + 'and the enforcement boundary sits at the flow endpoint rather than in a '
        + 'component this repository ships. The complete trigger URLs are provisioned into '
        + 'the delivered package by scripts/package.mjs.',
  };
}

/* ── public portal ─────────────────────────────────────────────────────────────
   Five pages and a service worker, holding no credential. Counted, so the claim that it
   holds none can be checked rather than repeated. */
function portal() {
  const walk = (d, acc = []) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) walk(rel, acc); else acc.push(rel);
    }
    return acc;
  };
  const all = walk('document-portal');
  const pages = all.filter(f => f.endsWith('.html')).map(f => path.basename(f)).sort();
  const scripts = all.filter(f => /\/js\/.+\.js$/.test(f)).map(f => path.basename(f)).sort();
  const sw = read('document-portal/sw.js');
  return {
    files: all.length,
    pages,
    scripts,
    cacheName: (sw.match(/const CACHE\s*=\s*'([^']+)'/) || [])[1] || '',
    shellEntries: ((sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '')
      .split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean),
    /* The sprite is a JS string literal, so the ids arrive escaped: id=\"i-home\". */
    icons: (read('document-portal/js/icons.js').match(/id=\\?"i-[a-z0-9-]+/g) || []).length,
    manifest: exists('document-portal/manifest.webmanifest'),
  };
}

/* ── design system ─────────────────────────────────────────────────────────────
   The cascade is declared once in styles/index.css, so the layer order and the sheets in
   each layer are read from it. A diagram of a cascade that does not match the @layer
   statement is worse than no diagram. */
function designSystem() {
  /* Comments stripped first. styles/index.css opens with a long explanatory block that
     itself contains the words `@layer` and commas, and parsing that block produced a
     "layer order" made of prose — the exact failure this file exists to prevent. */
  const idx = read('styles/index.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const layerOrder = ((idx.match(/@layer\s+([^;]+);/) || [])[1] || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const sheets = [...idx.matchAll(/@import url\("([^"]+)"\)\s*layer\(([a-z]+)\)/g)]
    .map(m => ({ sheet: m[1], layer: m[2] }));
  const tokenFiles = fs.readdirSync(path.join(ROOT, 'styles/dgo-design-system/tokens'))
    .filter(f => f.endsWith('.css')).sort();
  const primitives = read('styles/dgo-design-system/tokens/tokens.primitive.css');
  const tokenCount = (primitives.match(/^\s*--dgo-[\w-]+:/gm) || []).length;
  const semantic = read('styles/dgo-design-system/tokens/tokens.semantic.css');
  const components = [...read('shared/components.js')
    .matchAll(/^export (?:const|function) ([A-Z][\w]*)/gm)].map(m => m[1]);
  /* A trailing `/* ---------- section ---------- *\/` banner belongs to the NEXT group of
     tokens, not to the swatch above it, so section rules are not read as colour notes. */
  const brand = [...primitives.matchAll(/^\s*(--dgo-(?:green|smart|ink)-\d+):\s*(#[0-9A-Fa-f]{6});(?:\s*\/\*\s*([^*]+?)\s*\*\/)?/gm)]
    .map(m => ({ token: m[1], value: m[2], note: /^-{3,}/.test((m[3] || '').trim()) ? '' : (m[3] || '').trim() }));
  return {
    layerOrder,
    sheets,
    tokenFiles,
    primitiveTokens: tokenCount,
    semanticTokens: (semantic.match(/^\s*--dgo-[\w-]+:/gm) || []).length,
    components,
    themes: AppConfig.themes,
    densities: AppConfig.densities,
    brand,
  };
}

/* ── data model ────────────────────────────────────────────────────────────────
   The SharePoint provisioning specification is the system of record's schema. It is
   already machine-readable, so the data-model view is a rendering of it rather than a
   retyping — which is the only way 97 fields stay right. */
function dataModel() {
  const spec = JSON.parse(read('docs/reference/sharepoint-provisioning-spec.json'));
  const fieldsByList = new Map();
  for (const f of spec.fields || []) {
    if (!fieldsByList.has(f.ListTitle)) fieldsByList.set(f.ListTitle, []);
    fieldsByList.get(f.ListTitle).push({
      name: f.InternalName,
      type: f.FieldType,
      required: f.Required === 'Yes',
      indexed: f.Indexed === 'Yes',
      choices: f.ChoiceValues ? String(f.ChoiceValues).split(/\s*[;|]\s*/).filter(Boolean) : null,
    });
  }
  const lists = (spec.lists || []).map(l => ({
    title: l.ListTitle,
    order: l.ListOrder,
    description: l.Description,
    purpose: l.Purpose,
    fieldCount: l.FieldCount,
    requiredFields: l.RequiredFieldCount,
    indexedFields: l.IndexedFieldCount,
    seedRecords: l.SeedRecordCount,
    fields: fieldsByList.get(l.ListTitle) || [],
  }));
  return {
    lists,
    listCount: lists.length,
    fieldCount: (spec.fields || []).length,
    provisioningSteps: (spec.powerAutomateActions || []).length,
    validationChecks: (spec.validationChecks || []).length,
    /* The client-side shape, which is a different thing from the server schema and is
       worth showing beside it: what the browser holds while a session is open. */
    stateCollections: [...RequiredStateCollections].sort(),
    stateObjects: [...RequiredStateObjects].sort(),
    stateSchemaVersion: AppConfig.stateSchemaVersion,
  };
}

/* ── quality ───────────────────────────────────────────────────────────────────
   Twenty-odd suites is a claim; the npm scripts and the workflow file are the evidence. */
function quality() {
  const pkg = JSON.parse(read('package.json'));
  const suites = Object.entries(pkg.scripts)
    .filter(([k]) => k.startsWith('test:'))
    .map(([k, v]) => ({ script: `npm run ${k}`, runs: v }));
  const ci = read('.github/workflows/ci.yml');
  const jobs = [...ci.matchAll(/^ {2}([a-z-]+):\n {4}name: (.+)$/gm)].map(m => ({ id: m[1], name: m[2] }));
  const steps = [...ci.matchAll(/^ {6}- name: (.+)$/gm)].map(m => m[1]);
  const testFiles = fs.readdirSync(path.join(ROOT, 'tests'))
    .filter(f => /\.(test\.mjs|spec\.js)$/.test(f) || /^check-/.test(f)).sort();
  return {
    suites,
    ciJobs: jobs,
    ciSteps: steps,
    testFiles,
    /* Kept as an explicit empty list rather than removed: the atlas schema is consumed by
       tests/visual-docs.test.mjs, and a key that disappears is harder to read than a key
       that is empty and says why. There is no proxy tier — see backend(). */
    proxyTests: [],
    playwrightSpecs: fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.spec.js')).sort(),
  };
}

/* ── security posture ──────────────────────────────────────────────────────────
   Reported, not asserted. The auth layer's own module says which posture it is in, so the
   page says what the code says rather than what a document hoped. */
function security() {
  const baseline = exists('tests/secrets-baseline.txt')
    ? read('tests/secrets-baseline.txt').split('\n').map(s => s.trim()).filter(l => l && !l.startsWith('#'))
    : [];
  /* The auth layer reports its own posture, including what is still missing before it can
     be activated. Reproducing that judgement here would be a second opinion that drifts,
     so the page shows what the code says about itself. */
  const posture = typeof authPosture === 'function' ? { ...authPosture() } : null;
  return {
    posture,
    postureName: posture ? posture.posture : (AuthConfig.enabled ? 'enforced' : 'development'),
    enabled: AuthConfig.enabled,
    provider: AuthConfig.provider,
    scopes: [...AuthConfig.scopes],
    clientAssertsIdentityWhileInert: !AuthConfig.enabled,
    secretsBaseline: baseline,
    roles: rbac.RoleList.map(r => ({ id: r.id, label: r.label, permissions: r.permissions })),
    permissions: Object.values(rbac.Permissions),
    roleRouteAccess: rbac.RoleRouteAccess,
    personas: [...rbac.Personas],
    rolePersonaMap: rbac.RolePersonaMap,
    personaScopes: rbac.PersonaScopes,
  };
}

/* ── the document's journey ────────────────────────────────────────────────────
   Four channels, one record. The states come from the code, not from a whiteboard. */
const channels = [
  { id: 'A', label: 'Public portal', origin: 'External submitter, no account',
    entry: 'document-portal/submit.html',
    path: 'SUBMISSION flow (direct)',
    channelValue: 'Portal',
    auth: 'Anonymous — rate limited, size capped, create only', status: 'built, awaiting deployment' },
  { id: 'B', label: 'Email', origin: 'Monitored mailbox',
    entry: 'FETCH_ALL', path: 'core/data-loader.js → state.emails', channelValue: 'Email',
    auth: 'Server-side flow', status: 'implemented' },
  { id: 'C', label: 'Scan / physical counter', origin: 'Registry counter clerk',
    entry: 'modules/scan-intake.js',
    path: 'SCAN_INTAKE flow (direct)',
    channelValue: 'Document',
    auth: 'Authenticated staff', status: 'built, awaiting deployment' },
  { id: 'D', label: 'Internal origination', origin: 'NITDA staff',
    entry: 'modules/correspondence.js', path: 'in-platform create', channelValue: 'Registry',
    auth: 'Authenticated staff', status: 'implemented' },
];

/* Three zones, and the enforcement boundary is at the flow endpoint.

   Removing the proxy did not merely delete a box — it moved the enforcement boundary from
   a component this repository ships to the flow itself, and the rule attached to the
   systems-of-record zone moved with it. Emitting four zones on a three-zone tree is how a
   diagram starts lying, which is why the fourth is gone rather than conditional. */
const zones = [
  { id: 'public', label: 'Public', tone: 'public',
    rule: 'Holds no credential. Anonymous by design — a citizen writing to NITDA has no account.',
    components: [{ name: 'document-portal/', detail: `${countFilesIn('document-portal')} files · 5 pages · PWA` }] },
  { id: 'internal', label: 'Internal', tone: 'internal',
    rule: 'NITDA staff. Entra ID mandatory once activated; provisioned and inert today.',
    components: [{ name: 'DGO R11.6 runtime', detail: `${Routes.length} routes · system of record` }] },
  { id: 'record', label: 'Systems of record', tone: 'record',
    rule: 'The enforcement boundary sits here, at the flow endpoint. Each flow authenticates '
        + 'and authorises its own caller; no shipped component stands in front of it.',
    components: [{ name: 'SharePoint', detail: 'lists + document library' },
                 { name: 'Power Automate', detail: 'workflows · cutover scope' }] },
];

function countFilesIn(dir) {
  let count = 0;
  const walk = d => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) walk(`${d}/${e.name}`); else count++;
    }
  };
  walk(dir);
  return count;
}

/** Every state the machine can be in: the keys, plus every state named as a target. */
function lifecycleStates() {
  const set = new Set(Object.keys(lifecycle.LifecycleTransitions));
  for (const targets of Object.values(lifecycle.LifecycleTransitions)) targets.forEach(t => set.add(t));
  return [...set].sort();
}

/* ── assemble ──────────────────────────────────────────────────────────────── */
const routes = routeTable();
const data = {
  provenance: provenance(),
  product: {
    name: product.productName,
    office: product.coordinatingOffice,
    summary: product.executiveSummary,
    ingestionSources: product.ingestionSources,
    appId: AppConfig.id,
    version: AppConfig.version,
    defaultRoute: AppConfig.defaultRoute,
    maxBulkAssign: AppConfig.maxBulkAssign,
    apiTimeoutMs: AppConfig.apiTimeoutMs,
  },
  headline: {
    routes: Routes.length,
    visibleWorkspaces: VisibleWorkspaces.length,
    technicalRoutes: Object.keys(HiddenTechnicalRoutes).length,
    stateCollections: RequiredStateCollections.length,
    contractKeys: EndpointKeys.length,
    roles: rbac.RoleList.length,
    permissions: Object.values(rbac.Permissions).length,
    zones: zones.length,
    channels: channels.length,
    lifecycleStates: lifecycleStates().length,
  },
  zones,
  channels,
  routes,
  navGroups: [...new Set(Routes.map(r => r.group))],
  hiddenRoutes: Object.fromEntries(
    Object.entries(HiddenTechnicalRoutes).map(([k, v]) => [k, v.visibleThrough])),
  layers: layerGraph(),
  inventory: Object.fromEntries(LAYERS.map(l => [l, inventory(l)])),
  endpoints: {
    keys: [...EndpointKeys],
    count: EndpointKeys.length,
    note: 'config/endpoints.config.js holds no URL. Keys resolve through core/endpoint-registry.js, which redacts sig/sv/sp/code before any URL is logged or exported.',
  },
  backend: backend(),
  portal: portal(),
  design: designSystem(),
  dataModel: dataModel(),
  quality: quality(),
  security: security(),
  lifecycle: {
    transitions: lifecycle.LifecycleTransitions,
    /* Keys alone understate the machine: `rejected`, `duplicate`, `on_hold` and
       `reopened_as_new_ref` are reachable states that simply have nothing after them.
       Omitting them draws a lifecycle with no way to refuse anything. */
    states: lifecycleStates(),
    statesWithOutgoing: Object.keys(lifecycle.LifecycleTransitions).length,
    terminalStates: lifecycleStates().filter(s => !(lifecycle.LifecycleTransitions[s] || []).length),
    transitionCount: Object.values(lifecycle.LifecycleTransitions).reduce((a, b) => a + b.length, 0),
    correspondenceStates: [...domainStates.CorrespondenceStates],
    operationStates: [...domainStates.OperationStates],
    registryStates: [...domainStates.RegistryStates],
  },
  taxonomy: {
    documentKinds: categories.DocumentKinds ? Object.keys(categories.DocumentKinds).length : 0,
    publicKinds: [...(categories.PUBLIC_DOCUMENT_KINDS || [])],
    defaultRoutingCategory: categories.DEFAULT_ROUTING_CATEGORY || '',
    referencePattern: String(refMinter.REFERENCE_PATTERN),
    referencePrefix: refMinter.REFERENCE_PREFIX,
    /* D1 removed the fixed width: the register issues `NITDA-2026-217`, unpadded, and the
       platform conforms to the register rather than the other way round. The old export was
       renamed to LEGACY_SEQUENCE_WIDTH and this line went on reading the vanished name,
       emitting `undefined` into the atlas — a fact silently lost rather than loudly broken,
       which is the failure mode a derived dataset is supposed to make impossible. Both are
       published now: the shape that is issued, and the width that is still READ. */
    referenceFormat: `${refMinter.REFERENCE_PREFIX}-YYYY-<sequence>`,
    referenceExample: `${refMinter.REFERENCE_PREFIX}-2026-217`,
    referencePadded: false,
    legacySequenceWidth: refMinter.LEGACY_SEQUENCE_WIDTH,
    filenamePolicy: {
      version: filenamePolicy.FilenamePolicy.version,
      effective: filenamePolicy.FilenamePolicy.effective,
      owner: filenamePolicy.FilenamePolicy.owner,
      pattern: filenamePolicy.FilenamePolicy.pattern,
      bodyPattern: String(filenamePolicy.FilenamePolicy.bodyPattern),
      vagueTerms: [...filenamePolicy.FilenamePolicy.vagueTerms],
      limits: { ...filenamePolicy.FILENAME_LIMITS },
    },
    /* Three real inputs through the real normaliser. A worked example is worth more than
       a restatement of the regex, and running it here means it cannot be wrong. */
    filenameExamples: ['Letter to the DG (final) !!.PDF', 'IMG_20260101_093211(1).jpg', 'con.pdf']
      .map(raw => {
        const r = filenamePolicy.normaliseFilename(raw);
        return { from: raw, to: r.name, reasons: r.reasons || [] };
      }),
  },
};

const js =
  '/* GENERATED by scripts/visual-docs-data.mjs — do not edit.\n' +
  `   Source commit ${data.provenance.commit}. Regenerate with: npm run visual */\n` +
  'window.DGO_PLATFORM = ' + JSON.stringify(data, null, 1) + ';\n';

if (process.argv.includes('--write')) {
  const out = path.join(ROOT, 'docs/visual');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'platform-data.js'), js);
  const h = data.headline;
  console.log(
    `platform-data.js — ${h.routes} routes · ${h.visibleWorkspaces} workspaces · ` +
    `${data.layers.files.core + data.layers.files.modules + data.layers.files.config + data.layers.files.shared} front-end files · ` +
    'no proxy tier · ' +
    `${data.dataModel.listCount} lists / ${data.dataModel.fieldCount} fields · ` +
    `layers ${data.layers.acyclic ? 'acyclic' : 'CYCLIC'}`);
} else {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}
