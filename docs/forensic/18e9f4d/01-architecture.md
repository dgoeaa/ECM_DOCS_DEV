# Phase 1 — Architecture and Connectivity (brief v3.1)

**Audit target:** `18e9f4da4ff5e110643a7ea88fc3b306a71fa679`
**Working tree:** clean; source at branch HEAD is identical to this commit
**Supersedes:** `docs/forensic/177d992/01-architecture.md` (prior target, brief v3)

---

## 1.1 §6.1 Root boot sequence

```
$ rg -n 'stylesheet|<script|noscript' index.html
21:  <link rel="stylesheet" href="styles/index.css">
24:  <script src="config/config.local.js" onerror="void 0"></script>
29:  <noscript><div class="fatal">JavaScript is required to run DGO Digital Operations.</div></noscript>
30:  <script type="module" src="shared/figma-uiux-runtime.js"></script>
31:  <script type="module" src="core/boot.js"></script>
37:  <script>   ← inline boot watchdog
```

Chain confirmed as v3.1 §6.1 describes. `core/boot.js` then runs, in order:
`PlatformProvisioner.ensure()` → registers 25 lazy module loaders on `Router` → applies
`theme`/`density` from `State` → `await WelcomeExperience.run()` → imports `shared/shell.js`,
mounts `<dgo-shell>` → `DeepLinkResolver.resolveInitial()` → sets `window.__DGO_BOOTED__ = true`
→ calls `loadRuntimeData()` **without awaiting**.

### Q1/Q2 — Does the static module graph resolve, and does `check-imports.mjs` confirm it?

**Yes.** `CONFIRMED-PRESENT`.

```
$ node tests/check-imports.mjs
entry points     : shared/figma-uiux-runtime.js, core/boot.js, ECM_ActivityHub_Portal/js/main.js
modules reachable: 168
import edges     : 2085
✅ every relative import resolves on disk
```

25 routes declared in `config/routes.config.js`, 25 loaders registered in `core/boot.js`,
**0 missing**. The failure mode the watchdog guards is not live.

Scope limit worth recording: the check asserts only that relative specifiers resolve *on disk*.
It does not execute modules, and does not cover bare or dynamic specifiers.

### Q3 — Behaviour when `config/config.local.js` is absent

**Silent degradation to a functional-but-empty runtime.** Not mock data, not demo mode, not a
visible error. `CONFIRMED-PRESENT`.

`config/endpoints.config.js:19-22`
> ```js
> const _cfg = (typeof window !== 'undefined' && window.DGO_CONFIG?.endpoints) || {};
> const _url = (key) => _cfg[key] || '';
> ```

Every endpoint resolves to `''`. `core/data-client.js` then refuses:
> `if(!url) throw new Error('Endpoint '+key+' is not configured')`

`core/boot.js` swallows it into state rather than surfacing it:
> `loadRuntimeData().catch(e=>{ … console.warn('[DGO DATA]', message); … lastLoad:{ok:false,offline:true,…} })`

**Consequence.** On a clean checkout the shell mounts, all 25 routes render, and every workspace
shows zero records — indistinguishable from a correctly-configured platform against an empty
backend. The only signals are one `console.warn` and `state.runtime.lastLoad.offline`.

### Q4 — Does the watchdog surface missing module/config failures?

Partially. It fires only if `window.__DGO_BOOTED__` is unset after 15 s and lists resources that
raised a load `error` event. A *missing* `config.local.js` does not trip it, because boot
completes successfully — the watchdog covers module-graph failure, not configuration absence.

### Q5 — Does root runtime depend on files not tracked in the repo?

**Yes, one — by design.**

```
$ # every src/href in index.html, tested against disk
  tracked: assets/dgo-mark.svg
  tracked: styles/index.css
  ** NOT ON DISK: config/config.local.js      ← git-ignored, optional, onerror="void 0"
  tracked: shared/figma-uiux-runtime.js
  tracked: core/boot.js
```

`config/config.local.js` is the only untracked runtime dependency. Whether any deployed
environment supplies it is `INDETERMINATE` → OQ-9.

---

## 1.2 §6.2 Module and route inventory

25 routes, all lazily imported, all behind one route guard. No module is reachable except
through `core/router.js`.

```
routes declared=25   loaders registered=25   missing=0
touch State: 23/25   call core/api.js: 14/25   import governed-actions: 25/25
```

`core/router.js:2` — the single route guard:
> `if(!canCurrentUserAccess(p)){const u=getCurrentUser(); out.innerHTML=\`…Access denied…\`; return}`

