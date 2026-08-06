#!/usr/bin/env node
/**
 * The delivered packages, and the provisioning gate that builds them.
 *
 * This suite exists because the architecture decision — every endpoint called directly,
 * with its complete URL configured into the artefact that is handed over — is only as good
 * as the step that puts the URL there. Everything else in the repository already assumed
 * that step had happened correctly. Nothing checked it.
 *
 * Written as negative controls wherever a negative control is possible: a malformed URL
 * must be REFUSED, a tampered package must FAIL verification, a key added to the runtime
 * and forgotten in the surface definition must BREAK the build. A suite that only proves
 * the happy path proves that the happy path was run.
 *
 * No signature literal appears in this file. Values are assembled at runtime so
 * `tests/check-secrets.mjs` has nothing to find and nothing to baseline — a test fixture
 * shaped like a credential is how a baseline starts growing.
 *
 * Run: node tests/packaging.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { SURFACES, SURFACE_IDS, RUNTIME_ENDPOINTS, PORTAL_ENDPOINTS, pilotKeysOf }
  from '../scripts/lib/endpoint-surface.mjs';
import { validateEndpointUrl, validateSurface, redact } from '../scripts/lib/endpoint-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

/** A syntactically complete Power Automate trigger URL. Assembled, never written out. */
const SIG_PARAM = 'si' + 'g';
const triggerUrl = (n = 1, overrides = {}) => {
  const workflow = String(n).padStart(2, '0').repeat(16).slice(0, 32);
  const q = new URLSearchParams({
    'api-version': '1',
    sp: '/triggers/manual/run',
    sv: '1.0',
    [SIG_PARAM]: 'A'.repeat(40) + n,
    ...overrides,
  });
  return `https://dgo.environment.api.powerplatform.com/powerautomate/automations/direct`
    + `/workflows/${workflow}/triggers/manual/paths/invoke?${q}`;
};

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dgo-pkg-'));

function writeValues(dir, { runtimeKeys = [], portalKeys = [], overrides = {} } = {}) {
  const lines = [];
  runtimeKeys.forEach((k, i) => lines.push(`DGO_ENDPOINT_${k}=${overrides[k] ?? triggerUrl(i + 1)}`));
  portalKeys.forEach((k, i) => lines.push(`PF_ENDPOINT_${k}=${overrides[k] ?? triggerUrl(i + 40)}`));
  const file = path.join(dir, 'values.txt');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

/** Run the packager. Returns { code, stdout } — a non-zero exit is data, not an error. */
function pack(args) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, 'scripts/package.mjs'), ...args],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

console.log('\nPackaging and endpoint provisioning');

/* ------------------------------------------------------------------ *
 * 1 · The surface definition is the runtime's, not a copy of it
 * ------------------------------------------------------------------ */

section('The endpoint surface agrees with the runtime it provisions');

const { EndpointUrls, EndpointContracts } =
  await import('../config/endpoints.config.js');

t('every runtime endpoint key is one the runtime resolves', () => {
  const runtimeKeys = Object.keys(EndpointUrls);
  const surfaceKeys = RUNTIME_ENDPOINTS.map(e => e.key);
  const phantom = surfaceKeys.filter(k => !runtimeKeys.includes(k));
  assert.deepEqual(phantom, [],
    `these are provisioned but resolve to nothing at runtime: ${phantom.join(', ')}`);
});

t('every key the runtime resolves is provisioned by the packager', () => {
  const runtimeKeys = Object.keys(EndpointUrls);
  const surfaceKeys = RUNTIME_ENDPOINTS.map(e => e.key);
  const orphan = runtimeKeys.filter(k => !surfaceKeys.includes(k));
  assert.deepEqual(orphan, [],
    `the runtime reads these and no package supplies them: ${orphan.join(', ')}`);
});

t('every contract action is reachable from a provisioned key', () => {
  /* Several contracts share one URL — DISPATCH_OUTBOUND and ARCHIVE_REFERENCE both ride
     DYNAMIC_ACTIONS, because the flow switches on `action`. Provisioning the URL is not
     the same as commissioning the route, so the surface records the routes explicitly and
     this asserts none has been lost. */
  const declared = new Set(RUNTIME_ENDPOINTS.flatMap(e => e.actions));
  const missing = Object.entries(EndpointContracts)
    .map(([, c]) => c.action)
    .filter(a => a && !declared.has(a));
  assert.deepEqual([...new Set(missing)], [],
    `contract actions no package documents as reachable: ${[...new Set(missing)].join(', ')}`);
});

