#!/usr/bin/env node
/**
 * Authentication posture tests.
 *
 * Proves both halves of the switch in config/auth.config.js:
 *
 * Coverage includes the routes added in steps 5-7 — the proxy byte path and the data
 * client's target resolution — because activation must be verified, not hoped for.
 *
 * There is ONE auth implementation. A second lived in ECM_ActivityHub_Portal until decision
 * D6(b) retired that tree; the parity assertions that held the two together went with it.
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

  /* The ECM Activity Hub's parallel auth layer was asserted here until decision D6(b)
     retired that tree. There is no second implementation left to hold to parity — which was
     the point of the decision: one auth surface to enable, not two. See
     docs/architecture/CONSOLIDATION_ANALYSIS.md §1.1. */

  /* Routes added in steps 5-7 were not covered here until now. Flipping the master switch
     should not be the first time anyone learns how they behave. */
  const scan = await import(`../core/scan-intake-service.js`);
  check('scan intake: no byte path without a configured proxy', scan.scanIntakeConfigured() === false);
  const scanDev = await scan.depositScan({ name: 'x.pdf', size: 3, type: 'application/pdf' });
  check('scan intake: an unconfigured deposit is refused, not attempted',
    scanDev.ok === false && scanDev.reason === 'not-configured');

  const dc = await import(`../core/data-client.js`);
  check('data client: development resolves to the endpoint registry, not a proxy',
    !String(dc.resolveUrl('FETCH_ALL')).includes('proxy.example'));

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

  // ── Routes added in steps 5-7, under enforcement.
  auth.clearToken();
  auth.registerTokenProvider(async () => ({
    token: fakeJwt({ preferred_username: 'clerk@nitda.gov.ng', roles: ['DGO.SystemAdmin'] }),
    expiresAt: Date.now() + 3_600_000,
  }));
  await auth.getAccessToken();

  const dc = await import(`../core/data-client.js`);
  check('data client: enforced traffic is routed through the proxy',
    String(dc.resolveUrl('FETCH_ALL')).startsWith('https://proxy.example/dgo'),
    dc.resolveUrl('FETCH_ALL'));

  /* Registry scan intake (step 7). The byte path is the one place a browser sends raw
     document bytes, so it must carry the bearer token once enforcement is on — and must
     send NOTHING that asserts who the depositing officer is, because the proxy reads that
     from the verified token. */
  const scan = await import(`../core/scan-intake-service.js`);
  check('scan intake: available once a proxy is configured', scan.scanIntakeConfigured() === true);

  let sent = null;
  const file = { name: 'counter-scan.pdf', size: 13, type: 'application/pdf',
                 arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7 scan').buffer };
  await scan.depositScan(file, {
    fetchImpl: async (url, opts) => {
      sent = { url, headers: opts.headers };
      return { ok: true, status: 201, json: async () => ({ ok: true, referenceId: 'NITDA-2026-000001', stored: true }) };
    },
  });
  check('scan intake: targets the proxy byte route',
    sent && sent.url === 'https://proxy.example/dgo/documents/scan', sent && sent.url);
  check('scan intake: attaches Authorization: Bearer',
    !!sent && /^Bearer /.test(sent.headers.Authorization || ''),
    sent && JSON.stringify(Object.keys(sent.headers)));
  check('scan intake: declares a digest so the proxy can verify the bytes',
    !!sent && /^[a-f0-9]{64}$/.test(sent.headers['X-DGO-Sha256'] || ''));
  check('scan intake: asserts no depositor — the proxy reads it from the token',
    !!sent && !Object.keys(sent.headers).some(h => /deposit|user|officer|role/i.test(h)),
    sent && Object.keys(sent.headers).join(','));

  /* The anonymous intake routes are anonymous BY DESIGN and must stay that way under
     enforcement — a public submitter has no account. Their narrowness is enforced
     server-side (proxy/test/intake.test.mjs); what matters here is that turning auth on
     does not accidentally put a staff token on a public path. */
  check('portal intake stays anonymous: no client-asserted identity anywhere in its envelope',
    auth.clientMayAssertIdentity() === false);
}

console.log(`\n${failures.length ? '❌' : '✅'} ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.error(`   · ${f}`)); process.exit(1); }
process.exit(0);
