# Authentication Contract — DGO R11.6

**Status: PROVISIONED, INERT.** Every structure described here exists in the codebase today and is switched off. This document is the specification for turning it on.

The platform operates without any external proxy. Every request is sent **directly** to the configured Power Automate flow endpoint URL from `window.DGO_CONFIG.endpoints`. When authentication is enabled, a bearer token is attached to each request. **The flow endpoint itself must enforce required authentication and authorization.**

> ⚠ **Signed endpoint URLs are credentials.** Power Automate HTTP trigger URLs containing SAS signatures are equivalent to passwords — they must be restricted, rotated regularly, and never committed to source control. `config/config.local.js` is git-ignored for this reason.

---

## 1. Current posture

| | Development (today) | Enforced (at release) |
|---|---|---|
| `AuthConfig.enabled` | `false` | `true` |
| Identity source | `localStorage` profile | Validated token claims |
| `Authorization` header | absent | `****** |
| `userEmail` in request body | sent | **not sent** |
| Role resolution | `state.users` lookup | `roleClaimMap[claim]` |
| Endpoint target | configured flow URL | configured flow URL (with bearer token) |
| Tampering with `localStorage` | **changes effective role** | no effect |

The development posture is deliberate: a half-enabled auth layer is worse than none, because it invites the assumption that something is being enforced.

## 2. Server obligations — the part that actually enforces

Every governed Power Automate endpoint **must** perform all of the following. Client-side authentication (bearer token acquisition and attachment) does NOT provide server-side authorization — the flow endpoints must enforce this themselves.

1. **Validate the token.** Signature against the provider's JWKS, plus `iss`, `aud`, `exp`, `nbf`. Reject anything that fails — never fall back to body content.
2. **Derive identity from the token only.** `sub` / `oid` for identity; `preferred_username` / `email` for display.
3. **Derive role from the token only.** Read the configured roles claim and map it server-side. **Do not accept a role from the client under any circumstances.**
4. **Ignore `userEmail` entirely.** When auth is enforced the client stops sending it, but the backend must not trust it even if present — an attacker controls the request body.
5. **Authorize per action.** Check the caller's role against the action being invoked, using the same matrix as `config/rbac.config.js` §`Roles`. Client-side route guards are UX only.
6. **Enforce idempotency.** Honour the `idempotencyKey` the client supplies (`core/idempotency.js`) so retries cannot double-apply a write.
7. **Audit server-side.** Log the token-derived identity, not the client-supplied one.

## 3. Activation procedure

1. **Register an app** in Entra ID. Note tenant id and client id. Define app roles matching `config/rbac.config.js`: `systemAdmin`, `userAdmin`, `executive`, `director`, `operator`, `viewer`.
2. **Configure your Power Automate flows** to validate the bearer token and enforce authorization for each action. No external proxy or Azure APIM is required.
3. **Inject configuration at deploy time** — never commit it:

```js
window.DGO_CONFIG = {
  auth: {
    enabled: true,
    tenantId: '<tenant-guid>',
    clientId: '<client-guid>',
    roleSource: 'claims',
    rolesClaim: 'roles',
    roleClaimMap: {
      'DGO.SystemAdmin': 'systemAdmin',
      'DGO.UserAdmin':   'userAdmin',
      'DGO.Executive':   'executive',
      'DGO.Director':    'director',
      'DGO.Operator':    'operator',
      'DGO.Viewer':      'viewer'
    }
  },
  endpoints: {
    FETCH_ALL:          '<rotated-flow-url>',
    REFERENCE_DATA:     '<rotated-flow-url>',
    SINGLE_ASSIGNMENT:  '<rotated-flow-url>',
    BULK_ASSIGNMENT:    '<rotated-flow-url>',
    DYNAMIC_ACTIONS:    '<rotated-flow-url>',
    SUBSIDIARY_ACTIONS: '<rotated-flow-url>'
    // … all required endpoints
  }
};
```

4. **Register a token provider** during boot. Any function returning `{ token, expiresAt, claims }` works — MSAL, a broker endpoint, or a host-injected token. No vendor SDK is hard-bound:

```js
import { registerTokenProvider } from './core/auth.js';
registerTokenProvider(async ({ scopes }) => {
  const result = await msalInstance.acquireTokenSilent({ scopes });
  return { token: result.accessToken, expiresAt: result.expiresOn.getTime(), claims: result.idTokenClaims };
});
```

5. **Verify** with `npm run test:auth`. The suite asserts both postures; §5 explains what it proves.

## 4. What changes automatically on activation

Flipping `enabled` changes four behaviours at once, by design — they are not independently switchable, because any one of them alone produces a false sense of enforcement:

| Component | Behaviour |
|---|---|
| `core/data-client.js` | Attaches `Authorization: ******; drops `userEmail`; blocks unauthenticated requests; routes directly to configured endpoint URL |
| `core/current-user.js` | Resolves identity and role from token claims, not `state.users` |
| `core/auth.js` | `ensureAuthenticated()` throws instead of no-op; token renewed within the skew window |
| `config/rbac.config.js` | Unchanged — the same role/permission matrix, fed from a trustworthy source |

Note the last row. The RBAC model was never the weakness; **its input was.**

## 5. Regression guarantees

`tests/auth-posture.test.mjs` asserts, and CI enforces:

- **Inert posture is behaviour-preserving** — no `Authorization` header, `userEmail` still sent, `ensureAuthenticated()` a no-op. Adding auth must not disturb development or pilots.
- **Enforced posture sends no anonymous request** — every governed call carries a bearer token or throws.
- **Enforced posture ignores local role tampering** — the demonstrated `viewer` → `systemAdmin` escalation is encoded as a test that fails if the local path is ever reinstated.
- **Both postures route directly to configured endpoint URLs** — no external proxy, APIM, or Azure Function is consulted. The data client resolves to the flow URL from `window.DGO_CONFIG.endpoints`.
- **Activation readiness is checked** — `missingActivationConfig()` names every key still required, surfaced through Diagnostics before anyone attempts to activate. `proxyBaseUrl` is NOT required.

## 6. Known limitation while inert

Until activation, the platform trusts client-asserted identity and RBAC is advisory. This is recorded as **G-04** in `docs/audits/CAPABILITY_ASSESSMENT_R11.6.md` and remains open by design during development.

`authPosture()` returns this warning at runtime, and Diagnostics surfaces it, so the state is visible in the product rather than only in documentation:

> *Authentication is provisioned but INERT. Client-asserted identity is trusted and RBAC is advisory only. Do not treat any governance control as enforced.*
