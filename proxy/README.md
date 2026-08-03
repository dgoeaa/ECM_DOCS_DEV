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
| `src/upload.js` | Upload brokering: signed single-use tickets, byte verification, relay to SharePoint |
| `src/config.js` | Environment loading and start-up validation |
| `src/server.js` | `node:http` host |
| `test/proxy.test.mjs` | 66 assertions including the attack cases |
| `test/intake.test.mjs` | 36 assertions on the one unauthenticated route |
| `test/upload.test.mjs` | 25 assertions on ticket forgery, replay, expiry and byte verification |

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
| `DGO_UPLOAD_SECRET` | for uploads | ≥32 chars, signs upload tickets. **Absent ⇒ uploads are disabled, never unsigned** |
| `DGO_ENDPOINT_INTAKE_UPLOAD` | | Document library destination for relayed attachment bytes |
| `DGO_ENDPOINT_INTAKE_SUPPORT` | | Downstream for helpdesk cases. Absent ⇒ a case reference is still minted and `delivered:false` is returned |
| `DGO_ENDPOINT_INTAKE_STATUS` | | Registry lookup for status read-back. **Absent ⇒ `/intake/status` answers `503`, never `404`** |
| `DGO_ENDPOINT_SCAN_UPLOAD` | | Library destination for registry counter deposits. Falls back to `INTAKE_UPLOAD` when unset |

Contract keys are the 19 in `config/endpoints.config.js`. `GET /healthz` reports which are configured and which are still missing.

## The anonymous intake route

`/intake/*` is **the only unauthenticated path through this proxy.** It exists because the
document portal is a public channel: a citizen sending a letter to NITDA has no account and
should not need one. Four routes: `POST /intake/submission`, `PUT /intake/upload`,
`POST /intake/support` and `POST /intake/status`.

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

## Upload brokering

`PUT /intake/upload` accepts one attachment. The ticket travels in an `X-Upload-Ticket`
header — not the path, so it never lands in an access log or a `Referer` — and the body is
the raw file.

A ticket is an HMAC-signed, short-lived, **single-use** grant to upload **one named file of
one submission**. It carries its own expiry and is burned on redemption, so observing a
ticket does not let anyone replace a document that has already been accepted.

**Bytes are verified, not trusted.** The size and `sha256` declared at intake are checked
against what actually arrives; a mismatch is refused rather than reconciled by guessing.

**A deliberate departure from `TARGET_ARCHITECTURE.md` §3.3.** That section says the client
uploads *directly* to SharePoint using a URL the proxy hands it. On implementation that is
the wrong call: a Graph upload-session URL is a bearer credential, and handing one to a
browser reintroduces the very class of problem this proxy exists to retire. Uploads are
**relayed** through the proxy instead. Correspondence attachments are single-digit
megabytes, so the bandwidth cost is trivial, and relaying is what makes the digest check
possible at all.

`DGO_UPLOAD_SECRET` has **no default and no fallback**. Without it the broker is not
constructed, no tickets are issued, and `PUT /intake/upload` answers `503`. Starting with
unsigned tickets would be worse than starting without uploads.

## Status read-back

`POST /intake/status` takes `{ referenceId, email }` and returns the citizen-visible view of
one record. It is the **first unauthenticated read** in this proxy, which weakened the
create-only property intake started with, so three properties carry the weight:

| Property | What it buys |
|---|---|
| **Uniform denial** | An unknown reference and a wrong email return a byte-identical `404` — same status, same body, no distinguishing field. Otherwise the route answers "does `NITDA-2026-000318` exist?" for anybody who asks. |
| **Allow-listed projection** | Only the fields in `projectStatus` ever leave. The description, attachment list, assigned officer, handling unit and phone number are not among them. Built by allow-list so a field the registry adds later cannot leak through a forgotten blocklist entry. |
| **Its own rate limit** | 10/min per source, separate from the submission budget, so a guessing run cannot hide inside the more generous allowance or deny service to a legitimate submitter. |

Two further deliberate choices. It is a **POST** so the email does not land in an access log,
a `Referer` header or browser history. And the proxy **re-checks the email itself** after the
upstream answers — an upstream that ignores the parameter and matches on the reference alone
would otherwise turn this into an unauthenticated read of any record, and that check is not
delegated on the strength of an assumption about someone else's implementation.

A timeline `note` is carried only when the upstream marks the entry `public: true`. Internal
deliberation shares that timeline in most case systems, and the default for anything
unmarked must be to withhold it.

**What this does not solve.** References are sequential and therefore guessable, so the email
is the only real secret in the pair — and it is one submitters routinely publish. Rate
limiting is what makes online guessing impractical; it is not a substitute for an unguessable
reference. The durable fix is a high-entropy lookup token minted at submission and sent in
the acknowledgement email. Recorded as **F-030**, not assumed away.

With `DGO_ENDPOINT_INTAKE_STATUS` unset the route answers **503**, never 404: a 404 would
tell the submitter their request does not exist, which is a claim about the registry this
proxy is in no position to make when the truth is that it has nowhere to ask.

## Registry scan intake — the authenticated byte path

`PUT /documents/scan` brings a physically-received document into the registry. It is the
counterpart of `PUT /intake/upload`, and the difference is entirely in **who may call it**:

| | `/intake/upload` | `/documents/scan` |
|---|---|---|
| Caller | Anonymous | Authenticated staff |
| Authorization | A single-use HMAC ticket naming one file of one submission | Bearer token + `ROUTE_MANAGE` |
| Attribution | None — the submitter is a stranger | `depositedBy`, from the verified token |
| Bytes | `verifyBytes` → `relayToLibrary` | the same two functions |

**No ticket, deliberately.** A ticket exists so an anonymous caller can be granted exactly one
narrow thing. An authenticated clerk has already presented a verified token and passed a role
check; issuing them a ticket adds a round trip and no security, and the token carries an
identity the ticket never could.

**Not in `/intake/`.** That namespace is documented as the anonymous one. Putting a staff
route inside it would make the trust boundary a matter of reading code rather than reading a
path — so the route lives in its own namespace and the auth gate is visible from the URL.

**One implementation of the byte rules.** Both routes call `verifyBytes` and
`relayToLibrary`. They differ on the caller and nothing else, because two channels writing
into the same document library under different guarantees is how a library ends up holding
documents nobody can vouch for.

`ROUTE_MANAGE` is the required permission, so a `viewer` cannot deposit and neither can an
`executive` — depositing is an operational act, not a reporting one.

### Three things that must change before scaling out

All three are in-memory and therefore **per instance**:

1. **The rate limiters.** Behind N replicas the effective limits are N × 5/min for
   submissions and N × 10/min for status reads. Move them to a shared store or a front-door
   WAF rule — the status limit in particular is the control standing between a guessable
   reference and an enumeration run.
2. **The reference minter.** Two instances will mint the same reference. Back it with a
   durable counter or the registry's own numbering.
3. **The consumed-ticket set.** Single-use is enforced per instance, so behind N replicas a
   ticket could be redeemed up to N times. Move it to the same shared store as the others.

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
