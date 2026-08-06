#!/usr/bin/env node
/**
 * Secret ratchet for Power Automate SAS signatures.
 *
 * A SAS-signed Power Automate URL is a bearer credential: possession alone authorizes
 * invocation of the flow. This check has two jobs, and they are deliberately different:
 *
 *   1. FAIL on any tracked file that carries a signature and is not in the baseline.
 *      That is a new leak and must never merge.
 *   2. REPORT the baselined files, which are the ones the capability assessment recorded
 *      as already affected (gap G-03). They cannot simply be scrubbed — deleting a file
 *      revokes nothing. Each signature must be ROTATED in Power Automate first; only then
 *      is removing it from the tree meaningful.
 *
 * The baseline may only shrink. If a baselined file no longer contains a signature, this
 * says so and fails, so the list cannot silently drift out of date.
 *
 * Usage:  node tests/check-secrets.mjs
 * Exit:   0 = no new leaks and the baseline is accurate, 1 = otherwise
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'tests', 'secrets-baseline.txt');

/** Signature-shaped: `sig=` plus >=20 URL-safe base64 chars. Skips `sig=ROTATE_ME`. */
const SIG = /sig=[A-Za-z0-9_-]{20,}/;

/* docs/reference/foundational/ is the curated record of the DEPLOYED flow estate — its
   whole purpose is to document the live flows verbatim, trigger URLs included, and it was
   committed intact by explicit decision (D5, 2026-08-04). Scanning it would turn this
   ratchet permanently red, and a permanently red ratchet is one nobody reads. The ratchet
   therefore guards the APPLICATION tree: a signature appearing in shipped code or config
   still fails the build. Rotation of the documented estate is scheduled platform work,
   not a per-commit gate. */
const REFERENCE_CORPUS = 'docs/reference/foundational/';

const allTracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const trackedFiles = allTracked.filter(f => !f.startsWith(REFERENCE_CORPUS));

/**
 * How much this ratchet is NOT looking at.
 *
 * The exclusion above is deliberate and correct, but the success message was not: this
 * printed "No SAS signatures in tracked files" while 55 of them sat in 28 tracked files
 * one directory away. Only `npm run commission` reported the real figure, so the number a
 * reader saw depended on which command they happened to run — and the one wired into CI as
 * "Secret scan" was the one that said zero. A control may narrow its scope. It may not
 * describe the narrowed result as the whole result.
 */
function excludedExposure() {
  const files = [];
  const distinct = new Set();
  for (const f of allTracked.filter(f => f.startsWith(REFERENCE_CORPUS))) {
    let buf;
    try {
      const st = fs.statSync(path.join(ROOT, f));
      if (!st.isFile() || st.size > 512 * 1024 * 1024) continue;
      buf = fs.readFileSync(path.join(ROOT, f));
    } catch { continue; }
    if (buf.includes(0)) continue;
    const found = buf.toString('utf8').match(ALL);
    if (!found) continue;
    files.push(f);
    found.forEach(v => distinct.add(v));
  }
  return { files: files.length, distinct: distinct.size };
}

const ALL = /sig=[A-Za-z0-9_-]{20,}/g;

/**
 * Signatures inside a zip archive.
 *
 * The NUL-byte skip below is correct for images and fonts, but an archive is not opaque —
 * it is text in a container. Skipping it meant ECM_DOCS_DEV.zip was never scanned by
 * anything, and it holds 31 distinct signatures across 18 of its 837 members. Nine of those
 * appear in no commit and no tracked text file, so no audit could have found them.
 *
 * Requires `unzip` on PATH. If it is absent the archive is reported as UNSCANNABLE rather
 * than silently passing — a control that cannot run must say so, not return green.
 */
