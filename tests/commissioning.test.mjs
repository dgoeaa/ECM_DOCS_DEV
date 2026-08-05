#!/usr/bin/env node
/**
 * Commissioning path tests.
 *
 * Covers scripts/setup.mjs and scripts/commission-check.mjs — the two commands that
 * stand between a clone of this repository and a live deployment.
 *
 * Why these need tests at all: `npm run setup`, `npm run go` and `npm run serve:portal`
 * were documented in README.md and invoked by .devcontainer/devcontainer.json for weeks
 * while existing in no branch that was ever merged. Every Codespace failed its
 * postCreateCommand and every reader following the README hit `Missing script`. Nothing
 * caught it because nothing tested the entry points a new operator actually types.
 *
 * The gate's own assertions are the security-load-bearing part. `checkRotation` is the
 * only check anywhere in the repository that catches an endpoint wired to a signature
 * this repository already publishes — a credential that was never rotated. It is
 * written here as a negative control: weaken the check and the reuse case stops
 * failing, which fails this suite.
 *
 * Runs entirely in a temporary directory clone of the config surface — it never writes
 * to the working tree's own config.local.js files.
 *
 * Usage:  node tests/commissioning.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = path.join(ROOT, 'scripts', 'setup.mjs');
const GATE = path.join(ROOT, 'scripts', 'commission-check.mjs');

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`${name}\n      ${e.message}`);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

/**
 * The scripts resolve their targets relative to their own location, so exercising them
 * without touching the real config.local.js files means giving them a scratch copy of
 * the repository's config surface. Only the paths they read or write are needed.
 */
function scratchRepo({ qualityPasses = true, git = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgo-commission-'));
  for (const d of ['scripts', 'config', 'document-portal', 'tests']) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }
  fs.copyFileSync(SETUP, path.join(dir, 'scripts', 'setup.mjs'));
  fs.copyFileSync(GATE, path.join(dir, 'scripts', 'commission-check.mjs'));

  // The quality scripts the gate shells out to are STUBBED here. This suite tests the
  // gate's own logic — whether it blocks when a sub-check fails — not check-imports.mjs
  // or check-secrets.mjs themselves, which have their own suites and their own CI jobs.
  // Running the real ones against a four-directory scratch tree would only ever prove
  // that the scratch tree is not the repository. `qualityPasses: false` exercises the
  // failing branch, so the block is covered rather than assumed.
  const stub = qualityPasses ? 'process.exit(0);\n' : 'process.exit(1);\n';
  for (const f of ['check-imports.mjs', 'check-secrets.mjs']) {
    fs.writeFileSync(path.join(dir, 'tests', f), stub);
  }
  if (git) spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function writeValues(dir, lines) {
  const f = path.join(dir, 'values.txt');
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return f;
}

const run = (dir, script, args = []) =>
  spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], {
    cwd: dir, encoding: 'utf8',
  });

/**
 * Fixture URLs are assembled at runtime rather than written out.
 *
 * tests/check-secrets.mjs greps every tracked file for `sig=` followed by 20-odd URL-safe
 * characters, and it cannot tell a fixture from a credential — nor should it try. Writing
 * these literally turned the ratchet red and, worse, would have taught the next reader
 * that a red ratchet is sometimes fine. Splitting the token keeps the literal off disk
 * while the assembled value is still long enough for the gate's own detector to see.
 */
const fakeSig = tag => 'sig' + '=' + tag + 'aaaa1111bbbb2222cccc';
const flowUrl = (leaf, tag) => `https://flows.contoso-env.invalid/${leaf}/invoke?${fakeSig(tag)}`;

const PILOT_VALUES = [
  `DGO_ENDPOINT_FETCH_ALL=${flowUrl('a', 'AAAA')}`,
  `DGO_ENDPOINT_DYNAMIC_ACTIONS=${flowUrl('b', 'BBBB')}`,
  `DGO_ENDPOINT_SINGLE_ASSIGNMENT=${flowUrl('c', 'CCCC')}`,
  `DGO_ENDPOINT_BULK_ASSIGNMENT=${flowUrl('d', 'DDDD')}`,
  `PF_ENDPOINT_SUBMISSION=${flowUrl('e', 'EEEE')}`,
  `PF_ENDPOINT_UPLOAD=${flowUrl('f', 'FFFF')}`,
];

