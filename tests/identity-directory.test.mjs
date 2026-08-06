#!/usr/bin/env node
/**
 * Identity and role-assignment tests — the DGO_UserDirectory read path.
 *
 * Covers the three defects that made server-side role assignment unusable, each written as
 * a negative control so reverting the fix fails the case rather than passing quietly.
 *
 *   1. core/domain.js normalizeUser read only lower-case keys. DGO_UserDirectory sends
 *      SharePoint internal names, so `Role` fell through to the 'viewer' default and
 *      `Status` fell through to 'active'. Every officer arrived stripped of their role,
 *      and — the dangerous half — every DISABLED user arrived ACTIVE, which
 *      config/rbac.config.js canAccess() admits.
 *
 *   2. core/current-user.js normalizeUserRecord defaulted an absent role to systemAdmin
 *      whenever the LOCAL profile carried persona 'admin' — which the packaged default
 *      profile in core/state.js does.
 *
 *   3. getCurrentUser could not distinguish "no directory has ever answered" from "the
 *      directory answered and you are not in it". Both looked like `!users.length`, so a
 *      backend returning `users: []` promoted every caller to systemAdmin with
 *      accessScope ['all'].
 *
 * The bootstrap administrator is deliberately PRESERVED for the case it was built for — a
 * platform with no directory at all — because that is what lets the runtime boot and all
 * 29 routes render before any flow exists. The tests pin both halves.
 *
 * Usage:  node tests/identity-directory.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) { passed++; }
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/** Minimal browser globals so the runtime modules import cleanly under Node. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.window = { DGO_CONFIG: {} };
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { ...(globalThis.crypto || {}), randomUUID: () => 'test-uuid' };
}

const { normalizeUser } = await import('../core/domain.js');
const { getCurrentUser, normalizeUserRecord } = await import('../core/current-user.js');
const { canAccess } = await import('../config/rbac.config.js');

/* ------------------------------------------------------------------ *
 * 1 · normalizeUser against the real DGO_UserDirectory column names
 * ------------------------------------------------------------------ */

// Exactly the 21 internal names the provisioning specification declares.
const directoryRow = {
  UserId: 'u-1042',
  FullName: 'A. Officer',
  Email: 'A.Officer@nitda.gov.ng',
  Directorate: 'Registry',
  Department: 'Office of the Director-General',
  Unit: 'Digital Operations',
  JobTitle: 'Principal Officer',
  Phone: '+234...',
  Role: 'director',
  Persona: 'registry',
  Status: 'active',
  AccessScope: '["Registry","Operations"]',
  PilotCohort: 'COHORT-1',
  DisabledReason: '',
};

const u = normalizeUser(directoryRow);

check('NEGATIVE CONTROL: Role is read from the SharePoint column, not defaulted to viewer',
  u.role === 'director', `got ${u.role}`);
check('Persona is carried, not re-derived from the role',
  u.persona === 'registry', `got ${u.persona}`);
check('Status is read from the SharePoint column', u.status === 'active');
check('Email is lower-cased', u.email === 'a.officer@nitda.gov.ng');
check('UserId becomes the record id', u.id === 'u-1042');
check('FullName is read', u.fullName === 'A. Officer');
check('Unit, JobTitle and Phone survive', u.unit === 'Digital Operations' && u.jobTitle === 'Principal Officer' && u.phone === '+234...');
check('PilotCohort survives', u.pilotCohort === 'COHORT-1');

check('AccessScope parses from a JSON array string',
  Array.isArray(u.accessScope) && u.accessScope.join(',') === 'Registry,Operations',
  JSON.stringify(u.accessScope));
check('AccessScope parses from a comma-separated string',
  normalizeUser({ Email: 'x@y', AccessScope: 'Registry, Operations' }).accessScope.join(',') === 'Registry,Operations');
check('AccessScope parses from an already-parsed array',
  normalizeUser({ Email: 'x@y', AccessScope: ['all'] }).accessScope.join(',') === 'all');
check('AccessScope absent yields an empty array, not undefined',
  Array.isArray(normalizeUser({ Email: 'x@y' }).accessScope));

/* THE FAIL-OPEN THAT MATTERED MOST. */
const disabled = normalizeUser({ ...directoryRow, Status: 'disabled', DisabledReason: 'Left the agency' });
check('NEGATIVE CONTROL: a DISABLED directory user is not silently active',
  disabled.status === 'disabled', `got ${disabled.status}`);
check('the disabled reason survives for the audit trail',
  disabled.disabledReason === 'Left the agency');
check('canAccess() refuses a disabled user every route',
  canAccess(disabled, 'home') === false && canAccess(disabled, 'reports') === false);

/* Graph-shaped rows must keep working — REFERENCE_DATA returns them and they carry no role. */
const graphRow = normalizeUser({ displayName: 'B. Person', mail: 'B.Person@nitda.gov.ng', jobTitle: 'Analyst', Department: 'ICT' });
check('a Microsoft Graph row still normalises', graphRow.email === 'b.person@nitda.gov.ng' && graphRow.fullName === 'B. Person');
check('a Graph row with no role defaults to viewer, never higher', graphRow.role === 'viewer');