function signaturesInArchive(abs) {
  let listing;
  try {
    listing = execFileSync('unzip', ['-Z1', abs], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8').split('\n').filter(Boolean);
  } catch {
    return { unscannable: true, found: [] };
  }
  const found = [];
  for (const member of listing) {
    if (member.endsWith('/')) continue;
    if (/\.(png|jpe?g|gif|ico|svg|woff2?|ttf|eot|pdf|docx|xlsx|pptx|zip)$/i.test(member)) continue;
    try {
      const raw = execFileSync('unzip', ['-p', abs, member], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      if (raw.includes(0)) continue;
      found.push(...(raw.toString('utf8').match(ALL) || []));
    } catch { /* unreadable member — skip, the listing above is the record */ }
  }
  return { unscannable: false, found };
}

const affected = [];
const unscannable = [];
const globalDistinct = new Set(); // deduplicated across files — the figure that matters for rotation
for (const file of trackedFiles) {
  const abs = path.join(ROOT, file);
  let buf;
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > 512 * 1024 * 1024) continue;
    buf = fs.readFileSync(abs);
  } catch {
    continue;
  }

  if (/\.zip$/i.test(file)) {
    const { unscannable: bad, found } = signaturesInArchive(abs);
    if (bad) { unscannable.push(file); continue; }
    if (!found.length) continue;
    found.forEach(v => globalDistinct.add(v));
    affected.push({ file, distinct: new Set(found).size, archive: true });
    continue;
  }

  if (buf.includes(0)) continue; // binary and not an archive
  const text = buf.toString('utf8');
  if (!SIG.test(text)) continue;
  const found = text.match(ALL) || [];
  found.forEach(v => globalDistinct.add(v));
  affected.push({ file, distinct: new Set(found).size });
}

const baseline = fs.existsSync(BASELINE)
  ? new Set(fs.readFileSync(BASELINE, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')))
  : new Set();

const affectedPaths = new Set(affected.map(a => a.file));
const added = affected.filter(a => !baseline.has(a.file));
const cleared = [...baseline].filter(f => !affectedPaths.has(f)).sort();

// Per-file counts sum higher than the global figure because the same signature appears in
// several files. Rotation is per signature, so the global count is the one that matters.
const totalDistinct = globalDistinct.size;

if (added.length) {
  console.error('\n❌ NEW files carrying a Power Automate SAS signature:\n');
  for (const a of added) console.error(`   ${a.file}  (${a.distinct} distinct)`);
  console.error('\nA SAS URL is a credential. Rotate it in Power Automate and keep it out of');
  console.error('the tree — use config/config.local.js, which is git-ignored.\n');
}

if (cleared.length) {
  console.error('\n❌ Baseline is stale — these files no longer carry a signature:\n');
  for (const f of cleared) console.error(`   ${f}`);
  console.error('\nRemove them from tests/secrets-baseline.txt so the ratchet stays tight.\n');
}

if (affected.length && !added.length && !cleared.length) {
  console.log(
    `⚠️  ${affected.length} baselined file(s) carry ${totalDistinct} globally distinct SAS signature(s).`
  );
  console.log('   These are gap G-03 in docs/audits/CAPABILITY_ASSESSMENT_R11.6.md and remain OUTSTANDING.');
  console.log('   Rotation in Power Automate must happen before removal — deleting a file');
  console.log('   revokes nothing. Not failing the build on already-known exposure.\n');
  for (const a of affected) console.log(`   ${a.file}  (${a.distinct} distinct)`);
}

if (unscannable.length) {
  console.error('\n❌ Archive(s) could not be scanned — `unzip` is not available:\n');
  for (const f of unscannable) console.error(`   ${f}`);
  console.error('\nA control that cannot run must not report green. Install unzip, or remove');
  console.error('the archive from the tree.\n');
}

if (!affected.length && !cleared.length && !unscannable.length) {
  console.log('✅ No SAS signatures in the application tree.');
}

/* Printed on every run, pass or fail. The exposure this ratchet excludes is real, is gap
   G-03, and is the thing that must be rotated before any production endpoint is minted —
   so it is stated here rather than left to a different command nobody ran. */
const excluded = excludedExposure();
if (excluded.files) {
  console.log(
    `\nℹ️  NOT IN SCOPE: ${excluded.distinct} distinct signature(s) across ${excluded.files} file(s) ` +
    `under ${REFERENCE_CORPUS}`);
  console.log('   That corpus documents the deployed flow estate verbatim by explicit decision (D5),');
  console.log('   so scanning it would hold this ratchet permanently red. The exposure is not');
  console.log('   thereby closed: anyone who can read this repository holds every one of those');
  console.log('   signatures, and deleting a file revokes nothing.');
  console.log('   Gap G-03 — rotate each in Power Automate before minting production endpoints.');
}

process.exit(added.length || cleared.length || unscannable.length ? 1 : 0);