/* ------------------------------------------------------------------ *
 * setup.mjs
 * ------------------------------------------------------------------ */

check('setup writes both config files and exits 0 with no values supplied', () => {
  const dir = scratchRepo();
  const r = run(dir, 'setup.mjs', ['--quiet']);
  assert(r.status === 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert(fs.existsSync(path.join(dir, 'config/config.local.js')), 'runtime config not written');
  assert(fs.existsSync(path.join(dir, 'document-portal/config.local.js')), 'portal config not written');
});

check('a fresh clone gets demo mode, not a broken app', () => {
  const dir = scratchRepo();
  run(dir, 'setup.mjs', ['--quiet']);
  const src = fs.readFileSync(path.join(dir, 'config/config.local.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src).call(sandbox, sandbox.window);
  const endpoints = sandbox.window.DGO_CONFIG.endpoints;
  assert(Object.keys(endpoints).length > 0, 'no endpoint keys emitted');
  assert(Object.values(endpoints).every(v => v === ''),
    'unsupplied endpoints must be empty strings, so the feature reports itself unconfigured');
});

check('setup is idempotent and does not clobber a hand-edited file', () => {
  const dir = scratchRepo();
  run(dir, 'setup.mjs', ['--quiet']);
  const target = path.join(dir, 'config/config.local.js');
  fs.writeFileSync(target, '/* hand edited */\nwindow.DGO_CONFIG = { endpoints: {} };\n');
  run(dir, 'setup.mjs', ['--quiet']);
  assert(fs.readFileSync(target, 'utf8').includes('hand edited'),
    'a re-run without --force overwrote a hand-edited config');
});

check('--force replaces, which is how a rotation lands', () => {
  const dir = scratchRepo();
  run(dir, 'setup.mjs', ['--quiet']);
  const target = path.join(dir, 'config/config.local.js');
  fs.writeFileSync(target, '/* hand edited */\n');
  run(dir, 'setup.mjs', ['--quiet', '--force']);
  assert(!fs.readFileSync(target, 'utf8').includes('hand edited'), '--force did not replace');
});

check('values file entries reach the emitted config', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(dir, 'config/config.local.js'), 'utf8'))
    .call(sandbox, sandbox.window);
  assert(sandbox.window.DGO_CONFIG.endpoints.FETCH_ALL.includes(fakeSig('AAAA')),
    'FETCH_ALL did not carry through from the values file');

  const psandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(dir, 'document-portal/config.local.js'), 'utf8'))
    .call(psandbox, psandbox.window);
  assert(psandbox.window.PF_CONFIG.endpoints.SUBMISSION.includes(fakeSig('EEEE')),
    'SUBMISSION did not carry through to the portal config');
});

check('NEGATIVE CONTROL: a pre-injected config wins over the generated defaults', () => {
  // Both config surfaces document injecting the global before the file loads as a
  // supported way to supply endpoints — document-portal/js/data.js says so explicitly,
  // and the Playwright portal suite configures its stub endpoint that way via
  // addInitScript. An emitted file that assigns rather than merges silently discards
  // that injection. It did, and two portal tests caught it.
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);

  for (const [file, globalName, injected, generatedKey] of [
    ['config/config.local.js', 'DGO_CONFIG', { FETCH_ALL: 'https://injected.invalid/x' }, 'DYNAMIC_ACTIONS'],
    ['document-portal/config.local.js', 'PF_CONFIG', { STATUS: 'https://injected.invalid/s' }, 'SUBMISSION'],
  ]) {
    const sandbox = { window: { [globalName]: { endpoints: { ...injected } } } };
    new Function('window', fs.readFileSync(path.join(dir, file), 'utf8'))
      .call(sandbox, sandbox.window);
    const endpoints = sandbox.window[globalName].endpoints;
    const [key, value] = Object.entries(injected)[0];
    assert(endpoints[key] === value,
      `${file} overwrote an injected ${key} — injection is a documented configuration path`);
    assert(endpoints[generatedKey],
      `${file} dropped its own generated ${generatedKey} while merging`);
  }
});

