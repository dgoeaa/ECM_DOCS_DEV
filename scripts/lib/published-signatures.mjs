/**
 * Every Power Automate signature committed to this repository, mapped to the files
 * carrying it.
 *
 * Two callers need this and must not disagree: `scripts/commission-check.mjs` refuses to
 * clear a deployment wired to a published signature, and `scripts/package.mjs` refuses to
 * build a package around one. A signature that is in the tree is disclosed to everyone who
 * can read the repository, so going live on it means going live on a credential that is
 * already held by people who were never granted it. Deleting the file revokes nothing —
 * only regenerating the trigger in Power Automate does.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const SIGNATURE = /sig=([A-Za-z0-9_-]{20,})/g;

/**
 * Tracked files, or null when this is not a git work tree.
 *
 * Running a gate on an exported or deployed copy is legitimate — arguably where you most
 * want it — so a missing `.git` must not crash. It must not silently pass either: without
 * the repository there is nothing to compare a wired signature against, and "could not
 * check" is a different claim from "checked, and it is clean".
 */
export function trackedFiles(root) {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8').split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/*
 * Chunked with an overlap, so a signature straddling a chunk boundary is still found.
 * Reading whole files was the obvious implementation and it was wrong: capping the read to
 * skip large ones silently excluded a 23 MB flow run record carrying a live signature, and
 * a scan that under-reports published credentials is worse than none because the gates
 * above it are trusted. Decoded as latin1 — signature characters are ASCII, and a
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
      for (const m of text.matchAll(SIGNATURE)) onMatch(m[1]);
      carry = text.slice(-OVERLAP);
    }
  } catch { /* unreadable — nothing to report */ }
  finally { fs.closeSync(fd); }
}

/** @returns {Map<string, string[]>} signature → the tracked files carrying it */
export function publishedSignatures(root, files) {
  const index = new Map();
  for (const f of files) {
    scanFile(path.join(root, f), sig => {
      if (!index.has(sig)) index.set(sig, []);
      const list = index.get(sig);
      if (!list.includes(f)) list.push(f);
    });
  }
  return index;
}

/**
 * Which of these endpoint values reuse a signature that is already published.
 * @param {object} values key → url
 * @param {Map<string,string[]>} published
 */
export function reusedSignatures(values, published) {
  const reused = [];
  for (const [key, url] of Object.entries(values || {})) {
    if (!url) continue;
    for (const m of String(url).matchAll(SIGNATURE)) {
      if (published.has(m[1])) reused.push({ key, files: published.get(m[1]) });
    }
  }
  return reused;
}