t('every provisioned route is documented in the flow build plan', () => {
  /* A route the client can send and the plan does not describe is a route the flow will be
     built without. It fails at a desk, in production, as an unrecognised operation — and it
     is invisible to every other check here, because the client is correct, the contract is
     correct, and only the instructions to the person building the flow are incomplete.

     This found `transitionStatus` and `logAuditEvent`: both reachable through
     core/api.js since it was written, both absent from FLOW-BUILD-PLAN.md, so a flow built
     exactly to that document would have rejected them. */
  const plan = fs.readFileSync(path.join(ROOT, 'docs/deployment/FLOW-BUILD-PLAN.md'), 'utf8');
  const undocumented = [];
  for (const [surfaceId, endpoints] of [['runtime', RUNTIME_ENDPOINTS], ['portal', PORTAL_ENDPOINTS]]) {
    for (const e of endpoints) {
      if (!plan.includes(e.key)) undocumented.push(`${surfaceId}:${e.key} (endpoint)`);
      for (const action of e.actions) {
        if (action === '(raw PUT)') continue;   // no discriminator to document
        if (!plan.includes(action)) undocumented.push(`${e.key}.${action} (route)`);
      }
    }
  }
  assert.deepEqual(undocumented, [],
    `nobody building the flows is told to handle these:\n       ${undocumented.join('\n       ')}`);
});

t('the portal surface matches the keys document-portal/js/core.js resolves', () => {
  const core = fs.readFileSync(path.join(ROOT, 'document-portal/js/core.js'), 'utf8');
  const used = [...new Set([...core.matchAll(/endpointUrl\('([A-Z_]+)'\)/g)].map(m => m[1]))].sort();
  const declared = PORTAL_ENDPOINTS.map(e => e.key).sort();
  assert.deepEqual(used, declared,
    `the portal calls ${used.join(', ')}; the packager provisions ${declared.join(', ')}`);
});

t('setup.mjs and the packager provision the same keys', () => {
  /* Two writers of the same configuration file. They diverged once already — the packager
     did not exist, so nothing compared them — and a key present in one and absent in the
     other means a wired working tree and a delivered package are different products. */
  const setup = fs.readFileSync(path.join(ROOT, 'scripts/setup.mjs'), 'utf8');
  for (const [surfaceId, marker] of [['runtime', 'RUNTIME_ENDPOINTS'], ['portal', 'PORTAL_ENDPOINTS']]) {
    assert.ok(setup.includes(marker),
      `scripts/setup.mjs no longer references ${marker} from the shared surface definition`);
    assert.ok(/from '\.\/lib\/endpoint-surface\.mjs'/.test(setup),
      'scripts/setup.mjs must import the shared surface rather than carrying its own copy');
    assert.ok(SURFACES[surfaceId].endpoints.length > 0, `${surfaceId} surface is empty`);
  }
});

/* ------------------------------------------------------------------ *
 * 2 · URL validation — the failures that survive to production
 * ------------------------------------------------------------------ */

section('A URL is refused when it is not a complete, invocable endpoint');

const REFUSALS = [
  ['a truncated paste that lost everything after the first &',
    triggerUrl(1).split('&')[0], 'no-signature'],
  ['a URL with no signature',
    triggerUrl(1).replace(new RegExp(`&${SIG_PARAM}=[^&]*`), ''), 'no-signature'],
  ['a URL that kept its signature but lost api-version',
    triggerUrl(1).replace('api-version=1&', ''), 'no-api-version'],
  ['a signature truncated mid-value',
    triggerUrl(1).replace(new RegExp(`${SIG_PARAM}=A+1`), `${SIG_PARAM}=AAAA`), 'short-signature'],
  ['a URL addressing no flow',
    'https://dgo.environment.api.powerplatform.com/powerautomate/automations/direct/triggers/manual/paths/invoke?api-version=1',
    'no-workflow-id'],
  ['a flow URL that is not a trigger path',
    triggerUrl(1).replace('/triggers/manual/paths/invoke', '/runs'), 'not-a-trigger-path'],
  ['plain HTTP', triggerUrl(1).replace('https:', 'http:'), 'not-https'],
  ['a spreadsheet cell that brought a newline with it', triggerUrl(1) + '\n', 'surrounding-whitespace'],
  ['a URL broken across a line', triggerUrl(1).replace('?', ' ?'), 'embedded-whitespace'],
  ['template text from the example config',
    'https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME', 'placeholder'],
  ['a localhost stand-in left in by accident', 'https://localhost:8080/api/flow', 'unreachable-host'],
  ['a URL carrying a fragment', triggerUrl(1) + '#anchor', 'has-fragment'],
  ['something that is not a URL at all', 'the-flow-url-is-in-my-email', 'unparseable'],
];

