# Deployment and pilot runbook — Cloudflare

End to end, in order. Nothing here is optional and nothing is skippable except where a step
says so explicitly.

**About values.** Every parameter name, file path, command and code value in this document is
real and final — copy them exactly. Nine values cannot be printed here because they exist
only inside your Cloudflare account, your identity provider and your Power Platform
environment. Each one is listed in §0 with the exact command or console page that produces
it. Nothing is invented and nothing is a stand-in.

---

## §0 · The nine values only you can obtain

Collect all nine before starting. Steps later refer to them by these names.

| # | Name used below | Where it comes from |
|---|---|---|
| V1 | Cloudflare account ID | `npx wrangler whoami` — the `Account ID` column |
| V2 | Cloudflare Access team domain | Cloudflare dashboard → Zero Trust → Settings → Custom Pages; shown as `<team>.cloudflareaccess.com` |
| V3 | Access application AUD tag | Zero Trust → Access → Applications → your app → Overview → **Application Audience (AUD) Tag** (64 hex characters) |
| V4 | The 6 Access group names | Zero Trust → Access → Groups — the `Name` of each group you create in §3.2 |
| V5 | 23 flow trigger URLs | One per `DGO_ENDPOINT_*` secret listed in §4.3. Regenerated (§2.1), rebuilt (§2.2) or newly created (§2.5) |
| V6 | `DGO_UPLOAD_SECRET` | Generate: `openssl rand -base64 48` |
| V7 | `DGO_VERIFY_SECRET` | Generate: `openssl rand -base64 48` |
| V8 | SharePoint document library upload endpoint | The Power Automate flow that writes to the library; its regenerated trigger URL |
| V9 | Pages project hostname | Assigned by `wrangler pages deploy` in §5, or your own custom domain |

V6 and V7 must be different from each other. Generate them now:

```bash
openssl rand -base64 48    # V6 — DGO_UPLOAD_SECRET
openssl rand -base64 48    # V7 — DGO_VERIFY_SECRET
```

Both are read by `proxy/src/config.js`, which requires at least 32 characters and refuses to
issue unsigned tickets or proofs if either is absent.

---

## §1 · Prerequisites

```bash
node --version      # must be v18.0.0 or higher; v22 is what the suite runs on
npx wrangler --version
npx wrangler login
npx wrangler whoami   # record V1
```

Confirm the repository is green before changing anything:

```bash
cd /path/to/ECM_DOCS_DEV
npm install
npm test
```

Expected: 23 stages pass, then `59 passed` from Playwright. If anything fails, stop — do not
deploy from a red tree.

---

## §2 · Regenerate every Power Automate trigger

**Do this before anything is written into Cloudflare.** Putting an existing trigger URL into a
Worker secret relocates a published credential rather than replacing it.

The repository contains signed trigger URLs for **25 workflows**. Full list with IDs:
`docs/cutover/FLOW_DECOMMISSION_INVENTORY.md`.

### 2.1 The 16 workflows that map to a platform endpoint

For each, open Power Automate → Solutions or My Flows → find the flow by its workflow ID →
open the **When an HTTP request is received** trigger → **Regenerate** → copy the new URL.

