#!/usr/bin/env node
/**
 * Inventory every Power Automate workflow for which this repository holds a signed
 * (`sig=`) trigger URL — including inside tracked archives.
 *
 * WHY IT LOOKS INSIDE ZIPS
 * A signed trigger URL is a bearer credential: possession is authorisation. It does not
 * stop being one because it is inside a container file. `ECM_DOCS_DEV.zip` holds more
 * distinct signed URLs than the entire rest of the tree, so a scanner that skips archives
 * reports a clean repository and is wrong about the thing that matters most.
 *
 * WHAT IT DOES NOT DO
 * It does not print the `sig` tokens. Workflow IDs are identifiers — an administrator needs
 * them to find the flow — but reproducing the credential in a report just moves the leak.
 *
 * Usage:
 *   node scripts/flow-inventory.mjs          # human summary
 *   node scripts/flow-inventory.mjs --json   # machine-readable
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

/* Anchored on the workflow path so a bare `sig=` in prose or a truncated illustration in a
   document does not register as a credential. `docs/forensic/.../00-provenance.md` quotes a
   10-character fragment of a token to show the shape of the problem; that is documentation,
   not exposure, and this pattern correctly ignores it.

   The scheme and host are OPTIONAL. Captured flow run records store the trigger as a
   relative `X-Original-URL` header — `/workflows/<id>/triggers/manual/paths/invoke?…&sig=…`
   — with the host in a separate field. A scheme-anchored pattern misses those entirely.
   It happens not to change the count today (every relative occurrence names a workflow the
   absolute ones already cover) but a detector that only sees one of two shapes in which the
   credential is actually written down is one shape away from reporting a clean tree. */
export const SIGNED_URL =
  /(?:https?:\/\/[^"'\s<>\\)]*?)?\/workflows\/([a-f0-9]{32})\/triggers\/[^"'\s<>\\)]*?[?&]sig=([A-Za-z0-9_%-]{20,})/g;

const SKIP_DIRS = new Set(['node_modules', '.git', 'test-results', 'playwright-report', 'dist']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Files git actually tracks. Exposure is what a clone hands over, not what sits on a disk. */
export function trackedFiles(root = ROOT) {
  try {
    return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
      .split('\0').filter(Boolean);
  } catch { return []; }
}

function scanText(text, file, sink) {
  if (!text.includes('sig=')) return;
  for (const m of text.matchAll(SIGNED_URL)) {
    const [, workflowId, sig] = m;
    const e = sink.get(workflowId) || { workflowId, sigs: new Set(), files: new Set() };
    e.sigs.add(sig); e.files.add(file);
    sink.set(workflowId, e);
  }
}

function scanFile(path, display, sink) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return; }
  scanText(text, display, sink);
}

/** Expand a zip into a temp dir and scan its contents, attributing hits to `zip!inner/path`. */
function scanArchive(path, display, sink) {
  let dir;
  try {
    dir = mkdtempSync(join(tmpdir(), 'flowinv-'));
    execFileSync('unzip', ['-qq', '-o', path, '-d', dir], { stdio: 'ignore' });
    for (const f of walk(dir)) scanFile(f, `${display}!${relative(dir, f)}`, sink);
  } catch { /* an unreadable archive is reported by its absence, not by a crash */ }
  finally { if (dir) rmSync(dir, { recursive: true, force: true }); }
}

export function inventory({ root = ROOT, trackedOnly = true } = {}) {
  const sink = new Map();
  const files = trackedOnly
    ? trackedFiles(root).map(f => ({ abs: join(root, f), rel: f }))
    : walk(root).map(f => ({ abs: f, rel: relative(root, f) }));

  for (const { abs, rel } of files) {
    let st; try { st = statSync(abs); } catch { continue; }
    if (!st.isFile()) continue;
    if (rel.endsWith('.zip')) scanArchive(abs, rel, sink);
    else scanFile(abs, rel, sink);
  }
  return [...sink.values()]
    .map(e => ({ workflowId: e.workflowId, sigCount: e.sigs.size, files: [...e.files].sort() }))
    .sort((a, b) => a.workflowId.localeCompare(b.workflowId));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = inventory({ trackedOnly: !process.argv.includes('--all') });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const carriers = new Map();
    for (const r of rows) for (const f of r.files) {
      const container = f.split('!')[0];
      carriers.set(container, (carriers.get(container) || 0) + 1);
    }
    console.log(`${rows.length} workflow(s) with a signed trigger URL in tracked files\n`);
    for (const [file, n] of [...carriers].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}  ${file}`);
    }
    if (rows.length) {
      console.log('\nWorkflow IDs (identifiers, not secrets):');
      rows.forEach(r => console.log('  ' + r.workflowId));
      console.log('\nA signed trigger URL is a bearer credential. Deleting the file does not');
      console.log('revoke it and neither does rewriting history — only regenerating the');
      console.log('trigger URL in Power Automate does.');
      console.log('See docs/cutover/FLOW_DECOMMISSION_INVENTORY.md');
    }
  }
  process.exit(0);
}
