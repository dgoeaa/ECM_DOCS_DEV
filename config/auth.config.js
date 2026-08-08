// DGO R11.6 — authentication configuration.
//
// NO EXTERNAL IDENTITY PROVIDER. NO TENANT OR DIRECTORY TO REGISTER OR PAY FOR.
//
// This file used to describe an external identity-provider integration: a named `provider`,
// a `tenantId` and `clientId` to be supplied at deploy time, OIDC scopes, and a `roleClaimMap`
// translating an IdP's group claims onto platform roles. None of it was ever activated, and all of it is
// removed — it added a tenant registration, a directory dependency and an administrative
// approval to the critical path of a platform whose entire architecture is otherwise
// zero-build, zero-dependency and self-contained.
//
// Identity comes from `core/otp-identity.js` instead: OTP_GENERATE mails a one-time code,
// OTP_VERIFY exchanges it for a signed expiring proof, and the proof is what a governed
// request carries. Both are Power Automate flows the platform already calls directly, so
// identity has the same shape as everything else here — no tier to stand up, nothing to
// keep alive, and no vendor between the browser and the flow.
//
// WHAT ACTIVATION NOW REQUIRES
//   1. Set `enabled: true` (or inject `window.DGO_CONFIG.auth.enabled = true`).
//   2. Wire OTP_GENERATE and OTP_VERIFY. That is all the configuration there is.
//   3. Make each flow verify the proof's signature and expiry itself, and derive the role
//      from DGO_UserDirectory rather than trusting any field the client sent.
//
// Flipping `enabled` changes four behaviours at once, by design:
//   · every request carries the proof in the authorization header
//   · the client-asserted `userEmail` field is no longer sent
//   · role decisions read the verified proof instead of local state
//   · unauthenticated callers cannot reach a governed action at all
//
// Until then the runtime behaves as it does today: local profile, local RBAC, no proof.
// That is deliberate — a half-enabled auth layer is worse than none, because it invites the
// assumption that something is being enforced.
//
// NOTE ON AUTHORIZATION
// Acquiring and attaching a proof in the client does NOT provide server-side authorization.
// Step 3 above is the only thing that does, and no code in this repository can perform it.

const _runtime = (typeof window !== 'undefined' && window.DGO_CONFIG?.auth) || {};
const _pick = (key, fallback) => (key in _runtime ? _runtime[key] : fallback);

export const AuthConfig = Object.freeze({
  /** MASTER SWITCH. False = development posture. True = enforced posture. */
  enabled: _pick('enabled', false),

  /**
   * The only identity provider this platform has. Fixed rather than configurable: a second
   * value would imply a second implementation, and there is not one.
   */
  provider: 'otp',

  /**
   * While false-y auth is off, the runtime trusts `State.profile` and sends `userEmail`.
   * Enabling auth flips this to false and the client stops asserting identity entirely.
   */
  allowClientAssertedIdentity: _pick('allowClientAssertedIdentity', true),

  /**
   * Where the effective role comes from.
   *   'local'    — state.users / profile (development)
   *   'verified' — the identity the OTP proof resolves to, as the flow returns it
   *
   * There is no 'claims' option any more. Reading a role out of a token claim was the
   * identity-provider-shaped path, and it required an IdP to issue the claim and a map to translate it.
   */
  roleSource: _pick('roleSource', 'local'),

  /** Renew the proof this many seconds before it expires. */
  renewSkewSeconds: _pick('renewSkewSeconds', 120),

  /** Header used to carry the proof. */
  authorizationHeader: _pick('authorizationHeader', 'Authorization'),
});

/** True when the platform is running in enforced (release) posture. */
export function isAuthEnforced() {
  return AuthConfig.enabled === true;
}

/**
 * Configuration completeness check. Returns what must still be supplied before `enabled`
 * may be turned on.
 *
 * It used to return `tenantId` and `clientId` — values that had to be obtained from a
 * tenant administrator before the platform could be activated at all. There is nothing of
 * that kind left. What remains is the two OTP endpoints, which are ordinary endpoint
 * configuration and arrive with every other URL in the package.
 */
export function missingActivationConfig() {
  const endpoints = (typeof window !== 'undefined' && window.DGO_CONFIG?.endpoints) || {};
  return ['OTP_GENERATE', 'OTP_VERIFY'].filter(k => !String(endpoints[k] || '').trim());
}

/** Human-readable posture, for Diagnostics and evidence export. */
export function authPosture() {
  if (!AuthConfig.enabled) {
    return Object.freeze({
      posture: 'development',
      enforced: false,
      identity: 'client-asserted (localStorage profile)',
      roleSource: AuthConfig.roleSource,
      warning:
        'Authentication is provisioned but INERT. Client-asserted identity is trusted and ' +
        'RBAC is advisory only. Do not treat any governance control as enforced.',
      readyToActivate: missingActivationConfig().length === 0,
      missingConfig: missingActivationConfig(),
    });
  }
  return Object.freeze({
    posture: 'enforced',
    enforced: true,
    identity: 'one-time-code proof, verified by the flow',
    roleSource: AuthConfig.roleSource,
    warning: '',
    readyToActivate: true,
    missingConfig: missingActivationConfig(),
  });
}
