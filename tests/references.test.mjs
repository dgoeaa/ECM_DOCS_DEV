#!/usr/bin/env node
/**
 * Every reference in the tracked tree resolves to something that exists.
 *
 * `npm run test:links` crawls the two applications with a browser-shaped link checker. It
 * needs a running server, reaches external hosts, and is `continue-on-error` in CI for that
 * reason — a flaky CDN must not block a merge. The consequence is that nothing blocking
 * ever checked the documentation, and the documentation is where the broken references
 * actually were: an audit citing a tree that was retired, a README pointing at a script
 * that was renamed, a deployment procedure linking a file that moved.
 *
 * This is the blocking half. No server, no network, no dependencies: it reads the tracked
 * files and resolves every relative reference on disk. It is deterministic, runs in under a
 * second offline, and it fails the build.
 *
 * The two checks are complementary and neither replaces the other. This one cannot tell you
 * a CDN went away; the crawler cannot tell you a markdown link in `docs/` is dangling.
 *
 * Run: node tests/references.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The harvest is excluded, and only the harvest.
 *
 * `docs/reference/foundational/` is raw material kept for evidence — vendor HTML exports,
 * canvas dumps, SPA snapshots — full of references to hosts, files and trees that were
 * never part of this repository. Checking it would report hundreds of dangling references
 * that are correct, because a verbatim record of something else is supposed to point at
 * something else. `docs/README.md` classifies it as *Harvest: untrusted, prefer the
 * contract over the sample*, and this exclusion follows that classification rather than
 * inventing a new one.
 */
const EXCLUDED = ['docs/reference/foundational/'];

/** Markdown link and image targets. */
const MD_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/** HTML src/href, and CSS url() and @import. */
const HTML_REF = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.\-]*:/;

/** Is this a reference to a file in this repository? */
function isLocal(ref) {
  if (!ref) return false;
  if (HAS_SCHEME.test(ref)) return false;   // http:, mailto:, tel:, data:
  if (ref.startsWith('//')) return false;   // protocol-relative
  if (ref.startsWith('#')) return false;    // same-document anchor
  if (ref.startsWith('{{') || ref.includes('${')) return false; // templated at runtime
  return true;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 26 })
    .toString('utf8').split('\0').filter(Boolean)
    .filter(f => !EXCLUDED.some(p => f.startsWith(p)));
}

/**
 * Resolve a reference the way the thing that reads it would.
 *
 * Markdown and CSS resolve relative to the file. An HTML `src="/x"` resolves to the site
 * root, which for the portal is `document-portal/` and for the runtime is the repository
 * root — so a root-relative reference is checked against both, and counts as resolved if
 * either exists. Getting that wrong in the strict direction would report the portal's own
 * absolute paths as broken.
 */
function candidates(fromFile, ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return [];
  if (clean.startsWith('/')) {
    const rel = clean.slice(1);
    return [rel, path.join('document-portal', rel)];
  }
  const relativeToFile = path.normalize(path.join(path.dirname(fromFile), clean));

  /* A dynamic import inside a Playwright spec runs in the PAGE, not in Node: it is written
     `import('./core/state.js')` inside `page.evaluate()` and the browser resolves it
     against the served document, which is the site root. Resolving those against
     `tests/` reported 28 of them broken while every one loads correctly. The site root is
     therefore a second candidate for a browser-evaluated file. */
  if (/\.spec\.js$/.test(fromFile)) {
    return [relativeToFile, path.normalize(clean), path.join('document-portal', path.normalize(clean))];
  }
  return [relativeToFile];
}

let passed = 0;
const failures = [];
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failures.push(label); console.log(`  ❌ ${label}\n       ${e.message}`); }
};

console.log('\nReference integrity');

const files = trackedFiles();
const broken = [];
let checked = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!['.md', '.html', '.css', '.js', '.mjs'].includes(ext)) continue;

  let text;
  try { text = fs.readFileSync(path.join(ROOT, file), 'utf8'); } catch { continue; }

  const refs = [];
  if (ext === '.md') {
    for (const m of text.matchAll(MD_LINK)) refs.push(m[1]);
  } else if (ext === '.html') {
    for (const m of text.matchAll(HTML_REF)) refs.push(m[1]);
    for (const m of text.matchAll(CSS_URL)) refs.push(m[1]);
  } else if (ext === '.css') {
    for (const m of text.matchAll(CSS_URL)) refs.push(m[1]);
    for (const m of text.matchAll(/@import\s+["']([^"']+)["']/g)) refs.push(m[1]);
  } else {
    /* JS: only explicitly-relative module specifiers. `tests/check-imports.mjs` already
       walks the runtime graph from its entry points; this catches the modules that graph
       never reaches, such as a script importing a helper that was renamed. */
    for (const m of text.matchAll(/\bfrom\s*['"](\.[^'"\n]+)['"]/g)) refs.push(m[1]);
    for (const m of text.matchAll(/\bimport\s*\(\s*['"](\.[^'"\n]+)['"]\s*\)/g)) refs.push(m[1]);
  }

  for (const ref of refs) {
    if (!isLocal(ref)) continue;
    /* The deploy-time endpoint configuration is absent by design in a clone — its tag
       carries onerror="void 0" and `npm run package` provisions it into a delivered
       package. A miss here is the intended state, not a broken reference. */
    if (/config\.local\.js$/.test(ref)) continue;
    checked++;
    const options = candidates(file, ref);
    if (!options.some(c => c && !c.startsWith('..') && fs.existsSync(path.join(ROOT, c)))) {
      broken.push({ file, ref });
    }
  }
}

t(`every relative reference resolves on disk (${checked} across ${files.length} tracked files)`, () => {
  if (broken.length) {
    const detail = broken.slice(0, 20).map(b => `${b.file} → ${b.ref}`).join('\n       ');
    throw new Error(`${broken.length} broken:\n       ${detail}` +
      (broken.length > 20 ? `\n       … and ${broken.length - 20} more` : ''));
  }
});

/* A guard on the guard. If the extraction silently stopped matching — a regex edited, an
   extension dropped — this suite would pass by checking nothing, which is the failure mode
   it exists to prevent elsewhere. */
t('the checker is actually reading references', () => {
  if (checked < 200) throw new Error(`only ${checked} references extracted; the matchers have stopped matching`);
});

t('the harvest is excluded deliberately, and it is the only exclusion', () => {
  if (EXCLUDED.length !== 1 || EXCLUDED[0] !== 'docs/reference/foundational/') {
    throw new Error(`exclusions have grown to: ${EXCLUDED.join(', ')} — each one is a place broken references can hide`);
  }
});

console.log(`\n${failures.length ? '❌' : '✅'} ${passed} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