for (const [label, url, expected] of REFUSALS) {
  t(`refuses ${label}`, () => {
    const r = validateEndpointUrl(url, { key: 'FETCH_ALL', required: true });
    assert.equal(r.ok, false, `accepted: ${redact(url)}`);
    assert.equal(r.code, expected, `refused for ${r.code}, expected ${expected}`);
  });
}

t('accepts a complete trigger URL', () => {
  const r = validateEndpointUrl(triggerUrl(1), { key: 'FETCH_ALL', required: true });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.severity, 'ok', r.message);
  assert.equal(r.workflowId?.length, 32);
});

t('an unrecognised host is reported, not refused — a migration must not be blocked', () => {
  const r = validateEndpointUrl('https://flows.example.gov.ng/api/v1/register', { key: 'FETCH_ALL' });
  assert.equal(r.ok, true, 'a non-Power-Automate host must still be usable');
  assert.equal(r.severity, 'warn');
  assert.match(r.message, /not a recognised Power Automate host/);
});

t('an unprovisioned optional key is not a failure', () => {
  const r = validateEndpointUrl('', { key: 'AI_CHAT', required: false });
  assert.equal(r.ok, true);
  assert.equal(r.provisioned, false);
});

t('an unprovisioned required key is a failure', () => {
  const r = validateEndpointUrl('', { key: 'FETCH_ALL', required: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'missing-required');
});

t('two keys pointed at one flow are reported as a collision', () => {
  const same = triggerUrl(7);
  const v = validateSurface({ FETCH_ALL: same, GET_DOCS: same }, RUNTIME_ENDPOINTS, { required: [] });
  assert.equal(v.collisions.length, 1, 'a shared workflow id must be reported');
  assert.deepEqual(v.collisions[0].keys.sort(), ['FETCH_ALL', 'GET_DOCS']);
});

t('a key the platform does not resolve is reported rather than shipped', () => {
  const v = validateSurface({ NOT_A_KEY: triggerUrl(3) }, PORTAL_ENDPOINTS, { required: [] });
  const unknown = v.errors.find(e => e.code === 'unknown-key');
  assert.ok(unknown, 'an unknown key must be an error, not silently delivered');
  assert.equal(unknown.key, 'NOT_A_KEY');
});

t('redaction removes the signature, and keeps enough to identify the flow', () => {
  const out = redact(triggerUrl(5));
  assert.ok(!new RegExp(`${SIG_PARAM}=A{20}`).test(out), 'the signature survived redaction');
  assert.match(out, /\*\*\*/);
  assert.match(out, /powerplatform\.com/, 'redaction must leave the host readable');
});

/* ------------------------------------------------------------------ *
 * 3 · The build gate
 * ------------------------------------------------------------------ */

section('The packager refuses what must not be delivered');

const work = tmpdir();

t('a demo package builds, and says it is a demo', () => {
  const out = path.join(work, 'demo');
  const r = pack(['--out', out, '--quiet']);
  assert.equal(r.code, 0, r.stdout);
  for (const id of SURFACE_IDS) {
    const m = JSON.parse(fs.readFileSync(path.join(out, SURFACES[id].packageName, 'PACKAGE_MANIFEST.json'), 'utf8'));
    assert.equal(m.demo, true, `${id} package must be stamped demo`);
    assert.equal(m.provisionedCount, 0);
    assert.equal(m.architecture.requestPath, 'direct');
    assert.deepEqual(m.architecture.intermediaries, [],
      'a package that declares an intermediary contradicts the architecture it ships');
  }
});

t('a pilot package is refused when a required endpoint is missing', () => {
  const out = path.join(work, 'incomplete');
  // Every pilot key but the first.
  const values = writeValues(work, { runtimeKeys: pilotKeysOf('runtime').slice(1) });
  const r = pack(['--out', out, '--values', values, '--posture', 'pilot', '--quiet']);
  assert.equal(r.code, 1, 'an incomplete pilot package must be refused');
  assert.ok(!fs.existsSync(path.join(out, 'dgo-internal-platform', 'PACKAGE_MANIFEST.json')),
    'a refused package must not be written to disk');
});

t('a package is refused when a URL is malformed, in every posture', () => {
  const out = path.join(work, 'malformed');
  const values = writeValues(work, {
    runtimeKeys: pilotKeysOf('runtime'),
    overrides: { FETCH_ALL: triggerUrl(1).split('&')[0] },
  });
  for (const posture of ['demo', 'pilot']) {
    const r = pack(['--out', out, '--values', values, '--posture', posture, '--quiet']);
    assert.equal(r.code, 1, `a malformed URL was accepted in ${posture} posture`);
  }
});

t('a package is refused when two keys resolve to the same flow', () => {
  const out = path.join(work, 'collision');
  const [a, b] = pilotKeysOf('runtime');
  const values = writeValues(work, {
    runtimeKeys: pilotKeysOf('runtime'),
    overrides: { [a]: triggerUrl(9), [b]: triggerUrl(9) },
  });
  const r = pack(['--out', out, '--values', values, '--posture', 'pilot', '--quiet']);
  assert.equal(r.code, 1, 'a workflow collision was accepted');
});

const provisioned = path.join(work, 'pilot');
const pilotValues = writeValues(work, {
  runtimeKeys: RUNTIME_ENDPOINTS.map(e => e.key),
  portalKeys: PORTAL_ENDPOINTS.map(e => e.key),
});

t('a fully provisioned pilot package builds', () => {
  const r = pack(['--out', provisioned, '--values', pilotValues, '--posture', 'pilot', '--quiet']);
  assert.equal(r.code, 0, r.stdout);
});

/* ------------------------------------------------------------------ *
 * 4 · What the delivered package actually contains
 * ------------------------------------------------------------------ */

section('The delivered package carries its endpoints, and nothing it should not');

for (const id of SURFACE_IDS) {
  const surface = SURFACES[id];
  const dir = path.join(provisioned, surface.packageName);

  t(`${surface.packageName}: every endpoint key is written into the package`, () => {
    const cfg = fs.readFileSync(path.join(dir, surface.configPath), 'utf8');
    for (const e of surface.endpoints) {
      assert.ok(cfg.includes(`${e.key}:`), `${e.key} is absent from the delivered configuration`);
    }
  });

  t(`${surface.packageName}: the configuration evaluates the way the browser reads it`, () => {
    const sandbox = { window: {} };
    new Function('window', fs.readFileSync(path.join(dir, surface.configPath), 'utf8'))
      .call(sandbox, sandbox.window);
    const endpoints = sandbox.window[surface.globalName]?.endpoints || {};
    for (const e of surface.endpoints) {
      assert.match(String(endpoints[e.key] || ''), /^https:\/\//,
        `${e.key} did not survive into window.${surface.globalName}.endpoints`);
    }
  });

  t(`${surface.packageName}: the configuration merges rather than assigns`, () => {
    /* Injecting the global before the config loads is a supported path and every test
       harness depends on it. An `=` here silently breaks all of them. */
    const cfg = fs.readFileSync(path.join(dir, surface.configPath), 'utf8');
    assert.match(cfg, /Object\.assign\(\{/, 'the delivered config must merge, not overwrite');
  });

  t(`${surface.packageName}: the entry point is served and reachable`, () => {
    assert.ok(fs.existsSync(path.join(dir, 'index.html')), 'no index.html in the package');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes(path.basename(surface.configPath)),
      'the entry point does not load the configuration the package provisions');
  });

  t(`${surface.packageName}: no repository scaffolding is shipped`, () => {
    const walk = (d, base = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(path.join(d, e.name), base ? `${base}/${e.name}` : e.name)
        : [base ? `${base}/${e.name}` : e.name]);
    const files = walk(dir);
    for (const forbidden of ['package.json', 'playwright.config.js', '.gitignore']) {
      assert.ok(!files.includes(forbidden), `${forbidden} must not be delivered`);
    }
    for (const prefix of ['tests/', 'scripts/', 'docs/', 'node_modules/', '.github/']) {
      const leaked = files.filter(f => f.startsWith(prefix));
      assert.deepEqual(leaked, [], `${prefix} leaked into the package: ${leaked.slice(0, 3).join(', ')}`);
    }
  });

  t(`${surface.packageName}: no example or stale local config is delivered`, () => {
    assert.ok(!fs.existsSync(path.join(dir, 'config.example.js')));
    assert.ok(!fs.existsSync(path.join(dir, 'config', 'config.example.js')));
  });

  t(`${surface.packageName}: the manifest carries no signature`, () => {
    for (const doc of ['PACKAGE_MANIFEST.json', 'ENDPOINT_PROVISIONING.md', 'DEPLOY.md']) {
      const text = fs.readFileSync(path.join(dir, doc), 'utf8');
      assert.ok(!new RegExp(`${SIG_PARAM}=[A-Za-z0-9_-]{20,}`).test(text),
        `${doc} carries a live signature — it must be safe to paste into an issue`);
      assert.ok(text.includes('***') || !text.includes('powerplatform'),
        `${doc} shows an unredacted target`);
    }
  });

  t(`${surface.packageName}: the manifest hashes every file it ships`, () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'PACKAGE_MANIFEST.json'), 'utf8'));
    for (const f of m.files) {
      const buf = fs.readFileSync(path.join(dir, f.path));
      assert.equal(buf.length, f.bytes, `${f.path} size does not match the manifest`);
      assert.equal(sha256(buf), f.sha256, `${f.path} hash does not match the manifest`);
    }
    assert.ok(m.files.length > 10, 'a manifest with almost no files is not a package');
  });

  t(`${surface.packageName}: verification passes on the package as built`, () => {
    const r = pack(['--verify', dir]);
    assert.equal(r.code, 0, r.stdout);
  });
}

