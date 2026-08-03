#!/usr/bin/env node
/**
 * Static ES-module graph checker.
 *
 * Walks every relative `import` / `export … from` / `import()` specifier reachable
 * from each app's entry points and asserts the target exists on disk.
 *
 * This exists because 12 config modules were referenced by the runtime but never
 * committed. Because they are STATIC imports, resolution failed before core/boot.js
 * could run its try/catch — so no error was thrown, no `pageerror` fired, and the app
 * simply held its boot spinner forever. Nothing in the repository detected it.
 *
 * The check is deliberately dependency-free and does not need a browser, so it can run
 * as the very first CI step and fail fast.
 *
 * Usage:  node tests/check-imports.mjs [--json]
 * Exit:   0 = every relative import resolves, 1 = at least one is missing
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');

/** HTML entry points; their `<script type="module">` tags seed the graph. */
const HTML_ENTRIES = ['index.html'];

/** Extra roots that are loaded dynamically rather than via a module tag. */
const EXTRA_ENTRIES = [];

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function moduleScriptsFrom(htmlPath) {
  const abs = path.join(ROOT, htmlPath);
  if (!fs.existsSync(abs)) return [];
  const html = fs.readFileSync(abs, 'utf8');
  const out = [];
  // <script type="module" src="…">  (attribute order independent)
  const tagRe = /<script\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const attrs = m[1];
    if (!/type\s*=\s*["']module["']/i.test(attrs)) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!src || /^(https?:)?\/\//i.test(src)) continue;
    out.push(path.posix.normalize(path.posix.join(path.posix.dirname(htmlPath), src)));
  }
  return out;
}

/**
 * Match static and dynamic module specifiers.
 * Groups: 1 = `from '…'` / bare `import '…'`, 2 = `import('…')`.
 */
const SPEC_RE =
  /(?:^|[^\w$.])(?:import|export)\s*(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function scan(file, seen, missing, edges) {
  if (seen.has(file)) return;
  seen.add(file);

  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return; // reported by whoever referenced it
  const src = fs.readFileSync(abs, 'utf8');

  let m;
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[1] ?? m[2];
    if (!spec || !spec.startsWith('.')) continue; // bare specifiers are not our concern
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    edges.push([file, target]);
    if (fs.existsSync(path.join(ROOT, target))) scan(target, seen, missing, edges);
    else missing.push({ from: file, spec, target });
  }
}

const entries = [...HTML_ENTRIES.flatMap(moduleScriptsFrom), ...EXTRA_ENTRIES];
const seen = new Set();
const missing = [];
const edges = [];
entries.forEach(e => scan(e, seen, missing, edges));

// Group by missing target so one absent file is reported once, with all its importers.
const byTarget = new Map();
for (const x of missing) {
  if (!byTarget.has(x.target)) byTarget.set(x.target, new Set());
  byTarget.get(x.target).add(x.from);
}

const report = {
  entries,
  modulesReachable: seen.size,
  edges: edges.length,
  missingTargets: [...byTarget.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([target, from]) => ({ target, importedBy: [...from].sort() })),
  brokenEdges: missing.length,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`entry points     : ${entries.join(', ') || '(none found)'}`);
  console.log(`modules reachable: ${report.modulesReachable}`);
  console.log(`import edges     : ${report.edges}`);
  if (!report.missingTargets.length) {
    console.log('\n✅ every relative import resolves on disk');
  } else {
    console.log(`\n❌ ${report.missingTargets.length} missing target(s), ${report.brokenEdges} broken edge(s):\n`);
    for (const { target, importedBy } of report.missingTargets) {
      console.log(`  ${target}`);
      for (const f of importedBy) console.log(`      imported by ${f}`);
    }
    console.log('');
  }
}

if (!entries.length) {
  console.error('No module entry points found — check HTML_ENTRIES in this file.');
  process.exit(1);
}
process.exit(report.missingTargets.length ? 1 : 0);