| Route | Entry file | Load | State | External calls | Guard observed | Confidence |
|---|---|---|---|---|---|---|
| `home` | `modules/home.js` | lazy `import()` | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `ecm-erp-charter` | `modules/ecm-erp-charter.js` | lazy | no | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `activities` | `modules/activities.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `correspondence` | `modules/correspondence.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `response-tracking` | `modules/response-tracking.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `orchestrator` | `modules/orchestrator.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `single-assignment` | `modules/single-assignment.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `bulk-assignment` | `modules/bulk-assignment.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `fasttrack` | `modules/fasttrack.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `approvals` | `modules/approvals.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `acknowledgment` | `modules/acknowledgment.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `dispatch` | `modules/dispatch.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `registry` | `modules/registry.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `comments` | `modules/comments.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `reports` | `modules/reports.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `statistics` | `modules/statistics.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `executive` | `modules/executive.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `assistant` | `modules/assistant.js` | lazy | no | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `lookup` | `modules/lookup.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `operator-hud` | `modules/operator-hud.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `settings` | `modules/settings.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `diagnostics` | `modules/diagnostics.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `user-admin` | `modules/user-admin.js` | lazy | yes | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `archive` | `modules/archive.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `correspondence-email` | `modules/correspondence-email.js` | lazy | yes | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |

**Enforcement classification (§2.4).** Both observed controls are client-side. Neither is
`proxy-enforced (evidenced)`:

- `route guard` — `core/router.js:2`. Prevents *rendering*, not *requesting*.
- `client-side check` — all 25 modules import `core/governed-actions.js`;
  `executeOwnedAction()` calls `ensureCurrentUserActive()` and `assertModuleAction()`.

Both resolve the acting role through `core/current-user.js`, which reads token claims **only**
when auth is enforced (`core/current-user.js:70`) and otherwise falls back to `state.users` in
`localStorage`.

### The two trees guard differently — a material asymmetry

| | Root platform | `ECM_ActivityHub_Portal/` |
|---|---|---|
| Guard site | `core/router.js:2` | `js/core/router.js:18-24` |
| While auth is **inert** (shipped default) | Evaluates `canAccess()` against a role read from `localStorage` | **Returns `true` unconditionally** |
| Classification | `client-side check` | **`none observed`** in the default posture |

`ECM_ActivityHub_Portal/js/core/router.js:18-24`
> ```js
> export function canOpen(route) {
>   const allowed = ROUTE_ROLES[route];
>   if (!allowed) return true;                 // unrestricted route
>   if (!isAuthEnforced()) return true;        // inert: permissive, development unchanged
>   const role = getIdentity(Store).role;
>   return !!role && allowed.includes(role);
> }
> ```

`ROUTE_ROLES` restricts `/admin`, `/audit` and `/directory` to `SystemAdmin`/`DGCEO`/`COS`
(lines 12-16). With `enabled: false` — the shipped default — **line 21 returns before those
restrictions are ever consulted**, so all three privileged routes open for any visitor. The
file's own comment states this is deliberate ("permissive by design"), which makes it a design
decision to record rather than a coding error, but the observed control in the default posture
is `none observed`.

---

## 1.3 §6.3 The `config/` surface

```
config modules=31   referenced=30   orphaned=1 -> ['product-definition.config.json']
```

High count, but not dead weight. The single orphan is JSON rather than a module.

| Module | Encodes | Consumed by | Enforcement reality |
|---|---|---|---|
| `rbac.config.js` | `Roles`, `Permissions`, `RoleRouteAccess`, `canAccess()` | `core/current-user.js`, `core/router.js`, **`proxy/src/authorize.js`** | The one genuinely shared policy artefact — client *and* server import it |
| `auth.config.js` | `enabled` master switch, `proxyBaseUrl`, `roleClaimMap` | `core/auth.js`, `core/data-client.js` | `enabled: false` at line 28 → §1.4 |
| `endpoints.config.js` | 19 endpoint contracts | `core/endpoint-registry.js`, `core/data-client.js` | All URLs `''` absent `config.local.js` |
| `module-boundaries.config.js` | Action ownership per module | `core/action-authority.js` | `client-side check` |
| `action-ownership.config.js` | Action → owner/service/backend | `core/action-authority.js` | `client-side check` |
| `routes.config.js` | 25 route definitions | `core/boot.js`, `shared/shell.js`, `tests/smoke.spec.js` | Non-security |
| `fetch-policy.config.js` | Retry/timeout/dedupe per key | `core/data-client.js`, `core/endpoint-registry.js` | Non-security |
| `cache-policy.config.js` | TTLs | `core/cache-manager.js` | Non-security |

Cross-referenced against `tests/check-imports.mjs` (all resolve), `tests/governance.test.mjs`
(asserts RBAC shape and boundary consistency) and `tests/auth-posture.test.mjs` (asserts both
postures).

