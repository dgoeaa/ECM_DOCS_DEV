// Authenticating proxy — the request handler.
//
// Implements AUTHENTICATION_CONTRACT.md §2 end to end:
//
//   §2.1  verify the token   →  jwt.js
//   §2.2  identity from token→  jwt.js identityFrom()
//   §2.3  role from claims   →  authorize.js roleFromClaims()
//   §2.4  ignore client-asserted identity → authorize.js stripAssertedIdentity()
//   §2.5  authorize per action→  authorize.js authorize()
//   §2.6  honour idempotency →  here
//   §2.7  audit server-side  →  here
//
// THE POINT OF THIS COMPONENT
// The signed Power Automate URLs live here, in server-side configuration, and are never
// sent to a browser. That is what retires the credential-in-client-code problem class
// rather than merely rotating it: after this is deployed there is no signature in any
// shipped asset to leak in the first place.
//
// Transport-agnostic: `handleRequest` takes and returns plain objects, so the same code
// runs under an Azure Function, a Container App, App Service, or the bundled node:http
// server in server.js. Nothing here binds a hosting SDK.

import { verifyToken, identityFrom, TokenError } from './jwt.js';
import { roleFromClaims, authorize, stripAssertedIdentity, AuthzError } from './authorize.js';
import { handleIntake } from './intake.js';
import { handleUpload, handleScanIntake } from './upload.js';

/** In-memory idempotency store. Swap for Redis or a table in a multi-instance deployment. */
export function createIdempotencyStore({ ttlMs = 300_000, max = 10_000 } = {}) {
  const seen = new Map(); // key -> { at, response }
  return {
    get(key) {
      const e = seen.get(key);
      if (!e) return null;
      if (Date.now() - e.at > ttlMs) { seen.delete(key); return null; }
      return e.response;
    },
    set(key, response) {
      if (seen.size >= max) {
        // Evict the oldest decile rather than clearing, so a burst cannot flush everything.
        const cut = Math.ceil(max / 10);
        [...seen.keys()].slice(0, cut).forEach(k => seen.delete(k));
      }
      seen.set(key, { at: Date.now(), response });
    },
    size: () => seen.size,
  };
}

const json = (status, body, headers = {}) => ({ status, headers: { 'Content-Type': 'application/json', ...headers }, body });

/**
 * @param {object} req  { method, path, headers, body }
 * @param {object} deps { config, jwks, idempotency, audit, fetchImpl }
 */