| Workflow ID | Endpoint key | Secret name to set in §4.3 |
|---|---|---|
| `02a3a70f3dec4dcd9a85a244a60c65b9` | (legacy `API_GET`, retired) | do not set — delete the flow |
| `1154b50e1d17420dadb3b012e7e2a02c` | `BULK_ASSIGNMENT` | `DGO_ENDPOINT_BULK_ASSIGNMENT` |
| `6b3bad3005b44bf6bced0f8074d3f2ed` | `SINGLE_ASSIGNMENT` | `DGO_ENDPOINT_SINGLE_ASSIGNMENT` |
| `7e71fffe770a45ccb93bf216bb53786e` | `BULK_ASSIGNMENT_DIRECT` | `DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT` |
| `818ec4053f1e4f0b87845114241d8b74` | `GET_DOCS` | `DGO_ENDPOINT_GET_DOCS` |
| `20e3b003a57f47febae8a24ad5b9acd4` | `AI_DOC_ANALYSIS` | `DGO_ENDPOINT_AI_DOC_ANALYSIS` |
| `20e6340941ce4b1bbb87b43c9102a777` | `FETCH_EMAIL_ATTACHMENTS` | `DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS` |
| `314aaf27593147089b38322e5ca25936` | `OTP_GENERATE` | `DGO_ENDPOINT_OTP_GENERATE` |
| `43879c5165de439680055ab4258b3f27` | `OTP_VERIFY` | `DGO_ENDPOINT_OTP_VERIFY` |
| `4a250f97181b4a28abc1d0fb0f7d4c4d` | `FETCH_ALL` | `DGO_ENDPOINT_FETCH_ALL` |
| `85c556f10b8244ba9d839a2ebe240b91` | `FETCH_ACTIVITIES` and `SUBSIDIARY_ACTIONS` | `DGO_ENDPOINT_FETCH_ACTIVITIES` and `DGO_ENDPOINT_SUBSIDIARY_ACTIONS` (same URL, both names) |
| `a13c8b577bd44f8787c50d095ea3faf9` | `AI_CHAT` | `DGO_ENDPOINT_AI_CHAT` |
| `a942d230337c4ddfa9a386e92bbd048b` | `EMAIL_RELATED_TASK` | `DGO_ENDPOINT_EMAIL_RELATED_TASK` |
| `bc83d98acf474a088832d78f50085388` | `DYNAMIC_ACTIONS` and `EMAIL` | `DGO_ENDPOINT_DYNAMIC_ACTIONS` and `DGO_ENDPOINT_EMAIL` (same URL, both names) |
| `d67f2acb3708449490eed561ee56efbe` | `REFERENCE_DATA` | `DGO_ENDPOINT_REFERENCE_DATA` |
| `fe794e0139784ac694768e5a716e0be7` | `AI_EMAIL_ANALYSIS` | `DGO_ENDPOINT_AI_EMAIL_ANALYSIS` |

### 2.2 Six flows carry TWO valid signatures each — delete these, do not regenerate

These six have two published signatures. Each had its trigger regenerated at some point and
the superseded signature was never revoked, so **both still work**. Regenerating once more
invalidates only the current one and leaves the older signature live.

| Workflow ID | Endpoint key | Action |
|---|---|---|
| `314aaf27593147089b38322e5ca25936` | `OTP_GENERATE` | Delete the flow, rebuild it, use the new URL |
| `43879c5165de439680055ab4258b3f27` | `OTP_VERIFY` | Delete the flow, rebuild it, use the new URL |
| `4a250f97181b4a28abc1d0fb0f7d4c4d` | `FETCH_ALL` | Delete the flow, rebuild it, use the new URL |
| `37642ba3597f4cf58288cc71b5e6b519` | none | Delete — nothing calls it |
| `3931e2ff995242b6b2c920c8b2209797` | none | Delete — nothing calls it |
| `ff455c68e9ac493e858fb984bcfd01fb` | none | Delete — nothing calls it |

Deleting the flow is the only action that invalidates every signature it has ever had. For
the three that carry an endpoint key, rebuild the flow with the same logic under a new
trigger and use that URL in §4.3.

The remaining 19 workflows have exactly one signature each and can be regenerated in place.

### 2.3 The remaining 6 workflows with no endpoint key

Three of the nine unreferenced workflows are already covered in §2.2. These are the other six:

```
1ff7714c11a74fa4a876f8f6a79b64d2    3fc71cc29d15481291fd341def327572
5b29edc84b5d4a8db3c885d8441aa977    7995c1eb50d94d5daa2780e71391d874
c43388639d14452faef4ca3042a95b23    ca0bafc172114e0bb4853c135246654c
```

Nothing in the platform calls these. **Delete each one.** They are live triggers with
published credentials and no consumer — the category most likely to be forgotten, because
nothing breaks when they are removed and nothing complains while they remain.

### 2.4 Three endpoints have no flow yet

`DISPATCH_OUTBOUND`, `ARCHIVE_REFERENCE` and the intake endpoints below have no workflow in
the inventory. `config/endpoints.config.js` declares `DISPATCH_OUTBOUND` and
`ARCHIVE_REFERENCE` with `.optional` backends, so the platform degrades gracefully without
them. Leave their secrets unset for the pilot.