/* ------------------------------------------------------------------ *
 * 2 · normalizeUserRecord must not escalate via the local profile
 * ------------------------------------------------------------------ */

const escalationProfile = { email: 'nobody@nitda.gov.ng', persona: 'admin' };
const rec = normalizeUserRecord({ email: 'nobody@nitda.gov.ng' }, escalationProfile);
check('NEGATIVE CONTROL: an absent role does not become systemAdmin because the local profile says persona=admin',
  rec.role === 'viewer', `got ${rec.role}`);
check('an explicit role is still honoured',
  normalizeUserRecord({ email: 'x@y', role: 'operator' }, escalationProfile).role === 'operator');

/* ------------------------------------------------------------------ *
 * 3 · Directory authority
 * ------------------------------------------------------------------ */

const profile = { name: 'Registry', email: 'dgsregistry@nitda.gov.ng', persona: 'admin' };

// (a) No directory has ever answered — the bootstrap administrator is CORRECT here, and is
//     what lets a fresh clone boot and render every route before any flow exists.
const fresh = getCurrentUser({ profile, users: [], runtime: {} });
check('with no directory ever served, the bootstrap administrator still applies',
  fresh.role === 'systemAdmin' && fresh.bootstrap === true, `got ${fresh.role}`);

// (b) The directory answered, and it is empty. This is the escalation.
const servedEmpty = getCurrentUser({ profile, users: [], runtime: { directory: { served: true, count: 0 } } });
check('NEGATIVE CONTROL: an EMPTY directory response does not grant systemAdmin',
  servedEmpty.role === 'viewer', `got ${servedEmpty.role}`);
check('an empty directory response marks the caller unregistered',
  servedEmpty.status === 'unregistered', `got ${servedEmpty.status}`);
check('an unregistered caller is refused every route',
  canAccess(servedEmpty, 'home') === false);

// (c) The directory answered and lists this caller.
const listed = getCurrentUser({
  profile,
  users: [normalizeUser({ Email: 'dgsregistry@nitda.gov.ng', FullName: 'Registry', Role: 'operator', Persona: 'registry', Status: 'active' })],
  runtime: { directory: { served: true, count: 1 } },
});
check('a listed caller receives the role the directory assigned',
  listed.role === 'operator', `got ${listed.role}`);
check('a listed caller is marked registered', listed.registered === true);
check('the directory role governs route access',
  canAccess(listed, 'bulk-assignment') === true && canAccess(listed, 'user-admin') === false);

// (d) The directory answered but does not list this caller.
const absent = getCurrentUser({
  profile: { ...profile, email: 'stranger@nitda.gov.ng' },
  users: [normalizeUser({ Email: 'someone.else@nitda.gov.ng', Role: 'operator', Status: 'active' })],
  runtime: { directory: { served: true, count: 1 } },
});
check('a caller absent from the directory is unregistered, not admin',
  absent.role === 'viewer' && absent.status === 'unregistered', `got ${absent.role}/${absent.status}`);

// (e) A disabled caller who IS listed.
const disabledListed = getCurrentUser({
  profile,
  users: [normalizeUser({ Email: 'dgsregistry@nitda.gov.ng', Role: 'systemAdmin', Status: 'disabled' })],
  runtime: { directory: { served: true, count: 1 } },
});
check('a disabled systemAdmin is refused despite the role',
  canAccess(disabledListed, 'home') === false, `status ${disabledListed.status}`);

/* ------------------------------------------------------------------ *
 * 4 · The stamp itself — presence, not length; and never revoked
 * ------------------------------------------------------------------ */

const { applyFetchAll } = await import('../core/data-loader.js');
const { State } = await import('../core/state.js');

applyFetchAll({ users: [], docs: [] });
check('a response carrying an EMPTY users array still marks the directory served',
  State.get().runtime?.directory?.served === true);
check('the served stamp records the count', State.get().runtime?.directory?.count === 0);

applyFetchAll({ docs: [] });
check('NEGATIVE CONTROL: a later response WITHOUT users does not revoke directory authority',
  State.get().runtime?.directory?.served === true);

applyFetchAll({ users: [{ Email: 'a@b', Role: 'operator', Status: 'active' }] });
check('a populated response updates the count',
  State.get().runtime?.directory?.count === 1, String(State.get().runtime?.directory?.count));
check('the ingested user keeps its directory role',
  State.get().users[0].role === 'operator', State.get().users[0]?.role);

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log('\nidentity and role assignment\n');
if (failures.length) {
  for (const f of failures) console.log(`  ✖  ${f}`);
  console.log(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  process.exit(1);
}
console.log(`  ${passed}/${passed} assertions hold\n`);
process.exit(0);