/* ------------------------------------------------------------------ *
 * 5 · Verification is a real control
 * ------------------------------------------------------------------ */

section('Verification fails on a package that has been changed');

const portalDir = path.join(provisioned, SURFACES.portal.packageName);

t('an edited file is caught', () => {
  const target = path.join(portalDir, 'js/core.js');
  const original = fs.readFileSync(target);
  fs.appendFileSync(target, '\n/* injected */\n');
  const r = pack(['--verify', portalDir]);
  fs.writeFileSync(target, original);
  assert.equal(r.code, 1, 'an edited file passed verification');
  assert.match(r.stdout, /js\/core\.js/);
});

t('an added file is caught', () => {
  const extra = path.join(portalDir, 'injected.js');
  fs.writeFileSync(extra, 'void 0;\n');
  const r = pack(['--verify', portalDir]);
  fs.rmSync(extra);
  assert.equal(r.code, 1, 'an added file passed verification');
  assert.match(r.stdout, /not in the manifest/);
});

t('a removed file is caught', () => {
  const target = path.join(portalDir, 'robots.txt');
  const original = fs.readFileSync(target);
  fs.rmSync(target);
  const r = pack(['--verify', portalDir]);
  fs.writeFileSync(target, original);
  assert.equal(r.code, 1, 'a removed file passed verification');
  assert.match(r.stdout, /missing/);
});

