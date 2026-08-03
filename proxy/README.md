# Authenticating proxy

The component that makes the platform's governance **enforced** rather than advisory.

Implements every obligation in [`AUTHENTICATION_CONTRACT.md`](../AUTHENTICATION_CONTRACT.md) §2. Until this is deployed, every control in both client applications is a UX affordance — the browser can decline to send a request, but it can never prevent one.

**Status: reference implementation, complete and tested, not yet deployed.**

---

## Why it exists

Power Automate HTTP triggers cannot properly validate a JWT. Something must sit in front of them that does.

Beyond authentication, this retires the credential problem class outright. **The signed flow URLs live here, in server-side configuration, and are never sent to a browser.** After deployment there is no signature in any shipped asset to leak — which is a stronger outcome than rotating the existing ones.

```
Browser ──Bearer──▶ Proxy ──▶ validate sig/iss/aud/exp
                      │        derive role from claims
                      │        authorize action
                      │        strip client-asserted identity
                      └──────▶ Power Automate (signed URL, server-side only)
```

## Design

**No dependencies.** `node:crypto` imports a JWK and verifies RS/PS/ES signatures natively, so the platform's zero-dependency commitment holds on the server too — and there is no third-party JWT library in the trust path.

**The permission matrix is imported from `config/rbac.config.js`, not restated.** Two copies of an authorization matrix drift, and the drift is silent and always in the unsafe direction.

**Transport-agnostic.** `handleRequest()` takes and returns plain objects. `server.js` is one host; an Azure Function calling `handleRequest` directly is another. No hosting SDK is bound anywhere in this directory.

**Fails closed.** An unknown contract key requires the highest permission rather than passing through. A misconfigured proxy refuses to start — one that boots without an issuer validates nothing and is worse than no proxy at all.

## Files

| File | Role |
|---|---|
| `src/jwt.js` | JWKS cache, signature verification, claim validation (§2.1, §2.2) |
| `src/authorize.js` | Role mapping, per-action authorization, identity stripping (§2.3–2.5) |
| `src/handler.js` | Request pipeline, idempotency, audit, forwarding (§2.6, §2.7) |
| `src/intake.js` | **Anonymous** correspondence intake: validation, rate limiting, reference minting |
| `src/config.js` | Environment loading and start-up validation |
| `src/server.js` | `node:http` host |
| `test/proxy.test.mjs` | 66 assertions including the attack cases |
| `test/intake.test.mjs` | 36 assertions on the one unauthenticated route |

## Configuration

Everything sensitive comes from the environment. Nothing is committed.

| Variable | Required | Notes |
|---|---|---|
| `DGO_TENANT_ID` | ✅ | Entra tenant GUID |
| `DGO_AUDIENCE` | ✅ | Expected `aud` — the API app-ID URI |
| `DGO_ROLE_MAP` | ✅ | JSON, e.g. `{"DGO.Operator":"operator"}` |
| `DGO_ENDPOINT_<KEY>` | ✅ per endpoint | One signed URL per contract key, e.g. `DGO_ENDPOINT_FETCH_ALL` |
| `DGO_ISSUER` | | Defaults to the tenant v2.0 issuer |
| `DGO_JWKS_URI` | | Defaults to the tenant discovery keys endpoint |
| `DGO_ROLES_CLAIM` | | Default `roles` |
| `DGO_CLOCK_SKEW_SEC` | | Default `60` |
| `DGO_UPSTREAM_TIMEOUT_MS` | | Default `45000` |
| `PORT` | | Default `8081` |
| `DGO_ENDPOINT_INTAKE_SUBMISSION` | | Downstream for anonymous intake. Absent ⇒ a reference is still minted and `delivered:false` is returned |
| `DGO_TRUST_FORWARDED_FOR` | | `true` only when genuinely behind a trusted front door — see below |
| `DGO_INTAKE_REF_PREFIX` | | Default `NITDA` |

Contract keys are the 19 in `config/endpoints.config.js`. `GET /healthz` reports which are configured and which are still missing.

## The anonymous intake route

`POST /intake/submission` is **the only unauthenticated path through this proxy.** It exists
because the document portal is a public channel: a citizen sending a letter to NITDA has no
account and should not need one.

Because it is unauthenticated it is deliberately narrow:

- **Create only.** It brings a new submission into the registry. There is no path from here
  to an existing record, so an anonymous caller cannot read, list, search or mutate anything.
