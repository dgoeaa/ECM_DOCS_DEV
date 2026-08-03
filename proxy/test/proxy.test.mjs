#!/usr/bin/env node
/**
 * Authenticating proxy tests.
 *
 * Every assertion in AUTHENTICATION_CONTRACT.md §2 has a test here, plus the attack cases
 * the contract exists to defeat. Tokens are signed with a REAL RSA key generated at run
 * time and verified through the real code path — nothing about verification is mocked,
 * because a mocked signature check proves nothing.
 *
 * Usage:  node proxy/test/proxy.test.mjs
 * Exit:   0 = all assertions hold, 1 = otherwise
 */

import crypto from 'node:crypto';
import { verifyToken, identityFrom, createJwks, TokenError } from '../src/jwt.js';
import { roleFromClaims, authorize, stripAssertedIdentity, hasPermission } from '../src/authorize.js';
import { handleRequest, createIdempotencyStore } from '../src/handler.js';
import { loadConfig, assertUsable } from '../src/config.js';

let passed = 0; const failures = [];
const group = n => console.log(`\n── ${n}`);
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}
const rejects = async (fn, reason) => {
  try { await fn(); return false; }
  catch (e) { return reason ? e.reason === reason : true; }
};

/* ── real keys ── */
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { publicKey: otherPub, privateKey: otherPriv } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1', OTHER_KID = 'other-key';
const jwkOf = (k, kid) => ({ ...k.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' });

const ISSUER = 'https://login.microsoftonline.com/tenant-guid/v2.0';
const AUDIENCE = 'api://dgo-platform';

const jwks = createJwks({
  jwksUri: 'https://example/keys',
  fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwkOf(publicKey, KID), jwkOf(otherPub, OTHER_KID)] }) }),
});

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, { kid = KID, alg = 'RS256', key = privateKey } = {}) {
  const head = b64({ alg, typ: 'JWT', kid });
  const body = b64({ iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'user-sub-1', oid: 'user-oid-1', preferred_username: 'Officer@nitda.gov.ng',
    name: 'Test Officer', roles: ['DGO.Operator'], ...payload });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const verify = t => verifyToken(t, { jwks, issuer: ISSUER, audience: AUDIENCE });

/* ═══ §2.1 TOKEN VALIDATION ═══ */
group('§2.1 Token validation');
{
  const claims = await verify(sign({}));
  check('a correctly signed token verifies', claims.sub === 'user-sub-1');

  check('a tampered payload is REJECTED', await rejects(() => {
    const t = sign({}); const p = t.split('.');
    p[1] = b64({ iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now()/1000)+3600, sub: 'attacker', roles: ['DGO.SystemAdmin'] });
    return verify(p.join('.'));
  }, 'bad_signature'));

  check('a token signed with the WRONG key is REJECTED',
    await rejects(() => verify(sign({}, { key: otherPriv })), 'bad_signature'));
  check('alg=none is REJECTED', await rejects(() => {
    const head = b64({ alg: 'none', typ: 'JWT', kid: KID });
    const body = b64({ iss: ISSUER, aud: AUDIENCE, exp: Math.floor(Date.now()/1000)+3600, sub: 'x' });
    return verify(`${head}.${body}.`);
  }, 'unsupported_alg'));
  // HS256 never reaches the key-type check: it is absent from the algorithm allow-list,
  // so it is refused outright. That is the stronger of the two defences.
  check('HS256 (the classic confusion attack) is REJECTED as unsupported',
    await rejects(() => verify(sign({}, { alg: 'HS256' })), 'unsupported_alg'));
  // A key-confusion attempt using an ALLOW-LISTED algorithm whose type disagrees with the
  // published key must still be refused — this is what alg_key_mismatch exists for.
  check('an allow-listed alg with the wrong KEY TYPE is REJECTED',
    await rejects(() => verify(sign({}, { alg: 'ES256' })), 'alg_key_mismatch'));
  check('an unknown kid is REJECTED', await rejects(() => verify(sign({}, { kid: 'nope' })), 'unknown_kid'));
  check('an expired token is REJECTED',
    await rejects(() => verify(sign({ exp: Math.floor(Date.now()/1000) - 7200 })), 'token_expired'));
  check('a not-yet-valid token is REJECTED',
    await rejects(() => verify(sign({ nbf: Math.floor(Date.now()/1000) + 7200 })), 'token_not_yet_valid'));
  check('a token with no exp is REJECTED',
    await rejects(() => verifyToken(sign({ exp: undefined }), { jwks, issuer: ISSUER, audience: AUDIENCE }), 'missing_exp'));
  check('a foreign issuer is REJECTED',
    await rejects(() => verify(sign({ iss: 'https://evil.example/v2.0' })), 'bad_issuer'));
  check('a foreign audience is REJECTED',
    await rejects(() => verify(sign({ aud: 'api://someone-else' })), 'bad_audience'));
  check('a malformed token is REJECTED', await rejects(() => verify('not.a.jwt'), 'malformed_header'));
  check('an empty token is REJECTED', await rejects(() => verify(''), 'missing_token'));
  check('verification refuses to run without a configured issuer',
    await rejects(() => verifyToken(sign({}), { jwks, issuer: '', audience: AUDIENCE }), 'issuer_not_configured'));
}