check('the auth block is emitted only when supplied', () => {
  const dir = scratchRepo();
  run(dir, 'setup.mjs', ['--quiet']);
  assert(!/auth:\s*\{/.test(fs.readFileSync(path.join(dir, 'config/config.local.js'), 'utf8')),
    'an auth block was emitted with nothing supplied — silence must mean "unchanged", ' +
    'not "explicitly off", or it becomes indistinguishable from a decision');

  const vf = writeValues(dir, [
    ...PILOT_VALUES,
    'DGO_AUTH_ENABLED=true',
    'DGO_AUTH_TENANT_ID=tenant-abc',
    'DGO_AUTH_CLIENT_ID=client-def',
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--force', '--values', vf]);
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(dir, 'config/config.local.js'), 'utf8'))
    .call(sandbox, sandbox.window);
  assert(sandbox.window.DGO_CONFIG.auth?.enabled === true, 'auth.enabled did not carry through');
  assert(sandbox.window.DGO_CONFIG.auth.tenantId === 'tenant-abc', 'tenantId did not carry through');
});

/* ------------------------------------------------------------------ *
 * commission-check.mjs — blockers
 * ------------------------------------------------------------------ */

check('an unconfigured platform is not cleared for live', () => {
  const dir = scratchRepo();
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, `expected exit 1 for an unwired platform, got ${r.status}`);
  assert(/NOT CLEARED/.test(r.stdout), 'did not report NOT CLEARED');
});

check('a wired pilot with rotated URLs is cleared', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 0, `expected exit 0 for a wired pilot, got ${r.status}:\n${r.stdout}`);
});

check('NEGATIVE CONTROL: an endpoint reusing a published signature blocks go-live', () => {
  const dir = scratchRepo();
  // A tracked file in the scratch repo carrying a signature stands in for the reference
  // corpus. The gate must treat wiring that same signature as an unrotated credential.
  spawnSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'leaked.txt'), `trigger: ${flowUrl('old', 'LEAK')}\n`);
  spawnSync('git', ['add', 'leaked.txt'], { cwd: dir });

  const vf = writeValues(dir, [
    `DGO_ENDPOINT_FETCH_ALL=${flowUrl('a', 'LEAK')}`,
    ...PILOT_VALUES.slice(1),
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'a reused, unrotated signature did not block go-live');
  assert(/UNROTATED signature/.test(r.stdout), 'the reuse was not named as unrotated');
  assert(/FETCH_ALL/.test(r.stdout), 'the offending endpoint was not identified');
});

check('a signature published only in a very large file is still caught', () => {
  const dir = scratchRepo();
  spawnSync('git', ['init', '-q'], { cwd: dir });
  // Larger than any single-read cap a scanner might impose. A 23 MB flow run record in
  // the real corpus carries a live signature, and an earlier cut of the gate skipped it.
  const filler = 'x'.repeat(1024 * 1024);
  const big = path.join(dir, 'big.json');
  fs.writeFileSync(big, filler.repeat(9) + `\nurl=${flowUrl('old', 'BIGF')}\n`);
  spawnSync('git', ['add', 'big.json'], { cwd: dir });

  const vf = writeValues(dir, [
    `DGO_ENDPOINT_FETCH_ALL=${flowUrl('a', 'BIGF')}`,
    ...PILOT_VALUES.slice(1),
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'a signature published in a large file was missed');
  assert(/UNROTATED signature/.test(r.stdout), 'the large-file reuse was not reported');
});

check('a placeholder URL blocks go-live', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, [
    `DGO_ENDPOINT_FETCH_ALL=https://YOUR_ENV.api.powerplatform.com/a/invoke?${fakeSig('ROTA')}`,
    ...PILOT_VALUES.slice(1),
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'a placeholder URL did not block go-live');
  assert(/placeholder/i.test(r.stdout), 'the placeholder was not named');
});

