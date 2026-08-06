#!/usr/bin/env node
/**
 * Build the delivered packages, with their endpoints provisioned into them.
 *
 *   npm run package                                  # both, demo posture
 *   npm run package -- --values ~/dgo-values.txt --posture pilot
 *   npm run package -- --surface portal --out dist
 *   npm run package -- --verify dist/dgo-document-portal
 *
 * WHY THIS EXISTS. The architecture decision is that each platform calls its Power
 * Automate flows directly, with the complete trigger URLs configured into the artefact
 * that is handed over — no proxy, no broker, nothing to stand up between the browser and
 * the flow. Until now the repository implemented the first half of that and not the
 * second. `npm run setup` wrote the URLs into `config/config.local.js` and
 * `document-portal/config.local.js`, both git-ignored, so the thing people actually
 * received — a clone, or GitHub's "Download ZIP" — was by construction the one artefact
 * that could not contain them. Provisioning was therefore a step an operator performed
 * from a document, on the far side of the handover, with nothing checking the result.
 *
 * This makes provisioning a build step with a build gate. Each package is self-contained:
 * the platform's own files, its endpoint configuration written in, a manifest that hashes
 * every byte, and a provisioning record that names what is wired and what is not. What is
 * verified here is verified once, centrally, against the same definition the runtime
 * resolves — instead of being re-derived by hand for every deployment.
 *
 * WHAT IT REFUSES. In `pilot` or `enforced` posture a package will not be emitted when a
 * required endpoint is missing, when any URL is malformed (see
 * `lib/endpoint-validation.mjs` — a truncated paste is the failure this catches), when two
 * keys resolve to the same flow, or when a wired signature is one already published in
 * this repository. In `demo` posture it emits a package with no endpoints at all and
 * stamps it as such, because that is a legitimate artefact and pretending otherwise would
 * only teach people to pass `--force`.
 *
 * WHAT IT DOES NOT DO. It cannot verify the flow behind a URL. `npm run verify:endpoints`
 * exercises those live; the seven server-side obligations in
 * `docs/architecture/AUTHENTICATION_CONTRACT.md` §2 belong to the flows and no build step
 * can settle them.
 *
 * Exit 0 = every requested package was emitted. Exit 1 = at least one was refused.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { SURFACES, SURFACE_IDS, pilotKeysOf } from './lib/endpoint-surface.mjs';
import { validateSurface, redact } from './lib/endpoint-validation.mjs';
import { trackedFiles, publishedSignatures, reusedSignatures } from './lib/published-signatures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const flag = name => argv.includes(name);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const VERIFY_DIR = opt('--verify');
const OUT_DIR = path.resolve(ROOT, opt('--out', 'dist'));
const POSTURE = opt('--posture', 'demo');
const VALUES_FILE = opt('--values');
const ONLY_SURFACE = opt('--surface');
const QUIET = flag('--quiet');

if (!['demo', 'pilot', 'enforced'].includes(POSTURE)) {
  console.error(`\n  ✖  Unknown posture "${POSTURE}". Use --posture demo | pilot | enforced\n`);
  process.exit(2);
}
if (ONLY_SURFACE && !SURFACE_IDS.includes(ONLY_SURFACE)) {
  console.error(`\n  ✖  Unknown surface "${ONLY_SURFACE}". Use --surface ${SURFACE_IDS.join(' | ')}\n`);
  process.exit(2);
}

/* ------------------------------------------------------------------ *
 * What goes in each package
 *
 * Listed rather than inferred, because "everything except the excluded" is the rule that
 * ships the reference corpus and the test suite to an operator. The completeness of these
 * lists is not taken on trust: after copying, every asset and every module the entry HTML
 * reaches is resolved inside the package, and a package that cannot resolve its own graph
 * is refused. That check is what makes a hand-written list safe.
 * ------------------------------------------------------------------ */

const CONTENTS = {
  runtime: {
    entry: 'index.html',
    /* `config/` carries the whole ES-module config graph, not just endpoints — the 13
       modules whose absence once held the runtime on its boot spinner forever. */
    include: ['index.html', 'assets/', 'config/', 'core/', 'modules/', 'shared/', 'styles/', 'LICENSE'],
    /* The example is a template for a step this packager replaces, and a stale
       config.local.js from the build machine must never be copied — it is regenerated. */
    exclude: ['config/config.example.js', 'config/config.local.js'],
    strip: 'runtime',
  },
  portal: {
    entry: 'index.html',
    include: ['document-portal/'],
    exclude: ['document-portal/config.example.js', 'document-portal/config.local.js'],
    /* Paths are re-rooted: `document-portal/index.html` ships as `index.html`, because the
       portal is deployed at the root of its own site. */
    strip: 'document-portal/',
  },
};