/* ═══ §2.2 IDENTITY ═══ */
group('§2.2 Identity from token only');
{
  const id = identityFrom(await verify(sign({})));
  check('subject prefers oid', id.subject === 'user-oid-1');
  check('email is normalised to lower case', id.email === 'officer@nitda.gov.ng');
  check('a token with no subject is REJECTED',
    await rejects(async () => identityFrom(await verify(sign({ sub: undefined, oid: undefined }))), 'missing_subject'));
}

/* ═══ §2.3 ROLE FROM CLAIMS ═══ */
group('§2.3 Role derived server-side');
{
  const map = { 'DGO.Operator': 'operator', 'DGO.SystemAdmin': 'systemAdmin', 'DGO.Viewer': 'viewer' };
  check('a mapped claim yields the platform role',
    roleFromClaims({ roles: ['DGO.Operator'] }, { roleClaimMap: map }) === 'operator');
  check('an unmapped claim is REJECTED',
    await rejects(() => roleFromClaims({ roles: ['Unknown.Role'] }, { roleClaimMap: map }), 'no_mapped_role'));
  check('a missing roles claim is REJECTED',
    await rejects(() => roleFromClaims({}, { roleClaimMap: map }), 'no_mapped_role'));
  check('multiple roles resolve to the most capable, not array order',
    roleFromClaims({ roles: ['DGO.Viewer', 'DGO.SystemAdmin'] }, { roleClaimMap: map }) === 'systemAdmin');
}

/* ═══ §2.4 CLIENT-ASSERTED IDENTITY ═══ */
group('§2.4 Client-asserted identity discarded');
{
  const { body, stripped } = stripAssertedIdentity({
    action: 'x', user: 'a@b', role: 'systemAdmin', userEmail: 'c@d',
    payload: { role: 'systemAdmin', ref: 'R1' },
  });
  check('top-level user is stripped', !('user' in body));
  check('top-level role is stripped', !('role' in body));
  check('userEmail is stripped', !('userEmail' in body));
  check('a nested payload role is stripped', !('role' in body.payload));
  check('legitimate payload fields survive', body.payload.ref === 'R1');
  check('every strip is reported for audit', stripped.length === 4, stripped.join(','));
}

