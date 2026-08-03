#!/usr/bin/env node
/**
 * Derive the architecture dataset from the code, so the diagrams describe what is there.
 *
 * A hand-drawn architecture diagram is accurate on the day it is drawn and misleading a
 * month later, and the reader has no way to tell which. Everything the diagrams assert about
 * counts, routes, layers and dependencies comes from here, and tests/architecture.test.mjs
 * checks the rendered page against this output. When the code changes, the test fails rather
 * than the diagram quietly lying.
 *
 * Usage:  node scripts/architecture-data.mjs           print
 *         node scripts/architecture-data.mjs --write   write docs/architecture/architecture-data.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = ['config', 'core', 'shared', 'modules'];

const { Routes } = await import('../config/routes.config.js');
const { VisibleWorkspaces, HiddenTechnicalRoutes } = await import('../config/workflow-clarity.config.js');
const { RequiredStateCollections } = await import('../config/state-schema.config.js');
const { EndpointKeys } = await import('../config/endpoints.config.js');
const { Roles, RoleRouteAccess } = await import('../config/rbac.config.js');
const boundaries = await import('../config/module-boundaries.config.js');

/* ── layer graph ───────────────────────────────────────────────────────────────
   Counted from real `from '…'` specifiers, resolved to a path, bucketed by top
   directory. Only cross-layer edges are kept; intra-layer imports are dense and say
   nothing about layering. */
function layerGraph() {
  const files = [];
  for (const dir of LAYERS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.js')) files.push(`${dir}/${f}`);
    }
  }
  const layerOf = f => f.split('/')[0];

  /* Three import forms, and missing any of them understates the graph:
       from '…'        the common case
       import '…'      bare, for side effects
       import('…')     dynamic, which is how core/boot.js reaches every module
     An earlier version of this script matched only the first, and consequently reported a
     clean acyclic graph while core/boot.js dynamically imported all 29 modules. Static and
     dynamic edges are counted SEPARATELY below, because they mean different things. */
  const STATIC = /(?:from\s*|^\s*import\s+)['"](\.[^'"]+)['"]/gm;
  const DYNAMIC = /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

  const collect = (re) => {
    const edges = {};
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const m of src.matchAll(re)) {
        const target = path.normalize(path.join(path.dirname(f), m[1]));
        const a = layerOf(f), b = layerOf(target);
        if (!LAYERS.includes(b) || a === b) continue;
        const key = `${a}->${b}`;
        edges[key] = (edges[key] || 0) + 1;
      }
    }
    return edges;
  };

  const edges = collect(STATIC);
  const dynamicEdges = collect(DYNAMIC);
  const hasCycle = es => Object.keys(es).some(k => {
    const [a, b] = k.split('->');
    return es[`${b}->${a}`];
  });

  return {
    files: Object.fromEntries(LAYERS.map(l => [l, files.filter(f => layerOf(f) === l).length])),
    edges,
    dynamicEdges,
    /* True of the STATIC graph, which is the one that governs whether a layer can be built,
       tested or deleted independently. */
    acyclic: !hasCycle(edges),
    /* The composition root. core/boot.js lazily imports every module to register it with the
       router — an upward reference by design, and the only one. Naming it is more honest than
       a diagram that claims a clean hierarchy while this exists. */
    compositionRoot: {
      file: 'core/boot.js',
      dynamicModuleImports: (fs.readFileSync(path.join(ROOT, 'core/boot.js'), 'utf8')
        .match(/import\('\.\.\/modules\//g) || []).length,
    },
    acyclicIncludingDynamic: !hasCycle({ ...edges, ...dynamicEdges }),
  };
}

/* ── zones ─────────────────────────────────────────────────────────────────────
   TARGET_ARCHITECTURE.md §3.1. Component lists are counted from disk, not asserted. */
const countFiles = (dir, ext) => {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return 0;
  let n = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (!ext || e.name.endsWith(ext)) n++;
    }
  };
  walk(p);
  return n;
};

const zones = [
  { id: 'public', label: 'Public', auth: 'None — anonymous submission is the point',
    components: [{ name: 'document-portal/', detail: `${countFiles('document-portal')} files · 5 pages · service worker`, note: 'Holds no credential' }] },
  { id: 'enforcement', label: 'Enforcement', auth: 'Validates every request; the only path onward',
    components: [{ name: 'proxy/', detail: `${countFiles('proxy/src', '.js')} modules · ${EndpointKeys.length} contract keys`, note: 'The only component holding a credential' }] },
  { id: 'internal', label: 'Internal', auth: 'Entra ID, mandatory (provisioned, inert until step 8)',
    components: [{ name: 'root platform', detail: `${Routes.length} routes · ${countFiles('modules', '.js')} modules · ${countFiles('core', '.js')} core`, note: 'The single system of record, since D6(b)' }] },
  { id: 'record', label: 'Systems of record', auth: 'Enforcement zone only — private endpoint / IP-restricted',
    components: [{ name: 'SharePoint', detail: 'Lists + document library', note: 'Holds the bytes' },
                 { name: 'Power Automate', detail: '25 workflows (dev/pilot, to be decommissioned)', note: 'F-001 · cutover scope' }] },
];

/* ── intake channels ───────────────────────────────────────────────────────── */
const channels = [
  { id: 'A', label: 'Document portal', origin: 'External submitter', channel: 'Portal', route: 'proxy /intake/submission', status: 'step 5' },
  { id: 'B', label: 'Email', origin: 'Mailbox', channel: 'Email', route: 'FETCH_ALL → correspondence-email', status: 'implemented' },
  { id: 'C', label: 'Scan / physical', origin: 'Registry counter', channel: 'Registry', route: 'proxy /documents/scan', status: 'step 7' },
  { id: 'D', label: 'Internal origination', origin: 'NITDA staff', channel: 'Document', route: 'modules/correspondence.js', status: 'implemented' },
];

const data = {
  generatedFrom: 'scripts/architecture-data.mjs',
  routes: { total: Routes.length, visible: VisibleWorkspaces.length, hidden: Object.keys(HiddenTechnicalRoutes).length },
  routeList: Routes.map(r => r.path).sort(),
  visibleWorkspaces: VisibleWorkspaces.map(w => ({ route: w.route, label: w.label, group: w.group, handoffs: w.handoffs || [] })),
  hiddenRoutes: Object.fromEntries(Object.entries(HiddenTechnicalRoutes).map(([k, v]) => [k, v.visibleThrough])),
  state: { collections: RequiredStateCollections.length, list: [...RequiredStateCollections].sort() },
  endpoints: { keys: EndpointKeys.length },
  roles: Object.keys(Roles),
  roleRouteAccess: RoleRouteAccess,
  layers: layerGraph(),
  zones,
  channels,
  moduleBoundaries: Object.keys(boundaries.ModuleBoundaries || {}).length || undefined,
};

const json = JSON.stringify(data, null, 2) + '\n';
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT, 'docs/architecture/architecture-data.json'), json);
  console.log(`architecture-data.json — ${data.routes.total} routes, ${data.state.collections} collections, layers ${data.layers.acyclic ? 'acyclic' : 'CYCLIC'}`);
} else {
  process.stdout.write(json);
}