/* ------------------------------------------------------------------ *
 * Values
 * ------------------------------------------------------------------ */

function parseValuesFile(file) {
  const abs = path.resolve(String(file).replace(/^~(?=$|\/)/, process.env.HOME || '~'));
  if (!fs.existsSync(abs)) {
    console.error(`\n  ✖  Values file not found: ${abs}\n`);
    process.exit(2);
  }
  const out = {};
  for (const raw of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const FILE_VALUES = VALUES_FILE ? parseValuesFile(VALUES_FILE) : {};

/** Values file first, then environment — so a stale shell export cannot beat an explicit file. */
function resolveValue(key, prefixes) {
  const names = [...prefixes.map(p => p + key), key];
  for (const n of names) if (FILE_VALUES[n]) return FILE_VALUES[n].trim();
  for (const n of names) if (process.env[n]) return String(process.env[n]).trim();
  return '';
}

function valuesFor(surfaceId) {
  const s = SURFACES[surfaceId];
  return Object.fromEntries(s.endpoints.map(e => [e.key, resolveValue(e.key, s.envPrefixes)]));
}

/* Authentication travels with the runtime package the same way the endpoints do. */
const AUTH_KEYS = [
  { key: 'enabled', env: 'DGO_AUTH_ENABLED', cast: v => v === 'true' || v === '1' },
  { key: 'tenantId', env: 'DGO_AUTH_TENANT_ID' },
  { key: 'clientId', env: 'DGO_AUTH_CLIENT_ID' },
  { key: 'authority', env: 'DGO_AUTH_AUTHORITY' },
  { key: 'roleSource', env: 'DGO_AUTH_ROLE_SOURCE' },
];

function authValues() {
  const out = {};
  for (const { key, env, cast } of AUTH_KEYS) {
    const raw = FILE_VALUES[env] ?? process.env[env];
    if (raw === undefined || raw === '') continue;
    out[key] = cast ? cast(String(raw).trim()) : String(raw).trim();
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Emitted configuration
 *
 * Written from the same renderer shape `scripts/setup.mjs` uses, so a package and a wired
 * working tree present the runtime with identical bytes. MERGED, not assigned: injecting
 * the global before this file loads is a supported path and must keep winning.
 * ------------------------------------------------------------------ */

const pad = (s, n) => String(s).padEnd(n, ' ');

function renderRuntimeConfig(values, auth, meta) {
  const w = Math.max(...Object.keys(values).map(k => k.length)) + 2;
  const lines = Object.entries(values).map(([k, v]) => `    ${pad(k + ':', w)}${JSON.stringify(v || '')},`);
  const authBlock = Object.keys(auth).length
    ? `
/* Authentication, provisioned into this package.
 *
 * ⚠  enabled:true switches on the CLIENT half only: the browser acquires a token and sends
 * it, stops asserting identity itself, and reads roles from claims. It does NOT make any
 * decision server-authoritative. Each flow must validate the token, derive the role and
 * authorise the action itself — see docs/architecture/AUTHENTICATION_CONTRACT.md §2.
 */
window.DGO_CONFIG.auth = Object.assign({
${Object.entries(auth).map(([k, v]) => `    ${pad(k + ':', 12)}${JSON.stringify(v)},`).join('\n')}
}, window.DGO_CONFIG.auth);
`
    : '';
  return `/* DGO Digital Operations — internal platform endpoint configuration.
 *
 * PROVISIONED INTO THIS PACKAGE by scripts/package.mjs.
 *   build ${meta.buildId}   posture ${meta.posture}   ${meta.builtAt}
 *
 * Every URL below is a signed Power Automate trigger, and a signed trigger URL is a bearer
 * credential: possession alone authorises invoking the flow. This file is delivered
 * verbatim to every browser that loads the platform, so treat each URL as public from the
 * moment you deploy.
 *
 * There is no proxy in the request path, by decision. The flow behind each URL is the only
 * place authentication, authorisation, validation and rate limiting can happen, and it
 * must do all four itself.
 *
 * Rotation is the only revocation. Regenerate the signature in Power Automate, rebuild the
 * package, redeploy. Rebuilding changes the build id above, which is how a deployment can
 * be told apart from the one it replaced.
 *
 * MERGED, NOT ASSIGNED — injecting window.DGO_CONFIG before this file loads is a supported
 * way to supply endpoints, so anything already set must win.
 */
window.DGO_CONFIG = window.DGO_CONFIG || {};
window.DGO_CONFIG.endpoints = Object.assign({
${lines.join('\n')}
}, window.DGO_CONFIG.endpoints);
${authBlock}`;
}

function renderPortalConfig(values, meta) {
  const w = Math.max(...Object.keys(values).map(k => k.length)) + 2;
  const lines = Object.entries(values).map(([k, v]) => `    ${pad(k + ':', w)}${JSON.stringify(v || '')},`);
  return `/* NITDA document portal — endpoint configuration.
 *
 * PROVISIONED INTO THIS PACKAGE by scripts/package.mjs.
 *   build ${meta.buildId}   posture ${meta.posture}   ${meta.builtAt}
 *
 * ⚠  This is the PUBLIC portal. Every URL below is delivered to every visitor's browser
 * and is readable by anyone who fetches a static asset from the site. Configure only
 * endpoints whose flows are built to be invoked by an anonymous stranger: each must
 * validate its own input, rate-limit its own callers, return only what that caller is
 * entitled to see, and be rotatable on a schedule.
 *
 * With SUBMISSION empty the portal stays in DEMO MODE — everything stays on the device and
 * nothing is transmitted, which is the safe failure for a public channel.
 *
 * MERGED, NOT ASSIGNED — injecting window.PF_CONFIG before this file loads is a supported
 * way to supply endpoints, so anything already set must win.
 */
window.PF_CONFIG = window.PF_CONFIG || {};
window.PF_CONFIG.endpoints = Object.assign({
${lines.join('\n')}
}, window.PF_CONFIG.endpoints);
`;
}

/* ------------------------------------------------------------------ *
 * File assembly
 * ------------------------------------------------------------------ */

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * The build id: a digest over the provisioned endpoint set, not over the clock.
 *
 * Two builds of the same code with the same endpoints therefore carry the same id, and a
 * rotation necessarily changes it. The portal's service worker names its cache after it,
 * which is what makes rotation actually take effect for a returning visitor — see the
 * `sw.js` transform below.
 */
function buildIdFor(values) {
  const material = Object.keys(values).sort().map(k => `${k}=${values[k] || ''}`).join('\n');
  return sha256(material).slice(0, 16);
}

function filesFor(surfaceId, tracked) {
  const { include, exclude } = CONTENTS[surfaceId];
  return tracked
    .filter(f => include.some(i => (i.endsWith('/') ? f.startsWith(i) : f === i)))
    .filter(f => !exclude.includes(f))
    .sort();
}

const stripPrefix = (file, strip) =>
  strip === 'runtime' ? file : file.startsWith(strip) ? file.slice(strip.length) : file;

/**
 * Transforms applied to a file as it enters a package.
 *
 * Only one, and it earns its place. The portal's service worker is cache-first for every
 * same-origin GET, so `config.local.js` — the file holding the trigger URLs — was cached
 * on first visit and served from Cache Storage afterwards. A rotation therefore did not
 * reach a returning visitor: their browser kept calling the URL that had just been
 * revoked, and the source could only ask a human to remember to bump `CACHE`. Naming the
 * cache after the build id makes the invalidation mechanical, because the build id is
 * derived from the endpoint set that was rotated.
 */
function transform(relPath, buf, meta) {
  if (relPath !== 'sw.js') return buf;
  const src = buf.toString('utf8');
  const marked = src.replace(
    /^const BUILD = '[^']*';/m,
    `const BUILD = '${meta.buildId}';`);
  if (marked === src) {
    throw new Error(
      "document-portal/sw.js no longer carries the `const BUILD = '...'` line the packager " +
      'rewrites. Without it the service-worker cache is not tied to the endpoint set, and a ' +
      'rotation will not reach returning visitors.');
  }
  return Buffer.from(marked, 'utf8');
}

/* ------------------------------------------------------------------ *
 * Completeness — can the package resolve its own graph?
 * ------------------------------------------------------------------ */

/* Three narrow matchers rather than one wide one. An earlier cut tried to span an entire
   import statement with a lazy `[\s\S]{0,400}?` and matched prose four hundred characters
   away from a `from`, which reported a config file as referencing a fragment of its own
   contents. Each of these anchors on the token immediately before the specifier. */
const MODULE_FROM = /\bfrom\s*['"]([^'"\n]+)['"]/g;
const MODULE_DYNAMIC = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const MODULE_BARE = /^\s*import\s+['"]([^'"\n]+)['"]/gm;
const HTML_REF = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const CSS_IMPORT = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/gi;

/** Anything carrying a URI scheme — http:, data:, tel:, mailto: — leaves the package. */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.\-]*:/;
const EXPLICIT_PATH = /^(?:\.\.?\/|\/)/;
const ASSET_PATH = /^[\w][\w./-]*\.(?:js|mjs|css|svg|png|jpe?g|gif|ico|webmanifest|woff2?|json|html)$/i;

/**
 * Is this string a reference to a file inside the package?
 *
 * The narrow answer matters more than the wide one. `from` and `src=` both appear inside
 * template literals and prose — a module explaining that one value is "different from
 * 'wrong email'" produced a matcher hit, and treating every hit as a required file turned
 * English into build blockers. A specifier is followed only when it is unambiguously a
 * path: explicitly relative, or a bare name ending in an extension the package serves.
 * Bare module specifiers (`node:fs`, a package name) are not resolved from disk at all.
 */
const isPackageRef = (u, kind) => {
  if (!u || HAS_SCHEME.test(u) || u.startsWith('//') || u.startsWith('#')) return false;
  if (EXPLICIT_PATH.test(u)) return true;
  return kind !== 'js' && ASSET_PATH.test(u);
};

/**
 * Walk the package the way a browser would and report anything it asks for that is not
 * there. This is what allows CONTENTS above to be a hand-written list: an omission fails
 * the build with the missing path named, rather than shipping and hanging on a spinner.
 */
function missingReferences(dir, entry) {
  const seen = new Set();
  const missing = [];
  const queue = [entry];

  const resolve = (from, ref) => {
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) return null;
    return path.normalize(path.join(path.dirname(from), clean));
  };

  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;

    /* Only text formats are walked; a font or a PNG has no references to follow. */
    if (!/\.(html|js|mjs|css)$/i.test(rel)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const refs = [];

    let kind = 'js';
    if (/\.html$/i.test(rel)) {
      kind = 'html';
      for (const m of text.matchAll(HTML_REF)) refs.push(m[1]);
    } else if (/\.css$/i.test(rel)) {
      kind = 'css';
      for (const m of text.matchAll(CSS_IMPORT)) refs.push(m[1]);
    } else {
      for (const re of [MODULE_FROM, MODULE_DYNAMIC, MODULE_BARE]) {
        for (const m of text.matchAll(re)) refs.push(m[1]);
      }
    }

    for (const ref of refs) {
      if (!isPackageRef(ref, kind)) continue;
      const target = resolve(rel, ref);
      if (!target || target.startsWith('..')) continue;
      const targetAbs = path.join(dir, target);
      if (!fs.existsSync(targetAbs)) {
        /* The optional config script is the one deliberate 404 in both trees — its tag
           carries onerror="void 0". A package provisions it, so a miss here is real. */
        missing.push({ from: rel, ref, resolved: target });
        continue;
      }
      queue.push(target);
    }
  }
  return missing;
}

/* ------------------------------------------------------------------ *
 * Build one package
 * ------------------------------------------------------------------ */

function buildSurface(surfaceId, tracked, published) {
  const surface = SURFACES[surfaceId];
  const spec = CONTENTS[surfaceId];
  const values = valuesFor(surfaceId);
  const auth = surfaceId === 'runtime' ? authValues() : {};
  const buildId = buildIdFor(values);
  const builtAt = new Date().toISOString();
  const meta = { buildId, builtAt, posture: POSTURE };

  const anyProvisioned = Object.values(values).some(Boolean);
  const required = POSTURE === 'demo' ? [] : pilotKeysOf(surfaceId);
  const validation = validateSurface(values, surface.endpoints, { required });

  const blockers = [];

  if (POSTURE !== 'demo') {
    if (!anyProvisioned) {
      blockers.push({
        code: 'nothing-provisioned',
        message: `no endpoint URL was supplied for the ${surface.label}, so a "${POSTURE}" package would ship demo mode under a live label`,
        fix: 'npm run package -- --values ~/dgo-values.txt --posture ' + POSTURE,
      });
    }
    for (const key of validation.missingRequired) {
      blockers.push({
        code: 'missing-required', key,
        message: `${key} is required and has no URL — correspondence cannot flow end to end without it`,
        fix: 'regenerate the trigger in Power Automate and add it to the values file',
      });
    }
  }

  /* Malformed values are refused in every posture, demo included: a demo package with a
     broken URL in it is not a demo, it is a package nobody has looked at. */
  for (const r of validation.errors) {
    if (r.code === 'missing-required') continue; // already recorded above
    blockers.push({ code: r.code, key: r.key, message: `${r.key} ${r.message}`, fix: 'correct the value and rebuild' });
  }

  for (const c of validation.collisions) {
    blockers.push({
      code: 'workflow-collision',
      message: `${c.keys.join(' and ')} resolve to the same flow (${c.workflowId.slice(0, 8)}…), so one of them will never reach the flow it names`,
      fix: 'point each key at its own flow, or remove the duplicate',
    });
  }

  const reused = published ? reusedSignatures(values, published) : [];
  if (reused.length && POSTURE !== 'demo') {
    for (const r of reused) {
      blockers.push({
        code: 'unrotated-signature', key: r.key,
        message: `${r.key} is wired to a signature already published in this repository (${r.files[0]}${r.files.length > 1 ? ` +${r.files.length - 1} more` : ''})`,
        fix: 'regenerate the trigger in Power Automate — deleting the file revokes nothing',
      });
    }
  }

  const record = {
    surface: surfaceId,
    label: surface.label,
    packageName: surface.packageName,
    posture: POSTURE,
    buildId,
    validation,
    reused,
    blockers,
    emitted: false,
    dir: path.join(OUT_DIR, surface.packageName),
  };

  if (blockers.length) return record;

  /* --- emit --- */
  const dir = record.dir;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const files = filesFor(surfaceId, tracked);
  if (!files.length) {
    record.blockers.push({
      code: 'empty-package',
      message: `no tracked file matched the content list for ${surface.label}`,
      fix: 'run from a git work tree',
    });
    return record;
  }

  const manifestFiles = [];
  for (const file of files) {
    const rel = stripPrefix(file, spec.strip);
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const buf = transform(rel, fs.readFileSync(path.join(ROOT, file)), meta);
    fs.writeFileSync(dest, buf);
    manifestFiles.push({ path: rel, bytes: buf.length, sha256: sha256(buf) });
  }

  /* The provisioned configuration, written last so it is unmistakably an artefact of this
     build rather than a file that happened to be lying around the build machine. */
  const configRel = surface.configPath;
  const configBody = surfaceId === 'runtime'
    ? renderRuntimeConfig(values, auth, meta)
    : renderPortalConfig(values, meta);
  const configDest = path.join(dir, configRel);
  fs.mkdirSync(path.dirname(configDest), { recursive: true });
  fs.writeFileSync(configDest, configBody);
  manifestFiles.push({ path: configRel, bytes: Buffer.byteLength(configBody), sha256: sha256(configBody) });

  const provisioningDoc = renderProvisioningDoc(surfaceId, values, validation, meta, auth);
  fs.writeFileSync(path.join(dir, 'ENDPOINT_PROVISIONING.md'), provisioningDoc);
  manifestFiles.push({
    path: 'ENDPOINT_PROVISIONING.md',
    bytes: Buffer.byteLength(provisioningDoc),
    sha256: sha256(provisioningDoc),
  });

  const missing = missingReferences(dir, spec.entry);
  if (missing.length) {
    record.blockers.push(...missing.slice(0, 10).map(m => ({
      code: 'unresolved-reference',
      message: `${m.from} references ${m.ref}, which is not in the package`,
      fix: 'add the missing path to CONTENTS in scripts/package.mjs',
    })));
    return record;
  }

  /* Deployment instructions, written as DEPLOY.md rather than README.md: both platforms
     ship a README of their own, and a packager that silently overwrote it would replace
     the document explaining the platform with one explaining the box it arrived in. */
  const summary = {
    demo: POSTURE === 'demo' && !anyProvisioned,
    provisionedCount: validation.results.filter(r => r.provisioned).length,
    endpointCount: surface.endpoints.length,
    actionCount: surface.endpoints.reduce((n, e) => n + e.actions.length, 0),
    buildId, posture: POSTURE, entry: spec.entry,
    fileCount: manifestFiles.length + 2,
    totalBytes: manifestFiles.reduce((n, f) => n + f.bytes, 0),
  };
  const deployDoc = renderDeployDoc(surfaceId, summary);
  fs.writeFileSync(path.join(dir, 'DEPLOY.md'), deployDoc);
  manifestFiles.push({ path: 'DEPLOY.md', bytes: Buffer.byteLength(deployDoc), sha256: sha256(deployDoc) });

  manifestFiles.sort((a, b) => (a.path < b.path ? -1 : 1));
  const filesDigest = sha256(manifestFiles.map(f => `${f.sha256}  ${f.path}`).join('\n'));

  const manifest = {
    package: surface.packageName,
    platform: surface.label,
    posture: POSTURE,
    demo: POSTURE === 'demo' && !anyProvisioned,
    buildId,
    builtAt,
    builtBy: 'scripts/package.mjs',
    entry: spec.entry,
    architecture: {
      requestPath: 'direct',
      intermediaries: [],
      note: 'Each endpoint below is invoked directly by the browser. There is no proxy, '
        + 'broker or other intermediary in the request path, and none is required to deploy '
        + 'or run this package. The flow behind each URL is the only place authentication, '
        + 'authorisation, validation and rate limiting can be enforced.',
    },
    endpoints: surface.endpoints.map(e => {
      const v = validation.results.find(r => r.key === e.key);
      return {
        key: e.key,
        transport: e.transport,
        actions: e.actions,
        pilot: !!e.pilot,
        purpose: e.note,
        provisioned: !!v?.provisioned,
        host: v?.host || null,
        workflowId: v?.workflowId || null,
        // Redacted, always. A manifest travels with the package and into issue trackers.
        target: v?.redacted || '',
        severity: v?.severity || 'warn',
        status: v?.code || 'unprovisioned',
      };
    }),
    provisionedCount: validation.results.filter(r => r.provisioned).length,
    endpointCount: surface.endpoints.length,
    actionCount: surface.endpoints.reduce((n, e) => n + e.actions.length, 0),
    fileCount: manifestFiles.length,
    totalBytes: manifestFiles.reduce((n, f) => n + f.bytes, 0),
    integrity: { algorithm: 'sha256', filesDigest },
    files: manifestFiles,
  };

  fs.writeFileSync(path.join(dir, 'PACKAGE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  record.emitted = true;
  record.manifest = manifest;
  return record;
}

/* ------------------------------------------------------------------ *
 * Documents written into the package
 * ------------------------------------------------------------------ */

function renderProvisioningDoc(surfaceId, values, validation, meta, auth) {
  const surface = SURFACES[surfaceId];
  const rows = surface.endpoints.map(e => {
    const v = validation.results.find(r => r.key === e.key);
    const state = !v.provisioned ? 'not provisioned' : v.ok ? 'provisioned' : `INVALID — ${v.message}`;
    return `| \`${e.key}\` | ${e.transport} | ${e.pilot ? 'yes' : '—'} | ${state} | ${v.workflowId ? `\`${v.workflowId.slice(0, 8)}…\`` : '—'} |`;
  });

  const unprovisioned = surface.endpoints.filter(e => !values[e.key]);

  return `# Endpoint provisioning — ${surface.label}

**Build** \`${meta.buildId}\` · **posture** ${meta.posture} · **built** ${meta.builtAt}

This package calls each Power Automate flow **directly**. There is no proxy, broker or
other intermediary in the request path, and none is required to deploy or run it. Every
URL below is delivered to the browser and is readable by anyone who can fetch a static
asset from this deployment, so **each flow must authenticate and authorise its own
callers, validate its own input, and return only what that caller is entitled to see.**
Nothing else in the request path can do it for them.

## What is wired

| Key | Transport | Pilot set | State | Flow |
|---|---|---|---|---|
${rows.join('\n')}

${unprovisioned.length ? `## Not provisioned — ${unprovisioned.length}

Each of these reports itself unconfigured at runtime rather than failing mid-action:

${unprovisioned.map(e => `- \`${e.key}\` — ${e.note}`).join('\n')}
` : 'Every endpoint on this surface is provisioned.\n'}
## Flow routes reached from this package

One URL can carry several routes: the flow switches on \`action\`, so provisioning a URL
commissions every obligation listed against it. A flow implementing only the first of them
fails at a desk, not at the gate.

${surface.endpoints.filter(e => e.actions.length > 1)
  .map(e => `- \`${e.key}\` — ${e.actions.map(a => `\`${a}\``).join(', ')}`).join('\n') || '- No key carries more than one route.'}

## Rotation

Rotation is the only revocation. A signed trigger URL cannot be retired, only regenerated.

1. Regenerate the signature in Power Automate.
2. Rebuild: \`npm run package -- --values <file> --posture ${meta.posture}\`.
3. Redeploy. The build id changes, which is how this deployment is told apart from the one
   it replaces${surfaceId === 'portal' ? ', and is what invalidates the service-worker cache so a returning visitor stops calling the revoked URL' : ''}.

## Verify before deploying

\`\`\`
npm run package:verify -- --verify <this directory>   # bytes match the manifest
npm run verify:endpoints                              # the flows answer, live
npm run commission                                    # readiness obligations
\`\`\`
${Object.keys(auth).length ? `
## Authentication

Provisioned with \`enabled: ${auth.enabled === true}\`. This is the **client half only** —
the browser acquires a token and sends it. Each flow must still validate that token, derive
the role and authorise the action itself. See \`docs/architecture/AUTHENTICATION_CONTRACT.md\` §2.
` : ''}`;
}

function renderDeployDoc(surfaceId, manifest) {
  const surface = SURFACES[surfaceId];
  return `# Deploying — ${surface.label}

Self-contained deployment package. **Build \`${manifest.buildId}\`, posture ${manifest.posture}.**

${manifest.demo
  ? '> **DEMO PACKAGE.** No endpoint is provisioned. It boots, renders and exercises every\n> screen, and transmits nothing. Do not present it as a live deployment.\n'
  : `> ${manifest.provisionedCount} of ${manifest.endpointCount} endpoints provisioned, covering ${manifest.actionCount} flow routes.\n`}

## Deploy

Serve this directory as a static site. There is nothing to build, install or keep running:
${manifest.fileCount} files, ${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MB, entry \`${manifest.entry}\`.
Every request goes directly from the browser to the configured flow.

## Before you deploy

\`\`\`
npm run package:verify -- --verify <this directory>
\`\`\`

Recomputes every file hash against \`PACKAGE_MANIFEST.json\` and re-validates the endpoint
set. A package that does not verify must not be deployed.

## What is in it

- \`PACKAGE_MANIFEST.json\` — every file, its size and its SHA-256, plus the endpoint
  provisioning record. Signatures are redacted; the manifest is safe to share.
- \`ENDPOINT_PROVISIONING.md\` — what is wired, what is not, and how to rotate.
- \`${surface.configPath}\` — the provisioned endpoint URLs. **This is a credential.**

## The obligation this package cannot discharge

Each flow is called directly, so each flow is the only place authentication, authorisation,
validation and rate limiting can happen. No file in this package can do it for them, and no
check in it can prove they do. See \`docs/architecture/AUTHENTICATION_CONTRACT.md\` §2.
`;
}

/* ------------------------------------------------------------------ *
 * Verify an already-built package
 * ------------------------------------------------------------------ */

function verifyPackage(dir) {
  const abs = path.resolve(ROOT, dir);
  const manifestPath = path.join(abs, 'PACKAGE_MANIFEST.json');
  console.log(`\nDGO Digital Operations — package verification\n\n  ${abs}\n`);

  if (!fs.existsSync(manifestPath)) {
    console.error('  ⛔ No PACKAGE_MANIFEST.json here. This is not a package built by scripts/package.mjs.\n');
    return 1;
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { console.error(`  ⛔ PACKAGE_MANIFEST.json does not parse: ${e.message}\n`); return 1; }

  console.log(`  ${manifest.platform}`);
  console.log(`  build ${manifest.buildId} · posture ${manifest.posture} · ${manifest.fileCount} files\n`);

  const problems = [];
  const present = new Set();

  for (const f of manifest.files) {
    const fp = path.join(abs, f.path);
    if (!fs.existsSync(fp)) { problems.push(`missing: ${f.path}`); continue; }
    present.add(f.path);
    const buf = fs.readFileSync(fp);
    if (buf.length !== f.bytes) problems.push(`size differs: ${f.path} (${buf.length} vs ${f.bytes})`);
    else if (sha256(buf) !== f.sha256) problems.push(`content differs: ${f.path}`);
  }

  /* A file the manifest does not know about is as much a failure as a missing one: it is
     how something gets added to a verified package after it was verified. */
  const walk = (d, base = '') => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), rel);
      /* The manifest is the only file it cannot hash — it would have to contain its own
         digest. Everything else, including the documents this packager writes, is covered:
         an unlisted file is how something gets added to a package after it was verified. */
      else if (rel !== 'PACKAGE_MANIFEST.json' && !present.has(rel)) {
        problems.push(`not in the manifest: ${rel}`);
      }
    }
  };
  walk(abs);

  const digest = sha256([...manifest.files].sort((a, b) => (a.path < b.path ? -1 : 1))
    .map(f => `${f.sha256}  ${f.path}`).join('\n'));
  if (digest !== manifest.integrity.filesDigest) {
    problems.push('the manifest\'s own file list does not match its integrity digest — the manifest was edited');
  }

  const provisioned = manifest.endpoints.filter(e => e.provisioned);
  const invalid = manifest.endpoints.filter(e => e.provisioned && e.severity === 'error');
  console.log(`  endpoints   ${provisioned.length}/${manifest.endpoints.length} provisioned` +
    `${invalid.length ? `, ${invalid.length} INVALID` : ''}`);
  for (const e of manifest.endpoints) {
    const icon = !e.provisioned ? '·' : e.severity === 'error' ? '⛔' : e.severity === 'warn' ? '⚠️ ' : '✅';
    console.log(`    ${icon} ${e.key.padEnd(24)} ${e.provisioned ? e.target : '(not provisioned)'}`);
  }
  console.log('');

  if (problems.length) {
    console.error(`  ⛔ ${problems.length} integrity problem(s):\n`);
    for (const p of problems.slice(0, 25)) console.error(`     ${p}`);
    if (problems.length > 25) console.error(`     … and ${problems.length - 25} more`);
    console.error('\n  This package does not match its manifest. Do not deploy it.\n');
    return 1;
  }

  console.log('  ✅ Every file matches the manifest, and the manifest matches itself.\n');
  if (manifest.demo) {
    console.log('  ⚠️  This is a DEMO package — no endpoint is provisioned and nothing is transmitted.\n');
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

if (VERIFY_DIR) process.exit(verifyPackage(VERIFY_DIR));

const tracked = trackedFiles(ROOT);
if (!tracked) {
  console.error('\n  ✖  Not a git work tree. The package contents are the tracked files, so there is\n' +
                '     nothing to build from here. Run from a clone.\n');
  process.exit(2);
}

/* Only scanned when it can change the outcome. In demo posture nothing is wired, so there
   is nothing to compare against the published set. */
const published = POSTURE === 'demo' ? null : publishedSignatures(ROOT, tracked);

const surfaces = ONLY_SURFACE ? [ONLY_SURFACE] : SURFACE_IDS;
const records = surfaces.map(s => buildSurface(s, tracked, published));

if (!QUIET) {
  console.log('\nDGO Digital Operations — package build\n');
  console.log(`  posture ${POSTURE.toUpperCase()}${VALUES_FILE ? `   values ${VALUES_FILE}` : ''}`);
  console.log(`  output  ${path.relative(ROOT, OUT_DIR) || '.'}\n`);

  for (const r of records) {
    console.log(`  ${r.label}  (${r.packageName})`);
    const total = SURFACES[r.surface].endpoints.length;
    const prov = r.validation.results.filter(x => x.provisioned).length;
    console.log(`    ${prov}/${total} endpoints provisioned · build ${r.buildId}`);

    for (const v of r.validation.results) {
      if (!v.provisioned && POSTURE === 'demo') continue;
      const icon = !v.provisioned ? '·' : v.ok ? (v.severity === 'warn' ? '⚠️ ' : '✅') : '⛔';
      console.log(`      ${icon} ${v.key.padEnd(24)} ${v.provisioned ? v.message : 'not provisioned'}`);
    }

    if (r.emitted) {
      console.log(`    ✅ wrote ${path.relative(ROOT, r.dir)}/  — ${r.manifest.fileCount} files, ` +
        `${(r.manifest.totalBytes / 1024 / 1024).toFixed(1)} MB`);
    } else {
      console.log(`    ⛔ NOT BUILT — ${r.blockers.length} blocker(s):`);
      for (const b of r.blockers) {
        console.log(`       ${b.message}`);
        if (b.fix) console.log(`         → ${b.fix}`);
      }
    }
    console.log('');
  }

  console.log('  ' + '─'.repeat(72) + '\n');
  const failed = records.filter(r => !r.emitted);
  if (failed.length) {
    console.log(`  ${failed.length} package(s) refused.\n`);
  } else if (POSTURE === 'demo') {
    console.log('  Demo packages built. Nothing is transmitted from either of them.\n');
    console.log('  To provision endpoints:\n');
    console.log('    npm run package -- --values ~/dgo-values.txt --posture pilot\n');
  } else {
    console.log('  Both packages built and provisioned. Before deploying:\n');
    console.log('    npm run package:verify -- --verify dist/dgo-internal-platform');
    console.log('    npm run package:verify -- --verify dist/dgo-document-portal');
    console.log('    npm run verify:endpoints');
    console.log('    npm run commission\n');
  }
}

process.exit(records.every(r => r.emitted) ? 0 : 1);
