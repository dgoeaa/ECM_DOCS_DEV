#!/usr/bin/env node
/**
 * Authentication posture tests.
 *
 * Proves both halves of the switch in config/auth.config.js:
 *
 *   INERT    — adding the auth layer did not disturb development or pilot behaviour.
 *   ENFORCED — no request leaves anonymously, and tampering with local state no longer
 *              changes the effective role. That last one is the viewer -> systemAdmin
 *              escalation demonstrated during the capability assessment, encoded so it
 *              cannot silently return.
 *
 * Each posture runs in its own child process (see below) so the two configurations
 * cannot leak into one another.
 *
 * Usage:  node tests/auth-posture.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Each posture must run in its OWN process. config/auth.config.js reads window.DGO_CONFIG
// at module-evaluation time, and core/auth.js imports it without a cache-busting query —
// so a second import inside the same process would silently reuse the first posture's
// frozen config. Query-string cache busting does not propagate to a module's dependencies.
const POSTURE = process.argv.find(a => a.startsWith('--posture='))?.split('=')[1];

if (!POSTURE) {
  const self = fileURLToPath(import.meta.url);
  let failed = 0;
  for (const p of ['inert', 'enforced']) {
    const r = spawnSync(process.execPath, [self, `--posture=${p}`], { stdio: 'inherit' });
    if (r.status !== 0) failed++;
  }
  console.log(failed ? `\n❌ ${failed} posture(s) failed` : '\n✅ both postures passed');
  process.exit(failed ? 1 : 0);
}

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** Minimal browser globals so the runtime modules import cleanly under Node. */
function installGlobals(authCfg) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = { DGO_CONFIG: authCfg ? { auth: authCfg } : {} };
  globalThis.document = undefined;
  if (!globalThis.crypto?.randomUUID) {
    globalThis.crypto = { ...(globalThis.crypto || {}), randomUUID: () => 'test-uuid' };
  }
  return store;
}

