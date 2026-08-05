#!/usr/bin/env node
/**
 * Package portability — can the repository ZIP be opened on the device it was sent to?
 *
 * "Download ZIP" is how this platform is handed to people who will never run `git`, and
 * it had stopped working. Six run-record directories repeated the flow name and the
 * 33-character Power Automate run id in the directory AND in every file inside it, which
 * pushed 28 paths to 271 characters. Windows Explorer's ZIP handler, and most mobile
 * unzip apps, are still bound by the 260-character MAX_PATH: the extraction fails, and it
 * fails on the whole archive rather than on the offending file, so the symptom is
 * "I can't unzip it" with nothing to point at.
 *
 * The budget below is arithmetic, not taste:
 *
 *   260   MAX_PATH
 *  - 26   C:\Users\<user>\Downloads\
 *  - 55   ECM_DOCS_DEV-claude-platform-commissioning-live-5vnn9n/  (GitHub's ZIP prefix,
 *         which is the repo name plus the branch name with `/` turned into `-`)
 *  ----
 *   179   left for the repository-relative path — rounded down to 170.
 *
 * That prefix is why the limit bites here: a long branch name spends the budget before a
 * single repository path is counted. Extracting into Explorer's default "new folder named
 * after the ZIP" spends it twice, and no budget survives that — extract to a short
 * destination instead.
 *
 * The remaining rules are the ones that make an archive refuse to extract, or extract
 * wrongly, rather than merely look untidy. Spaces are not among them and are not checked.
 *
 * Run: node tests/package-portability.test.mjs
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MAX_PATH = 260;
export const ZIP_PREFIX_CHARS = 55;
export const DESTINATION_CHARS = 26;
export const MAX_REPO_PATH = 170;

/* Windows reserves these whatever the extension: `aux.json` is unwritable, and an
   extractor that hits one leaves the archive half-unpacked. */
const RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);
const WINDOWS_ILLEGAL = /[<>:"|?*]/;

/** What a clone — and therefore what `git archive` and GitHub's ZIP — actually contains. */
function trackedFiles() {
  return execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

/** Report the worst few offenders, not all of them — a wall of paths gets skimmed. */
const worst = (list, n = 5) => list.slice(0, n)
  .map(([len, p]) => `\n       ${len}  ${p}`).join('');

console.log('\nPackage portability');
const files = trackedFiles();

section(`The extraction budget (${files.length} tracked files)`);

t(`every path fits ${MAX_REPO_PATH} characters`, () => {
  const over = files.map(p => [p.length, p]).filter(([n]) => n > MAX_REPO_PATH)
    .sort((a, b) => b[0] - a[0]);
  assert.equal(over.length, 0,
    `${over.length} path(s) over ${MAX_REPO_PATH}; shorten them or the ZIP will not `
    + `extract on Windows:${worst(over)}`);
});

t('and therefore extracts inside MAX_PATH on Windows', () => {
  const budget = MAX_PATH - ZIP_PREFIX_CHARS - DESTINATION_CHARS;
  assert.ok(MAX_REPO_PATH <= budget,
    `the budget itself is wrong: ${MAX_REPO_PATH} > ${budget}`);
  const longest = Math.max(...files.map(p => p.length));
  assert.ok(longest + ZIP_PREFIX_CHARS + DESTINATION_CHARS <= MAX_PATH,
    `longest extracted path is ${longest + ZIP_PREFIX_CHARS + DESTINATION_CHARS}`);
});

section('Names an extractor refuses');

t('no Windows-illegal characters', () => {
  const bad = files.filter(p => p.split('/').some(s => WINDOWS_ILLEGAL.test(s)));
  assert.deepEqual(bad, [], 'these cannot be written on Windows at all');
});

t('no control characters', () => {
  const bad = files.filter(p => /[\u0000-\u001f\u007f]/.test(p));
  assert.deepEqual(bad, []);
});

t('no reserved device names', () => {
  const bad = files.filter(p => p.split('/')
    .some(s => RESERVED.has(s.split('.')[0].toUpperCase())));
  assert.deepEqual(bad, [], 'Windows refuses these regardless of extension');
});

t('no segment ends in a space or a dot', () => {
  /* Windows silently strips both, so `report .json ` and `report.json` land on the same
     file and the second one wins. Silent overwrite, not an error. */
  const bad = files.filter(p => p.split('/').some(s => s !== s.replace(/[ .]+$/, '')));
  assert.deepEqual(bad, []);
});

t('no segment exceeds 255 bytes', () => {
  const bad = files.flatMap(p => p.split('/'))
    .filter(s => Buffer.byteLength(s, 'utf8') > 255);
  assert.deepEqual(bad, [], 'the per-component limit on every filesystem that matters');
});

section('Names that extract wrongly');

t('no two paths collide when case is folded', () => {
  /* Windows and macOS default to case-insensitive. Two paths differing only in case
     extract over each other, and the archive is quietly missing a file. */
  const seen = new Map();
  const collisions = [];
  for (const p of files) {
    const k = p.toLowerCase();
    if (seen.has(k)) collisions.push([seen.get(k), p]); else seen.set(k, p);
  }
  assert.deepEqual(collisions, []);
});

t('every path is ASCII', () => {
  /* `git archive` sets the UTF-8 flag, so a correct extractor handles an em dash. Plenty
     of mobile unzip apps do not read the flag and write mojibake instead — and the repo's
     own Universal Filename Policy already says a-z0-9 (rule 3). */
  const bad = files.map(p => [p.length, p]).filter(([, p]) => /[^\x00-\x7f]/.test(p));
  assert.equal(bad.length, 0, `non-ASCII in:${worst(bad)}`);
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