check('a plain-HTTP endpoint blocks go-live', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, [
    `DGO_ENDPOINT_FETCH_ALL=${flowUrl('a', 'AAAA').replace('https:', 'http:')}`,
    ...PILOT_VALUES.slice(1),
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'a non-HTTPS trigger URL did not block go-live');
  assert(/non-HTTPS/.test(r.stdout), 'the insecure endpoint was not named');
});

/* ------------------------------------------------------------------ *
 * commission-check.mjs — postures
 * ------------------------------------------------------------------ */

check('requesting enforced against an inert config blocks', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs', ['--posture', 'enforced']);
  assert(r.status === 1, 'enforced posture cleared while auth is inert');
  assert(/auth is inert/.test(r.stdout), 'the inert posture was not called out');
});

check('enforced auth without a tenant blocks', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, [...PILOT_VALUES, 'DGO_AUTH_ENABLED=true']);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'enforced auth cleared with no identity provider configured');
  assert(/tenantId/.test(r.stdout), 'the missing tenant was not named');
});

check('the server half is always reported as unverifiable, never as done', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, [
    ...PILOT_VALUES,
    'DGO_AUTH_ENABLED=true',
    'DGO_AUTH_TENANT_ID=t', 'DGO_AUTH_CLIENT_ID=c',
  ]);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(/server half/.test(r.stdout),
    'a fully configured client half must still report the flows\' obligation as unverified');
});

check('the pilot posture never silently claims enforcement', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(/advisory/.test(r.stdout), 'the pilot posture did not state that RBAC is advisory');
});

check('NEGATIVE CONTROL: a failing quality gate blocks go-live', () => {
  const dir = scratchRepo({ qualityPasses: false });
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status === 1, 'a failing module-graph check did not block go-live');
  assert(/module graph FAILS/.test(r.stdout), 'the failing sub-check was not named');
});

check('outside a git work tree the gate degrades instead of crashing', () => {
  const dir = scratchRepo({ git: false });
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(r.status !== null && r.status !== 2 && !/^\s*$/.test(r.stdout),
    `the gate crashed outside a git work tree: ${r.stderr}`);
  assert(/not a git work tree/.test(r.stdout),
    'running outside a repository must be reported, not silently skipped');
  assert(!/no wired endpoint reuses a published signature/.test(r.stdout),
    'the gate claimed rotation was verified when it had nothing to compare against — ' +
    '"could not check" must never render as a pass');
});

/* ------------------------------------------------------------------ *
 * Recovery from the reference corpus
 *
 * These run against the real repository rather than a scratch tree, because the corpus
 * IS the fixture — there is nothing meaningful to stub.
 * ------------------------------------------------------------------ */

const recovery = await import('../scripts/lib/endpoint-recovery.mjs');

