// DGO R11.6 — authentication service.
//
// Single owner of "who is calling". Provisioned complete, inert until
// config/auth.config.js sets `enabled: true`.
//
// DEVELOPMENT POSTURE (enabled === false)
//   getIdentity()    -> the local profile, exactly as today
//   getAccessToken() -> null
//   authHeaders()    -> {} (no Authorization header)
//   Behaviour is byte-identical to the pre-auth runtime.
//
// ENFORCED POSTURE (enabled === true)
//   getIdentity()    -> identity derived from validated token claims
//   getAccessToken() -> a live bearer token, renewed before expiry
//   authHeaders()    -> { Authorization: 'Bearer …' }
//   ensureAuthenticated() throws rather than proceeding unauthenticated.
//
// The token acquisition adapter is intentionally pluggable. `registerTokenProvider()`
// accepts any function returning { token, expiresAt, claims }. core/otp-identity.js is the
// or an injected host token. Nothing here hard-binds a vendor SDK, so activation does not
// require adding a runtime dependency to a repository whose stated architecture is
// zero-build with no runtime dependencies.

import { AuthConfig, isAuthEnforced } from '../config/auth.config.js';
import { State } from './state.js';
import { AuditLog } from './audit-log.js';

let _provider = null;
let _cached = null; // { token, expiresAt (ms epoch), claims }
let _inflight = null;

/** Register the token acquisition adapter. Called once at boot when auth is enabled. */
export function registerTokenProvider(fn) {
  if (typeof fn !== 'function') throw new Error('Token provider must be a function');
  _provider = fn;
  return true;
}

export function hasTokenProvider() {
  return typeof _provider === 'function';
}

function _expired(entry) {
  if (!entry?.expiresAt) return true;
  return Date.now() >= entry.expiresAt - AuthConfig.renewSkewSeconds * 1000;
}

/** Clear cached credentials. Call on sign-out or on a 401 from the backend. */
export function clearToken() {
  _cached = null;
  _inflight = null;
}

/**
 * Current access token, or null when auth is inert.
 * Renews automatically inside the configured skew window; concurrent callers share
 * one in-flight acquisition rather than stampeding the identity provider.
 */
export async function getAccessToken() {
  if (!isAuthEnforced()) return null;
  if (!_provider) {
    throw new Error(
      'Authentication is enabled but no token provider is registered. ' +
      'Call registerTokenProvider() during boot — see docs/architecture/AUTHENTICATION_CONTRACT.md.'
    );
  }
  if (_cached && !_expired(_cached)) return _cached.token;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const result = await _provider();
      if (!result?.token) throw new Error('Token provider returned no token');
      _cached = {
        token: result.token,
        expiresAt: result.expiresAt || Date.now() + 55 * 60 * 1000,
        claims: result.claims || _decodeClaims(result.token),
      };
      AuditLog.record({
        event: 'audit:auth-token-acquired',
        actor: { email: _cached.claims?.preferred_username || _cached.claims?.email || '' },
        meta: { provider: AuthConfig.provider, expiresAt: new Date(_cached.expiresAt).toISOString() },
      });
      return _cached.token;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/**
 * Best-effort JWT payload decode.
 *
 * This is for READING non-sensitive display claims on the client only. It performs NO
 * signature verification and must never be treated as proof of anything. Authorization
 * is decided by the server, which validates the signature, issuer and audience — see
 * docs/architecture/AUTHENTICATION_CONTRACT.md §2.
 */
export function _decodeClaims(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return {};
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

/** Claims of the current token, or {} when inert. */
export function getClaims() {
  return isAuthEnforced() ? (_cached?.claims || {}) : {};
}

/**
 * Headers to attach to a governed request.
 * Inert posture returns {} so today's requests are unchanged.
 */
export async function authHeaders() {
  if (!isAuthEnforced()) return {};
  const token = await getAccessToken();
  return token ? { [AuthConfig.authorizationHeader]: `Bearer ${token}` } : {};
}

/**
 * Whether the client may assert its own identity in the request body.
 * True during development; false the moment auth is enforced.
 */
export function clientMayAssertIdentity() {
  return !isAuthEnforced() && AuthConfig.allowClientAssertedIdentity !== false;
}

/**
 * Effective identity.
 *   inert    -> local profile (development behaviour preserved)
 *   enforced -> the identity the verified proof resolves to
 */
export function getIdentity() {
  if (!isAuthEnforced()) {
    const p = State.get()?.profile || {};
    return Object.freeze({
      email: String(p.email || '').toLowerCase(),
      name: p.name || p.email || 'Unknown',
      role: null,            // null => defer to local RBAC resolution
      source: 'local-profile',
      verified: false,
    });
  }
  const c = getClaims();
  const email = String(c.email || c.sub || '').toLowerCase();
  return Object.freeze({
    email,
    name: c.name || email,
    role: verifiedRole(c),
    source: 'verified-proof',
    verified: true,
  });
}

/**
 * The platform role the verified proof carries.
 *
 * This was `mapClaimRole()`: it read an identity provider's group values out of a token
 * claim and translated them through `AuthConfig.roleClaimMap`. Both the claim and the map
 * were Entra-shaped — they needed a directory to issue the groups and an administrator to
 * maintain the translation — and both are gone with it.
 *
 * The OTP flow resolves the caller against DGO_UserDirectory and returns the role it found,
 * so there is nothing to map. Returning null when the proof carries no role is unchanged and
 * load-bearing: callers must treat that as unauthorised rather than falling back to a local
 * role, which would reopen the escalation path the enforced posture exists to close.
 */
export function verifiedRole(claims = getClaims()) {
  const role = claims?.role;
  return typeof role === 'string' && role.trim() ? role.trim() : null;
}

/**
 * Gate a governed action. No-op while inert; throws when enforced and unauthenticated.
 * Call from action paths that must never run anonymously once auth is live.
 */
export async function ensureAuthenticated(action = 'governed-action') {
  if (!isAuthEnforced()) return null;
  const token = await getAccessToken();
  if (!token) {
    AuditLog.record({ event: 'audit:auth-required', meta: { action } });
    throw new Error('Authentication required.');
  }
  const identity = getIdentity();
  if (!identity.role) {
    AuditLog.record({
      event: 'audit:auth-role-unmapped',
      actor: { email: identity.email },
      meta: { action, provider: AuthConfig.provider },
    });
    throw new Error('No platform role is mapped for this account.');
  }
  return identity;
}

export const Auth = Object.freeze({
  registerTokenProvider, hasTokenProvider, getAccessToken, getClaims, getIdentity,
  authHeaders, clientMayAssertIdentity, verifiedRole, ensureAuthenticated, clearToken,
});
export default Auth;
