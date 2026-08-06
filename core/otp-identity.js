// DGO R11.6 — OTP identity.
//
// An identity provider built entirely from Power Automate flows: no Entra, no Azure AD, no
// MSAL, no vendor SDK, and nothing added to a repository whose architecture is zero-build
// with no runtime dependencies. It satisfies core/auth.js's token-provider contract, so
// turning it on is the same activation path AUTHENTICATION_CONTRACT.md already describes.
//
// THE SHAPE OF THE THING
//   1. requestCode(email)         -> OTP_GENERATE mails a one-time code.
//   2. submitCode(email, code)    -> OTP_VERIFY exchanges it for a signed, expiring proof.
//   3. The proof is held here and handed to core/auth.js on demand.
//
// WHY A PROVIDER THAT CANNOT ACQUIRE SILENTLY
// getAccessToken() calls the registered provider whenever it needs a token, expecting
// acquisition to be non-interactive. OTP is interactive by construction — a human reads a
// mailbox. So this provider never initiates: it returns the proof obtained by submitCode()
// and otherwise throws SIGN_IN_REQUIRED, which the shell turns into a sign-in prompt. A
// provider that silently returned "no token" instead would let a governed action proceed
// looking authenticated and unauthorised, which is the ambiguity the enforced posture
// exists to remove.
//
// WHAT THIS DOES NOT DO
// It does not make anything server-authoritative on its own. The proof is only worth what
// the FLOW does with it: every flow must verify the signature and expiry itself and derive
// the role from DGO_UserDirectory rather than trusting any field the client sent. The
// client half cannot check its own work — see docs/reference/flow-contracts/IDENTITY.md.

import { invokeObsidianAction } from './api.js';
import { registerTokenProvider, clearToken } from './auth.js';
import { AuditLog } from './audit-log.js';
import { State } from './state.js';

/** Thrown when a governed action needs identity and nobody has signed in yet. */
export const SIGN_IN_REQUIRED = 'SIGN_IN_REQUIRED';

const STORAGE_KEY = 'dgo.r11.identity.proof';

let _proof = null; // { token, expiresAt, claims }

/* ------------------------------------------------------------------ *
 * Proof persistence
 *
 * Survives a reload so a refresh is not a re-authentication, and no longer. It is written
 * to sessionStorage rather than localStorage deliberately: a bearer proof should die with
 * the browser session, and localStorage is the same surface whose tamperability is the
 * reason this module exists.
 * ------------------------------------------------------------------ */

function safeSession() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

function persist(proof) {
  const s = safeSession();
  if (!s) return;
  try {
    if (proof) s.setItem(STORAGE_KEY, JSON.stringify(proof));
    else s.removeItem(STORAGE_KEY);
  } catch { /* quota or privacy mode — the proof simply does not survive reload */ }
}

function restore() {
  const s = safeSession();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isLive(parsed) ? parsed : null;
  } catch { return null; }
}

const isLive = p => Boolean(p?.token) && Number(p.expiresAt) > Date.now();

/* ------------------------------------------------------------------ *
 * The two calls
 * ------------------------------------------------------------------ */

/**
 * Ask OTP_GENERATE to mail a code.
 *
 * Returns `{ sent, expiresAt, reason }`. `sent:false` is reported honestly rather than
 * being smoothed into a "check your inbox" the platform cannot stand behind — the portal's
 * VERIFY contract makes the same demand for the same reason.
 */
export async function requestCode(email) {
  const address = String(email || '').trim().toLowerCase();
  if (!address) throw new Error('An email address is required.');

  const res = await invokeObsidianAction('REQUEST_OTP', { email: address });
  const sent = res?.sent !== false && res?.ok !== false;

  AuditLog.record({
    event: sent ? 'audit:otp-requested' : 'audit:otp-request-failed',
    actor: { email: address },
    meta: { reason: res?.reason || '' },
  });

  return {
    sent,
    expiresAt: res?.expiresAt || null,
    reason: res?.reason || (sent ? '' : 'The code could not be sent.'),
  };
}

/**
 * Exchange a code for a proof.
 *
 * The flow is the only party that can decide this. It compares the code in constant time,
 * expires and single-uses it, looks the caller up in DGO_UserDirectory, and returns the
 * role IT resolved. The role in the response is therefore a statement by the server about
 * the caller, which is exactly what the local `users` array never was.
 */
export async function submitCode(email, code) {
  const address = String(email || '').trim().toLowerCase();
  const entered = String(code || '').trim();
  if (!address || !entered) throw new Error('Both the email address and the code are required.');

  const res = await invokeObsidianAction('VERIFY_OTP', { email: address, code: entered });

  const token = res?.token || res?.verification || res?.proof;
  if (!token || res?.ok === false || res?.verified === false) {
    AuditLog.record({ event: 'audit:otp-verify-denied', actor: { email: address }, meta: { reason: res?.reason || 'rejected' } });
    throw new Error(res?.reason || 'That code was not accepted.');
  }

  // Claims come from the flow, never from anything the browser knows. `roles` is an array
  // so AuthConfig.roleClaimMap can map it exactly as an identity provider's group claim
  // would be mapped — the enforced path in core/auth.js needs no special case for OTP.
  const claims = res.claims || {
    preferred_username: res.email || address,
    email: res.email || address,
    name: res.name || res.fullName || address,
    roles: res.roles || (res.role ? [res.role] : []),
  };

  _proof = {
    token,
    expiresAt: Number(res.expiresAt) || (Date.parse(res.expiresAt) || Date.now() + 8 * 60 * 60 * 1000),
    claims,
  };
  persist(_proof);
  clearToken(); // drop any cached token so the next call takes the new proof

  AuditLog.record({
    event: 'audit:otp-verified',
    actor: { email: address },
    meta: { expiresAt: new Date(_proof.expiresAt).toISOString(), roles: claims.roles || [] },
  });

  return { ...(_proof.claims), expiresAt: _proof.expiresAt };
}

/** Discard the proof. Call on sign-out and on any 401 from a flow. */
export function signOut() {
  _proof = null;
  persist(null);
  clearToken();
  AuditLog.record({ event: 'audit:signed-out', actor: State.get()?.profile || {} });
}

/** Whether a live proof is held right now. */
export function isSignedIn() {
  if (isLive(_proof)) return true;
  _proof = restore();
  return isLive(_proof);
}

/** The identity the held proof asserts, or null. Display only — the flow decides. */
export function heldIdentity() {
  if (!isSignedIn()) return null;
  const c = _proof.claims || {};
  return Object.freeze({
    email: c.preferred_username || c.email || '',
    name: c.name || c.email || '',
    roles: c.roles || [],
    expiresAt: _proof.expiresAt,
  });
}

/**
 * Register this module as core/auth.js's token provider.
 *
 * Call once at boot when auth is enforced. Idempotent.
 */
export function installOtpProvider() {
  registerTokenProvider(async () => {
    if (!isSignedIn()) {
      const err = new Error('Sign in with the code sent to your email address.');
      err.code = SIGN_IN_REQUIRED;
      throw err;
    }
    return { token: _proof.token, expiresAt: _proof.expiresAt, claims: _proof.claims };
  });
  _proof = restore();
  return true;
}

export const OtpIdentity = Object.freeze({
  requestCode, submitCode, signOut, isSignedIn, heldIdentity, installOtpProvider, SIGN_IN_REQUIRED,
});
export default OtpIdentity;
