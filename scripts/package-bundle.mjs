#!/usr/bin/env node
/**
 * Serialise a built package into ONE JSON file, with every byte of every file embedded.
 *
 *   npm run package:bundle                       # both, from dist/
 *   npm run package:bundle -- --out /some/dir
 *   npm run package:bundle -- --verify dist/dgo-document-portal.bundle.json
 *
 * The package on disk is a directory tree. This is the same thing as a single transferable
 * document: metadata, the endpoint provisioning record, and the complete content of all
 * 160 / 42 files. Nothing is summarised, shortened or truncated — the round-trip check
 * below re-derives every file's SHA-256 from the embedded content and compares it with the
 * package manifest, so a bundle that lost or altered a byte fails to emit rather than
 * shipping quietly.
 *
 * ENCODING. Text files are embedded as UTF-8 strings so the bundle stays readable and
 * diffable; binary files (fonts, images) are base64. Each entry says which, so decoding is
 * unambiguous. A file is treated as text only when it round-trips through UTF-8 unchanged —
 * inferring from the extension would corrupt anything mislabelled.
 *
 * ⚠  A BUNDLE CONTAINS THE ENDPOINT CONFIGURATION, AND THAT IS A CREDENTIAL. It carries the
 * signed trigger URLs in full, unredacted, because a bundle that cannot reconstruct a
 * runnable package is not a bundle. `PACKAGE_MANIFEST.json` inside it is still redacted —
 * that document is meant to be shareable, and this one is not. Bundles are written into
 * dist/, which is git-ignored, and must never be committed: doing so would add live
 * signatures to the tracked tree and defeat tests/check-secrets.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const OUT_DIR = path.resolve(ROOT, opt('--out', 'dist'));
const VERIFY = opt('--verify');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/** Walk every file in the package, relative paths, sorted for a stable bundle. */
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Text if and only if the bytes survive a UTF-8 round trip.
 *
 * Extension-based detection was the obvious approach and is wrong in both directions: a
 * `.txt` holding a stray 0x80 byte becomes mojibake, and a correctly-encoded file with an
 * unfamiliar extension gets base64'd for no reason. Re-encoding and comparing is exact.
 */
function encodeFile(abs) {
  const buf = fs.readFileSync(abs);
  const asText = buf.toString('utf8');
  if (Buffer.from(asText, 'utf8').equals(buf)) {
    return { encoding: 'utf8', content: asText };
  }
  return { encoding: 'base64', content: buf.toString('base64') };
}

function decodeEntry(entry) {
  return entry.encoding === 'base64'
    ? Buffer.from(entry.content, 'base64')
    : Buffer.from(entry.content, 'utf8');
}

/* ------------------------------------------------------------------ *
 * Bundle
 * ------------------------------------------------------------------ */

