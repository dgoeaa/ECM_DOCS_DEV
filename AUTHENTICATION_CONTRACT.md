# Authentication Contract — DGO R11.6

**Status: PROVISIONED, INERT.** Every structure described here exists in the codebase today and is switched off. This document is the specification for turning it on.

> **The client half is done. The server half is not, and cannot be done by the client.**
> Everything in `core/auth.js` and `config/auth.config.js` is preparation. Until the
> obligations in §2 are implemented in the backend, **no control in this platform is
> enforced** — the client can only decline to send a request, never prevent one.

---

## 1. Current posture

| | Development (today) | Enforced (at release) |
|---|---|---|
| `AuthConfig.enabled` | `false` | `true` |
| Identity source | `localStorage` profile | Validated token claims |
| `Authorization` header | absent | `Bearer <token>` |
| `userEmail` in request body | sent | **not sent** |
| Role resolution | `state.users` lookup | `roleClaimMap[claim]` |
| Endpoint target | signed flow URL | authenticating proxy |
| Tampering with `localStorage` | **changes effective role** | no effect |

The development posture is deliberate: a half-enabled auth layer is worse than none, because it invites the assumption that something is being enforced.

## 2. Server obligations — the part that actually enforces

Every governed endpoint **must** perform all of the following. A gap in any one of them nullifies the rest.

1. **Validate the token.** Signature against the provider's JWKS, plus `iss`, `aud`, `exp`, `nbf`. Reject anything that fails — never fall back to body content.
2. **Derive identity from the token only.** `sub` / `oid` for identity; `preferred_username` / `email` for display.
3. **Derive role from the token only.** Read the configured roles claim and map it server-side. **Do not accept a role from the client under any circumstances.**
4. **Ignore `userEmail` entirely.** When auth is enforced the client stops sending it, but the backend must not trust it even if present — an attacker controls the request body.
5. **Authorize per action.** Check the caller's role against the action being invoked, using the same matrix as `config/rbac.config.js` §`Roles`. Client-side route guards are UX only.
6. **Enforce idempotency.** Honour the `idempotencyKey` the client supplies (`core/idempotency.js`) so retries cannot double-apply a write.
7. **Audit server-side.** Log the token-derived identity, not the client-supplied one.

### Why a proxy

Power Automate HTTP triggers cannot validate a JWT properly on their own. The realistic production shape is an authenticating proxy — Azure API Management or an Azure Function — that performs §2.1–2.3 and forwards to the flow over a private channel.

`AuthConfig.proxyBaseUrl` provisions for this now: when set and auth is enabled, `core/data-client.js` routes every governed request to `${proxyBaseUrl}/${contractKey}` instead of a signed flow URL. **Activation therefore requires no endpoint re-plumbing, and signed URLs stop reaching the browser at all** — which retires the entire SAS-in-client-code problem class rather than merely rotating it.

## 3. Activation procedure

1. **Register an app** in Entra ID. Note tenant id and client id. Define app roles matching `config/rbac.config.js`: `systemAdmin`, `userAdmin`, `executive`, `director`, `operator`, `viewer`.
2. **Stand up the proxy** implementing §2, in front of the Power Automate flows.
3. **Inject configuration at deploy time** — never commit it:

```js
window.DGO_CONFIG = {
  auth: {
    enabled: true,
    tenantId: '<tenant-guid>',
    clientId: '<client-guid>',
    proxyBaseUrl: 'https://<proxy-host>/dgo',
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
  }
};
```

4. **Register a token provider** during boot. Any function returning `{ token, expiresAt, claims }` works — MSAL, a broker endpoint, or a host-injected token. No vendor SDK is hard-bound, so this adds no runtime dependency:

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
| `core/data-client.js` | Attaches `Authorization`; drops `userEmail`; routes via proxy; blocks unauthenticated requests |
| `core/current-user.js` | Resolves identity and role from token claims, not `state.users` |
| `core/auth.js` | `ensureAuthenticated()` throws instead of no-op; token renewed within the skew window |
| `config/rbac.config.js` | Unchanged — the same role/permission matrix, fed from a trustworthy source |

Note the last row. The RBAC model was never the weakness; **its input was.**

## 5. Regression guarantees

`tests/auth-posture.test.mjs` asserts, and CI enforces:

- **Inert posture is behaviour-preserving** — no `Authorization` header, `userEmail` still sent, `ensureAuthenticated()` a no-op. Adding auth must not disturb development or pilots.
- **Enforced posture sends no anonymous request** — every governed call carries a bearer token or throws.
- **Enforced posture ignores local role tampering** — the demonstrated `viewer` → `systemAdmin` escalation is encoded as a test that fails if the local path is ever reinstated.
- **Activation readiness is checked** — `missingActivationConfig()` names every key still required, surfaced through Diagnostics before anyone attempts to activate.

## 6. Known limitation while inert

Until activation, the platform trusts client-asserted identity and RBAC is advisory. This is recorded as **G-04** in `CAPABILITY_ASSESSMENT_R11.6.md` and remains open by design during development.

`authPosture()` returns this warning at runtime, and Diagnostics surfaces it, so the state is visible in the product rather than only in documentation:

> *Authentication is provisioned but INERT. Client-asserted identity is trusted and RBAC is advisory only. Do not treat any governance control as enforced.*