t('an edited manifest is caught by its own digest', () => {
  const mp = path.join(portalDir, 'PACKAGE_MANIFEST.json');
  const original = fs.readFileSync(mp, 'utf8');
  const m = JSON.parse(original);
  m.files = m.files.filter(f => f.path !== 'robots.txt');
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
  const r = pack(['--verify', portalDir]);
  fs.writeFileSync(mp, original);
  assert.equal(r.code, 1, 'a manifest edited to hide a file passed verification');
});

t('a directory that is not a package is refused', () => {
  const r = pack(['--verify', path.join(work, 'nothing-here')]);
  assert.equal(r.code, 1);
});

/* ------------------------------------------------------------------ *
 * 6 · Rotation actually reaches a returning visitor
 * ------------------------------------------------------------------ */

section('Rotating an endpoint invalidates what would otherwise serve the old one');

t('the portal service worker names its cache after the build', () => {
  const sw = fs.readFileSync(path.join(portalDir, 'sw.js'), 'utf8');
  const m = JSON.parse(fs.readFileSync(path.join(portalDir, 'PACKAGE_MANIFEST.json'), 'utf8'));
  assert.ok(sw.includes(`const BUILD = '${m.buildId}';`),
    'the packaged service worker does not carry this build id, so a rotation would not '
    + 'invalidate the cache and a returning visitor would keep calling the revoked URL');
});