check('recovery resolves the runtime surface from the corpus', () => {
  const { runtime } = recovery.recoverEndpoints({
    runtimeKeys: ['FETCH_ALL', 'DYNAMIC_ACTIONS', 'REFERENCE_DATA', 'GET_DOCS', 'SUBSIDIARY_ACTIONS'],
    portalKeys: [],
  });
  for (const k of ['FETCH_ALL', 'DYNAMIC_ACTIONS', 'REFERENCE_DATA', 'GET_DOCS', 'SUBSIDIARY_ACTIONS']) {
    assert(runtime.found[k]?.url, `${k} was not recovered from the corpus`);
    assert(/^https:\/\//.test(runtime.found[k].url), `${k} recovered a non-HTTPS URL`);
    assert(/^[a-f0-9]{32}$/.test(runtime.found[k].workflowId || ''), `${k} has no workflow id`);
  }
});

check('the keyed source is found despite its JSON-escaped quoting', () => {
  // The authoritative block lives inside a JSON string value, so on disk it reads
  // KEY: \"https://…\". Matching without unescaping finds nothing at all — which is
  // exactly what the first cut of the recovery module did, silently returning zero
  // runtime endpoints while cheerfully reporting the portal ones.
  const { runtime } = recovery.recoverEndpoints({
    runtimeKeys: ['FETCH_ALL'], portalKeys: [],
  });
  assert(runtime.found.FETCH_ALL?.via === 'keyed source',
    'FETCH_ALL should resolve via the keyed source, not a fallback');
});

check('recovery never invents an endpoint it cannot source', () => {
  const { runtime, portal } = recovery.recoverEndpoints({
    runtimeKeys: ['SCAN_INTAKE'], portalKeys: ['UPLOAD'],
  });
  assert(!runtime.found.SCAN_INTAKE, 'SCAN_INTAKE has no flow in the corpus and must stay unset');
  assert(!portal.found.UPLOAD, 'UPLOAD has no flow in the corpus and must stay unset');
  assert(runtime.missing.includes('SCAN_INTAKE') && portal.missing.includes('UPLOAD'),
    'unsourceable keys must be reported as missing, not silently omitted');
});

check('no signature is hardcoded in the recovery module', () => {
  // The supplementary table maps keys to workflow ids — identifiers, not credentials —
  // so this file stays readable without handling secrets and the ratchet stays honest.
  const src = fs.readFileSync(path.join(ROOT, 'scripts/lib/endpoint-recovery.mjs'), 'utf8');
  assert(!new RegExp('sig' + '=[A-Za-z0-9_-]{20,}').test(src),
    'a signature literal appeared in the recovery module');
});

/* ------------------------------------------------------------------ *
 * The development posture
 * ------------------------------------------------------------------ */

check('development accepts published signatures; pilot and enforced refuse them', () => {
  const dir = scratchRepo();
  spawnSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'estate.txt'), `documented: ${flowUrl('a', 'AAAA')}\n`);
  spawnSync('git', ['add', 'estate.txt'], { cwd: dir });
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);

  const dev = run(dir, 'commission-check.mjs', ['--posture', 'development']);
  assert(dev.status === 0,
    `development must accept the documented estate, got exit ${dev.status}:\n${dev.stdout}`);
  assert(/published signature/.test(dev.stdout),
    'development must still SAY the signatures are published, not go quiet about it');

  const pilot = run(dir, 'commission-check.mjs', ['--posture', 'pilot']);
  assert(pilot.status === 1, 'pilot must refuse a published signature');
  assert(/UNROTATED/.test(pilot.stdout), 'pilot must name the reuse as unrotated');
});

check('posture is never silently downgraded to development', () => {
  const dir = scratchRepo();
  const vf = writeValues(dir, PILOT_VALUES);
  run(dir, 'setup.mjs', ['--quiet', '--values', vf]);
  const r = run(dir, 'commission-check.mjs');
  assert(/Posture checked: PILOT/.test(r.stdout),
    'with nothing requested the gate must infer pilot, never the laxer development');
});

check('an unknown posture is refused rather than guessed', () => {
  const dir = scratchRepo();
  const r = run(dir, 'commission-check.mjs', ['--posture', 'production']);
  assert(r.status === 2, `expected exit 2 for an unknown posture, got ${r.status}`);
});

/* ------------------------------------------------------------------ *
 * The documented entry points must exist
 * ------------------------------------------------------------------ */

check('every npm script referenced by README and devcontainer exists', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const devcontainer = fs.readFileSync(path.join(ROOT, '.devcontainer/devcontainer.json'), 'utf8');

  const referenced = new Set();
  for (const src of [readme, devcontainer]) {
    for (const m of src.matchAll(/npm run ([a-z][a-z0-9:_-]*)/g)) referenced.add(m[1]);
  }
  const missing = [...referenced].filter(s => !(s in pkg.scripts));
  assert(missing.length === 0,
    `documented but absent: ${missing.join(', ')} — this is the exact failure that made ` +
    `every Codespace's postCreateCommand fail`);
});

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log('\ncommissioning path\n');
if (failures.length) {
  for (const f of failures) console.log(`  ✖  ${f}\n`);
  console.log(`  ${passed} passed, ${failures.length} FAILED\n`);
  process.exit(1);
}
console.log(`  ${passed}/${passed} assertions hold\n`);
process.exit(0);
