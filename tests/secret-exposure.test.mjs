#!/usr/bin/env node
/**
 * Signed trigger URLs, counted by WORKFLOW.
 *
 * RELATIONSHIP TO tests/check-secrets.mjs — READ THIS FIRST
 * `check-secrets.mjs` is the leak ratchet and remains so. It scans tracked files, expands
 * archives, fails on any signature outside `tests/secrets-baseline.txt`, and refuses to
 * report green if it cannot scan. Nothing here replaces it and this suite deliberately does
 * not re-implement it — two checkers failing on the same finding is noise, and noise is how
 * a control stops being read.
 *
 * What this adds is a different UNIT of measurement. `check-secrets.mjs` counts signatures;
 * this counts WORKFLOWS, because the thing an administrator deletes or regenerates is a flow,
 * not a signature. That distinction produced the two findings that shaped the cutover: only 8
 * of 25 workflows were reachable from the working configuration, so a checklist built by
 * reading `config/` would have missed 17; and six of them carry TWO valid signatures, so
 * regenerating once leaves the older one live.
 *
 * Both counts are now ZERO. `ECM_DOCS_DEV.zip` held every one of them and has been removed
 * from the tree, its irreplaceable content extracted to docs/reference/. This suite now
 * asserts that nothing has come back — see docs/cutover/FLOW_DECOMMISSION_INVENTORY.md for
 * the 25 flows that still need their triggers regenerated in Power Automate, which removing
 * the file did not do.
 *
 * WHAT NEITHER SUITE CAN ASSERT
 * That any of this is revoked. A signed trigger URL is a bearer credential; deleting the
 * file does not revoke it and neither does rewriting history. Only regenerating the trigger
 * in Power Automate does.
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
 * Known, accepted exposure — a debt with a number attached, not a permission.
 *
 * Both figures are asserted EXACTLY. A rise means credentials were added to the archive that
 * is already the largest exposure here; a fall means the disposition moved and this entry is
 * now stale. Neither should pass silently.
 */
const ALLOWED = [
  /* Empty, and that is the finding.
     ECM_DOCS_DEV.zip held signed trigger URLs for 25 workflows — the whole of this
     repository's plaintext credential exposure. Its irreplaceable content was extracted to
     docs/reference/ and the archive was removed from the working tree.
     Removing it does NOT revoke anything: the blob is still in git history, and a signed
     trigger URL stays valid until the trigger is regenerated in Power Automate. That work is
     docs/deployment/MINIMAL-PILOT.md §3a. This list going empty means HEAD stopped
     publishing them, not that they stopped working. */
];

const rows = inventory({ trackedOnly: true });
const byContainer = new Map();
for (const r of rows) {
  for (const f of r.files) {
    const c = f.split('!')[0];
    if (!byContainer.has(c)) byContainer.set(c, { workflows: new Set(), signatures: 0 });
    byContainer.get(c).workflows.add(r.workflowId);
  }
}
for (const r of rows) {
  const containers = new Set(r.files.map(f => f.split('!')[0]));
  for (const c of containers) byContainer.get(c).signatures += r.sigCount;
}

console.log('\nSigned trigger URLs, by workflow');

section('Nothing unaccounted for');

t('every tracked file carrying a signed URL is on the allow-list', () => {
  const allowed = new Set(ALLOWED.map(a => a.file));
  const surprises = [...byContainer.keys()].filter(f => !allowed.has(f));
  assert.deepEqual(surprises, [],
    `signed trigger URL(s) in unlisted file(s): ${surprises.join(', ')}. ` +
    'Move the URL to config/config.local.js (git-ignored) AND regenerate the trigger in ' +
    'Power Automate — the published one stays valid until you do.');
});

t('no tracked file carries a signed trigger URL at all', () => {
  assert.equal(byContainer.size, 0,
    `still carrying credentials: ${[...byContainer.keys()].join(', ')}`);
});

t('the allow-list is empty, and must stay that way', () => {
  /* An entry appearing here again means a credential was committed and then accepted rather
     than removed. Accepting one is how a repository ends up with twenty-five. */
  assert.deepEqual(ALLOWED, []);
});

section('The source tree itself stays clean');

t('no signed URL in any tracked .js, .mjs, .json or .html', () => {
  const offenders = [...byContainer.keys()].filter(f => /\.(js|mjs|cjs|json|html)$/.test(f));
  assert.deepEqual(offenders, [], `source files must never hold a credential: ${offenders.join(', ')}`);
});

t('config/endpoints.config.js declares no URL at all', () => {
  const src = readFileSync(new URL('../config/endpoints.config.js', import.meta.url), 'utf8');
  assert.ok(!/https?:\/\/[^"'\s]*workflows\//.test(src),
    'endpoints.config.js must resolve URLs from window.DGO_CONFIG, never hold them');
  assert.match(src, /window\.DGO_CONFIG/, 'and it must still read the runtime config');
});

t('config/config.local.js is git-ignored, not tracked', () => {
  assert.ok(!trackedFiles().includes('config/config.local.js'),
    'the file that legitimately holds real URLs must never be committed');
});

section('The detector');

const matches = s => [...s.matchAll(SIGNED_URL)].length;

t('it matches an absolute signed trigger URL', () => {
  assert.equal(matches('https://x.environment.api.powerplatform.com:443/powerautomate/'
    + 'automations/direct/workflows/0123456789abcdef0123456789abcdef/triggers/manual/paths/'
    + 'invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=' + 'A'.repeat(43)), 1);
});

t('it matches the RELATIVE form captured in flow run records', () => {
  /* Run records store the trigger as an `X-Original-URL` header with no scheme and the host
     in a separate field. A scheme-anchored pattern reports a clean tree while the credential
     sits in plain view. */
  assert.equal(matches('"X-Original-URL":"/workflows/c43388639d14452faef4ca3042a95b23/'
    + 'triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2ftriggers%2fmanual%2frun'
    + '&sv=1.0&sig=' + 'B'.repeat(43) + '"'), 1);
});

t('it does NOT match a truncated illustration in documentation', () => {
  /* docs/forensic/dd2e909/00-provenance.md quotes `…&sig=<10 chars>…` to show the shape of
     the problem. That is documentation of a leak, not a leak; a detector that cannot tell
     them apart trains people to ignore it. */
  assert.equal(matches(
    'API_GET: "https://…/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/…&sig=abcdefghij…"'), 0);
});

t('it does not fire on the word sig in prose', () => {
  assert.equal(matches('the request carries sig= in its query string'), 0);
});

t('it does not fire on a workflow path with no signature', () => {
  assert.equal(matches('/workflows/0123456789abcdef0123456789abcdef/triggers/manual/paths/invoke'), 0);
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
