#!/usr/bin/env node
/**
 * Commissioning readiness gate.
 *
 *   npm run commission                     # gate against the posture the config declares
 *   npm run commission -- --posture pilot
 *   npm run commission -- --posture enforced
 *
 * Answers one question: **may this platform be declared live?**
 *
 * The repository has long been able to say "the tests pass" — 17 Node suites and 78
 * browser tests, all green. That is not the same claim. A platform whose code is
 * correct can still be uncommissionable because its trigger URLs are published, its
 * register is answerable by anonymous callers, or nothing is wired up at all. This
 * checks the obligations that stand between a healthy repository and live usage, and
 * it distinguishes the ones a machine can settle from the ones a person must sign.
 *
 * Three postures, because they are genuinely different products:
 *
 *   development  Wired to the flow estate this repository documents, via
 *                `npm run setup -- --recover`. The signatures are published, and that is
 *                accepted here and nowhere else: the point is to exercise a real
 *                configuration against real flows before production flows exist, so that
 *                configuration errors surface here rather than against a fresh estate
 *                nobody has ever called. Never serve the public from this posture.
 *
 *   pilot     Cloudflare Access gates who may LOAD the interface. Auth is inert, role
 *             is advisory, and a flow called directly answers whoever calls it. Fit for
 *             an internal pilot on correspondence you accept being readable by anyone
 *             holding a URL. Not fit for citizens' personal data at scale.
 *
 *   enforced  auth.enabled:true, Entra tenant supplied, roles from token claims — and
 *             each flow validating that token itself. The client half is in this
 *             repository. The server half is not and cannot be: it lives in Power
 *             Automate. This gate can verify the client half and can prove the server
 *             half is UNVERIFIED; it cannot verify it for you.
 *
 * Exit 0 = cleared for the checked posture. Exit 1 = at least one blocker stands.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const posturArg = (() => {
  const i = argv.indexOf('--posture');
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
})();

const PILOT_RUNTIME = ['FETCH_ALL', 'DYNAMIC_ACTIONS', 'SINGLE_ASSIGNMENT', 'BULK_ASSIGNMENT'];
const PILOT_PORTAL = ['SUBMISSION', 'UPLOAD'];

/* Development runs the internal platform against the documented estate. UPLOAD is left
   out of the required set because no ticket-redeeming upload flow exists anywhere in the
   corpus — demanding it would make the development posture permanently unreachable for a
   reason development cannot fix. */
const DEV_RUNTIME = PILOT_RUNTIME;
const DEV_PORTAL = ['SUBMISSION'];
const PUBLIC_PORTAL = ['SUBMISSION', 'UPLOAD', 'STATUS', 'SUPPORT', 'VERIFY', 'VERIFY_CONFIRM'];

const SIG = /sig=([A-Za-z0-9_-]{20,})/g;
const PLACEHOLDER = /YOUR_ENV|ROTATE_ME|YOURTENANT|example\.com/i;

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

const findings = [];
const record = (level, area, title, detail, fix) =>
  findings.push({ level, area, title, detail, fix });

const blocker = (...a) => record('BLOCKER', ...a);
const warn = (...a) => record('WARNING', ...a);
const pass = (...a) => record('PASS', ...a);
const manual = (...a) => record('MANUAL', ...a);

/* ------------------------------------------------------------------ *
 * Load the deploy-time config the way the browser does
 * ------------------------------------------------------------------ */

/**
 * Both config.local.js files are plain scripts assigning to a global. Evaluating them
 * with a stand-in `window` is exactly what the browser does, and it means this gate
 * reads the same bytes that ship rather than a re-parse that could drift.
 */
function loadLocalConfig(relPath, globalName) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return { present: false, config: null, abs, relPath };
  const src = fs.readFileSync(abs, 'utf8');
  const sandbox = { window: {} };
  try {
    // eslint-disable-next-line no-new-func
    new Function('window', src).call(sandbox, sandbox.window);
  } catch (e) {
    return { present: true, config: null, error: e.message, abs, relPath };
  }
  return { present: true, config: sandbox.window[globalName] || null, abs, relPath, src };
}

const runtime = loadLocalConfig('config/config.local.js', 'DGO_CONFIG');
const portal = loadLocalConfig('document-portal/config.local.js', 'PF_CONFIG');