### 2.5 Intake endpoints — build these if they do not exist

The public channel needs four flows. Each is an **When an HTTP request is received** trigger
that writes to the SharePoint correspondence list or library:

| Purpose | Secret name |
|---|---|
| Write a new correspondence record | `DGO_ENDPOINT_INTAKE_SUBMISSION` |
| Write attachment bytes to the library (V8) | `DGO_ENDPOINT_INTAKE_UPLOAD` |
| Read back one record's status | `DGO_ENDPOINT_INTAKE_STATUS` |
| Write a support case | `DGO_ENDPOINT_INTAKE_SUPPORT` |
| Send a verification code by email | `DGO_ENDPOINT_INTAKE_VERIFY_EMAIL` |
| Registry counter scan deposits | `DGO_ENDPOINT_SCAN_UPLOAD` |

`DGO_ENDPOINT_SCAN_UPLOAD` falls back to `DGO_ENDPOINT_INTAKE_UPLOAD` when unset, so one
library can serve both channels. Set it separately only if counter deposits must be filed
apart from public submissions.

If `DGO_ENDPOINT_INTAKE_STATUS` is unset, `/intake/status` answers `503`, not `404` — a 404
would be a false statement that the record does not exist.

---

## §3 · Cloudflare Access

### 3.1 Create the Access application

Zero Trust → Access → Applications → **Add an application** → **Self-hosted**.

| Field | Value |
|---|---|
| Application name | `NITDA DGO Platform` |
| Session Duration | `8 hours` |
| Application domain | V9 (the Pages hostname from §5) |

Save, then open the application's **Overview** tab and record the **Application Audience
(AUD) Tag** — that is V3.

### 3.2 Create six Access groups

Zero Trust → Access → **Groups** → Add a group, once per row. The platform has exactly six
roles and no others; these are the literal role identifiers in `config/rbac.config.js`.

| Group name (V4) | Maps to platform role | What that role can do |
|---|---|---|
| `DGO-SystemAdmin` | `systemAdmin` | Everything, including settings and diagnostics |
| `DGO-UserAdmin` | `userAdmin` | Create and disable users, assign roles |
| `DGO-Executive` | `executive` | Executive register, briefs, meetings, projects, executive approvals |
| `DGO-Director` | `director` | Approve, reject, dispatch, close, archive |
| `DGO-Operator` | `operator` | Registry intake, triage, assignment, treatment |
| `DGO-Viewer` | `viewer` | Read only |

Populate each group with the pilot officers' email addresses.

### 3.3 Add a policy

On the application → **Policies** → Add a policy:

| Field | Value |
|---|---|
| Policy name | `DGO pilot access` |
| Action | `Allow` |
| Include | Access groups → select all six groups from §3.2 |

### 3.4 Add the groups claim

Zero Trust → Settings → Authentication → your identity provider → enable **Add groups to
the JWT**. Without this the assertion carries no group membership and every officer resolves
to `viewer`.

---

## §4 · Deploy the Worker

### 4.1 Set the two flags that must be on

Edit `proxy/wrangler.toml`, `[vars]` block. Change these two lines from `"false"` to `"true"`:

```toml
DGO_REQUIRE_VERIFICATION = "true"
DGO_REQUIRE_DURABLE_REFERENCES = "true"
```

`DGO_REQUIRE_DURABLE_REFERENCES = "true"` makes the Worker refuse to serve if the Durable
Object binding is ever removed. Without it a cold start reissues `NITDA-2026-000001` and two
citizens hold a receipt for one reference.

Set `DGO_REQUIRE_VERIFICATION = "true"` only after
`DGO_ENDPOINT_INTAKE_VERIFY_EMAIL` is set in §4.3. The Worker refuses to start if
verification is required but no mail endpoint exists — requiring a code it cannot send would
take the public channel offline.

The rest of `[vars]` is already correct and needs no change:

```toml
DGO_INTAKE_REF_PREFIX = "NITDA"
DGO_UPSTREAM_TIMEOUT_MS = "20000"
DGO_TRUST_FORWARDED_FOR = "false"
```