export async function handleRequest(req, deps) {
  const { config, jwks, idempotency, audit = () => {}, fetchImpl = fetch } = deps;
  const correlationId = req.headers?.['x-correlation-id'] || cryptoRandom();

  /* Authenticate and authorise one request. Used by the contract path below and by the
     registry scan route, so there is exactly ONE implementation of §2.1–§2.3 and §2.5. A
     second copy is how an auth gate drifts: the two diverge on a clock-skew default or a
     claim name, and only one of them is the one anybody reads.
     Returns { identity, claims, decision } on success or { response } to return verbatim. */
  const authenticate = async (contractKey) => {
    let claims, identity;
    try {
      /* Two ways a token arrives, because two front doors put it in different places.
         · Authorization: Bearer <jwt>   — a client that holds a token and attaches it.
         · Cf-Access-Jwt-Assertion       — Cloudflare Access authenticates at the edge and
           injects the assertion. The browser never holds a readable token at all, so there
           is no Authorization header to find.

         Accepting the Access header is NOT a weaker check. The token is verified exactly as
         rigorously either way — signature against the configured JWKS, issuer, audience,
         expiry. A caller who reaches the Worker directly and forges the header supplies a
         JWT they cannot sign, and it fails at the signature. What must not happen is
         trusting the header's PRESENCE; nothing here does. */
      const authz = req.headers?.authorization || req.headers?.Authorization || '';
      const bearer = /^Bearer\s+(.+)$/i.exec(authz)?.[1];
      const accessAssertion = req.headers?.['cf-access-jwt-assertion'] || '';
      const token = bearer || accessAssertion;
      if (!token) throw new TokenError('missing_bearer');
      claims = await verifyToken(token, {
        jwks, issuer: config.issuer, audience: config.audience, clockSkewSec: config.clockSkewSec,
      });
      identity = identityFrom(claims);
    } catch (e) {
      audit({ event: 'proxy:auth-rejected', correlationId, contractKey, reason: e.reason || 'error', at: new Date().toISOString() });
      return { response: json(401, { ok: false, error: 'unauthorized', reason: e.reason || 'invalid_token', correlationId }) };
    }
    let decision;
    try {
      const role = roleFromClaims(claims, { rolesClaim: config.rolesClaim, roleClaimMap: config.roleClaimMap });
      decision = authorize(role, contractKey);
    } catch (e) {
      audit({ event: 'proxy:authz-denied', correlationId, contractKey, subject: identity.subject,
              email: identity.email, reason: e.reason || 'error', at: new Date().toISOString() });
      return { response: json(403, { ok: false, error: 'forbidden', reason: e.reason || 'not_permitted', correlationId }) };
    }
    return { identity, claims, decision };
  };

  // Upload redemption is a PUT carrying raw bytes, so it is matched before the POST-only
  // gate below. It is still inside the /intake/ namespace and still unauthenticated —
  // the ticket IS the authorization, and it grants exactly one file of one submission.
  const seg = String(req.path || '').split('/').filter(Boolean);
  if (req.method === 'PUT' && seg[0] === 'intake' && seg[1] === 'upload') {
    return handleUpload(req, { ...deps, correlationId });
  }

  // Registry scan intake (channel C). Also a PUT of raw bytes, but on the OTHER side of the
  // trust boundary: authenticated, role-checked, and attributed to the depositing officer.
  // Deliberately outside the /intake/ namespace — that namespace is documented as the
  // anonymous one, and putting a staff route inside it would make the boundary a matter of
  // reading the code rather than reading the path.
  if (req.method === 'PUT' && seg[0] === 'documents' && seg[1] === 'scan') {
    const auth = await authenticate('SCAN_UPLOAD');
    if (auth.response) return auth.response;
    return handleScanIntake(req, { ...deps, identity: auth.identity, correlationId });
  }

  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  // ── /intake/* — the one unauthenticated path, and the only one.
  //
  // It is matched on a path SEGMENT, not a prefix: `startsWith('/intake')` would also
  // match `/intake-anything`, and a bypass of the auth gate is not somewhere to be relaxed
  // about string matching. Everything below this block requires a validated token.
  //
  // Scope is enforced inside intake.js: create-only, rate-limited, size-capped, and the
  // registry reference is minted server-side. See TARGET_ARCHITECTURE.md §3.6.
  const segments = String(req.path || '').split('/').filter(Boolean);
  if (segments[0] === 'intake' || (segments.length > 1 && segments[segments.length - 2] === 'intake')) {
    if (!deps.rateLimiter || !deps.minter) {
      return json(503, { ok: false, error: 'intake_not_available', correlationId });
    }
    return handleIntake(req, { ...deps, correlationId });
  }

  // The contract key is the last path segment: POST /dgo/SINGLE_ASSIGNMENT
  const contractKey = String(req.path || '').split('/').filter(Boolean).pop() || '';
  if (!contractKey) return json(404, { ok: false, error: 'no_contract_key' });

  // ── §2.1 / §2.2 authenticate · §2.3 / §2.5 derive role and authorize the action
  const auth = await authenticate(contractKey);
  if (auth.response) return auth.response;
  const { identity, claims, decision } = auth;

  // ── §2.4 — discard anything the client asserted about who it is
  const { body: cleanBody, stripped } = stripAssertedIdentity(req.body || {});
  if (stripped.length) {
    audit({ event: 'proxy:asserted-identity-stripped', correlationId, contractKey,
            subject: identity.subject, fields: stripped, at: new Date().toISOString() });
  }

  // ── §2.6 — honour the client's idempotency key, scoped to the caller so one principal
  //           cannot replay or observe another's result
  const rawKey = cleanBody.idempotencyKey || cleanBody.payload?.idempotencyKey;
  const idemKey = rawKey ? `${identity.subject}:${contractKey}:${rawKey}` : null;
  if (idemKey) {
    const cached = idempotency.get(idemKey);
    if (cached) {
      audit({ event: 'proxy:idempotent-replay', correlationId, contractKey, subject: identity.subject, at: new Date().toISOString() });
      return { ...cached, headers: { ...cached.headers, 'X-Idempotent-Replay': 'true' } };
    }
  }

  // ── forward. The signed URL is resolved here and never leaves the server.
  const target = config.endpoints?.[contractKey];
  if (!target) {
    audit({ event: 'proxy:unconfigured-endpoint', correlationId, contractKey, at: new Date().toISOString() });
    return json(502, { ok: false, error: 'endpoint_not_configured', contractKey, correlationId });
  }

  // §2.7 — the identity recorded is the token-derived one, never the client's claim.
  audit({ event: 'proxy:forward', correlationId, contractKey, subject: identity.subject,
          email: identity.email, role: decision.role, permission: decision.permission,
          at: new Date().toISOString() });

  const upstreamBody = {
    ...cleanBody,
    // Injected server-side, after verification. Downstream flows read these and nothing else.
    _identity: { subject: identity.subject, email: identity.email, name: identity.name, role: decision.role },
  };

  let response;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), config.upstreamTimeoutMs || 45_000);
    try {
      const r = await fetchImpl(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        body: JSON.stringify(upstreamBody),
        signal: ctl.signal,
      });
      const text = await r.text();
      let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      response = json(r.ok ? 200 : 502, r.ok ? data : { ok: false, error: 'upstream_error', status: r.status, data, correlationId });
    } finally { clearTimeout(timer); }
  } catch (e) {
    audit({ event: 'proxy:upstream-failed', correlationId, contractKey, subject: identity.subject,
            error: String(e?.message || e), at: new Date().toISOString() });
    return json(504, { ok: false, error: 'upstream_unreachable', correlationId });
  }

  if (idemKey && response.status === 200) idempotency.set(idemKey, response);
  return { ...response, headers: { ...response.headers, 'X-Correlation-Id': correlationId } };
}

function cryptoRandom() {
  try { return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2); }
  catch { return Math.random().toString(36).slice(2); }
}
