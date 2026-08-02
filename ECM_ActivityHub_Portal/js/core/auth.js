// ECM Activity Hub Portal — authentication.
//
// Parity with the R11.6 runtime's core/auth.js. Provisioned complete, held INERT so the
// development and pilot loop is unchanged, and governed by exactly one flag.
//
// This closes the client half of AUDIT.md F-001, F-002 and F-003:
//   F-001  production identity was hardcoded in js/core/store.js
//   F-002  a UI control flipped the role between DGCEO and COS in the browser
//   F-003  every request envelope carried `user` and `role` taken from that mutable state
//
// Inert  (enabled === false): identity is the local Store profile, no Authorization
//        header, `user`/`role` still travel in the envelope, role switching still works.
//        Behaviour is byte-identical to before this file existed.
// Enforced (enabled === true): identity and role come from validated token claims,
//        `Authorization: Bearer` is attached, the envelope carries NO asserted identity,
//        and the role switch is refused.
//
// As with the runtime: the token provider is a registered function, not a bound SDK, so
// activation adds no runtime dependency to a zero-build application.

const _cfg = (typeof window !== "undefined" && window.DGO_CONFIG?.auth) || {};
const _pick = (k, d) => (k in _cfg ? _cfg[k] : d);

export const AuthConfig = Object.freeze({
  enabled: _pick("enabled", false),
  provider: _pick("provider", "entra-id"),
  tenantId: _pick("tenantId", ""),
  clientId: _pick("clientId", ""),
  scopes: Object.freeze(_pick("scopes", ["openid", "profile", "email"])),
  proxyBaseUrl: _pick("proxyBaseUrl", ""),
  rolesClaim: _pick("rolesClaim", "roles"),
  // Maps identity-provider roles onto the portal's own role vocabulary.
  roleClaimMap: Object.freeze(_pick("roleClaimMap", {})),
  renewSkewSeconds: _pick("renewSkewSeconds", 120),
});

export const isAuthEnforced = () => AuthConfig.enabled === true;

let _provider = null, _cached = null, _inflight = null;

export function registerTokenProvider(fn) {
  if (typeof fn !== "function") throw new Error("Token provider must be a function");
  _provider = fn;
  return true;
}
export const hasTokenProvider = () => typeof _provider === "function";
export function clearToken() { _cached = null; _inflight = null; }

const _expired = e => !e?.expiresAt || Date.now() >= e.expiresAt - AuthConfig.renewSkewSeconds * 1000;

/** Decode-only. No signature verification — that is the server's job. Display use only. */
export function decodeClaims(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return {}; }
}

export async function getAccessToken() {
  if (!isAuthEnforced()) return null;
  if (!_provider) {
    throw new Error(
      "Authentication is enabled but no token provider is registered. " +
      "Call registerTokenProvider() during boot — see AUTHENTICATION_CONTRACT.md."
    );
  }
  if (_cached && !_expired(_cached)) return _cached.token;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const r = await _provider({ scopes: AuthConfig.scopes });
      if (!r?.token) throw new Error("Token provider returned no token");
      _cached = {
        token: r.token,
        expiresAt: r.expiresAt || Date.now() + 55 * 60 * 1000,
        claims: r.claims || decodeClaims(r.token),
      };
      return _cached.token;
    } finally { _inflight = null; }
  })();
  return _inflight;
}

export const getClaims = () => (isAuthEnforced() ? _cached?.claims || {} : {});

export async function authHeaders() {
  if (!isAuthEnforced()) return {};
  const t = await getAccessToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** True while the client is permitted to assert its own identity in the envelope. */
export const clientMayAssertIdentity = () => !isAuthEnforced();

/** True while the in-browser role switch (F-002) is permitted. */
export const roleSwitchAllowed = () => !isAuthEnforced();

export function mapClaimRole(claims = getClaims()) {
  const raw = claims?.[AuthConfig.rolesClaim];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const v of values) if (AuthConfig.roleClaimMap[v]) return AuthConfig.roleClaimMap[v];
  return null;
}

/**
 * Effective identity.
 *   inert    -> the local Store profile, unchanged
 *   enforced -> token claims; role mapped, never read from Store
 */
export function getIdentity(store) {
  if (!isAuthEnforced()) {
    const u = store?.auth?.user || {};
    return Object.freeze({
      email: String(u.email || "").toLowerCase(),
      name: u.name || u.email || "Unknown",
      role: u.role || null,
      source: "local-store",
      verified: false,
    });
  }
  const c = getClaims();
  const email = String(c.preferred_username || c.email || c.upn || "").toLowerCase();
  return Object.freeze({
    email,
    name: c.name || email,
    role: mapClaimRole(c),
    source: "token-claims",
    verified: true,
  });
}

/** Gate a governed action. No-op while inert; throws when enforced and unauthenticated. */
export async function ensureAuthenticated(store, action = "action") {
  if (!isAuthEnforced()) return null;
  const token = await getAccessToken();
  if (!token) throw new Error("Authentication required.");
  const id = getIdentity(store);
  if (!id.role) throw new Error("No portal role is mapped for this account.");
  return id;
}

export function authPosture() {
  return Object.freeze(
    isAuthEnforced()
      ? { posture: "enforced", enforced: true, identity: `server-issued token (${AuthConfig.provider})`, warning: "" }
      : {
          posture: "development", enforced: false,
          identity: "client-asserted (local Store)",
          warning:
            "Authentication is provisioned but INERT. Identity and role are client-asserted " +
            "and may be altered in the browser. Do not treat any control as enforced.",
        }
  );
}

export const Auth = Object.freeze({
  AuthConfig, isAuthEnforced, registerTokenProvider, hasTokenProvider, getAccessToken,
  getClaims, getIdentity, authHeaders, clientMayAssertIdentity, roleSwitchAllowed,
  mapClaimRole, ensureAuthenticated, clearToken, authPosture,
});
export default Auth;
