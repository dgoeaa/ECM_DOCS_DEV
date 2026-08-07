/* V-04 — the two platforms publish one status vocabulary, or this fails.
 *
 * The design audit recorded the vocabulary as already consistent across both platforms and
 * asked for it to be held "as a governed list rather than duplicated strings". It was not
 * consistent: the portal published seven states and the internal platform stored five, with
 * only "Declined" common to both and no mapping in either direction. This test is the
 * governance the audit asked for — the list now exists once, and a change on one side that
 * is not made on the other stops the build. */
import { readFileSync } from 'node:fs';
import { StatusVocabulary, StatusLabels, InternalStatusToGoverned, governedStatusLabel } from '../config/status-vocabulary.config.js';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log('  ✅ ' + name); return; }
  failed++; console.log('  ❌ ' + name + (detail ? '\n     ' + detail : ''));
};

console.log('\nGoverned status vocabulary');

// 1. The portal's PF.STATUS is the governed list, key for key and label for label.
const portalSrc = readFileSync(new URL('../document-portal/js/data.js', import.meta.url), 'utf8');
const block = portalSrc.slice(portalSrc.indexOf('PF.STATUS = {'), portalSrc.indexOf('PF.STAGES'));
const portal = [...block.matchAll(/^\s*'?([a-z-]+)'?:\s*\{\s*label:\s*'([^']+)'/gm)].map(m => ({ key: m[1], label: m[2] }));

ok('the portal declares every governed state', StatusVocabulary.every(s => portal.some(p => p.key === s.key)),
   'missing: ' + StatusVocabulary.filter(s => !portal.some(p => p.key === s.key)).map(s => s.key).join(', '));
ok('the portal declares no state the governed list does not', portal.every(p => StatusLabels[p.key] !== undefined),
   'extra: ' + portal.filter(p => StatusLabels[p.key] === undefined).map(p => p.key).join(', '));
ok('every label reads the same on both sides', portal.every(p => !StatusLabels[p.key] || StatusLabels[p.key] === p.label),
   portal.filter(p => StatusLabels[p.key] && StatusLabels[p.key] !== p.label).map(p => `${p.key}: portal "${p.label}" vs governed "${StatusLabels[p.key]}"`).join('; '));

// 2. Every internal status the correspondence workspace can store maps onto the governed list.
const corrSrc = readFileSync(new URL('../modules/correspondence.js', import.meta.url), 'utf8');
const listed = (corrSrc.match(/const statusList=\[([^\]]+)\]/) || [, ''])[1]
  .split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);

ok('the internal status list was found', listed.length > 0, 'statusList not parsed from modules/correspondence.js');
ok('every internal status maps to a governed state',
   listed.every(x => InternalStatusToGoverned[x]),
   'unmapped: ' + listed.filter(x => !InternalStatusToGoverned[x]).join(', '));
ok('every mapping target is a real governed state',
   Object.values(InternalStatusToGoverned).every(k => StatusLabels[k] !== undefined),
   'bad targets: ' + Object.values(InternalStatusToGoverned).filter(k => !StatusLabels[k]).join(', '));
ok('the map carries no status the workspace cannot store',
   Object.keys(InternalStatusToGoverned).every(x => listed.includes(x)),
   'stale: ' + Object.keys(InternalStatusToGoverned).filter(x => !listed.includes(x)).join(', '));

// 3. The display helper resolves to a published label, and leaves an unknown value alone
//    rather than relabelling it as something it is not.
ok('an internal status renders as its governed label', governedStatusLabel('Pending') === 'Received');
ok('an unknown status is shown verbatim, not relabelled', governedStatusLabel('Something Else') === 'Something Else');

console.log(failed ? `\n❌ ${failed} failed` : '\n✅ all passed');
process.exit(failed ? 1 : 0);