`DGO_TRUST_FORWARDED_FOR` stays `"false"`. The Worker reads `cf-connecting-ip`, which the
edge sets and a caller cannot forge. `X-Forwarded-For` can be forged, and a rate limiter
keyed on a forgeable value is not a rate limiter.

### 4.2 First deploy — creates the Durable Object

```bash
cd proxy
npx wrangler deploy
```

The `[[migrations]]` block with `tag = "v1"` and `new_sqlite_classes = ["ReferenceCounter"]`
runs on this first deploy and creates the counter class. Deploy before setting secrets; the
Worker will answer `503 proxy_not_configured` until §4.3 is complete, which is correct.

### 4.3 Set every secret

Run each command and paste the value when prompted. Nothing goes in a file.

**Identity — four values, all four required.** For Cloudflare Access, `DGO_ISSUER` and
`DGO_JWKS_URI` must be set explicitly. If they are omitted the proxy derives Microsoft login
URLs from `DGO_TENANT_ID` and every token fails verification.

```bash
npx wrangler secret put DGO_TENANT_ID
# paste: V2, the team domain, e.g. the value shown as <team>.cloudflareaccess.com

npx wrangler secret put DGO_AUDIENCE
# paste: V3, the 64-character Application Audience (AUD) Tag

npx wrangler secret put DGO_ISSUER
# paste: https://<V2>   — the full team domain URL, with scheme, no trailing slash

npx wrangler secret put DGO_JWKS_URI
# paste: https://<V2>/cdn-cgi/access/certs
```

**Roles claim and mapping.** Cloudflare Access puts group membership in the `groups` claim,
not `roles`:

```bash
npx wrangler secret put DGO_ROLES_CLAIM
# paste exactly: groups

npx wrangler secret put DGO_ROLE_MAP
# paste exactly this single line, with the group names from §3.2:
```

```json
{"DGO-SystemAdmin":"systemAdmin","DGO-UserAdmin":"userAdmin","DGO-Executive":"executive","DGO-Director":"director","DGO-Operator":"operator","DGO-Viewer":"viewer"}
```

The proxy refuses to start if `DGO_ROLE_MAP` is absent, empty or invalid JSON. If you renamed
any group in §3.2, the key on the left must match the new name character for character.

**Signing secrets:**

```bash
npx wrangler secret put DGO_UPLOAD_SECRET     # paste V6
npx wrangler secret put DGO_VERIFY_SECRET     # paste V7
```

**Flow endpoints — one command per regenerated URL from §2:**

```bash
npx wrangler secret put DGO_ENDPOINT_FETCH_ALL
npx wrangler secret put DGO_ENDPOINT_FETCH_ACTIVITIES
npx wrangler secret put DGO_ENDPOINT_SUBSIDIARY_ACTIONS
npx wrangler secret put DGO_ENDPOINT_REFERENCE_DATA
npx wrangler secret put DGO_ENDPOINT_GET_DOCS
npx wrangler secret put DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS
npx wrangler secret put DGO_ENDPOINT_SINGLE_ASSIGNMENT
npx wrangler secret put DGO_ENDPOINT_BULK_ASSIGNMENT
npx wrangler secret put DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT
npx wrangler secret put DGO_ENDPOINT_DYNAMIC_ACTIONS
npx wrangler secret put DGO_ENDPOINT_EMAIL
npx wrangler secret put DGO_ENDPOINT_EMAIL_RELATED_TASK
npx wrangler secret put DGO_ENDPOINT_AI_EMAIL_ANALYSIS
npx wrangler secret put DGO_ENDPOINT_AI_DOC_ANALYSIS
npx wrangler secret put DGO_ENDPOINT_AI_CHAT
npx wrangler secret put DGO_ENDPOINT_OTP_GENERATE
npx wrangler secret put DGO_ENDPOINT_OTP_VERIFY
npx wrangler secret put DGO_ENDPOINT_INTAKE_SUBMISSION
npx wrangler secret put DGO_ENDPOINT_INTAKE_UPLOAD
npx wrangler secret put DGO_ENDPOINT_INTAKE_STATUS
npx wrangler secret put DGO_ENDPOINT_INTAKE_SUPPORT
npx wrangler secret put DGO_ENDPOINT_INTAKE_VERIFY_EMAIL
npx wrangler secret put DGO_ENDPOINT_SCAN_UPLOAD
```