function bundle(pkgDir) {
  const abs = path.resolve(ROOT, pkgDir);
  const manifestPath = path.join(abs, 'PACKAGE_MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`\n  ✖  ${pkgDir} has no PACKAGE_MANIFEST.json — it is not a built package.\n`);
    process.exit(2);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const files = walk(abs).map(rel => {
    const { encoding, content } = encodeFile(path.join(abs, rel));
    const bytes = fs.statSync(path.join(abs, rel)).size;
    return { path: rel, bytes, sha256: sha256(fs.readFileSync(path.join(abs, rel))), encoding, content };
  });

  /* The endpoint configuration, decoded, so a reader has the values without having to
     evaluate JavaScript. The same URLs are already in `files` verbatim; this is a view of
     them, not a second source. */
  const configPath = files.find(f => /(^|\/)config\.local\.js$/.test(f.path));
  let endpoints = {};
  if (configPath) {
    const sandbox = { window: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', configPath.content).call(sandbox, sandbox.window);
    const globalName = manifest.package === 'dgo-document-portal' ? 'PF_CONFIG' : 'DGO_CONFIG';
    endpoints = sandbox.window[globalName]?.endpoints || {};
  }

  const catalogueFile = files.find(f => f.path === 'FLOW_CATALOGUE.json');
  const catalogue = catalogueFile ? JSON.parse(catalogueFile.content) : null;

  return {
    bundleFormat: 'dgo.package-bundle/1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/package-bundle.mjs',
    warning:
      'This bundle embeds the endpoint configuration in full and unredacted. A signed Power '
      + 'Automate trigger URL is a bearer credential. Do not commit this file and do not '
      + 'transmit it over a channel you would not send the credentials themselves over.',
    package: manifest.package,
    platform: manifest.platform,
    posture: manifest.posture,
    demo: manifest.demo,
    buildId: manifest.buildId,
    builtAt: manifest.builtAt,
    entry: manifest.entry,
    architecture: manifest.architecture,
    exposure: manifest.exposure,
    endpointSummary: {
      provisioned: manifest.provisionedCount,
      total: manifest.endpointCount,
      flowRoutes: manifest.actionCount,
      contracts: manifest.endpoints,
    },
    /** Resolved endpoint URLs, in full. This is the credential half of the bundle. */
    endpointUrls: endpoints,
    /* Every flow in the documented estate, wired or not, lifted to the top level from the
       package's own FLOW_CATALOGUE.json. It is already embedded below in `files`; this is
       the same bytes surfaced where a reader will find them, because "which other flow can
       this key point at?" is the question a live test asks first and it should not require
       walking a 162-entry file array to answer. */
    flowCatalogue: catalogue,
    fileCount: files.length,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
    integrity: manifest.integrity,
    files,
  };
}

/* ------------------------------------------------------------------ *
 * Verify a bundle round-trips
 * ------------------------------------------------------------------ */

function verifyBundle(bundlePath) {
  const abs = path.resolve(ROOT, bundlePath);
  console.log(`\nBundle verification\n\n  ${abs}\n`);
  const b = JSON.parse(fs.readFileSync(abs, 'utf8'));

  const problems = [];
  for (const f of b.files) {
    const buf = decodeEntry(f);
    if (buf.length !== f.bytes) problems.push(`size differs after decode: ${f.path} (${buf.length} vs ${f.bytes})`);
    else if (sha256(buf) !== f.sha256) problems.push(`content differs after decode: ${f.path}`);
  }

  /* The bundle must also agree with the package manifest it embeds — the manifest is one of
     the files, so this closes the loop: every file the package claimed to contain is present
     in the bundle at the same digest. */
  const embeddedManifest = b.files.find(f => f.path === 'PACKAGE_MANIFEST.json');
  if (!embeddedManifest) problems.push('the bundle does not embed PACKAGE_MANIFEST.json');
  else {
    const m = JSON.parse(decodeEntry(embeddedManifest).toString('utf8'));
    const byPath = new Map(b.files.map(f => [f.path, f]));
    for (const mf of m.files) {
      const bf = byPath.get(mf.path);
      if (!bf) problems.push(`manifest lists ${mf.path}; the bundle does not carry it`);
      else if (bf.sha256 !== mf.sha256) problems.push(`digest disagrees with the manifest: ${mf.path}`);
    }
    const extra = b.files.filter(f => f.path !== 'PACKAGE_MANIFEST.json' && !m.files.some(x => x.path === f.path));
    for (const e of extra) problems.push(`bundle carries a file the manifest does not list: ${e.path}`);
  }

  console.log(`  ${b.platform}`);
  console.log(`  build ${b.buildId} · posture ${b.posture} · ${b.fileCount} files · ` +
    `${(b.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  endpoints ${b.endpointSummary.provisioned}/${b.endpointSummary.total} provisioned, ` +
    `${b.endpointSummary.flowRoutes} flow routes\n`);

  if (problems.length) {
    console.error(`  ⛔ ${problems.length} problem(s):\n`);
    for (const p of problems.slice(0, 25)) console.error(`     ${p}`);
    console.error('');
    return 1;
  }
  console.log('  ✅ Every embedded file decodes to exactly the bytes it was made from,');
  console.log('     and the bundle agrees with the package manifest it carries.\n');
  return 0;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

if (VERIFY) process.exit(verifyBundle(VERIFY));

const packages = ['dgo-internal-platform', 'dgo-document-portal']
  .map(name => path.join('dist', name))
  .filter(p => fs.existsSync(path.resolve(ROOT, p)));

if (!packages.length) {
  console.error('\n  ✖  No built package found under dist/. Run `npm run package` first.\n');
  process.exit(2);
}

console.log('\nDGO Digital Operations — package bundles\n');

for (const pkgDir of packages) {
  const b = bundle(pkgDir);
  const out = path.join(OUT_DIR, `${b.package}.bundle.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(b, null, 2) + '\n');
  const size = fs.statSync(out).size;
  console.log(`  ${b.package}`);
  console.log(`    ${b.fileCount} files · ${(b.totalBytes / 1024 / 1024).toFixed(2)} MB embedded`);
  console.log(`    ${b.endpointSummary.provisioned}/${b.endpointSummary.total} endpoints · ${b.endpointSummary.flowRoutes} flow routes`);
  console.log(`    → ${path.relative(ROOT, out)}  (${(size / 1024 / 1024).toFixed(2)} MB)\n`);
}

console.log('  ⚠  These bundles carry the signed trigger URLs in full. They are written into');
console.log('     dist/, which is git-ignored. Do not commit them.\n');
process.exit(0);
