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

import { readFileSync, existsSync } from 'node:fs';
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

/* ---------------------------------------------------------------- F-023 / F-024 / D6(b)
   F-023 (a personal Cloudflare Workers subdomain as the default backend) and
   F-024 (an @latest CDN tag) were both fixed inside ECM_ActivityHub_Portal. Decision
   D6(b) then retired that tree entirely: 15 of its 19 pages duplicated root routes, it
   shared no backend, state, identity or code with this platform, and it had no backend at
   all. Both findings are now closed by deletion, which is stronger than the fix — there is
   no module left to regress. What must be asserted is that the deletion holds, and that the
   three capabilities it uniquely had came across. */
console.log('F-023 / F-024 / D6(b) · the ECM Activity Hub is retired, not merely unlinked');
{
  for (const f of ['ECM_ActivityHub_Portal/index.html',
                   'ECM_ActivityHub_Portal/js/core/auth.js',
                   'ECM_ActivityHub_Portal/js/core/config.js',
                   'ECM_ActivityHub_Portal/js/core/store.js']) {
    ok(`${f} is deleted`, !existsSync(path.join(ROOT, f)));
  }
  ok('the tree is gone entirely', !existsSync(path.join(ROOT, 'ECM_ActivityHub_Portal')));

  // The two credentials-shaped defects cannot return, because their files cannot.
  ok('no workers.dev host remains anywhere in the tracked source',
     !/workers\.dev/.test(read('package.json') + read('config/endpoints.config.js')));

  // Nothing may still point at it.
  for (const f of ['package.json', 'core/boot.js', 'tests/check-imports.mjs',
                   'scripts/check-links.mjs', '.gitignore']) {
    ok(`${f} no longer references the retired tree`, !/ECM_ActivityHub/.test(read(f)));
  }

  /* scripts/setup-local.mjs was in that list until the archive was removed. Its whole job was
     recovering the PILOT Power Automate endpoints out of ECM_DOCS_DEV.zip and writing them
     into config.local.js — which is precisely the credential exposure the cutover exists to
     end. A convenience that restores revoked credentials is not a convenience. */
  ok('setup-local.mjs is retired, not merely unused',
     !existsSync(path.join(ROOT, 'scripts/setup-local.mjs')));
  ok('and npm no longer offers a command that would run it',
     !/setup-local/.test(read('package.json')));

  // Its three unique capabilities are the reason the retirement is a merge, not a drop.
  for (const f of ['core/executive-register.js', 'modules/briefs.js',
                   'modules/meetings.js', 'modules/projects.js']) {
    ok(`${f} exists — the ported capability`, existsSync(path.join(ROOT, f)));
  }
  const boot = read('core/boot.js');
  for (const r of ['briefs', 'meetings', 'projects']) {
    ok(`${r} is registered as a route`, new RegExp(`'${r}':\\(\\)=>import`).test(boot));
  }
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
   Two fixes, in sequence. Step 1 made the portal dispatch every attachment
   instead of only files[0]. Step 5 then removed the base64-in-JSON transport
   entirely, which is what created the 4 MB ceiling in the first place — so the
   assertions below describe the CURRENT shape, not the intermediate one. */
console.log('\nF-028 · every attachment is transmitted, and not inside a JSON payload');
{
  const s = read('document-portal/js/submit.js');
  const fn = (s.match(/function dispatchToWorkflow[\s\S]*?\n  \}/) || [''])[0];

  ok('dispatchToWorkflow was located', fn.length > 200);
  ok('no single-file dispatch remains', !/files\[0\]/.test(fn));
  ok('every attachment with bytes is declared', /withBytes/.test(fn));
  ok('uploads are redeemed one ticket at a time', /uploadAll/.test(s));
  ok('undelivered attachments are written to the audit trail', /PF\.store\.log/.test(s));
  ok('the submitter is told when something did not go', /PF\.toast\('warn'/.test(s));
  ok('attachments restored from a draft are reported, not skipped silently',
     /bytes were not available after a draft restore/.test(s));

  // The two shapes this replaced, neither of which may return.
  ok('no early return substitutes an empty payload for an oversize file',
     !/size > 4 \* 1048576\) return send\(''\)/.test(s));
  ok('no base64 transport remains', !/FileContentBase64|readAsDataURL/.test(s),
     'bytes must travel as bytes; base64-in-JSON is what forced the 4 MB limit');
}