---

## 1.4 §6.4 Tree connectivity — the central question

### Classification

| Tree | Relationship | Evidence |
|---|---|---|
| `document-portal/` | **`separately deployed`** | `scripts/setup-local.mjs:145` serves it; no root runtime reference |
| `ECM_ActivityHub_Portal/` | **`separately deployed`** | `package.json:13`, both `scripts/`, 3 test files; no root runtime reference |
| `newack/` | **`orphaned`** | `tests/secrets-baseline.txt:2` — and nothing else |
| `proxy/` | **`shared-config consumer`**, not in the default request path | `package.json:16,17,22`; imports `config/rbac.config.js` |

### Negative searches (§2.1 requirement)

```
$ rg -n "document-portal|ECM_ActivityHub_Portal|newack" index.html core/ modules/ shared/ config/ styles/
  ZERO HITS — CONFIRMED-ABSENT
```
No root runtime file references any satellite tree. No import, no link, no iframe `src`, no
route entry.

```
$ rg -n "proxyBaseUrl|authHeaders\(|ensureAuthenticated\(|isAuthEnforced\(" document-portal/js/ newack/
  ZERO HITS — CONFIRMED-ABSENT
```
**No auth or proxy primitive is *called* anywhere in `document-portal/` or `newack/`.**

A looser search for the string `proxy` does return four hits in `document-portal/`, but all four
are prose — three inside `/* … */` blocks (`config.example.js:50`, `js/data.js:110`,
and a `<p>` in `admin.html:77`) and one in `README.md`. They document that real authentication
*belongs* behind the proxy; none of them routes anything there. Answering v3.1 §0.3 question 4
and §7.1: **`document-portal/` and `newack/` do not traverse the proxy.**

`document-portal/` has exactly one outbound call site:

`document-portal/js/core.js:277-290`
> ```js
> PF.flow = function (kind, payload, ref, opts) {
>   var url = (PF.ENDPOINTS || {})[kind];
>   if (!url) return Promise.resolve({ delivered: false, reason: 'not-configured' });
>   …
>   return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
> ```
No `Authorization` header, no proxy indirection. `PF.ENDPOINTS` comes from `window.PF_CONFIG`
(`js/data.js:35-38`), so the target is deployment-supplied → OQ-9.

### `newack/` is an orphan holding a credential

Its only inbound reference in the entire repository is the line that suppresses it from the
secret scan. Not served by `scripts/setup-local.mjs`, not in `package.json`, not in any test,
not linked from any HTML. Combined with Phase 0 §0.4.1 — `newack/config.js:4` carries a
live-shaped SAS signature — this is a tree nobody runs that nonetheless publishes a credential
to anyone who clones the repository.

### The two-proxy topology — the central architectural finding

There are **two different proxies**, and the in-repo one is not the one either client uses by
default.

`config/auth.config.js:28` → `enabled: _pick('enabled', false)`
`ECM_ActivityHub_Portal/js/core/auth.js:25` → `enabled: _pick("enabled", false)`

`core/data-client.js:21-27`
> ```js
> export function resolveUrl(key){
>   const st=State.get();
>   if(isAuthEnforced() && AuthConfig.proxyBaseUrl){
>     return `${String(AuthConfig.proxyBaseUrl).replace(/\/+$/,'')}/${encodeURIComponent(key)}`;
>   }
>   return EndpointRegistry.url(key,{overrides:st.settings?.endpoints||{}});
> }
> ```

`ECM_ActivityHub_Portal/js/api/client.js:5-11`
> ```js
> /** Endpoint target. Enforced posture routes through the authenticating proxy. */
> function endpoint() {
>   if (isAuthEnforced() && AuthConfig.proxyBaseUrl) {
>     return String(AuthConfig.proxyBaseUrl).replace(/\/+$/, "");
>   }
>   return CONFIG.API_URL;
> }
> ```

`ECM_ActivityHub_Portal/js/core/config.js:13`
> ```js
>   API_URL: _override.API_URL || "https://exec-hub-proxy.kanihamza.workers.dev",
> ```

**In the default posture shipped in this repository:**

| Tree | Default target | Traverses `proxy/`? |
|---|---|---|
| Root platform | Power Automate direct, via `EndpointRegistry` | No |
| `ECM_ActivityHub_Portal/` | `https://exec-hub-proxy.kanihamza.workers.dev` | No |
| `document-portal/` | `window.PF_CONFIG` endpoints direct | No — no proxy concept exists |
| `newack/` | `newack/config.js` signed URL direct | No — no proxy concept exists |

`proxy/` is exercised only by `proxy/test/proxy.test.mjs` and started only by an explicit
`npm run start:proxy` (`package.json:16`).

