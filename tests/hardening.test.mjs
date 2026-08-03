#!/usr/bin/env node
/**
 * Hardening regressions.
 *
 * Every case corresponds to a finding in docs/forensic/dd2e909/findings.json and is written
 * as a negative control: revert the fix and the matching case fails. These guard changes
 * that are easy to undo by accident — a default restored, a sandbox attribute dropped, a
 * convenient entry added back to a precache list.
 *
 * Run: node tests/hardening.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
let passed = 0, failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? `\n       ${detail}` : ''}`); }
};

console.log('\nHardening\n');

/* ---------------------------------------------------------------- F-023
   The ECM Activity Hub defaulted its backend to a personal Cloudflare Workers
   subdomain while ENV read "PROD". config.local.js is git-ignored, so every
   fresh clone used that default. It must fall back to DEMO mode instead. */
console.log('F-023 · ECM Activity Hub backend default');
{
  const { CONFIG } = await import('../ECM_ActivityHub_Portal/js/core/config.js');
  ok('API_URL is empty with no override supplied', CONFIG.API_URL === '',
     `got ${JSON.stringify(CONFIG.API_URL)}`);
  const src = read('ECM_ActivityHub_Portal/js/core/config.js');
  ok('no workers.dev host remains in the module', !/workers\.dev/.test(src));
  ok('no hardcoded https default remains on API_URL',
     !/API_URL:\s*_override\.API_URL\s*\|\|\s*["']https?:/.test(src));
}

/* ---------------------------------------------------------------- F-014 / F-016
   srcdoc content is live HTML: escaping protects the attribute boundary, not the
   content. The sandbox attribute is the only control that stops scripts running,
   so every srcdoc iframe in the tree must carry one. */
console.log('\nF-014 / F-016 · every srcdoc iframe is sandboxed');
{
  const files = ['shared/components.js', 'modules/lookup.js', 'modules/correspondence-email.js'];
  let frames = 0;
  for (const f of files) {
    for (const tag of read(f).match(/<iframe[^>]*srcdoc=[^>]*>/g) || []) {
      frames++;
      const where = `${f}: ${tag.slice(0, 70)}…`;
      ok(`sandbox present — ${f}`, /\ssandbox=/.test(tag), where);
      ok(`allow-scripts absent — ${f}`, !/allow-scripts/.test(tag), where);
      ok(`allow-same-origin absent — ${f}`, !/allow-same-origin/.test(tag), where);
    }
  }
  ok('all srcdoc frames were found and checked', frames >= 4, `found ${frames}, expected >= 4`);
}

/* ---------------------------------------------------------------- F-020
   The service worker precached the file holding the workflow endpoints, writing
   them durably into Cache Storage, and precached the staff console for offline
   use. Neither belongs in the install-time shell. */
console.log('\nF-020 · service worker precache');
{
  const sw = read('document-portal/sw.js');
  const shell = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [, ''])[1];
  ok('js/data.js is not precached', !/data\.js/.test(shell));
  ok('admin.html is not precached', !/admin\.html/.test(shell));
  ok('the cache version was bumped past v2', !/CACHE\s*=\s*'nitda-portal-v2'/.test(sw));
  ok('rotation ordering is documented next to CACHE', /rotat/i.test(sw));
}

/* ---------------------------------------------------------------- F-024
   A mutable version tag resolves to whatever the registry publishes at load
   time, which is arbitrary third-party JavaScript in this origin. */
console.log('\nF-024 · remote script pinning');
{
  const html = read('ECM_ActivityHub_Portal/index.html');
  const remotes = html.match(/<script[^>]*src="https?:\/\/[^"]*"[^>]*>/g) || [];
  ok('remote script tags were found to check', remotes.length >= 2, `found ${remotes.length}`);
  for (const tag of remotes) {
    const src = (tag.match(/src="([^"]+)"/) || [, ''])[1];
    ok(`no mutable @latest tag — ${src.slice(0, 52)}`, !/@latest/.test(src));
  }
}

/* ---------------------------------------------------------------- F-017
   The secret scanner skipped every file containing a NUL byte, so the archive
   was never read. Nine signatures lived only there. */
console.log('\nF-017 · secret scanner reads archive members');
{
  const s = read('tests/check-secrets.mjs');
  ok('archives are routed to a member scan', /\\.zip\$\/i\.test\(file\)/.test(s) || /zip/i.test(s));
  ok('a signaturesInArchive path exists', /signaturesInArchive/.test(s));
  ok('an unscannable archive fails rather than passing silently',
     /unscannable/.test(s) && /unscannable\.length \? 1 : 0|\|\| unscannable\.length/.test(s));
  ok('the archive is baselined so its scope stays visible',
     /ECM_DOCS_DEV\.zip/.test(read('tests/secrets-baseline.txt')));
}

/* ---------------------------------------------------------------- F-028
   The portal accepted five attachments and transmitted one, substituting an
   empty payload when that one exceeded 4 MB while still reporting success.
   Every attachment must now be dispatched, and anything undeliverable must be
   queued and surfaced rather than silently emptied. */
console.log('\nF-028 · document portal transmits every attachment');
{
  const s = read('document-portal/js/submit.js');
  const fn = (s.match(/function dispatchToWorkflow[\s\S]*?\n  \}/) || [''])[0];

  ok('dispatchToWorkflow was located', fn.length > 200);
  ok('no single-file dispatch remains', !/var primary = files\[0\]/.test(fn));
  ok('it iterates the attachment list', /files\.length/.test(fn) && /files\[index\]|files\[at\]/.test(fn));
  ok('oversize attachments are queued, not emptied',
     /PF\.outbox\.queue/.test(fn),
     'an attachment that cannot be inlined must reach the outbox');
  ok('undelivered attachments are written to the audit trail', /PF\.store\.log/.test(fn));
  ok('the submitter is told when something did not go', /PF\.toast/.test(fn));
  ok('part metadata lets N calls reassemble into one submission',
     /PartNumber/.test(fn) && /PartCount/.test(fn));

  // The old bug in one line: an early return that sent '' for a too-large file.
  ok('no early return substitutes an empty payload for an oversize file',
     !/size > 4 \* 1048576\) return send\(''\)/.test(s));
}

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
