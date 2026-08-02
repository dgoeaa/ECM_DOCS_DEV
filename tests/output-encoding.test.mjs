#!/usr/bin/env node
/**
 * Output-encoding regressions.
 *
 * Every case here corresponds to a finding in FORENSIC_ROOT_PLATFORM_AUDIT.md. They are
 * written as negative controls: each asserts that a specific attacker-supplied string does
 * NOT survive into generated markup intact. Remove the escaping and the matching case fails.
 *
 * Run: node tests/output-encoding.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;

const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const PAYLOAD = '<img src=x onerror=alert(1)>';
const ESCAPED = '&lt;img src=x onerror=alert(1)&gt;';

console.log('\nOutput encoding\n');

/* ---------------------------------------------------------------- R-C1
   Deep-link parameters reach the acknowledgement email body. `text()` trims
   only, so every HTML interpolation must go through the escaper instead. */
console.log('R-C1 · acknowledgement email body');
{
  const { buildAcknowledgementNotification } = await import('../core/acknowledgement-service.js');
  const note = buildAcknowledgementNotification(
    { title: PAYLOAD, assignedTo: 'x@nitda.gov.ng', category: PAYLOAD },
    { actorName: PAYLOAD, actorEmail: PAYLOAD, referenceId: PAYLOAD, acknowledgedTime: PAYLOAD, taskId: 'T1' }
  );
  ok('actorName is escaped', !note.body.includes(PAYLOAD) && note.body.includes(ESCAPED));
  ok('referenceId is escaped', note.body.split(ESCAPED).length > 2);
  ok('no raw "<img" survives anywhere in the body', !/<img\s/i.test(note.body));
  // The recipient address and subject are NOT html; escaping them would corrupt delivery.
  ok('recipient address is left unescaped (not an HTML context)', note.to === 'x@nitda.gov.ng');
}

/* ---------------------------------------------------------------- R-H2
   The evidence index attests to a record; markup injected through a
   reference id would corrupt the artefact's own integrity claim. */
console.log('\nR-H2 · archive evidence index');
{
  const { ExportBundle } = await import('../core/export-bundle.js');
  const html = ExportBundle.createEvidenceIndex({ ref: PAYLOAD, archivedAt: PAYLOAD, hash: PAYLOAD });
  ok('bundle.ref is escaped', !html.includes(PAYLOAD));
  ok('escaped form is present', html.includes(ESCAPED));
  ok('no raw "<img" survives', !/<img\s/i.test(html));
}

/* ---------------------------------------------------------------- R-H1
   boot.js writes an error stack into innerHTML. core/router.js already
   escaped the equivalent value; boot did not. Asserted by source
   inspection because the branch only runs on a real boot failure. */
console.log('\nR-H1 · boot failure panel');
{
  const src = readFileSync(path.join(ROOT, 'core/boot.js'), 'utf8');
  ok('boot.js escapes before assigning innerHTML',
     /replace\(\/\[&<>\]\/g/.test(src),
     'expected an escape of & < > applied to the error stack');
  ok('no unescaped ${String(e.stack…)} interpolation remains',
     !/\$\{String\(e\.stack\|\|e\)\}/.test(src));
}

/* ---------------------------------------------------------------- R-C1 (bound)
   Deep-link values are capped so a single parameter cannot carry an
   arbitrarily large payload into state, the audit ledger and documents. */
console.log('\nR-C1 · deep-link value bound');
{
  const src = readFileSync(path.join(ROOT, 'core/deeplink-resolver.js'), 'utf8');
  ok('resolver caps parameter length', /MAX_PARAM_LENGTH/.test(src));
  ok('both the matched param and preserved params are bounded',
     (src.match(/bound\(/g) || []).length >= 2);
}

/* ---------------------------------------------------------------- shared discipline
   Both escapers must cover the same character set. A helper that misses
   a quote is the usual way an attribute-context injection reappears. */
console.log('\nEscaper coverage');
{
  const { esc } = await import('../core/ui.js');
  for (const [ch, ent] of [['&','&amp;'],['<','&lt;'],['>','&gt;'],['"','&quot;'],["'",'&#39;']]) {
    ok(`core/ui.js esc() encodes ${JSON.stringify(ch)}`, esc(ch) === ent, `got ${JSON.stringify(esc(ch))}`);
  }
  const portal = readFileSync(path.join(ROOT, 'document-portal/js/core.js'), 'utf8');
  ok('document-portal PF.esc covers the same five characters',
     /\[&<>"'\]/.test(portal),
     'PF.esc must encode & < > " \' — an attribute-context gap reappears otherwise');
}

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
