#!/usr/bin/env node
/**
 * Signed trigger URLs in tracked files.
 *
 * A Power Automate `sig=` trigger URL is a bearer credential: possession is authorisation.
 * There is no user, no token exchange and no expiry to rely on — whoever holds the string
 * can run the flow.
 *
 * `config/endpoints.config.js` was sanitised long ago and the real URLs now live in
 * git-ignored `config/config.local.js`, so the source tree reads clean. It is clean. The
 * exposure that remains is inside a container file: `ECM_DOCS_DEV.zip`, tracked, 16.7 MB,
 * carrying signed URLs for 25 distinct workflows — more than the rest of the repository has
 * ever held at once. A scanner that skips archives declares this repository safe and is
 * wrong about the only thing that is not.
 *
 * This suite therefore looks INSIDE archives, and pins the exposure to an explicit
 * allow-list so that:
 *
 *   - a NEW leak in any other tracked file fails the build immediately, and
 *   - the known archive cannot be quietly forgotten, because the allowance names it and
 *     the expected count, and the test fails if that count grows.
 *
 * When the archive's disposition is settled the allowance is deleted and this suite asserts
 * zero. Note what it cannot assert: removing the file does NOT revoke the credentials, and
 * neither does rewriting history. Only regenerating the trigger URLs in Power Automate does.
 * See docs/cutover/FLOW_DECOMMISSION_INVENTORY.md.
 *
 * Run: node tests/secret-exposure.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventory, trackedFiles, SIGNED_URL } from '../scripts/flow-inventory.mjs';

let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n       ${e.message}`); }
};
const section = s => console.log(`\n${s}`);

/**
 * Known, accepted exposure. Each entry is a debt with a number attached, not a permission.
 *
 * `workflows` is asserted EXACTLY, not as a ceiling: a drop means the disposition moved and
 * the entry should be updated; a rise means new credentials were added to an archive that
 * was already the worst offender in the repository.
 */
const ALLOWED = [
  {
    file: 'ECM_DOCS_DEV.zip',
    workflows: 25,
    why: 'Reference archive; sole custodian of the BRD/FRD baseline and the flow contracts. '
       + 'Disposition open — see docs/cutover/ARCHIVE_DISPOSITION.md.',
  },
];

const rows = inventory({ trackedOnly: true });
const byContainer = new Map();
for (const r of rows) {
  for (const f of r.files) {
    const c = f.split('!')[0];
    if (!byContainer.has(c)) byContainer.set(c, new Set());
    byContainer.get(c).add(r.workflowId);
  }
}

console.log('\nSigned trigger URLs in tracked files');

section('No unaccounted exposure');

t('every tracked file carrying a signed URL is on the allow-list', () => {
  const allowed = new Set(ALLOWED.map(a => a.file));
  const surprises = [...byContainer.keys()].filter(f => !allowed.has(f));
  assert.deepEqual(surprises, [],
    `signed trigger URL(s) in unlisted file(s): ${surprises.join(', ')}. ` +
    'A signed URL is a credential — move it to config/config.local.js (git-ignored) ' +
    'and rotate the trigger in Power Automate, because the old one stays valid.');
});

for (const a of ALLOWED) {
  t(`${a.file} carries exactly ${a.workflows} workflows, no more`, () => {
    const found = byContainer.get(a.file);
    assert.ok(found, `${a.file} is on the allow-list but carries no signed URL — ` +
      'if its disposition was settled, delete the entry rather than leaving a stale debt.');
    assert.equal(found.size, a.workflows,
      `expected ${a.workflows}, found ${found.size}. ` +
      (found.size > a.workflows
        ? 'Credentials were ADDED to an archive that is already the largest exposure here.'
        : 'Exposure shrank — update the allow-list so the number stays honest.'));
  });
}

section('The source tree itself stays clean');

t('no signed URL in any tracked .js, .mjs, .json or .html', () => {
  const offenders = [...byContainer.keys()].filter(f => /\.(js|mjs|cjs|json|html)$/.test(f));
  assert.deepEqual(offenders, [],
    `source files must never hold a credential: ${offenders.join(', ')}`);
});

t('config/endpoints.config.js declares no URL at all', () => {
  const src = readFileSync(new URL('../config/endpoints.config.js', import.meta.url), 'utf8');
  assert.ok(!/https?:\/\/[^"'\s]*workflows\//.test(src),
    'endpoints.config.js must resolve URLs from window.DGO_CONFIG, never hold them');
  assert.match(src, /window\.DGO_CONFIG/, 'it must still read the runtime config');
});

t('config/config.local.js is git-ignored, not tracked', () => {
  const tracked = trackedFiles();
  assert.ok(!tracked.includes('config/config.local.js'),
    'the file that legitimately holds real URLs must never be committed');
});

section('The detector itself');

t('it matches a full signed trigger URL', () => {
  const sample = 'https://x.environment.api.powerplatform.com:443/powerautomate/automations/'
    + 'direct/workflows/0123456789abcdef0123456789abcdef/triggers/manual/paths/invoke'
    + '?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=' + 'A'.repeat(43);
  assert.ok([...sample.matchAll(SIGNED_URL)].length === 1);
});

t('it does NOT match a truncated illustration in documentation', () => {
  /* docs/forensic/dd2e909/00-provenance.md quotes `…&sig=<10 chars>…` to show the shape of
     the problem. That is documentation of a leak, not a leak; a detector that cannot tell
     the difference trains people to ignore it. */
  const elided = 'API_GET: "https://…/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/…&sig=abcdefghij…"';
  assert.equal([...elided.matchAll(SIGNED_URL)].length, 0);
});

t('it does not fire on the word sig in prose', () => {
  assert.equal([...'the request carries sig= in its query string'.matchAll(SIGNED_URL)].length, 0);
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