### 4.4 Redeploy and verify

```bash
npx wrangler deploy
curl -s https://nitda-dgo-proxy.<V1-subdomain>.workers.dev/healthz | python3 -m json.tool
```

Required in the response:

```
"ok": true
"host": "cloudflare-worker"
"referenceSequence": "durable-object"
"referenceSequenceDurable": true
```

If `referenceSequenceDurable` is `false`, **stop**. The Durable Object is not bound and the
register will issue duplicate references. Re-check §4.1 and §4.2.

`unconfigured` lists every endpoint key with no secret. `DISPATCH_OUTBOUND` and
`ARCHIVE_REFERENCE` appearing there is expected per §2.4. Anything else appearing there is a
missed `wrangler secret put`.

### 4.5 Protect the Worker with Access

Zero Trust → Access → Applications → add a second self-hosted application:

| Field | Value |
|---|---|
| Application name | `NITDA DGO Proxy` |
| Application domain | the `workers.dev` hostname from §4.4, or your custom domain |
| Policy | the same `DGO pilot access` policy from §3.3 |

This is what causes `Cf-Access-Jwt-Assertion` to be injected. The proxy accepts that header
**and** `Authorization: Bearer`, verifying either one identically — signature against
`DGO_JWKS_URI`, issuer, audience and expiry. A caller who reaches the Worker directly and
forges the header supplies a JWT they cannot sign, and it fails at the signature.

Leave `/healthz` reachable by adding a **Bypass** policy for path `/healthz` if you want
external monitoring.

---

## §5 · Deploy the front end

### 5.1 Write the runtime config

Create `config/config.local.js`. This file is git-ignored and must never be committed.

Under Cloudflare Access it contains **no flow URLs at all** — every governed request routes
through the proxy, so the browser holds no credential:

```javascript
window.DGO_CONFIG = {
  endpoints: {},
  auth: {
    enabled: true,
    provider: 'cloudflare-access',
    roleSource: 'claims',
    rolesClaim: 'groups',
    allowClientAssertedIdentity: false,
    proxyBaseUrl: 'https://nitda-dgo-proxy.<V1-subdomain>.workers.dev',
    roleClaimMap: {
      'DGO-SystemAdmin': 'systemAdmin',
      'DGO-UserAdmin': 'userAdmin',
      'DGO-Executive': 'executive',
      'DGO-Director': 'director',
      'DGO-Operator': 'operator',
      'DGO-Viewer': 'viewer',
    },
  },
};
```

Replace `proxyBaseUrl` with the hostname verified in §4.4. `endpoints: {}` is deliberate and
correct — `core/data-client.js` routes to `proxyBaseUrl` when `auth.enabled` is true, so any
URL placed here would be both unused and a credential in a browser file.

Setting `auth.enabled: true` changes four behaviours at once: every request carries the
token, the client stops asserting `userEmail`, roles come from token claims instead of local
state, and unauthenticated callers cannot reach a governed action.

### 5.2 Configure the portal

Create `document-portal/config.local.js` — beside `index.html`, not inside `js/`. The pages load it with `<script src="config.local.js">`, which resolves relative to the HTML:

```javascript
window.PF_CONFIG = {
  proxyBaseUrl: 'https://nitda-dgo-proxy.<V1-subdomain>.workers.dev',
};
```

The portal is the public channel and stays unauthenticated — citizens have no account. It
reaches only `/intake/*`, which is the sole unauthenticated path through the proxy.

### 5.3 Deploy

```bash
cd /path/to/ECM_DOCS_DEV
npx wrangler pages project create nitda-dgo-platform --production-branch main
npx wrangler pages deploy . --project-name nitda-dgo-platform
```

Record the hostname it prints — that is V9. Go back to §3.1 and set it as the Access
application domain if you have not already.

---

## §6 · Verify before letting anyone in

Run all six. Each must produce the stated result.

**6.1 — The public channel accepts a submission and mints a reference**

