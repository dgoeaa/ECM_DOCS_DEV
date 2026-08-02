// Authenticating proxy — role derivation and per-action authorization.
//
// Implements AUTHENTICATION_CONTRACT.md §2.3, §2.4 and §2.5.
//
// The permission matrix is IMPORTED FROM THE PLATFORM ITSELF (config/rbac.config.js)
// rather than restated here. That is deliberate: two copies of an authorization matrix
// drift, and the drift is silent and always in the unsafe direction. One source, and the
// governance test suite already asserts its shape.

import { Roles, Permissions } from '../../config/rbac.config.js';

export class AuthzError extends Error {
  constructor(reason, detail = '') {
    super(detail ? `${reason}: ${detail}` : reason);
    this.reason = reason;
    this.status = 403;
  }
}

/**
 * §2.3 — the role is derived from token claims and mapped server-side.
 * Never accepts a role from the request body under any circumstance.
 */
export function roleFromClaims(claims, { rolesClaim = 'roles', roleClaimMap = {} } = {}) {
  const raw = claims?.[rolesClaim];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const mapped = values.map(v => roleClaimMap[v]).filter(Boolean);
  if (!mapped.length) throw new AuthzError('no_mapped_role', values.join(',') || 'none');
  // A principal carrying several mapped roles gets the most capable one, decided by
  // permission count — not by array order, which the provider controls.
  return mapped.sort((a, b) =>
    (Roles[b]?.permissions?.length || 0) - (Roles[a]?.permissions?.length || 0))[0];
}

/**
 * Which permission a contract key requires.
 *
 * Read contracts are readable by any authenticated principal with a mapped role; writes
 * are gated on a specific permission. Anything not listed is treated as privileged and
 * requires SETTINGS_MANAGE — an unknown action must fail closed, never open.
 */
export const ACTION_PERMISSION = Object.freeze({
  // reads
  FETCH_ACTIVITIES: null, FETCH_ALL: null, REFERENCE_DATA: null,
  GET_DOCS: null, FETCH_EMAIL_ATTACHMENTS: null,
  // writes
  SINGLE_ASSIGNMENT: Permissions.ROUTE_MANAGE,
  BULK_ASSIGNMENT: Permissions.BULK_ASSIGN,
  BULK_ASSIGNMENT_DIRECT: Permissions.BULK_ASSIGN,
  DYNAMIC_ACTIONS: Permissions.ROUTE_MANAGE,
  DISPATCH_OUTBOUND: Permissions.DISPATCH_APPROVE,
  ARCHIVE_REFERENCE: Permissions.ROUTE_MANAGE,
  EMAIL: Permissions.ROUTE_MANAGE,
  EMAIL_RELATED_TASK: Permissions.ROUTE_MANAGE,
  AI_EMAIL_ANALYSIS: Permissions.EXECUTIVE_VIEW,
  AI_DOC_ANALYSIS: Permissions.EXECUTIVE_VIEW,
  AI_CHAT: Permissions.EXECUTIVE_VIEW,
  OTP_GENERATE: null,
  OTP_VERIFY: null,
  SUBSIDIARY_ACTIONS: Permissions.ROUTE_MANAGE,
});

export function permissionsOf(role) {
  return Roles[role]?.permissions || [];
}

export function hasPermission(role, permission) {
  if (!permission) return true;           // read contract
  const perms = permissionsOf(role);
  return perms.includes(permission) || perms.includes('*');
}

/**
 * §2.5 — authorize the caller's role against the contract being invoked.
 * Fails closed on an unknown contract key.
 */
export function authorize(role, contractKey) {
  if (!role || !Roles[role]) throw new AuthzError('unknown_role', String(role));
  if (!(contractKey in ACTION_PERMISSION)) {
    // Unknown contract: require the most privileged permission rather than allowing it.
    if (!hasPermission(role, Permissions.SETTINGS_MANAGE)) {
      throw new AuthzError('unknown_contract', contractKey);
    }
    return { role, contractKey, permission: Permissions.SETTINGS_MANAGE };
  }
  const permission = ACTION_PERMISSION[contractKey];
  if (!hasPermission(role, permission)) {
    throw new AuthzError('insufficient_permission', `${role} lacks ${permission} for ${contractKey}`);
  }
  return { role, contractKey, permission };
}

/**
 * §2.4 — strip anything the client asserted about identity before the body is forwarded.
 * The client stops sending these once auth is enforced, but an attacker controls the
 * request body, so the proxy must not trust them even when present.
 */
export const CLIENT_ASSERTED_FIELDS = Object.freeze(['user', 'role', 'userEmail', 'actor', 'persona']);

export function stripAssertedIdentity(body) {
  if (!body || typeof body !== 'object') return { body, stripped: [] };
  const stripped = [];
  const clean = { ...body };
  for (const f of CLIENT_ASSERTED_FIELDS) {
    if (f in clean) { delete clean[f]; stripped.push(f); }
  }
  if (clean.payload && typeof clean.payload === 'object') {
    const p = { ...clean.payload };
    for (const f of CLIENT_ASSERTED_FIELDS) {
      if (f in p) { delete p[f]; stripped.push(`payload.${f}`); }
    }
    clean.payload = p;
  }
  return { body: clean, stripped };
}
