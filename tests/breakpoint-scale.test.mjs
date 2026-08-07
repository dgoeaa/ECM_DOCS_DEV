/* H-01 — one breakpoint scale across both platforms, or this fails.
 *
 * Measured before the scale existed: the internal platform declared fifteen width values
 * (480 520 560 600 720 768 820 900 980 1000 1024 1100 1180 1280 1500), several within 24px
 * of each other; the portal declared five (600 640 900 960 1080). Two were shared, and only
 * because both packages ship the same base.css and layout.css. The same shared component
 * reflowed at a different width in each platform, so no reflow behaviour could be reasoned
 * about or tested once.
 *
 * CSS custom properties cannot appear in a media query condition, so tokens.breakpoint.css
 * documents the scale but cannot enforce it. This does. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOWED_MAX = new Set([640, 900, 1200, 1536]);
const ALLOWED_MIN = new Set([641, 901, 1201, 1537]);

function cssFiles(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, e);
    if (statSync(join(ROOT, rel)).isDirectory()) cssFiles(rel, out);
    else if (e.endsWith('.css') && e !== 'tokens.breakpoint.css') out.push(rel);
  }
  return out;
}

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log('  ✅ ' + name); return; }
  failed++; console.log('  ❌ ' + name + (detail ? '\n     ' + detail : ''));
};

console.log('\nOne breakpoint scale');

const files = [...cssFiles('styles'), ...cssFiles('document-portal')];
ok('both packages were scanned', files.some(f => f.startsWith('styles')) && files.some(f => f.startsWith('document-portal')),
   `found ${files.length} stylesheets`);

const offenders = [];
const seenMax = new Set(), seenMin = new Set();
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  for (const q of src.match(/@media[^{]+/g) || []) {
    for (const m of q.matchAll(/(max|min)-width:\s*(\d+)px/g)) {
      const n = Number(m[2]);
      (m[1] === 'max' ? seenMax : seenMin).add(n);
      const allowed = m[1] === 'max' ? ALLOWED_MAX : ALLOWED_MIN;
      if (!allowed.has(n)) offenders.push(`${relative('.', f)}: ${m[1]}-width:${n}px`);
    }
  }
}

ok('every width breakpoint is on the agreed scale', offenders.length === 0, offenders.slice(0, 12).join('\n     '));
ok('the scale is actually used, not merely permitted', seenMax.size > 0, 'no width media queries found at all — the scan is not reading anything');
ok('no two scale values sit within 24px of each other',
   [...seenMax].sort((a, b) => a - b).every((v, i, xs) => i === 0 || v - xs[i - 1] > 24),
   [...seenMax].sort((a, b) => a - b).join(', '));

// The token file is the documentation half of the contract; it has to agree with this test.
const tokens = readFileSync(join(ROOT, 'styles/dgo-design-system/tokens/tokens.breakpoint.css'), 'utf8');
for (const v of ALLOWED_MAX) ok(`tokens.breakpoint.css declares ${v}px`, tokens.includes(`${v}px`));
ok('both packages ship the scale', readFileSync(join(ROOT, 'document-portal/ds/tokens/tokens.breakpoint.css'), 'utf8') === tokens);

console.log('\nwidth values in use — max: ' + [...seenMax].sort((a,b)=>a-b).join(', ') + ' | min: ' + [...seenMin].sort((a,b)=>a-b).join(', '));
console.log(failed ? `\n❌ ${failed} failed` : '\n✅ all passed');
process.exit(failed ? 1 : 0);
