// DGO R11.6 — authentication configuration.
//
// The platform is in development. Every structure required for authenticated,
// server-authoritative operation is provisioned here and in core/auth.js, but held
// INERT so the development and pilot loop stays frictionless.
//
// ACTIVATION AT RELEASE
// --------------------
//   1. Set `enabled: true` (or inject `window.DGO_CONFIG.auth.enabled = true`).
//   2. Supply `tenantId` and `clientId` at deploy time — never commit them.
//   3. Ensure flow endpoints in window.DGO_CONFIG.endpoints enforce required auth/authz.
//      ⚠  Signed Power Automate endpoint URLs are credentials — restrict, rotate, and
//      handle them accordingly. Do not expose them unnecessarily.
//   4. Implement the server side per AUTHENTICATION_CONTRACT.md.
//
// Flipping `enabled` changes four behaviours at once, by design:
//   · every request carries `Authorization: ******
//   · the client-asserted `userEmail` field is no longer sent
//   · role/permission decisions read token claims instead of local state
//   · unauthenticated callers cannot reach a governed action at all
//
// Until then the runtime behaves exactly as it does today: local profile, local RBAC,
// no token. That is deliberate — a half-enabled auth layer is worse than none, because
// it invites the assumption that something is being enforced.
//
// NOTE ON AUTHORIZATION
// Client-side authentication (bearer token acquisition and attachment) does NOT provide
// server-side authorization. Each configured Power Automate flow endpoint must enforce
// its own authentication and authorization requirements.

const _runtime = (typeof window !== 'undefined' && window.DGO_CONFIG?.auth) || {};
const _pick = (key, fallback) => (key in _runtime ? _runtime[key] : fallback);

export const AuthConfig = Object.freeze({
  /** MASTER SWITCH. False = development posture. True = enforced posture. */
  enabled: _pick('enabled', false),

  /** Identity provider. The platform already runs on M365 / Power Platform. */
  provider: _pick('provider', 'entra-id'),

  /** Injected at deploy time. Empty here on purpose — these must never be committed. */
  tenantId: _pick('tenantId', ''),
  clientId: _pick('clientId', ''),
  authority: _pick('authority', ''),

  /** Scopes requested for the platform API. */
  scopes: Object.freeze(_pick('scopes', ['openid', 'profile', 'email'])),

  /**
   * While false-y auth is off, the runtime trusts `State.profile` and sends `userEmail`.
   * Enabling auth flips this to false and the client stops asserting identity entirely.
   */
  allowClientAssertedIdentity: _pick('allowClientAssertedIdentity', true),

  /**
   * Where the effective role comes from.
   *   'local'  — state.users / profile (development)
   *   'claims' — the identity token's role claim (release)
   */
  roleSource: _pick('roleSource', 'local'),

  /** Token claim carrying platform roles, when roleSource === 'claims'. */
  rolesClaim: _pick('rolesClaim', 'roles'),

  /** Map IdP group/role values onto config/rbac.config.js role ids. Populate at release. */
  roleClaimMap: Object.freeze(_pick('roleClaimMap', {})),

  /** Renew the access token this many seconds before it expires. */
  renewSkewSeconds: _pick('renewSkewSeconds', 120),

  /** Header used to carry the bearer token. */
  authorizationHeader: _pick('authorizationHeader', 'Authorization'),
});

/** True when the platform is running in enforced (release) posture. */
export function isAuthEnforced() {
  return AuthConfig.enabled === true;
}

/**
 * Configuration completeness check. Returns the keys that must be supplied before
 * `enabled` may be turned on. Surfaced by Diagnostics so the gap is visible before
 * anyone attempts activation rather than after.
 */
export function missingActivationConfig() {
  const required = ['tenantId', 'clientId'];
  const missing = required.filter(k => !String(AuthConfig[k] || '').trim());
  if (AuthConfig.roleSource === 'claims' && !Object.keys(AuthConfig.roleClaimMap).length) {
    missing.push('roleClaimMap');
  }
  return missing;
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
    identity: `server-issued token (${AuthConfig.provider})`,
    roleSource: AuthConfig.roleSource,
    warning: '',
    readyToActivate: true,
    missingConfig: missingActivationConfig(),
  });
}