```bash
curl -s -X POST https://nitda-dgo-proxy.<V1-subdomain>.workers.dev/intake/submission \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Deployment verification","category":"General Correspondence","senderEmail":"registry@nitda.gov.ng","sender":{"name":"Registry"},"description":"Verification of the deployed intake path."}'
```

Expect `referenceId` matching `NITDA-<current year>-<6 digits>`.

**6.2 — The sequence does not restart**

Run 6.1 three more times. The four references must be four consecutive numbers. If any
number repeats, the Durable Object is not bound — return to §4.1.

**6.3 — The authenticated path refuses an anonymous caller**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://nitda-dgo-proxy.<V1-subdomain>.workers.dev/FETCH_ALL \
  -H 'Content-Type: application/json' -d '{}'
```

Expect `401`. Anything else means the Worker is reachable without Access — recheck §4.5.

**6.4 — A forged assertion is refused**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://nitda-dgo-proxy.<V1-subdomain>.workers.dev/FETCH_ALL \
  -H 'Content-Type: application/json' \
  -H 'Cf-Access-Jwt-Assertion: forged.token.value' -d '{}'
```

Expect `401`.

**6.5 — Officers resolve to their real role**

Have one officer from each of the six groups sign in and open `#/diagnostics`. Each must show
their own email and the role their group maps to. If anyone shows `viewer` unexpectedly, the
groups claim is missing — return to §3.4. If anyone shows `systemAdmin` unexpectedly,
`auth.enabled` is not `true` in `config/config.local.js`.

**6.6 — The register is shared, not per-browser**

One officer registers a correspondence. A second officer, on a different machine, opens
`#/lookup` and finds it. If they cannot, `FETCH_ALL` is not reaching a flow and each officer
is working in their own browser copy — check `unconfigured` in `/healthz`.

---

## §7 · Confirm the routing before any real correspondence

`config/correspondence-categories.config.js` decides which desk a submission lands on. The
current mapping is marked provisional in the file because it has never been approved:

| Document kind | Routes to |
|---|---|
| Ministerial Directive | Executive Correspondence |
| Policy Submission | Policy / Regulation |
| Compliance Filing | Policy / Regulation |
| Application | Operations |
| Proposal | Operations |
| Project Proposal | Operations |
| Report | Operations |
| Meeting Request | General Administration |
| Event Invitation | General Administration |
| Official Correspondence | General Administration |
| General Correspondence | General Administration |

Seven of the eleven kinds are offered to the public on the portal: General Correspondence,
Application, Proposal, Report, Compliance Filing, Policy Submission, Event Invitation.

Confirm or correct both lists. Corrections are a single-file change to
`config/correspondence-categories.config.js`; `tests/categories.test.mjs` will fail if a kind
is left without a routing rule.

---

## §8 · Known limits during the pilot

Two guarantees are weaker than they will be, and both are visible rather than assumed.

**8.1 — Single-use is isolate-scoped.** Upload tickets and email verification proofs are
burned in isolate memory. A ticket redeemed in one isolate can be redeemed again in another.
`/healthz` reports `"singleUseScope": "isolate"`. The fix is a `DGO_STATE_DO` Durable Object
holding the burn-lists; `proxy/wrangler.toml` has the binding stubbed for it. Acceptable for
a supervised pilot, not for open public traffic.

**8.2 — Rate limits are per-isolate.** The intake limit of 5 submissions per address per
minute and the status limit of 10 reads per minute apply per isolate, so the effective limit
is higher than it reads. Add a Cloudflare WAF rate-limiting rule on `/intake/*` at the zone
level for a hard ceiling.

Neither affects the correctness of the register. The one that did — the reference sequence —
is closed by §4.

---

## §9 · Rollback

```bash
cd proxy
npx wrangler deployments list
npx wrangler rollback --message "reason for rollback"
```

Secrets and the Durable Object survive a rollback. The reference sequence is not reset by
one, and must not be reset manually: reissuing a number that is already on a citizen's
receipt is the failure this design exists to prevent.

To stop the public channel without taking the platform down, delete
`DGO_ENDPOINT_INTAKE_SUBMISSION`:

```bash
npx wrangler secret delete DGO_ENDPOINT_INTAKE_SUBMISSION
```

Submissions then receive `202` with `stored: false` and are audited, rather than being
silently lost.