/* ------------------------------------------------------------------ *
 * Posture
 *
 * Settled before anything is checked, because the posture decides what "required" even
 * means. Inference goes to `enforced` when auth is on, otherwise `pilot` — never to
 * `development`, which has to be asked for. A posture that quietly downgrades its own
 * standard is not a gate.
 * ------------------------------------------------------------------ */

const authCfg = runtime.config?.auth || {};
const declaredEnforced = authCfg.enabled === true;
const posture = posturArg || (declaredEnforced ? 'enforced' : 'pilot');

if (!['development', 'pilot', 'enforced'].includes(posture)) {
  console.error(`\n  ✖  Unknown posture "${posture}". Use --posture development | pilot | enforced\n`);
  process.exit(2);
}

const isDev = posture === 'development';
const requiredRuntime = isDev ? DEV_RUNTIME : PILOT_RUNTIME;
const requiredPortal = isDev ? DEV_PORTAL : PILOT_PORTAL;

/* ------------------------------------------------------------------ *
 * 1 · Endpoint wiring
 * ------------------------------------------------------------------ */

function checkWiring(surface, required, label, cfgFile) {
  if (!surface.present) {
    blocker('wiring', `${label}: not configured`,
      `${surface.relPath} does not exist, so every endpoint resolves to '' and the ` +
      `platform runs in demo mode — it boots and renders, but transmits nothing.`,
      `npm run setup -- --values ~/dgo-values.txt`);
    return {};
  }
  if (surface.error) {
    blocker('wiring', `${label}: config file does not evaluate`,
      `${surface.relPath} threw when loaded: ${surface.error}. The browser will fail ` +
      `the same way, silently, because the tag carries onerror="void 0".`,
      `Fix the syntax, or regenerate with npm run setup -- --force`);
    return {};
  }
  const endpoints = surface.config?.endpoints || {};
  const missing = required.filter(k => !String(endpoints[k] || '').trim());
  const placeholders = Object.entries(endpoints)
    .filter(([, v]) => v && PLACEHOLDER.test(String(v)))
    .map(([k]) => k);
  const insecure = Object.entries(endpoints)
    .filter(([, v]) => v && !/^https:\/\//i.test(String(v)))
    .map(([k]) => k);

  if (missing.length) {
    blocker('wiring', `${label}: ${missing.length} required endpoint(s) unwired`,
      `Correspondence cannot flow end to end without: ${missing.join(', ')}.`,
      `Regenerate each trigger in Power Automate and re-run setup with --force`);
  } else {
    pass('wiring', `${label}: every required endpoint is wired`,
      `${required.length}/${required.length} of the minimal set present in ${cfgFile}.`);
  }
  if (placeholders.length) {
    blocker('wiring', `${label}: placeholder URLs still in place`,
      `These carry template text, not a real trigger: ${placeholders.join(', ')}.`,
      `Replace with the regenerated HTTP POST URL from Power Automate`);
  }
  if (insecure.length) {
    blocker('wiring', `${label}: non-HTTPS endpoint(s)`,
      `A trigger URL is a bearer credential; over plain HTTP it is readable in transit: ${insecure.join(', ')}.`,
      `Use the https:// form of the trigger URL`);
  }
  return endpoints;
}

const runtimeEndpoints = checkWiring(runtime, requiredRuntime, 'Internal runtime', 'config/config.local.js');
const portalEndpoints = checkWiring(portal, requiredPortal, 'Public portal', 'document-portal/config.local.js');

/* ------------------------------------------------------------------ *
 * 2 · Credential hygiene — the part that actually decides go-live
 * ------------------------------------------------------------------ */

/**
 * Tracked files, or null when this is not a git work tree.
 *
 * Running the gate on an exported or deployed copy is legitimate — that is arguably
 * where you most want it — so a missing .git must not crash. But it must not silently
 * pass either: without the repository there is nothing to compare a wired signature
 * against, and "could not check" is a different claim from "checked, and it is clean".
 */
function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8').split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Scan one file for signatures without holding it in memory.
 *
 * Reading whole files was the obvious implementation and it was wrong: capping the read
 * to skip large ones silently excluded a 23 MB flow run record that carries a live
 * signature. A gate that under-reports published credentials is worse than no gate,
 * because checkRotation() below would then clear an endpoint that was never rotated.
 *
 * Chunked with an overlap, so a signature straddling a chunk boundary is still found.
 * Decoded as latin1 rather than utf8 — signature characters are ASCII, and a
 * single-byte encoding cannot split a code point across a boundary.
 */
const CHUNK = 4 * 1024 * 1024;
const OVERLAP = 512;

function scanFile(abs, onMatch) {
  let fd;
  try { fd = fs.openSync(abs, 'r'); } catch { return; }
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let carry = '';
    for (;;) {
      const n = fs.readSync(fd, buf, 0, CHUNK, null);
      if (n <= 0) break;
      const text = carry + buf.subarray(0, n).toString('latin1');
      for (const m of text.matchAll(SIG)) onMatch(m[1]);
      carry = text.slice(-OVERLAP);
    }
  } catch { /* unreadable — nothing to report */ }
  finally { fs.closeSync(fd); }
}