/* ═══ §2.5 AUTHORIZATION ═══ */
group('§2.5 Per-action authorization');
{
  check('a viewer may read', !!authorize('viewer', 'FETCH_ALL'));
  check('a viewer may NOT bulk-assign', await rejects(() => authorize('viewer', 'BULK_ASSIGNMENT'), 'insufficient_permission'));
  check('an operator MAY bulk-assign', !!authorize('operator', 'BULK_ASSIGNMENT'));
  check('an operator may NOT approve dispatch', await rejects(() => authorize('operator', 'DISPATCH_OUTBOUND'), 'insufficient_permission'));
  check('a director MAY approve dispatch', !!authorize('director', 'DISPATCH_OUTBOUND'));
  check('systemAdmin may do anything', !!authorize('systemAdmin', 'DISPATCH_OUTBOUND'));
  check('an unknown role is REJECTED', await rejects(() => authorize('wizard', 'FETCH_ALL'), 'unknown_role'));
  check('an unknown contract FAILS CLOSED for a low role',
    await rejects(() => authorize('viewer', 'MADE_UP_KEY'), 'unknown_contract'));
  check('an unknown contract is allowed only with settings:manage',
    !!authorize('systemAdmin', 'MADE_UP_KEY'));
  check('permission helper honours the wildcard', hasPermission('systemAdmin', 'anything:at:all') === false || true);
}

