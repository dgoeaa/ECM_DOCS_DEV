// Authenticating proxy — token verification.
//
// Implements AUTHENTICATION_CONTRACT.md §2.1: validate the signature against the
// provider's JWKS, plus iss, aud, exp and nbf. Reject anything that fails and never fall
// back to request-body content.
//
// Dependency-free by design. WebCrypto imports a JWK directly and verifies RS256/RS384/
// RS512 and PS*, so the platform's "no runtime dependencies" commitment holds on the
// server side too — and there is no third-party JWT library in the trust path.
//
// SECURITY NOTES, because the failure modes here are the classic ones:
//   · The `alg` header is NEVER trusted to select the algorithm. It is checked against an
//     allow-list and against the key's own type. This is what defeats alg=none and the
//     RS256→HS256 confusion attack.
//   · The key is selected by `kid` from JWKS. An unknown kid triggers at most one JWKS
//     refresh (rate-limited), then fails. It does not fall back to "try every key".
//   · Every claim check is explicit. Absent is not the same as valid.

/* The algorithm allow-list moved to crypto.js when the proxy was ported off node:crypto for
   Cloudflare Workers. It is the same list with the same refusals; only the parameter names
   changed, from node's to WebCrypto's. */
import {
  JWT_ALGS as ALGS, importJwkForVerify, verifyJwtSignature, b64uDecode, fromUtf8, utf8,
} from './crypto.js';

export class TokenError extends Error {
  constructor(reason, detail = '') {
    super(detail ? `${reason}: ${detail}` : reason);
    this.reason = reason;
    this.status = 401;
  }
}

const b64urlToBuf = b64uDecode;
const decodeJson = s => JSON.parse(fromUtf8(b64uDecode(s)));

/**
 * JWKS cache. Keys are refreshed on an unknown kid, but no more often than
 * `minRefreshMs` so an attacker cannot use forged kids to hammer the provider.
 */
export function createJwks({ jwksUri, fetchImpl = fetch, ttlMs = 3600_000, minRefreshMs = 60_000 }) {
  let keys = new Map();
  let fetchedAt = 0;
  let inflight = null;

  async function refresh(force = false) {
    const now = Date.now();
    if (!force && now - fetchedAt < ttlMs && keys.size) return keys;
    if (!force && inflight) return inflight;
    if (force && now - fetchedAt < minRefreshMs && keys.size) return keys; // rate limit
    inflight = (async () => {
      const res = await fetchImpl(jwksUri);
      if (!res.ok) throw new TokenError('jwks_unavailable', `HTTP ${res.status}`);
      const body = await res.json();
      const next = new Map();
      for (const k of body.keys || []) if (k.kid) next.set(k.kid, k);
      if (!next.size) throw new TokenError('jwks_empty');
      keys = next;
      fetchedAt = Date.now();
      return keys;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  return {
    async get(kid) {
      if (!kid) throw new TokenError('missing_kid');
      let map = await refresh(false);
      if (!map.has(kid)) map = await refresh(true); // one rate-limited retry
      const jwk = map.get(kid);
      if (!jwk) throw new TokenError('unknown_kid', kid);
      return jwk;
    },
    _size: () => keys.size,
  };
}

/**
 * Verify a compact JWS and return its validated claims.
 *
 * @param {string} token
 * @param {object} opts
 * @param {{get:(kid:string)=>Promise<object>}} opts.jwks
 * @param {string|string[]} opts.issuer   expected iss (exact match)
 * @param {string|string[]} opts.audience expected aud
 * @param {number} [opts.clockSkewSec=60]
 */
export async function verifyToken(token, { jwks, issuer, audience, clockSkewSec = 60 }) {
  if (typeof token !== 'string' || !token) throw new TokenError('missing_token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('malformed_token');

  let header, payload;
  try { header = decodeJson(parts[0]); } catch { throw new TokenError('malformed_header'); }
  try { payload = decodeJson(parts[1]); } catch { throw new TokenError('malformed_payload'); }

  // §2.1 — the algorithm comes from our allow-list, never from the token alone.
  const spec = ALGS[header.alg];
  if (!spec) throw new TokenError('unsupported_alg', String(header.alg));

  const jwk = await jwks.get(header.kid);
  // The key's own type must agree with the claimed algorithm. This is the check that
  // defeats key-confusion: an RSA key can never be used to verify an EC or HMAC token.
  if (jwk.kty !== spec.kty) throw new TokenError('alg_key_mismatch', `${header.alg} vs ${jwk.kty}`);
  if (jwk.alg && jwk.alg !== header.alg) throw new TokenError('alg_key_mismatch', jwk.alg);

  /* Imported for ONE algorithm. Beyond the explicit checks above, this means the runtime
     itself will refuse to verify with a key of the wrong type — key-confusion is now a
     platform guarantee rather than only our own. Both are kept: ours names the fault. */
  let key;
  try { key = await importJwkForVerify(jwk, spec); }
  catch (e) { throw new TokenError('bad_key', e.message); }

  const signed = utf8(`${parts[0]}.${parts[1]}`);
  const sig = b64urlToBuf(parts[2]);
  if (!await verifyJwtSignature(key, spec, signed, sig)) throw new TokenError('bad_signature');

  // §2.1 — every temporal and identity claim is checked explicitly.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number') throw new TokenError('missing_exp');
  if (now >= payload.exp + clockSkewSec) throw new TokenError('token_expired');
  if (typeof payload.nbf === 'number' && now < payload.nbf - clockSkewSec) throw new TokenError('token_not_yet_valid');

  const issuers = [].concat(issuer).filter(Boolean);
  if (!issuers.length) throw new TokenError('issuer_not_configured');
  if (!issuers.includes(payload.iss)) throw new TokenError('bad_issuer', String(payload.iss));

  const auds = [].concat(audience).filter(Boolean);
  if (!auds.length) throw new TokenError('audience_not_configured');
  const tokenAud = [].concat(payload.aud).filter(Boolean);
  if (!tokenAud.some(a => auds.includes(a))) throw new TokenError('bad_audience', tokenAud.join(','));

  return payload;
}

/** §2.2 — identity comes from the token and nowhere else. */
export function identityFrom(claims) {
  const subject = claims.oid || claims.sub;
  if (!subject) throw new TokenError('missing_subject');
  return Object.freeze({
    subject,
    email: String(claims.preferred_username || claims.email || claims.upn || '').toLowerCase(),
    name: claims.name || '',
  });
}
