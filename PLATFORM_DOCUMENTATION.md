# DGO Digital Operations — Platform Documentation

**Version** R11.6.0 `enterprise-domains` · **Repository** `dgoeaa/ECM_DOCS_DEV` (private) · **Date** 2 August 2026

Owner: National Information Technology Development Agency (NITDA), Federal Ministry of Communications, Innovation & Digital Economy, Nigeria.

---

## 1. What the platform is

DGO Digital Operations manages **one governed lifecycle for every correspondence, assignment, approval and dispatch** passing through the Office of the Director-General.

Correspondence arrives from four sources — physical scanned documents, customer-service email, the public portal, and DG/CEO outgoing correspondence — and is carried through a single lifecycle: **intake → assignment → work → review → dispatch → archive**. Every mutating step is owned by exactly one module, audited, idempotent, and survives going offline.

The platform is **in active development**. Current endpoints serve feature testing and pilots and will not carry production traffic.

### Design commitments

| Commitment | Consequence |
|---|---|
| **Zero build** | No bundler, transpiler or SSR. Edit a file, refresh a browser. Requires an HTTP server — browsers block ES-module imports over `file://`. |
| **No runtime dependencies** | Nothing ships to the browser that is not in this repository. Even the authentication layer takes its token provider as a registered function rather than binding an SDK. |
| **Configuration over code** | Routes, roles, permissions, endpoints, module boundaries, action ownership and workflow visibility are all declarative under `config/`. |
| **Governed by default** | A mutating action that is not declared and owned throws rather than executing. |

---

## 2. Applications

Four independently bootable applications share the repository. Only the first uses the full runtime.

| Application | Entry | Scale | Role |
|---|---|---|---|
| **DGO R11.6 Runtime** | `index.html` | 135 modules reachable · 29 routes | The platform shell |
| ~~**ECM Activity Hub Portal**~~ | — | — | **Retired at D6(b)**; briefs, meetings and projects are now root modules |
| **Document Portal** | `document-portal/index.html` | 34 files | Public submission & tracking (PWA) |
| **AckFlow** | `newack/index.html` | 5 files | Acknowledgement prototype |

The Document Portal is a **progressive web app** — service worker, manifest, offline shell — and is deliberately self-contained so it can deploy standalone. That is why it keeps its own copy of the design tokens rather than sharing the runtime's.

---

## 3. Runtime architecture

Four layers. Data flows down; nothing in a lower layer knows about a higher one.

```
PRESENTATION   index.html · shared/shell.js · modules/*.js · styles/
     │           web-component shell, hash router, 25 lazy route modules
GOVERNANCE     core/action-authority.js · audit-log · idempotency
     │           · receipt-ledger · offline-action-queue · otp-service
INTEGRATION    core/auth.js · endpoint-registry · data-client · fetch-manager
     │           contract resolution, redaction, retry, dedupe, queueing
BACKEND        Power Automate (19 contracts) · SharePoint · one-time-code identity
```

### 3.1 Boot sequence

`core/boot.js`:

1. `PlatformProvisioner.ensure()` — normalise state shape against `config/state-schema.config.js`
2. Register all 25 route modules as lazy `import()` thunks
3. Apply theme and density to `<html>`
4. Run the welcome experience (skippable via `?skipWelcome=1` or `?embed=1`)
5. Mount `<dgo-shell>`, install relationship interceptors and the offline retry listener
6. Resolve any deep link, set `window.__DGO_BOOTED__ = true`
7. Load runtime data in the background — failure degrades to offline, never blocks boot

**A boot watchdog in `index.html` is deliberately a classic (non-module) script.** `boot.js` cannot report its own failure to *resolve*: module resolution happens before any of its code runs, so no `try/catch` fires and no error is logged. The watchdog surfaces failing URLs after 15 seconds. This exists because 12 config modules were once absent and the app simply hung forever with no diagnostic.

### 3.2 Routing and workspaces

`core/router.js` — hash-based, generation-token guarded so a slow module cannot overwrite a newer route.

Twenty-five routes exist; **nine are visible workspaces**, sixteen are guided internal routes reachable by handoff or deep link. This split lives in `config/workflow-clarity.config.js` and exists so navigation reflects operator intent rather than module inventory.

| Group | Visible workspaces |
|---|---|
| START HERE | Command Center · ERP–ECM Charter |
| OPERATIONS | Intake & Assignment · My Work / Departmental Work |
| CONTROL | Tracking & Monitoring · Review & Approval |
| CLOSURE | Dispatch & Archive · Correspondence Email Desk |
| SYSTEM | Administration |