/** Every signature that appears anywhere in the tracked tree, mapped to its files. */
function publishedSignatures(files) {
  const index = new Map();
  for (const f of files) {
    scanFile(path.join(ROOT, f), sig => {
      if (!index.has(sig)) index.set(sig, []);
      const list = index.get(sig);
      if (!list.includes(f)) list.push(f);
    });
  }
  return index;
}

const tracked = trackedFiles();
const inGitTree = tracked !== null;
const published = inGitTree ? publishedSignatures(tracked) : new Map();

if (!inGitTree) {
  manual('credentials', 'rotation could not be verified — this is not a git work tree',
    'The gate compares each wired trigger URL against every signature committed to this ' +
    'repository, which is how it catches an endpoint that was never rotated. Without the ' +
    'repository there is nothing to compare against, so that check did not run. This is ' +
    'not a pass.',
    'Run npm run commission from a clone of the repository');
} else if (published.size) {
  const files = new Set();
  for (const fl of published.values()) fl.forEach(f => files.add(f));
  warn('credentials', `${published.size} signed trigger URL(s) are committed to this repository`,
    `Across ${files.size} tracked file(s), largely the reference corpus under ` +
    `docs/reference/foundational/, which documents the deployed flow estate verbatim ` +
    `by explicit decision (D5). Anyone who can read this repository holds every one of ` +
    `them, and deleting a file revokes nothing.`,
    `Rotate each in Power Automate. Deletion is not rotation.`);
} else {
  pass('credentials', 'no signed trigger URL is committed', 'The tracked tree carries no SAS signature.');
}

/**
 * The check that matters most, and the one no other suite performs: is an endpoint you
 * are about to go live on the SAME signature that is already published in this
 * repository? If so it was never rotated, and the deployment inherits a credential
 * that anyone with repository access already holds.
 */
function checkRotation(endpoints, label) {
  const reused = [];
  for (const [key, url] of Object.entries(endpoints || {})) {
    if (!url) continue;
    for (const m of String(url).matchAll(SIG)) {
      if (published.has(m[1])) reused.push({ key, files: published.get(m[1]) });
    }
  }
  if (reused.length) {
    const detail =
      reused.map(r => `  ${r.key} — same signature as ${r.files[0]}${r.files.length > 1 ? ` (+${r.files.length - 1} more)` : ''}`).join('\n');
    if (isDev) {
      /* Expected here, and the whole point of the posture: development runs against the
         documented estate so configuration is exercised against real flows. Recorded as
         a warning rather than waved through, because the same wiring must never survive
         into pilot or production — where this same check blocks it. */
      warn('credentials', `${label}: ${reused.length} endpoint(s) wired to a published signature`,
        detail + `\n  Expected in the development posture — these are the documented estate. ` +
        `They are disclosed to anyone who can read this repository, so this configuration ` +
        `must not be deployed anywhere the public or real correspondence can reach it.`,
        `Before production: build a fresh estate and re-wire with npm run setup -- --values`);
    } else {
      blocker('credentials', `${label}: ${reused.length} endpoint(s) wired to an UNROTATED signature`,
        detail +
        `\n  These trigger URLs are published in this repository. Going live on them means ` +
        `going live on a credential that is already disclosed.`,
        `Regenerate the trigger in Power Automate, then npm run setup -- --force`);
    }
  } else if (inGitTree && Object.values(endpoints || {}).some(Boolean)) {
    pass('credentials', `${label}: no wired endpoint reuses a published signature`,
      'Every configured trigger URL is distinct from the ones committed here.');
  }
}

checkRotation(runtimeEndpoints, 'Internal runtime');
checkRotation(portalEndpoints, 'Public portal');

