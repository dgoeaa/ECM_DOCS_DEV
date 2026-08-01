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

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const affected = [];
const globalDistinct = new Set(); // deduplicated across files — the figure that matters for rotation
for (const file of trackedFiles) {
  const abs = path.join(ROOT, file);
  let buf;
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > 64 * 1024 * 1024) continue;
    buf = fs.readFileSync(abs);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // binary
  const text = buf.toString('utf8');
  if (!SIG.test(text)) continue;
  const found = text.match(/sig=[A-Za-z0-9_-]{20,}/g) || [];
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
  console.log('   These are gap G-03 in CAPABILITY_ASSESSMENT_R11.6.md and remain OUTSTANDING.');
  console.log('   Rotation in Power Automate must happen before removal — deleting a file');
  console.log('   revokes nothing. Not failing the build on already-known exposure.\n');
  for (const a of affected) console.log(`   ${a.file}  (${a.distinct} distinct)`);
}

if (!affected.length && !cleared.length) console.log('✅ No SAS signatures in tracked files.');

process.exit(added.length || cleared.length ? 1 : 0);