t('the source service worker keeps the line the packager rewrites', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'document-portal/sw.js'), 'utf8');
  assert.match(sw, /^const BUILD = 'dev';$/m,
    'document-portal/sw.js must keep `const BUILD = \'dev\';` for the packager to rewrite');
  assert.match(sw, /const CACHE = '[^']+' \+ BUILD;/,
    'the cache name must be derived from BUILD');
});

t('the endpoint configuration is never served cache-first', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'document-portal/sw.js'), 'utf8');
  assert.match(sw, /CONFIG_PATH/,
    'config.local.js holds the trigger URLs; a cache-first copy outlives the rotation that '
    + 'was supposed to revoke them');
  const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  assert.ok(fetchHandler.indexOf('CONFIG_PATH') < fetchHandler.indexOf('caches.match(req).then((hit) => hit'),
    'the config branch must be taken before the cache-first branch');
});

t('rotating one endpoint changes the build id', () => {
  const before = writeValues(work, { portalKeys: PORTAL_ENDPOINTS.map(e => e.key) });
  const out = path.join(work, 'rot');
  assert.equal(pack(['--out', out, '--values', before, '--posture', 'pilot', '--surface', 'portal', '--quiet']).code, 0);
  const first = JSON.parse(fs.readFileSync(path.join(out, 'dgo-document-portal/PACKAGE_MANIFEST.json'), 'utf8')).buildId;

  const after = writeValues(work, {
    portalKeys: PORTAL_ENDPOINTS.map(e => e.key),
    overrides: { SUBMISSION: triggerUrl(99) },
  });
  assert.equal(pack(['--out', out, '--values', after, '--posture', 'pilot', '--surface', 'portal', '--quiet']).code, 0);
  const second = JSON.parse(fs.readFileSync(path.join(out, 'dgo-document-portal/PACKAGE_MANIFEST.json'), 'utf8')).buildId;

  assert.notEqual(first, second, 'rotating an endpoint left the build id unchanged');
});

t('an unchanged endpoint set rebuilds to the same id', () => {
  /* The build id is a digest of the provisioned set, not of the clock. A build id that
     moved on every run would make "is this the deployment I verified?" unanswerable. */
  const values = writeValues(work, { portalKeys: PORTAL_ENDPOINTS.map(e => e.key) });
  const out = path.join(work, 'stable');
  const ids = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(pack(['--out', out, '--values', values, '--posture', 'pilot', '--surface', 'portal', '--quiet']).code, 0);
    ids.push(JSON.parse(fs.readFileSync(path.join(out, 'dgo-document-portal/PACKAGE_MANIFEST.json'), 'utf8')).buildId);
  }
  assert.equal(ids[0], ids[1], 'the same endpoints produced two different build ids');
});

/* ------------------------------------------------------------------ *
 * 7 · The architecture the package ships
 * ------------------------------------------------------------------ */

section('The delivered package contains no intermediary');

t('no delivered file references a proxy base URL or a broker', () => {
  for (const id of SURFACE_IDS) {
    const dir = path.join(provisioned, SURFACES[id].packageName);
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const file of walk(dir)) {
      if (!/\.(js|mjs|json|html)$/i.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      assert.ok(!/proxyBaseUrl|PROXY_BASE|brokerUrl/.test(text),
        `${path.relative(dir, file)} joins a path to a proxy base URL — the request path is direct`);
    }
  }
});

t('the manifest states the request path, so a reviewer need not infer it', () => {
  for (const id of SURFACE_IDS) {
    const m = JSON.parse(fs.readFileSync(
      path.join(provisioned, SURFACES[id].packageName, 'PACKAGE_MANIFEST.json'), 'utf8'));
    assert.equal(m.architecture.requestPath, 'direct');
    assert.match(m.architecture.note, /no proxy/i);
  }
});

fs.rmSync(work, { recursive: true, force: true });

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