/** The config.local files must be untracked. A committed one is a permanent leak. */
if (inGitTree) {
  const committed = ['config/config.local.js', 'document-portal/config.local.js']
    .filter(rel => tracked.includes(rel));
  for (const rel of committed) {
    blocker('credentials', `${rel} is tracked by git`,
      'This file holds live trigger URLs. Committing it publishes them to everyone with ' +
      'repository access, permanently — rewriting history does not revoke them.',
      `git rm --cached ${rel}  (then rotate every URL it contained)`);
  }
  if (!committed.length) {
    pass('credentials', 'deploy-time config is untracked',
      'Both config.local.js files are git-ignored and unstaged.');
  }
}

/* ------------------------------------------------------------------ *
 * 3 · Authentication posture
 * ------------------------------------------------------------------ */

if (isDev) {
  warn('auth', 'development posture: nothing is enforced anywhere',
    'Authentication is inert by design here — no identity provider, no token, identity ' +
    'from the local profile. Every flow is reachable by anyone holding its URL, and every ' +
    'URL is published. This is a development configuration and carries no security ' +
    'properties at all.',
    'Correct for development. Never expose it to the public or to real correspondence.');

  manual('auth', 'authorisation is the flows\' obligation, in every posture',
    'With no proxy and no identity provider, a flow is the only place a caller can be ' +
    'checked. That does not change when you move to production — it is the same ' +
    'obligation, against a fresh estate. What development buys you is the chance to get ' +
    'the request and response contracts right first, so the production flows are built ' +
    'once against a configuration already proven.',
    'npm run verify:endpoints -- --include-writes, then docs/architecture/AUTHENTICATION_CONTRACT.md §2');
} else if (posture === 'enforced') {
  if (!declaredEnforced) {
    blocker('auth', 'enforced posture requested but auth is inert',
      'config/auth.config.js defaults to enabled:false, and nothing in ' +
      'config/config.local.js overrides it. Caller identity travels as a client-asserted ' +
      'userEmail from localStorage, and RBAC is advisory: editing one storage key ' +
      'escalates a viewer to systemAdmin.',
      'npm run setup -- --force with DGO_AUTH_ENABLED=true and the tenant values');
  } else {
    const missing = ['tenantId', 'clientId'].filter(k => !String(authCfg[k] || '').trim());
    if (missing.length) {
      blocker('auth', `enforced posture is incomplete: ${missing.join(', ')} missing`,
        'auth.enabled is true but the identity provider is not identified, so token ' +
        'acquisition cannot succeed and every governed action will fail closed.',
        'Supply DGO_AUTH_TENANT_ID and DGO_AUTH_CLIENT_ID at deploy time');
    } else {
      pass('auth', 'client half of enforced auth is complete',
        'enabled:true with tenant and client identified.');
    }
    if (authCfg.roleSource === 'claims' && !Object.keys(authCfg.roleClaimMap || {}).length) {
      blocker('auth', 'roleSource is "claims" but roleClaimMap is empty',
        'Every caller resolves to no role, so the platform authorises nothing.',
        'Populate roleClaimMap against config/rbac.config.js role ids');
    }
    if (authCfg.roleSource !== 'claims') {
      warn('auth', 'roles still read from local state under enforced auth',
        `roleSource is "${authCfg.roleSource || 'local'}". The token is acquired and sent, ` +
        'but the role decision is still made from the browser profile — which the user ' +
        'controls. This is the half-enabled state config/auth.config.js warns against.',
        'Set DGO_AUTH_ROLE_SOURCE=claims and populate roleClaimMap');
    }
  }
  manual('auth', 'server half: each flow must validate the token itself',
    'This is gap G-04. The authenticating proxy that once discharged it has been ' +
    'removed, so token validation, role derivation, per-action authorisation, rate ' +
    'limiting, reference minting and upload ticketing are now each flow\'s own ' +
    'obligation. No check in this repository can verify a Power Automate flow. Until ' +
    'you have tested each one against an anonymous caller and an under-privileged ' +
    'caller, treat enforcement as unproven.',
    'docs/architecture/AUTHENTICATION_CONTRACT.md §2, then verify per docs/deployment/MINIMAL-PILOT.md §7');
} else {
  warn('auth', 'pilot posture: authentication is inert and enforcement is advisory',
    'Caller identity is a client-asserted userEmail from localStorage; editing one ' +
    'storage key escalates a viewer to systemAdmin. Cloudflare Access gates who may ' +
    'LOAD the interface, but it does not sit between the page and the flows — a flow ' +
    'called directly answers whoever calls it.',
    'Acceptable for an internal pilot. Not for citizens\' personal data at scale.');
  if (portalEndpoints && Object.keys(portalEndpoints).some(k => PUBLIC_PORTAL.includes(k) && portalEndpoints[k])) {
    manual('auth', 'the public channel is open by definition',
      'Portal endpoints are delivered to every visitor\'s browser and are readable from ' +
      'the page source. Each configured flow must validate its own input, rate-limit its ' +
      'own callers, mint its own reference and verify its own uploads, because nothing ' +
      'else in the request path can.',
      'Confirm C7/C9 obligations in docs/deployment/CLOUDFLARE.md are built');
  }
}