/** Unforgeable-shaped but unsigned JWT — decode-only, never verified client-side. */
function fakeJwt(claims) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.sig`;
}

if (POSTURE === 'inert') {
  console.log('=== POSTURE 1: INERT (development) ===');
  installGlobals(null); // no auth config -> defaults, enabled === false
  const cfg = await import(`../config/auth.config.js`);
  const auth = await import(`../core/auth.js`);

  check('auth is disabled by default', cfg.AuthConfig.enabled === false);
  check('isAuthEnforced() is false', cfg.isAuthEnforced() === false);
  check('no Authorization header is attached',
    Object.keys(await auth.authHeaders()).length === 0);
  check('client may still assert identity (userEmail preserved)',
    auth.clientMayAssertIdentity() === true);
  check('getAccessToken() returns null', (await auth.getAccessToken()) === null);
  check('ensureAuthenticated() is a no-op',
    (await auth.ensureAuthenticated('probe')) === null);
  check('identity is sourced from the local profile',
    auth.getIdentity().source === 'local-profile');
  check('identity is not marked verified', auth.getIdentity().verified === false);

  // ── ECM Activity Hub Portal — parity (AUDIT.md F-001/F-002/F-003)
  const pAuth = await import('../ECM_ActivityHub_Portal/js/core/auth.js');
  const pStore = { auth: { user: { email: 'dev@localhost', name: 'Dev', role: 'Officer' } } };
  check('portal: auth disabled by default', pAuth.isAuthEnforced() === false);
  check('portal: no Authorization header', Object.keys(await pAuth.authHeaders()).length === 0);
  check('portal: client may assert identity (envelope unchanged)', pAuth.clientMayAssertIdentity() === true);
  check('portal: role switch still permitted in development', pAuth.roleSwitchAllowed() === true);
  check('portal: identity comes from the local store', pAuth.getIdentity(pStore).source === 'local-store');
  check('portal: no production identity is hardcoded', !JSON.stringify(
    (await import('../ECM_ActivityHub_Portal/js/core/store.js')).Store.auth).includes('dgceo@nitda.gov.ng'));

  const posture = cfg.authPosture();
  check('posture reports "development"', posture.posture === 'development');
  check('posture warns that controls are NOT enforced', /INERT/.test(posture.warning));
  check('missing activation config is reported',
    cfg.missingActivationConfig().includes('tenantId'));
}

if (POSTURE === 'enforced') {
  console.log('=== POSTURE 2: ENFORCED (release) ===');
  installGlobals({
    enabled: true,
    tenantId: 't-guid', clientId: 'c-guid',
    proxyBaseUrl: 'https://proxy.example/dgo',
    roleSource: 'claims', rolesClaim: 'roles',
    roleClaimMap: { 'DGO.Viewer': 'viewer', 'DGO.SystemAdmin': 'systemAdmin' },
  });
  const cfg = await import(`../config/auth.config.js`);
  const auth = await import(`../core/auth.js`);

  check('auth is enabled', cfg.AuthConfig.enabled === true);
  check('activation config is complete', cfg.missingActivationConfig().length === 0,
    cfg.missingActivationConfig().join(', '));
  check('posture reports "enforced"', cfg.authPosture().posture === 'enforced');

  // No provider registered yet: nothing may proceed anonymously.
  let threw = false;
  try { await auth.getAccessToken(); } catch { threw = true; }
  check('getAccessToken() throws without a registered provider', threw);

  let gateThrew = false;
  try { await auth.ensureAuthenticated('governed'); } catch { gateThrew = true; }
  check('ensureAuthenticated() BLOCKS when unauthenticated', gateThrew);

  // Register a provider issuing a low-privilege token.
  auth.registerTokenProvider(async () => ({
    token: fakeJwt({ preferred_username: 'viewer@nitda.gov.ng', name: 'Low Priv', roles: ['DGO.Viewer'] }),
    expiresAt: Date.now() + 3_600_000,
  }));

  const token = await auth.getAccessToken();
  check('a token is acquired once a provider is registered', typeof token === 'string' && token.length > 0);

  const headers = await auth.authHeaders();
  check('Authorization: Bearer is attached', /^Bearer /.test(headers.Authorization || ''));
  check('client may NOT assert identity — userEmail is dropped',
    auth.clientMayAssertIdentity() === false);

  const id = auth.getIdentity();
  check('identity derives from token claims', id.source === 'token-claims');
  check('identity is marked verified', id.verified === true);
  check('role is mapped from the claim', id.role === 'viewer', `got ${id.role}`);

  // THE ESCALATION REGRESSION.
  // Rewriting local state to systemAdmin must not change the effective role, because
  // the role is no longer read from local state at all.
  globalThis.localStorage.setItem('dgo.r11.viewport.runtime.state', JSON.stringify({
    profile: { name: 'Low Priv', email: 'viewer@nitda.gov.ng', persona: 'admin' },
    users: [{ id: 'v1', email: 'viewer@nitda.gov.ng', role: 'systemAdmin', persona: 'admin', status: 'active' }],
  }));
  check('local-state tampering does NOT escalate the role',
    auth.getIdentity().role === 'viewer', `got ${auth.getIdentity().role}`);

  // An unmapped claim must deny, never fall back to a local role.
  auth.clearToken();
  auth.registerTokenProvider(async () => ({
    token: fakeJwt({ preferred_username: 'x@nitda.gov.ng', roles: ['Unmapped.Role'] }),
    expiresAt: Date.now() + 3_600_000,
  }));
  await auth.getAccessToken();
  check('an unmapped role claim yields no role', auth.getIdentity().role === null);
  let unmappedThrew = false;
  try { await auth.ensureAuthenticated('governed'); } catch { unmappedThrew = true; }
  check('an unmapped role is DENIED rather than defaulted', unmappedThrew);

  // ── ECM Activity Hub Portal — enforced parity
  const pAuth = await import('../ECM_ActivityHub_Portal/js/core/auth.js');
  check('portal: auth enabled', pAuth.isAuthEnforced() === true);
  check('portal: client may NOT assert identity — user/role dropped from envelope',
    pAuth.clientMayAssertIdentity() === false);
  check('portal: in-browser role switch is REFUSED (F-002)', pAuth.roleSwitchAllowed() === false);
  let pThrew = false;
  try { await pAuth.ensureAuthenticated({}, 'governed'); } catch { pThrew = true; }
  check('portal: unauthenticated governed call is BLOCKED', pThrew);
  pAuth.registerTokenProvider(async () => ({
    token: fakeJwt({ preferred_username: 'officer@nitda.gov.ng', roles: ['DGO.Officer'] }),
    expiresAt: Date.now() + 3_600_000 }));
  await pAuth.getAccessToken();
  check('portal: Authorization Bearer attached',
    /^Bearer /.test((await pAuth.authHeaders()).Authorization || ''));
  const tampered = { auth: { user: { email: 'officer@nitda.gov.ng', role: 'DGCEO' } } };
  check('portal: tampering with Store does NOT change the effective role (F-001/F-003)',
    pAuth.getIdentity(tampered).role !== 'DGCEO');
  check('portal: identity derives from token claims',
    pAuth.getIdentity(tampered).source === 'token-claims');
}

console.log(`\n${failures.length ? '❌' : '✅'} ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.error(`   · ${f}`)); process.exit(1); }
process.exit(0);