- **Rate limited.** Five submissions per address per minute, fixed window.
- **Validated, not forwarded.** The record sent downstream is rebuilt from known fields, so
  anything extra a caller sends is dropped — the same principle as `stripAssertedIdentity`
  on the authenticated path.
- **Server-minted references.** A client-supplied `referenceId` never survives.
- **Channel is fixed.** A caller cannot claim `channel: 'Registry'` or
  `correspondenceType: 'Registry'` and mislabel where a document came from.

It returns **202 Accepted**, not 200: the registry has accepted the submission and issued a
reference, but classification and routing have not happened yet.

### Two things that must change before scaling out

Both are in-memory and therefore **per instance**:

1. **The rate limiter.** Behind N replicas the effective limit is N × 5/min. Move it to a
   shared store or a front-door WAF rule.
2. **The reference minter.** Two instances will mint the same reference. Back it with a
   durable counter or the registry's own numbering.

`DGO_TRUST_FORWARDED_FOR` defaults to **false** deliberately. Trusting `X-Forwarded-For`
unconditionally lets any caller spoof a source address and defeat the rate limit entirely;
set it only when the proxy genuinely sits behind a front door that overwrites the header.

## Run

```bash
npm run test:proxy          # 66 assertions, no network, no browser

export DGO_TENANT_ID=<guid>
export DGO_AUDIENCE=api://dgo-platform
export DGO_ROLE_MAP='{"DGO.SystemAdmin":"systemAdmin","DGO.Operator":"operator","DGO.Viewer":"viewer"}'
export DGO_ENDPOINT_FETCH_ALL='https://…/invoke?…&sig=…'
node proxy/src/server.js
```

Then point the clients at it — no code change, only configuration:

```js
window.DGO_CONFIG = { auth: { enabled: true, proxyBaseUrl: 'https://<proxy-host>/dgo', /* … */ } };
```

## Deployment

Any host that can run Node 20 and hold secrets. **Azure Container Apps or App Service** are the straightforward routes — deploy `proxy/`, set the environment, done.

**Azure Functions:** import `handleRequest` and adapt the trigger's request/response shape. The handler is already the right shape for this.

**APIM instead:** viable — its `validate-jwt` policy covers §2.1–2.2 — but §2.3–2.6 (role mapping, per-action authorization against the platform matrix, identity stripping, idempotency) become policy XML that duplicates logic already written and tested here. **I'd recommend the Node handler**, with APIM in front of it for rate limiting and WAF if you want that layer.

Whatever the host: terminate TLS, restrict egress to the Power Automate environment, and give the proxy the only copy of the signed URLs.

## What it does not do

Stated plainly, so nobody assumes otherwise:

- **No token issuance.** Clients obtain tokens from Entra directly.
- **No user store.** Roles come from Entra app roles via `DGO_ROLE_MAP`.
- **In-memory idempotency.** Correct for a single instance; swap the store in `handler.js` for Redis or a table when running more than one.
- **No rate limiting.** Put APIM, Front Door or a gateway in front if you need it.
- **It does not make the flows safe on its own.** If a signed URL is also reachable from elsewhere, the proxy is a front door on an unlocked building. Rotate the existing signatures when this goes live, and treat the new ones as proxy-only.

## Test coverage

`npm run test:proxy` — 66 assertions:

- **§2.1** tampered payload, wrong signing key, `alg=none`, HS256 confusion, wrong key type for an allow-listed alg, unknown `kid`, expired, not-yet-valid, missing `exp`, foreign issuer, foreign audience, malformed, empty, unconfigured issuer
- **§2.2** subject resolution, email normalisation, missing subject
- **§2.3** mapped/unmapped claims, missing claim, most-capable-role selection
- **§2.4** stripping `user`, `role`, `userEmail` at top level and nested, preserving legitimate fields
- **§2.5** viewer/operator/director/systemAdmin against read and write contracts, unknown role, unknown contract failing closed
- **§2.6** replay of a repeated key, no re-forward, and **another principal is never served a cached response**
- **§2.7** forward/rejection/denial/strip all audited, and **no audit record contains a signed URL**
- **Config** missing configuration reported, misconfigured proxy refuses to start

Tokens are signed with a **real RSA key generated at run time** and verified through the real code path. A mocked signature check proves nothing.