Classification per §2.4: every RBAC control in every tree is
**`bypassable (call site does not traverse proxy)`** in the default configuration.

Whether a deployed environment injects `window.DGO_CONFIG.auth.enabled = true` and a
`proxyBaseUrl` is `INDETERMINATE` → OQ-6. The `kanihamza.workers.dev` hostname is a
personal-account Cloudflare Workers subdomain rather than an organisational domain; what it does
and who controls it is `INDETERMINATE` → OQ-7.

---

## 1.5 §5.5 deferred leads — both resolved

### Two ActivityHub routers: **layering, not duplication**

| File | Lines | Responsibility |
|---|---:|---|
| `js/core/router.js` | 61 | Route table (`ROUTES`), authorization predicate (`canOpen`, `ROUTE_ROLES`), route state via `setRoute` |
| `js/views/router.js` | 46 | Pure view dispatcher — a `switch` on `Store.ui.route` returning `render*()` |

No overlapping logic. `views/router.js` imports 19 page renderers and nothing else of substance.

### Service/page pairs: **layering, not duplication**

No page imports its same-named service:

```
$ for n in ai approvals briefs decisions inbox kpi meetings minutes projects tasks; do
    rg -q "services/$n.js" ECM_ActivityHub_Portal/js/views/pages/$n.js && echo "$n: imports" || echo "$n: does NOT import"
  done
  → all 10: does NOT import
```

The services are reached through a controller instead. Every one of the 13 has an importer:

```
$ # importers of ECM_ActivityHub_Portal/js/services/*
  13 of 13 imported by js/controllers/actions.js; 9 of those also by js/main.js
  0 with NO importer
```

Sampled `views/pages/approvals.js`: imports `core/store.js`, `views/components/ui.js`,
`utils/fn.js` — renders from `Store` only. `services/approvals.js` exports
`listApprovals()` / `decideApproval()` and is called by `controllers/actions.js`.

The pattern is a conventional layered split — pages render, services fetch/mutate, a controller
orchestrates. The partial name pairing (10 of 19 pages) reflects that 9 pages are read-only
views with no service of their own, not that logic is duplicated.

---

## 1.6 Phase 1 findings carried forward

| Ref | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| P1-A | Proxy not in the default request path; every RBAC control is `bypassable` | High | `CONFIRMED-PRESENT` | `CROSS` |
| P1-B | ActivityHub route guard returns `true` unconditionally while auth is inert, opening `/admin`, `/audit`, `/directory` | High | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| P1-C | ActivityHub hardcodes a personal-account Cloudflare Worker as its API target | Medium | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| P1-D | `newack/` is orphaned yet publishes a SAS signature | High | `CONFIRMED-PRESENT` | `NEWACK` |
| P1-E | Missing runtime config degrades silently; a misconfigured deployment is indistinguishable from a working one | Medium | `CONFIRMED-PRESENT` | `ROOT` |
| P1-F | `config/product-definition.config.json` orphaned | Low | `CONFIRMED-ABSENT` | `ROOT` |

Resolved and **not** findings: the two ActivityHub routers and the service/page pairs are
intentional layering (§1.5).

## 1.7 Open Questions added

| # | Question | Why the repo cannot answer | What would establish it |
|---|---|---|---|
| OQ-6 | Is `auth.enabled` set to `true` in any deployed environment? | Injected via `window.DGO_CONFIG` at runtime | Deployed page source or host config |
| OQ-7 | What does `exec-hub-proxy.kanihamza.workers.dev` do, and who controls it? | External service, no source in repo | Cloudflare account and Worker source |
| OQ-8 | Are `document-portal/` and `newack/` deployed anywhere? | No deploy step in-repo | Hosting configuration → Phase 3 |
| OQ-9 | Does any deployed `document-portal/` supply `config.local.js` endpoints? | Git-ignored by design | Deployment configuration |

---

## 1.8 Self-verification (§9.5)

Five of ~34 citations in this document (15%) reopened and re-run.

| # | Citation | Result |
|---|---|---|
| 1 | `ECM_ActivityHub_Portal/js/core/config.js:13` | Exact |
| 2 | `ECM_ActivityHub_Portal/js/core/auth.js:25` | Exact |
| 3 | `config/auth.config.js:28` | Exact |
| 4 | `ECM_ActivityHub_Portal/js/core/router.js:18-24` | Exact |
| 5 | `document-portal/js/core.js:277-290` | Exact |

```txt
Sample size:      5 of ~34 (15%)
Discrepancies:    0
Discrepancy rate: 0%
Action taken:     none required
```

---

**Phase 1 complete. Gate: awaiting acceptance.**