Hidden routes — `activities`, `registry`, `single-assignment`, `bulk-assignment`, `lookup`, `acknowledgment`, `comments`, `fasttrack`, `executive`, `archive`, `reports`, `statistics`, `assistant`, `operator-hud`, `diagnostics`, `user-admin` — each declare which workspace surfaces them and why.

### 3.3 State

`core/state.js` — a single object, `structuredClone`-isolated, persisted to `localStorage` under `dgo.r11.viewport.runtime.state` (schema v4). Every non-runtime patch auto-records an audit entry (capped at 1,000). Endpoint overrides are sanitised on hydrate so no signed URL is ever persisted.

---

## 4. The governance spine

This is the platform's most substantial engineering, and the reason the codebase is worth protecting.

### Action ownership — `core/action-authority.js`

Every mutating action must be **owned** by the invoking module, or explicitly list it as an allowed invoker. Otherwise it throws.

```
executeOwnedAction(module, action, runner)
  ├── ensureCurrentUserActive()     → status check, audit on denial
  ├── assertModuleAction()          → ownership and boundary check
  ├── audit  stage: started
  ├── runner()
  └── audit  stage: completed | failed
```

Backed by `config/action-ownership.config.js` (per-action owner, service, backend, audit vocabulary) and `config/module-boundaries.config.js` (what each module owns and explicitly must not own).

### Audit — `core/audit-log.js`

Ring buffer of 5,000 events, indexed by reference, returned frozen. Records actor, event, phase, status transition, entity type and id.

### Idempotency — `core/idempotency.js`

```
idem:<operation>:<ref>:<actor-email>:<5-min bucket>:<sha256 payload digest>
```

Sent with every write so a retry cannot double-apply.

### Offline durability

`pending-queue` → `offline-action-queue` → `receipt-ledger`. Failed writes enqueue with retry metadata; an `online` listener drains them; each attempt writes a receipt (`queued` / `sent` / `failed`). Acknowledgements survive a network outage.

### Step-up authentication — `core/otp-service.js`

Request, verify, and verify-and-execute — with the OTP **bound to a payload digest**, so a verified code cannot be replayed against different data.

### Write discipline — `core/write-manager.js`

Three modes: `local` (state only), `backend` (remote with idempotency), `optimistic` (patch, then roll back on failure or enqueue).

> **The governance model was never the weakness. Its input was.** Every control above is enforced in the browser only. Section 6 addresses this.

---

## 5. Integration

### Endpoint contracts — `config/endpoints.config.js`

Nineteen contracts, each declaring method, operation, read-only/write, timeout, and source key. No URLs are hardcoded; `EndpointUrls` reads `window.DGO_CONFIG.endpoints`.

Categories: fetch (activities, all, reference data, documents, email attachments) · assignment (single, bulk, bulk-direct) · action (dynamic, dispatch outbound, archive reference) · email (dispatch, email-to-task) · AI (email analysis, document analysis, chat) · security (OTP generate, OTP verify) · aggregate (subsidiary actions, 18 route keys).

### Endpoint registry — `core/endpoint-registry.js`

Resolution priority: **deployment manifest → audited operator override → packaged default.**

`redact()` strips `sig`, `sv`, `sp` and `code` before any URL is logged, exported or shown. `describeAll()` raises a diagnostics warning whenever any endpoint still resolves to a packaged signed URL — the registry reports on its own weakest posture.

An operator override is refused and audited unless the actor is an admin.

### Data client — `core/data-client.js`

Single owner of outbound requests: contract lookup → auth gate → URL resolution → flow confirmation → timeout via `AbortController` → retry per policy → JSON parse → success/error classification. Failed **writes** enqueue automatically.

### Data loading — `core/data-loader.js`

`FETCH_ALL` with a fallback to `FETCH_ACTIVITIES`; if both fail the runtime records the reason and continues offline. Response collections are alias-tolerant (`docs` / `activities` / `items` / `records`) and normalised through `core/domain.js`.

---

## 6. Authentication — provisioned, inert

Complete on the client side and **switched off**. The platform is in development; activation is a configuration event, not a development one.

### The switch

`config/auth.config.js` → `enabled`. Flipping it changes four behaviours **at once** — deliberately not independently switchable, because any one alone produces a false sense of enforcement:

| | Development (today) | Enforced (at release) |
|---|---|---|
| Identity source | `localStorage` profile | validated token claims |
| `Authorization` header | absent | `Bearer <token>` |
| `userEmail` in body | sent | **not sent** |
| Role resolution | `state.users` lookup | `roleClaimMap[claim]` |
| Endpoint target | signed flow URL | the same signed flow URL, plus a bearer token |
| **Local tampering** | **changes effective role** | **no effect** |

### Components

- **`core/auth.js`** — token acquisition with renewal and in-flight coalescing, claim decoding (never verification — that is the server's job), identity resolution, `ensureAuthenticated()` gating.
- **`core/current-user.js`** — a server-authoritative path that reads role from claims. This is what closes the escalation: the role is no longer read from local state, so tampering cannot change it.
- **`docs/architecture/AUTHENTICATION_CONTRACT.md`** — the seven server obligations. **The client can only decline to send a request, never prevent one.** Until the backend validates tokens and derives roles itself, nothing is enforced.

### Why there is no proxy

An authenticating proxy was built — `proxy/`, a Cloudflare Worker holding every signed trigger URL server-side — and then removed, because a platform that needs a runtime deployed and kept alive before it can be used is a platform that mostly is not used. Every request now goes **directly** to the configured flow URL.

The cost is stated plainly rather than absorbed: the signed URL is delivered to the browser, so it remains a credential in client code, and it can only be rotated, never retired. **Every obligation the proxy discharged now belongs to the flow** — token validation, role derivation, per-action authorisation, idempotency, rate limiting, reference minting, upload ticketing and the Universal Filename Policy. `docs/architecture/AUTHENTICATION_CONTRACT.md` §2 lists them; `document-portal/README.md` gives the per-endpoint contract. A flow that does not implement them is not protected by anything else.

**The URLs travel in the package, not alongside it.** `npm run package` builds each platform into a self-contained directory with its endpoint configuration written in, a manifest hashing every byte, and a provisioning record naming what is wired. It refuses to emit a pilot or enforced package with a required endpoint missing, a malformed URL, two keys resolving to one flow, or a signature this repository already publishes. `npm run package:verify` checks a delivered package against its manifest before it is deployed. See `docs/deployment/PACKAGING.md`.

This is the part the direct model makes load-bearing. With no proxy to normalise a URL or turn a malformed one into a useful error, a subtly wrong value fails for the first time at an officer's desk, mid-action, as a network error naming nothing — so it is caught at build time instead. Rotation is the only revocation, and rebuilding changes the package's build id, which is what tells one deployment apart from the one it replaced and what invalidates the portal's service-worker cache.

### Regression guarantees

`tests/auth-posture.test.mjs` — 25 assertions across both postures, in CI. The demonstrated **viewer → systemAdmin escalation is encoded as a test**: with auth enforced, rewriting `localStorage` leaves the effective role at `viewer`. An unmapped role claim is denied rather than defaulted.

---

## 7. Access control

Six roles, thirteen permissions, in `config/rbac.config.js`.

| Role | Route access |
|---|---|
| `systemAdmin` | all |
| `userAdmin` | home, settings, user-admin, diagnostics, operator-hud |
| `executive` | home, executive, response-tracking, approvals, reports, statistics, lookup, assistant, archive |
| `director` | operations + approvals, dispatch, reports, statistics |
| `operator` | operations + registry, comments, correspondence-email |
| `viewer` | home, response-tracking, reports, statistics, lookup |

Permissions: `user:view/create/update/disable` · `role:assign/view` · `settings:manage` · `audit:view` · `dispatch:approve` · `bulk:assign` · `route:manage` · `executive:view/export`.

Route guards in `core/router.js` render an explicit denial rather than a blank page, distinguishing *disabled*, *not enrolled* and *role cannot open*.

---

## 8. Design system

`styles/index.css` declares a deterministic cascade:

```
@layer tokens, brand, base, layout, components, overrides;
```

Tokens layer in order: primitive → semantic → component → density → enhanced → theme(light, dark, hc) → legacy bridge.

**Theme and density live on `<html>` only.** Every themed rule is a bare `[data-theme="…"]` selector written for `:root`. Mirroring those attributes onto descendants makes the selector match directly and beat inheritance — which silently broke dark mode until it was removed. `CONTRIBUTING.md` records this as a rule; the smoke suite asserts the mirrors stay absent.

Three themes (light, dark, high-contrast) × two densities (comfortable, compact).

> **Known debt:** the `overrides` layer holds two authorities whose rule interaction is documented at length in `styles/index.css` and remains unresolved. There is currently no rendered-appearance regression coverage beyond the smoke suite's theme assertion.

---

## 9. Accessibility

Skip link to `#main`, one `<nav>` and one `<main>` landmark, `lang="en"`, three ARIA live regions, zero images without `alt`, zero buttons without an accessible name. Drawers trap Tab and restore focus to the opener. Tables receive `data-label` attributes for responsive stacking. High-contrast theme reaches pure black on white and includes a `forced-colors` block.

**Open:** a duplicate top-level heading on the shell, and a full contrast pass now that the themes actually apply.

---

## 10. Quality gate

```bash
npm test              # imports → secrets → auth → smoke
npm run test:imports  # static ES-module graph check, no browser, ~1s
npm run test:secrets  # SAS signature ratchet
npm run test:auth     # both authentication postures
npm run test:smoke    # Playwright, 6 tests
npm run test:links    # linkinator crawl
```

| Check | What it proves |
|---|---|
| `check-imports.mjs` | Every relative import resolves. **167 modules, 0 broken edges.** The check that would have caught the original boot failure in one second. |
| `check-secrets.mjs` | A ratchet, not a gate — fails on *new* signatures, reports known ones. Deleting a file revokes nothing, so failing on known exposure would only make CI permanently red. |
| `auth-posture.test.mjs` | Both postures, 25 assertions, one child process each. |
| `smoke.spec.js` | Boot, accessibility entry points, all 29 routes, theme repaint, `?skipWelcome=1`, ECM portal. Gated on `__DGO_BOOTED__`, **not** HTTP 200 — a 200 proves the server served `index.html` and nothing more. |

CI (`.github/workflows/ci.yml`): `imports` gates `smoke` and `links`; `secrets` runs independently.

> **Gap:** the governance spine itself has **no tests**. The smoke suite proves pages render; it proves nothing about whether action ownership still blocks an unowned action.

---

## 11. Configuration

```bash
cp config/config.example.js config/config.local.js   # git-ignored
```

`index.html` loads it with `onerror="void 0"` — a 404 is expected and allow-listed by both the smoke suite and the link checker.

| File | Purpose |
|---|---|
| `app.config.js` | Version, storage key, schema version, themes, densities |
| `auth.config.js` | The authentication switch |
| `rbac.config.js` | Roles, permissions, route access |
| `routes.config.js` | 25 route declarations |
| `workflow-clarity.config.js` | Visible workspaces vs guided internal routes |
| `endpoints.config.js` | 19 contracts |
| `module-boundaries.config.js` | What each module owns and must not own |
| `action-ownership.config.js` | Per-action owner, service, audit vocabulary |
| `fetch-policy.config.js` | Timeout, retry, dedupe, cache TTL, payload budget |

---

## 12. Repository layout

```
index.html                     Runtime entry + boot watchdog
config/            31 files    Declarative platform configuration
core/              57 files    Boot, router, state, governance, integration
modules/           25 files    Lazy-loaded route modules
shared/             8 files    Shell, adapters, welcome runtime
styles/            18 files    @layer cascade + design tokens
tests/              6 files    Import, secret, auth and smoke suites
modules/briefs.js …             briefs, meetings and projects (ported from the retired ECM Activity Hub)
document-portal/               Public portal (PWA)
newack/                        Acknowledgement prototype
ECM_DOCS_DEV.zip               Archive of record — reference material
```

Documents: `PLATFORM_DOCUMENTATION.md` · `docs/STATUS_REPORT.md` · `docs/architecture/AUTHENTICATION_CONTRACT.md` · `docs/audits/CAPABILITY_ASSESSMENT_R11.6.md` · `docs/audits/REPOSITORY_AUDIT.md` · `docs/audits/FORENSIC_REPOSITORY_AUDIT.md` · `docs/audits/AUDIT.md` · `README.md` · `CONTRIBUTING.md`

---

## 13. Known limitations

Recorded plainly; each is tracked in `docs/STATUS_REPORT.md`.

1. **Nothing is enforced server-side.** All governance is browser-side. Until `docs/architecture/AUTHENTICATION_CONTRACT.md` §2 is implemented, controls are advisory.
2. ~~**The ECM Portal has no auth work at all**~~ — moot since D6(b): the tree is deleted, so there is one auth surface rather than two.
3. **Four signed URLs remain** in `document-portal/js/data.js` and `newack/config.js`; 22 pilot signatures still require rotation.
4. **The governance spine is untested.**
5. **No rendered-appearance regression coverage**; the `overrides` cascade debt is unmeasured.
6. **One duplicate `<h1>`** on the shell.
