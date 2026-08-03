// Portable cryptographic primitives — WebCrypto only.
//
// WHY THIS EXISTS
// The proxy is moving to a Cloudflare Worker in front of the Power Automate flows. A Worker
// has no `node:crypto` and no `Buffer`. Both could be papered over with the `nodejs_compat`
// flag, and that was the tempting route, but it makes the proxy's correctness depend on how
// complete a particular runtime's Node shim happens to be — for `createPublicKey` and
// `crypto.verify` in particular, which is precisely the code path that decides whether a
// token is genuine. A compatibility shim is a bad place to put the thing that says yes or no
// to an identity claim.
//
// So: `globalThis.crypto.subtle` and `Uint8Array`, nothing else. That is the same API in
// Workers, Node 18+, Deno and Bun, so there is ONE implementation and no runtime branching —
// which also means the existing Node test suite exercises the exact code the Worker runs,
// rather than a sibling of it.
//
// WHAT CHANGED IN THE PORT, AND WHAT DID NOT
// Every security property is preserved, and one is strengthened: `importKey` binds a key to
// a single algorithm at import time, so key-confusion is refused by the platform rather than
// only by our own check. Both checks are kept — the explicit one gives a diagnosable error.
//
// The cost is that WebCrypto is asynchronous where `node:crypto` was not, so the ticket
// broker and the verification service became async. Every caller was already inside an async
// handler, so this cost nothing at the call sites.

const SUBTLE = globalThis.crypto?.subtle;
if (!SUBTLE) {
  throw new Error(
    'WebCrypto (globalThis.crypto.subtle) is not available. The proxy requires Node 18+, ' +
    'a Cloudflare Worker, Deno or Bun.');
}

/* ── bytes and text ─────────────────────────────────────────────────────────── */

const ENC = new TextEncoder();
const DEC = new TextDecoder();

export const utf8 = s => ENC.encode(String(s ?? ''));
export const fromUtf8 = b => DEC.decode(b);

export function b64uEncode(bytes) {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  // Chunked so a large array cannot blow the argument limit of String.fromCharCode.
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const s = String(str ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const hex = bytes =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * Constant-time comparison.
 *
 * WebCrypto offers no equivalent of `crypto.timingSafeEqual`, so this is written out. The
 * accumulator must be XORed over the WHOLE array with no early exit — a loop that breaks on
 * the first differing byte leaks the length of the matching prefix, which is enough to
 * recover a MAC one byte at a time.
 *
 * Unequal lengths return false immediately. That is safe here because every value compared
 * through this function is a fixed-length digest or a signature whose length is public.
 */
export function timingSafeEqual(a, b) {
  const x = a instanceof Uint8Array ? a : new Uint8Array(a);
  const y = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ── digests and MACs ───────────────────────────────────────────────────────── */

export async function sha256(bytes) {
  return new Uint8Array(await SUBTLE.digest('SHA-256', bytes));
}

export const sha256Hex = async bytes => hex(await sha256(bytes));

/**
 * Import an HMAC key once and reuse it.
 *
 * `importKey` on every call would be a needless await per signature on the hot path of
 * ticket issue and redemption. Keyed by the secret itself, which never leaves the process.
 */
const hmacKeys = new Map();
export async function hmacKey(secret) {
  const s = typeof secret === 'string' ? secret : fromUtf8(secret);
  let k = hmacKeys.get(s);
  if (!k) {
    k = await SUBTLE.importKey('raw', utf8(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hmacKeys.set(s, k);
  }
  return k;
}

export async function hmacSha256(key, data) {
  return new Uint8Array(await SUBTLE.sign('HMAC', key, typeof data === 'string' ? utf8(data) : data));
}

/* ── randomness ─────────────────────────────────────────────────────────────── */

export const randomUUID = () => globalThis.crypto.randomUUID();

/**
 * A uniform integer in [0, maxExclusive).
 *
 * Rejection sampling rather than `% maxExclusive`. The modulo is biased toward small values
 * whenever the range does not divide the generator's span evenly, and this generates the
 * emailed verification code — a bias there narrows the guessing space for exactly the
 * control that exists to make guessing expensive.
 */
export function randomInt(maxExclusive) {
  const max = Number(maxExclusive);
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError('randomInt: maxExclusive must be an integer in (0, 2^32]');
  }
  const limit = Math.floor(2 ** 32 / max) * max;   // largest unbiased multiple
  const buf = new Uint32Array(1);
  let v;
  do { globalThis.crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}

/* ── JWT signature verification ─────────────────────────────────────────────── */

/**
 * alg → WebCrypto import/verify parameters.
 *
 * This map is the allow-list. An algorithm absent from it is refused before any key is
 * touched, which is what defeats `alg=none` and the RS256→HS256 confusion attack: an
 * attacker cannot name an algorithm we do not already intend to permit.
 */
export const JWT_ALGS = Object.freeze({
  RS256: { kty: 'RSA', import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5' } },
  RS384: { kty: 'RSA', import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, verify: { name: 'RSASSA-PKCS1-v1_5' } },
  RS512: { kty: 'RSA', import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, verify: { name: 'RSASSA-PKCS1-v1_5' } },
  // saltLength = digest length, matching RSA_PSS_SALTLEN_DIGEST in the node implementation
  // this replaces. A shorter salt would still verify but would accept signatures the
  // previous code refused, which is a silent widening of what counts as valid.
  PS256: { kty: 'RSA', import: { name: 'RSA-PSS', hash: 'SHA-256' }, verify: { name: 'RSA-PSS', saltLength: 32 } },
  PS384: { kty: 'RSA', import: { name: 'RSA-PSS', hash: 'SHA-384' }, verify: { name: 'RSA-PSS', saltLength: 48 } },
  PS512: { kty: 'RSA', import: { name: 'RSA-PSS', hash: 'SHA-512' }, verify: { name: 'RSA-PSS', saltLength: 64 } },
  // JWS ECDSA signatures are raw R‖S, which is exactly what WebCrypto expects — the same
  // thing the node path spelled as dsaEncoding: 'ieee-p1363'.
  ES256: { kty: 'EC', crv: 'P-256', import: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' } },
  ES384: { kty: 'EC', crv: 'P-384', import: { name: 'ECDSA', namedCurve: 'P-384' }, verify: { name: 'ECDSA', hash: 'SHA-384' } },
});

/**
 * Import a JWK for verification under exactly one algorithm.
 *
 * The `crv` check has no counterpart in the node implementation this replaces, where the
 * curve came along with the key. Here the curve is named at import, so a P-521 key claiming
 * ES256 must be rejected explicitly rather than being quietly imported as something else.
 */
export async function importJwkForVerify(jwk, spec) {
  if (spec.crv && jwk.crv !== spec.crv) {
    throw new Error(`curve mismatch: key is ${jwk.crv}, algorithm requires ${spec.crv}`);
  }
  // `use`/`key_ops` are stripped: a JWKS may mark a key `sig` or omit the field entirely,
  // and WebCrypto rejects an import whose key_ops disagree with the requested usage.
  const { use, key_ops, alg, ext, ...material } = jwk;
  return SUBTLE.importKey('jwk', { ...material, ext: true }, spec.import, false, ['verify']);
}

export async function verifyJwtSignature(key, spec, signedBytes, signatureBytes) {
  try { return await SUBTLE.verify(spec.verify, key, signatureBytes, signedBytes); }
  catch { return false; }   // a malformed signature is a failed verification, not a crash
}
