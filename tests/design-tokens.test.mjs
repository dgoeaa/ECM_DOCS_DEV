/**
 * Design-token drift gate.
 *
 * `document-portal/` is a separate deployable: it is published on its own, from its
 * own directory, and cannot reach up into `styles/` at runtime. So it carries its own
 * copy of the design system. A copy that nobody checks is a fork, and this one had
 * already become one — the portal's token layer was missing fifteen dark-theme tokens
 * and ten high-contrast tokens, and carried the pre-remediation values for four
 * contrast fixes (SC 1.4.3 on the accent surface, SC 1.4.11 on control boundaries).
 * On a public page. In a theme a visitor can select.
 *
 * The rule this file enforces: the shared token files are byte-for-byte identical in
 * both trees. Not "equivalent", not "the same variables" — identical, so that fixing
 * the runtime cannot silently leave the portal behind, and so that the fix is a copy
 * rather than a merge.
 *
 * The portal keeps exactly one file of its own, `tokens.portal.css`, for tokens the
 * runtime has no use for. That file is not compared, and it may not redefine anything
 * the shared layer already defines — otherwise it becomes the fork by another route.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_TOKENS = 'styles/dgo-design-system/tokens';
const PORTAL_TOKENS = 'document-portal/ds/tokens';

/** Files that must be identical in both trees. */
const SHARED = [
  // H-01 — the agreed breakpoint scale. Shared because the whole point of it is that the
  // same component reflows at the same width in both platforms; a copy that drifts is the
  // defect this file was created to end.
  'tokens.breakpoint.css',
  'tokens.primitive.css',
  'tokens.semantic.css',
  'tokens.component.css',
  'tokens.density.css',
  'tokens.theme-light.css',
  'tokens.theme-dark.css',
  'tokens.theme-hc.css'
];

/**
 * Token files the runtime has and the portal deliberately does not.
 * `legacy-bridge` maps retired variable names for the runtime's older screens; the
 * portal was written after the rename and has no legacy names to bridge.
 * `enhanced` is opt-in density/motion tuning the portal does not use.
 */
const RUNTIME_ONLY = ['tokens.legacy-bridge.css', 'tokens.enhanced.css'];

/** The portal's own layer. Not compared — but see the redefinition check below. */
const PORTAL_ONLY = ['tokens.portal.css'];

const failures = [];
const note = (m) => failures.push(m);

const declarations = (css) => {
  const found = new Map();
  const re = /^[ \t]*(--[A-Za-z0-9_-]+)[ \t]*:[ \t]*(.+?);/gm;
  let m;
  while ((m = re.exec(css)) !== null) found.set(m[1], m[2].trim());
  return found;
};

/* 1. Every shared file exists in both trees and is byte-identical. */
for (const name of SHARED) {
  const rootPath = join(ROOT_TOKENS, name);
  const portalPath = join(PORTAL_TOKENS, name);

  if (!existsSync(rootPath)) { note(`missing from the runtime: ${rootPath}`); continue; }
  if (!existsSync(portalPath)) {
    note(`missing from the portal: ${portalPath}\n    copy it from ${rootPath}`);
    continue;
  }

  const a = readFileSync(rootPath);
  const b = readFileSync(portalPath);
  if (a.equals(b)) continue;

  const rootVars = declarations(a.toString('utf8'));
  const portalVars = declarations(b.toString('utf8'));
  const missing = [...rootVars.keys()].filter((k) => !portalVars.has(k));
  const extra = [...portalVars.keys()].filter((k) => !rootVars.has(k));
  const changed = [...rootVars.keys()]
    .filter((k) => portalVars.has(k) && portalVars.get(k) !== rootVars.get(k));

  const detail = [];
  if (missing.length) detail.push(`      absent from the portal: ${missing.join(', ')}`);
  if (extra.length) detail.push(`      only in the portal: ${extra.join(', ')}`);
  for (const k of changed) {
    detail.push(`      ${k}\n        runtime: ${rootVars.get(k)}\n        portal:  ${portalVars.get(k)}`);
  }
  if (!detail.length) detail.push('      same declarations, different bytes (comments or whitespace)');

  note(
    `${name} has drifted\n${detail.join('\n')}\n` +
    `    Resolve by copying, in one direction, deliberately:\n` +
    `      cp ${rootPath} ${portalPath}\n` +
    `    If the portal's value is the correct one, change the runtime file first and\n` +
    `    then copy, so both apps move together.`
  );
}

/* 2. The portal's own layer may not redefine a shared token. */
const shared = new Map();
for (const name of SHARED) {
  const p = join(ROOT_TOKENS, name);
  if (existsSync(p)) for (const k of declarations(readFileSync(p, 'utf8')).keys()) shared.set(k, name);
}
for (const name of PORTAL_ONLY) {
  const p = join(PORTAL_TOKENS, name);
  if (!existsSync(p)) { note(`missing: ${p}`); continue; }
  for (const k of declarations(readFileSync(p, 'utf8')).keys()) {
    if (shared.has(k)) {
      note(
        `${name} redefines ${k}, which the shared layer already defines in ${shared.get(k)}\n` +
        `    A local override is how the two design systems drift apart. Change the shared\n` +
        `    value so both apps get it, or give the portal token a distinct name.`
      );
    }
  }
}

/* 3. No token file appears in the portal that this gate does not know about —
      otherwise a new shared file could be added to one tree and go unchecked. */
const known = new Set([...SHARED, ...PORTAL_ONLY]);
for (const f of readdirSync(PORTAL_TOKENS).filter((f) => f.endsWith('.css'))) {
  if (!known.has(f)) {
    note(
      `unrecognised token file in the portal: ${join(PORTAL_TOKENS, f)}\n` +
      `    Add it to SHARED in this test if the runtime has it too, or to PORTAL_ONLY if not.`
    );
  }
}
const knownRoot = new Set([...SHARED, ...RUNTIME_ONLY]);
for (const f of readdirSync(ROOT_TOKENS).filter((f) => f.endsWith('.css'))) {
  if (!knownRoot.has(f)) {
    note(
      `unrecognised token file in the runtime: ${join(ROOT_TOKENS, f)}\n` +
      `    Add it to SHARED in this test so the portal gets it too, or to RUNTIME_ONLY\n` +
      `    with a note saying why the portal does not need it.`
    );
  }
}

/* 4. The portal must actually load its token files. A file that drifts is a bug;
      a file that is never imported is a bigger one, and byte-comparison cannot see it. */
const dsEntry = 'document-portal/ds/ds.css';
if (!existsSync(dsEntry)) {
  note(`missing the portal's design-system entry point: ${dsEntry}`);
} else {
  const entry = readFileSync(dsEntry, 'utf8');
  for (const name of [...SHARED, ...PORTAL_ONLY]) {
    if (!entry.includes(`tokens/${name}`)) {
      note(`${dsEntry} does not import tokens/${name} — the file is present but never loaded`);
    }
  }
}

if (failures.length) {
  console.error(`\nDesign-token drift: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    'The portal and the runtime ship the same design system from two directories.\n' +
    'They are allowed to be copies. They are not allowed to be different.\n'
  );
  process.exit(1);
}

console.log(
  `Design tokens: ${SHARED.length} shared files identical across both trees, ` +
  `${PORTAL_ONLY.length} portal-only file with no shared redefinitions.`
);