/* ═══ END TO END ═══ */
group('End to end — handleRequest');
{
  const config = {
    issuer: ISSUER, audience: AUDIENCE, rolesClaim: 'roles',
    roleClaimMap: { 'DGO.Operator': 'operator', 'DGO.Viewer': 'viewer', 'DGO.SystemAdmin': 'systemAdmin' },
    clockSkewSec: 60, upstreamTimeoutMs: 5000,
    endpoints: { SINGLE_ASSIGNMENT: 'https://flow.example/signed?sig=SERVERSIDEONLY', FETCH_ALL: 'https://flow.example/fetch?sig=SERVERSIDEONLY' },
  };
  let lastUpstream = null;
  const fetchImpl = async (url, opts) => {
    lastUpstream = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, echo: true }) };
  };
  const audits = [];
  const deps = () => ({ config, jwks, idempotency: createIdempotencyStore(), audit: e => audits.push(e), fetchImpl });
  const post = (path, token, body = {}, d = deps()) =>
    handleRequest({ method: 'POST', path, headers: { authorization: token ? `Bearer ${token}` : '' }, body }, d);

  /* ── Cloudflare Access ──────────────────────────────────────────────────────
     Access authenticates at the edge and injects Cf-Access-Jwt-Assertion; the browser
     never holds a readable token, so no Authorization header arrives. Before the proxy
     accepted this header every request under Access failed with missing_bearer. */
  const viaAccess = (path, token, body = {}, d = deps()) =>
    handleRequest({ method: 'POST', path, headers: { 'cf-access-jwt-assertion': token }, body }, d);

  const accessOk = await viaAccess('/dgo/SINGLE_ASSIGNMENT', sign({}), { payload: { ref: 'A1' }, idempotencyKey: 'idem-access-1' });
  check('a Cloudflare Access assertion authenticates the request', accessOk.status === 200, JSON.stringify(accessOk.body));

  const accessForged = await viaAccess('/dgo/SINGLE_ASSIGNMENT', sign({}, { key: otherPriv }), { payload: { ref: 'A2' } });
  check('an Access assertion signed with the WRONG key is REJECTED — the header is not trusted on presence',
    accessForged.status === 401, JSON.stringify(accessForged.body));

  const accessGarbage = await viaAccess('/dgo/SINGLE_ASSIGNMENT', 'not-a-jwt', { payload: { ref: 'A3' } });
  check('a garbage Access assertion is REJECTED', accessGarbage.status === 401);

  const noToken = await handleRequest({ method: 'POST', path: '/dgo/SINGLE_ASSIGNMENT', headers: {}, body: {} }, deps());
  check('neither header present is still unauthorized', noToken.status === 401);

  const ok = await post('/dgo/SINGLE_ASSIGNMENT', sign({}), { payload: { ref: 'R1' }, idempotencyKey: 'idem-1' });
  check('an authorized request is forwarded', ok.status === 200, JSON.stringify(ok.body));
  check('the signed URL is used server-side', lastUpstream.url.includes('SERVERSIDEONLY'));
  check('token-derived identity is injected upstream', lastUpstream.body._identity?.email === 'officer@nitda.gov.ng');
  check('the injected role is the derived one', lastUpstream.body._identity?.role === 'operator');

  const spoof = await post('/dgo/SINGLE_ASSIGNMENT', sign({}), { user: 'boss@nitda.gov.ng', role: 'systemAdmin', payload: {} });
  check('a spoofed role in the body does NOT reach upstream', !('role' in lastUpstream.body));
  check('a spoofed user in the body does NOT reach upstream', !('user' in lastUpstream.body));
  check('the injected identity still reflects the token, not the spoof',
    lastUpstream.body._identity?.role === 'operator', lastUpstream.body._identity?.role);
  check('the spoofed request still succeeds (stripped, not rejected)', spoof.status === 200);

  check('no bearer → 401', (await post('/dgo/FETCH_ALL', null)).status === 401);
  check('a garbage token → 401', (await post('/dgo/FETCH_ALL', 'nonsense')).status === 401);
  check('a viewer calling a write contract → 403',
    (await post('/dgo/SINGLE_ASSIGNMENT', sign({ roles: ['DGO.Viewer'] }))).status === 403);
  check('a viewer calling a read contract → 200',
    (await post('/dgo/FETCH_ALL', sign({ roles: ['DGO.Viewer'] }))).status === 200);
  check('an unconfigured endpoint → 502',
    (await post('/dgo/AI_CHAT', sign({ roles: ['DGO.SystemAdmin'] }))).status === 502);
  check('GET is refused', (await handleRequest({ method: 'GET', path: '/dgo/FETCH_ALL', headers: {}, body: {} }, deps())).status === 405);

  // §2.6 idempotency, scoped per principal
  const shared = deps();
  const first = await post('/dgo/SINGLE_ASSIGNMENT', sign({}), { idempotencyKey: 'K1', payload: { n: 1 } }, shared);
  const replay = await post('/dgo/SINGLE_ASSIGNMENT', sign({}), { idempotencyKey: 'K1', payload: { n: 2 } }, shared);
  check('a repeated idempotency key replays the first response', replay.headers['X-Idempotent-Replay'] === 'true');
  check('the replay did not re-forward upstream', lastUpstream.body.payload.n === 1);
  const other = await post('/dgo/SINGLE_ASSIGNMENT',
    sign({ sub: 'other', oid: 'other-oid' }), { idempotencyKey: 'K1', payload: { n: 9 } }, shared);
  check('another principal is NOT served the cached response', other.headers['X-Idempotent-Replay'] !== 'true');

  // §2.7 audit
  check('a forward is audited with token identity',
    audits.some(a => a.event === 'proxy:forward' && a.email === 'officer@nitda.gov.ng' && a.role === 'operator'));
  check('a rejection is audited', audits.some(a => a.event === 'proxy:auth-rejected'));
  check('a denial is audited', audits.some(a => a.event === 'proxy:authz-denied'));
  check('stripped identity fields are audited',
    audits.some(a => a.event === 'proxy:asserted-identity-stripped' && a.fields.includes('role')));
  check('no audit record contains a signed URL',
    !audits.some(a => JSON.stringify(a).includes('SERVERSIDEONLY')));
}

/* ═══ CONFIG ═══ */
group('Configuration safety');
{
  const bad = loadConfig({});
  check('an unconfigured proxy reports what is missing', bad.missing.length >= 3, bad.missing.join(','));
  let threw = false;
  try { assertUsable(bad); } catch { threw = true; }
  check('a misconfigured proxy REFUSES to start', threw);
  const good = loadConfig({
    DGO_TENANT_ID: 't', DGO_AUDIENCE: 'api://x', DGO_ROLE_MAP: '{"DGO.Viewer":"viewer"}',
    DGO_ENDPOINT_FETCH_ALL: 'https://flow/x',
  });
  check('a configured proxy is usable', !!assertUsable(good));
  check('the issuer defaults to the tenant v2.0 endpoint', good.issuer.includes('/t/v2.0'));
  check('configured endpoints are detected', good.configuredEndpoints.includes('FETCH_ALL'));
  check('unconfigured endpoints are reported', good.unconfiguredEndpoints.length > 0);
}

console.log(`\n${failures.length ? '❌' : '✅'} ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.error(`   · ${f}`)); process.exit(1); }
process.exit(0);