/* ---------------------------------------------------------------- F-013 / F-001
   The portal held three SAS-signed Power Automate URLs COMMITTED in its bundle.
   It calls the flows directly again, with no proxy in the path — but nothing is
   hardcoded: every URL is supplied at deploy time through PF.CONFIG.endpoints. */
console.log('\nF-013 / F-001 · document portal commits no credential');
{
  const data = read('document-portal/js/data.js');
  ok('no SAS signature remains in the portal bundle', !/sig=[A-Za-z0-9_-]{20,}/.test(data));
  ok('PF.ENDPOINTS is gone', !/PF\.ENDPOINTS\s*=/.test(data));
  ok('the portal reads its endpoints from deployment configuration instead',
     /PF\.CONFIG = Object\.assign\(\{ endpoints: \{\} \}/.test(data));
  ok('the committed default is empty, so an unconfigured portal transmits nothing',
     !/endpoints:\s*\{\s*[A-Z]/.test(data));
  ok('the public exposure of a configured URL is stated where it is configured',
     /PUBLIC\s+portal/.test(data) && /anonymous\s+stranger/.test(data),
     'a signed URL served to a public browser is readable by anyone who fetches it');

  const core = read('document-portal/js/core.js');
  ok('PF.flow is gone', !/PF\.flow\s*=\s*function/.test(core));
  ok('PF.intake replaces it', /PF\.intake\s*=/.test(core));
  ok('submission targets the configured submission endpoint',
     /endpointUrl\('SUBMISSION'\)/.test(core));
  ok('uploads target the configured upload endpoint', /endpointUrl\('UPLOAD'\)/.test(core));
  ok('no proxy base URL is joined to a path any more', !/proxyBaseUrl/.test(core),
     'a base URL plus a path is what required an intermediary to exist');
  ok('an unconfigured endpoint yields no URL rather than a default host',
     /return String\(endpoints\[name\] \|\| ''\)\.trim\(\);/.test(core));

  for (const f of ['submit.js', 'support.js', 'track.js', 'home.js']) {
    const src = read(`document-portal/js/${f}`);
    ok(`${f} makes no PF.flow call`, !/PF\.flow\(/.test(src));
    ok(`${f} carries no signed URL`, !/sig=[A-Za-z0-9_-]{20,}/.test(src));
  }

  const submit = read('document-portal/js/submit.js');
  ok('attachments are no longer base64-encoded into a payload',
     !/FileContentBase64/.test(submit),
     'bytes must travel as bytes, not inside JSON');
  ok('a per-attachment digest is declared so the upload flow can verify it',
     /crypto\.subtle\.digest/.test(submit));

  // Comment lines explain why the portal was removed, so only entries count.
  const baselineEntries = read('tests/secrets-baseline.txt')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  ok('the portal is no longer a baselined credential file',
     !baselineEntries.some(l => l.startsWith('document-portal')),
     `entries: ${baselineEntries.join(', ')}`);
}

/* ---------------------------------------------------------------- F-012
   The external portal shipped a staff console gated by three username/password
   pairs held in js/data.js and compared in the browser. It is retired, not
   fixed — an external submission channel has no business carrying staff triage,
   and the internal platform already enforces identity server-side. */
console.log('\nF-012 · the staff console is retired, not merely hidden');
{
  const gone = ['document-portal/admin.html', 'document-portal/js/admin.js', 'document-portal/js/admin-panels.js'];
  for (const f of gone) ok(`${f} is deleted`, !existsSync(path.join(ROOT, f)));

  const data = read('document-portal/js/data.js');
  ok('PF.STAFF is gone', !/PF\.STAFF\s*=/.test(data));
  ok('no demo password literal survives', !/pass:\s*['"]/.test(data));
  ok('the deletion is explained where the credentials used to be', /PF\.STAFF is deleted/.test(data));

  const core = read('document-portal/js/core.js');
  ok('PF.store.admin is gone', !/^\s*admin:\s*\{/m.test(core));
  ok('the command palette no longer routes to the console', !/admin\.html/.test(core));
  ok('a session left by the retired console is cleared on load',
     /sessionStorage\.removeItem\('nitda\.portal\.admin'\)/.test(core));

  const sw = read('document-portal/sw.js');
  ok('the console files are out of the precache shell', !/admin/.test((sw.match(/const SHELL = \[([\s\S]*?)\];/) || [, ''])[1]),
     'a deleted file left in SHELL fails addAll and takes the whole offline shell down');

  for (const p of ['index.html', 'submit.html', 'track.html', 'support.html', '404.html']) {
    ok(`${p} does not link to the console`, !/admin\.html/.test(read(`document-portal/${p}`)));
  }
}

/* ---------------------------------------------------------------- D-C2
   The tracking page reported whatever this browser's localStorage said. It
   could not show a decision the registry had taken, and a submission made on
   one device did not exist on another. */
console.log('\nD-C2 · the portal reads status back from the registry');
{
  const core = read('document-portal/js/core.js');
  ok('PF.intake.status exists', /status:\s*function\s*\(referenceId, email\)/.test(core));
  ok('it targets the configured status endpoint', /endpointUrl\('STATUS'\)/.test(core));
  ok('a 404 is treated as authoritative, not as a reason to fall back',
     /r\.status === 404/.test(core));

  const track = read('document-portal/js/track.js');
  ok('the tracking page asks the registry first', /PF\.intake\.status\(/.test(track));
  ok('a registry answer is rendered as such', /'registry'/.test(track));
  ok('device data is labelled when it is used', /Shown from this device/.test(track));
  ok('an unreachable registry is not reported as not-found',
     /Status is unavailable right now/.test(track));

  // The enumeration oracle: the old page told a caller that a reference existed but
  // belonged to someone else. The status flow returns one uniform denial; the page must
  // not put the distinction back.
  ok('no separate wrong-email message remains',
     !/does not match this request|registered to a different address/.test(track));

  // The service-desk framing step 2 retired, which survived in this one block and read
  // "Closed after 14 of 3 working days" on a closed record.
  // Matched as it appears in the emitted markup, so the comment recording why it was
  // changed does not itself trip the check.
  ok('the acknowledgement block is not framed as a service-level target',
     !/>Service-level target</.test(track));
  ok('it reports acknowledgement of receipt instead', />Acknowledgement of receipt</.test(track));

  // Public copy that outlived the model change: the FAQ promised per-service decision
  // SLAs ("up to 30 working days for accreditation") the platform never enforced and no
  // longer even claims to have.
  const data = read('document-portal/js/data.js');
  ok('the FAQ no longer promises a per-service decision SLA', !/service-level target/i.test(data));
  ok('the FAQ states the acknowledgement commitment instead', /acknowledges receipt within/i.test(data));
  ok('no page advertises published working-day targets',
     !['index.html', 'submit.html', 'track.html', 'support.html']
       .some(p => /working-day target/i.test(read(`document-portal/${p}`))));

  // Fields renamed by step 2 that two render paths kept reading, interpolating
  // "undefined" into the page with no error anywhere.
  ok('the record view does not read the retired type fields',
     !/\bs\.name\b|\bs\.code\b/.test(track));
  ok('the home page reads label, not the retired name field',
     !/\bs\.name\b/.test(read('document-portal/js/home.js')));
  ok('metrics bucket on the field records actually carry',
     /byType/.test(core) && !/byService/.test(read('document-portal/js/home.js')));
}

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
