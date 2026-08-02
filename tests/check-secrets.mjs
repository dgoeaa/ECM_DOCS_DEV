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
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'tests', 'secrets-baseline.txt');

/** Signature-shaped: `sig=` plus >=20 URL-safe base64 chars. Skips `sig=ROTATE_ME`. */
const SIG = /sig=[A-Za-z0-9_-]{20,}/;
const SIG_G = /sig=[A-Za-z0-9_-]{20,}/g;

/**
 * ZIP member extraction.
 *
 * A NUL byte used to end the scan for a file, which meant every tracked archive was
 * skipped outright — and the repository tracks ECM_DOCS_DEV.zip (17 MB), which carries
 * MORE distinct signatures than the entire rest of the tree. The check reported "2 files,
 * 4 signatures" while the archive quietly shipped dozens. A scanner with a hole that
 * large is worse than none, because it certifies the tree as clean.
 *
 * Deliberately dependency-free: walk the central directory, inflate each member, scan it.
 * Anything that cannot be parsed is reported rather than silently passed.
 */
function zipMembers(buf) {
  const out = [];
  // End of central directory record: signature 0x06054b50, scanned from the tail.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return out;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/') || compSize === 0) continue;
    try {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compSize);
      const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
      if (data) out.push({ name, text: data.toString('utf8') });
    } catch {
      /* unreadable member — the caller reports the archive as unscannable */
    }
  }
  return out;
}

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
  // Archives are scanned by inflating their members. A committed zip is exactly as
  // readable to an attacker as a committed .js file — GitHub serves it over HTTPS.
  if (buf.readUInt32LE?.(0) === 0x04034b50 || /\.(zip|docx|xlsx|pptx)$/i.test(file)) {
    const members = zipMembers(buf);
    if (members === null) {
      affected.push({ file, distinct: 0, note: 'archive could not be parsed — scan it manually' });
      continue;
    }
    const found = [];
    const inner = [];
    for (const m of members) {
      const hits = m.text.match(SIG_G);
      if (hits) { found.push(...hits); inner.push(m.name); }
    }
    if (!found.length) continue;
    found.forEach(v => globalDistinct.add(v));
    affected.push({ file, distinct: new Set(found).size, members: inner.length });
    continue;
  }
  if (buf.includes(0)) continue; // binary, non-archive
  const text = buf.toString('utf8');
  if (!SIG.test(text)) continue;
  const found = text.match(SIG_G) || [];
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
  for (const a of added) console.error(`   ${a.file}  (${a.distinct} distinct${a.members ? `, in ${a.members} archived file(s)` : ''}${a.note ? ` — ${a.note}` : ''})`);
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
  for (const a of affected) console.log(`   ${a.file}  (${a.distinct} distinct${a.members ? `, in ${a.members} archived file(s)` : ''}${a.note ? ` — ${a.note}` : ''})`);
}

if (!affected.length && !cleared.length) console.log('✅ No SAS signatures in tracked files.');

process.exit(added.length || cleared.length ? 1 : 0);