/* ------------------------------------------------------------------ *
 * 4 · The quality gate still has to be green
 * ------------------------------------------------------------------ */

for (const [label, script] of [
  ['module graph', 'tests/check-imports.mjs'],
  ['secret ratchet', 'tests/check-secrets.mjs'],
]) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, script)], { cwd: ROOT, stdio: 'pipe' });
    pass('quality', `${label} passes`, `${script} exits clean.`);
  } catch {
    blocker('quality', `${label} FAILS`,
      `${script} exits non-zero. The runtime once shipped 12 config modules that were ` +
      `imported but never committed; because those are static imports the failure ` +
      `preceded boot()'s own try/catch, so nothing threw and the app hung on its spinner.`,
      `node ${script}`);
  }
}

manual('quality', 'browser suite must be run against the deployed build',
  'npm run test:smoke covers boot, accessibility, all 25 routes, themes and the portal, ' +
  'but against a local server. Run it once more against the deployed hostname before ' +
  'declaring live, because deployment is where config.local.js presence differs.',
  'npm run test:smoke');

/* ------------------------------------------------------------------ *
 * 5 · Obligations no script can settle
 * ------------------------------------------------------------------ */

manual('governance', 'routing table needs approval',
  'Part H of docs/deployment/CLOUDFLARE.md decides which desk each kind of ' +
  'correspondence lands on. It has not been approved by anyone.',
  'docs/deployment/CLOUDFLARE.md Part H');

manual('governance', 'test records must be cleared before real correspondence arrives',
  'Commissioning verification writes real rows into the Correspondence list, and a ' +
  'reference sequence that has issued test numbers keeps issuing from there.',
  'docs/deployment/MINIMAL-PILOT.md §8');

manual('data-protection', 'personal data of ~785 individuals is in scope',
  'Finding R-01. The repository is private now, which closed the exposure, but live ' +
  'usage puts that data through a channel whose enforcement posture you are choosing ' +
  'above. The pilot posture does not protect it.',
  'docs/STATUS_REPORT.md R-01');

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const ICON = { PASS: '✅', WARNING: '⚠️ ', BLOCKER: '⛔', MANUAL: '📋' };
const ORDER = ['BLOCKER', 'WARNING', 'MANUAL', 'PASS'];

console.log(`\nDGO Digital Operations — commissioning readiness\n`);
console.log(`  Posture checked: ${posture.toUpperCase()}${posturArg ? '' : '  (inferred from configuration)'}\n`);

for (const level of ORDER) {
  const group = findings.filter(f => f.level === level);
  if (!group.length) continue;
  const plural = group.length === 1 ? '' : level === 'PASS' ? 'ES' : 'S';
  console.log(`  ${ICON[level]} ${level}${plural} — ${group.length}\n`);
  for (const f of group) {
    console.log(`     ${f.title}`);
    if (level !== 'PASS') {
      for (const line of f.detail.split('\n')) console.log(`       ${line}`);
      if (f.fix) console.log(`       → ${f.fix}`);
    }
    console.log('');
  }
}

const blockers = findings.filter(f => f.level === 'BLOCKER');
const manuals = findings.filter(f => f.level === 'MANUAL');

console.log('  ' + '─'.repeat(72) + '\n');
if (blockers.length) {
  console.log(`  NOT CLEARED for ${posture} usage — ${blockers.length} blocker(s) stand.\n`);
  console.log(`  Nothing here is a code defect. Every blocker is a commissioning step that`);
  console.log(`  has to happen in your tenant, not in this repository.\n`);
  process.exit(1);
}
console.log(`  No automated blocker for ${posture} usage.\n`);
console.log(`  ${manuals.length} obligation(s) remain that no script can settle — they need a`);
console.log(`  person to verify and sign. Read them above before declaring live.\n`);
process.exit(0);
