# Phase 1 — Architecture and Connectivity

**Audit target:** `177d992649710ba70d653b3defed9866bc1ebd04` ("One-command setup and Codespaces support (#5)")
**Analysed via:** pinned detached worktree at `/tmp/claude-0/audit-177d992`
**Tracked files:** 279

---

## 1.0 Target selection and its justification

Phase 0 established that branch HEAD was authored by this agent in the same session. The brief
was re-issued unchanged and offered no override, so the audit target is set to **`177d992`**,
the parent commit, on evidence rather than preference:

```
$ cd /tmp/claude-0/audit-177d992 && cat tests/secrets-baseline.txt
document-portal/js/data.js
newack/config.js

$ wc -c < styles/dgo-design-system/components.css
39791
```

Both figures match the brief's §5.3 and §5.5 pre-seeded leads exactly. The brief's export
describes `177d992`. Auditing it makes the brief internally consistent **and** removes the
independence conflict. Every citation below is from this commit unless explicitly labelled
`[HEAD delta]`.

**Substitutions made** (brief-drift, per Phase 0 §0.3): references to
`tests/output-encoding.test.mjs` and `precision_auditor_v3.py` are dropped — the files have
never existed. Their intent is absorbed into §2 of Phase 2.

---

## 1.1 §6.1 Root boot sequence

`index.html:1-30` — load order is as the brief describes:

```
$ rg -n 'stylesheet|<script' index.html
7:  <link rel="stylesheet" href="styles/index.css">
11:  <script src="config/config.local.js" onerror="void 0"></script>
20:  <script type="module" src="shared/figma-uiux-runtime.js"></script>
21:  <script type="module" src="core/boot.js"></script>
```

`core/boot.js` then, in order: `PlatformProvisioner.ensure()` → registers 25 lazy module
loaders on `Router` → applies `theme`/`density` from `State` → awaits
`WelcomeExperience.run()` → imports `shared/shell.js` and mounts `<dgo-shell>` → resolves deep
links → sets `window.__DGO_BOOTED__ = true` → fires `loadRuntimeData()` **without awaiting it**.

### Q1 — Does the static module graph resolve?

**Yes.** `CONFIRMED-PRESENT`.

```
$ node tests/check-imports.mjs
entry points     : shared/figma-uiux-runtime.js, core/boot.js, ECM_ActivityHub_Portal/js/main.js
modules reachable: 168
import edges     : 2083
✅ every relative import resolves on disk
```

The watchdog in `index.html:23-58` guards a failure mode that is **not currently live**. Note
its scope limit: it checks only that files resolve on disk, not that bare or dynamic specifiers
resolve, and not that a resolved module executes.

### Q2 — Behaviour when `config/config.local.js` is absent

**Silent degradation to a functional-but-empty runtime. Not mock data, and not a visible
error.** `CONFIRMED-PRESENT`.

The chain:

`config/endpoints.config.js:19-22`
> ```js
> const _cfg = (typeof window !== 'undefined' && window.DGO_CONFIG?.endpoints) || {};
> const _url = (key) => _cfg[key] || '';
> ```

Every endpoint resolves to `''`. `core/data-client.js` then refuses the call:

> `if(!url) throw new Error('Endpoint '+key+' is not configured')`

And `core/boot.js` swallows it into state rather than surfacing it:

> `loadRuntimeData().catch(e=>{ const message=String(e?.message||e||''); console.warn('[DGO DATA]', message); … lastLoad:{ok:false,offline:true,…} })`

**Consequence.** On a clean checkout with no `config.local.js`, the shell mounts, all 25 routes
render, and every workspace shows zero records — indistinguishable from a correctly-configured
platform against an empty backend. The only signals are a `console.warn` and
`state.runtime.lastLoad.offline`. A deployment that silently forgot its config would look
identical to a working one.

`NOT ESTABLISHED` — whether the deployed instance supplies `config.local.js`. It is git-ignored
by design, so its presence in any environment is invisible from the repository. → OQ-5.

---

## 1.2 §6.2 Module and route inventory

25 routes, all lazily imported via `core/boot.js`, all guarded by the same route guard in
`core/router.js`. No module is reachable except through the router.

`core/router.js:2` — the single route guard:
> `if(!canCurrentUserAccess(p)){const u=getCurrentUser();out.innerHTML=\`<div class="empty"><h2>Access denied</h2>…`

| Route | Entry file | Load | State touched | External calls | Guard observed | Confidence |
|---|---|---|---|---|---|---|
| `home` | `modules/home.js` | lazy `import()` | `core/state.js` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `ecm-erp-charter` | `modules/ecm-erp-charter.js` | lazy | none | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `activities` | `modules/activities.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `correspondence` | `modules/correspondence.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `response-tracking` | `modules/response-tracking.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `orchestrator` | `modules/orchestrator.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `single-assignment` | `modules/single-assignment.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `bulk-assignment` | `modules/bulk-assignment.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `fasttrack` | `modules/fasttrack.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `approvals` | `modules/approvals.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `acknowledgment` | `modules/acknowledgment.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `dispatch` | `modules/dispatch.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `registry` | `modules/registry.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `comments` | `modules/comments.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `reports` | `modules/reports.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `statistics` | `modules/statistics.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `executive` | `modules/executive.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `assistant` | `modules/assistant.js` | lazy | none | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `lookup` | `modules/lookup.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `operator-hud` | `modules/operator-hud.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `settings` | `modules/settings.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `diagnostics` | `modules/diagnostics.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `user-admin` | `modules/user-admin.js` | lazy | `state` | `core/api.js` | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `archive` | `modules/archive.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |
| `correspondence-email` | `modules/correspondence-email.js` | lazy | `state` | none | `route guard` + `client-side check` | `CONFIRMED-PRESENT` |

**Enforcement classification (§2.4).** Both observed controls are client-side:

- `route guard` — `core/router.js:2`, calls `canCurrentUserAccess()`, which resolves the role
  from `localStorage` while auth is inert (see §1.4). It prevents *rendering*, not *requesting*.
- `client-side check` — all 25 modules import `core/governed-actions.js`; `executeOwnedAction`
  calls `ensureCurrentUserActive()` and `assertModuleAction()` before running. Same store, same
  trust assumption.

Neither is `proxy-enforced (evidenced)`. See §1.4.

---

## 1.3 §6.3 The `config/` surface

31 files. **30 are referenced; 1 is orphaned.**

```
$ # every config/<name> string searched across core, modules, shared, config, proxy, tests, scripts, index.html
REFERENCED (30) — top by reference count:
    15  priority.config.js        9  endpoints.config.js       7  rbac.config.js
     5  app.config.js             5  auth.config.js            5  workflow-clarity.config.js
     4  action-ownership.config.js 4 routes.config.js          3  activity-parity.config.js
ORPHANED (1):
     0  product-definition.config.json
```

The count is high but is **not** dead weight: 30/31 are live. `product-definition.config.json`
is the sole orphan — `CONFIRMED-ABSENT` from every import graph, JSON rather than a module.

Security-relevant policy modules, and where enforcement actually lands:

| Module | Encodes | Consumed by | Enforcement reality |
|---|---|---|---|
| `rbac.config.js` | `Roles`, `Permissions`, `RoleRouteAccess`, `canAccess()` | `core/current-user.js`, `core/router.js`, **`proxy/src/authorize.js`** | Dual-consumed — this is the one genuinely shared policy artefact |
| `auth.config.js` | `enabled` master switch, `proxyBaseUrl`, `roleClaimMap` | `core/auth.js`, `core/data-client.js` | `enabled: false` at line 28 — see §1.4 |
| `endpoints.config.js` | 19 endpoint contracts | `core/endpoint-registry.js`, `core/data-client.js` | All URLs `''` without `config.local.js` |
| `module-boundaries.config.js` | Action ownership per module | `core/action-authority.js` | `client-side check` |
| `fetch-policy.config.js` | Retry/timeout/dedupe per key | `core/data-client.js`, `endpoint-registry.js` | Non-security |
| `cache-policy.config.js` | TTLs | `core/cache-manager.js` | Non-security |

---

## 1.4 §6.4 Tree connectivity — the central question

### Inbound-reference matrix (evidenced)

| Tree | Referenced by root runtime? | Referenced by tooling | Classification |
|---|---|---|---|
| `document-portal/` | **No** | `scripts/setup-local.mjs:145` (serves URL), `tests/secrets-baseline.txt:1` | `separately deployed` |
| `ECM_ActivityHub_Portal/` | **No** | `package.json:13`, `scripts/check-links.mjs:26,45`, `scripts/setup-local.mjs:132,144`, `tests/check-imports.mjs:28`, `tests/smoke.spec.js:16,144`, `tests/auth-posture.test.mjs:90,98,175` | `separately deployed` |
| `newack/` | **No** | `tests/secrets-baseline.txt:2` — **and nothing else** | `orphaned` |
| `proxy/` | Config-only | `package.json:16,17,22`, `tests/auth-posture.test.mjs:112` | `shared-config consumer`, **not in the default request path** |

### Negative searches (§2.1 requirement)

```
$ rg -n "document-portal|ECM_ActivityHub_Portal|newack" index.html core/ modules/ shared/ config/ styles/
  ZERO HITS — CONFIRMED-ABSENT
```
No root runtime file references any satellite tree. There is no import, no link, no iframe
`src`, no route entry.

```
$ rg -n "proxy|proxyBaseUrl|authHeaders|ensureAuthenticated" document-portal/ newack/
  ZERO HITS — CONFIRMED-ABSENT
```
`document-portal/` and `newack/` contain no reference to the authenticating proxy or to any
auth primitive. Answering the brief's §0.3 question 3: **they do not route through it.**

### `newack/` is an orphan holding a credential

Its only inbound reference in the entire repository is the line that suppresses it from the
secret scan. It is not served by `scripts/setup-local.mjs`, not in `package.json`, not in any
test other than the baseline, and not linked from any HTML. Combined with Phase 0 §0.5 —
`newack/config.js:4` carries a live-shaped SAS signature — this is a tree nobody runs that
nonetheless publishes a credential to anyone who clones the repository.

### The two-proxy topology — the material architectural finding

There are **two different proxies**, and the in-repo one is not the one the client uses by
default.

`ECM_ActivityHub_Portal/js/core/config.js:13`
> ```js
> API_URL: _override.API_URL || "https://exec-hub-proxy.kanihamza.workers.dev",
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

`ECM_ActivityHub_Portal/js/core/auth.js:25,37`
> ```js
>   enabled: _pick("enabled", false),
> export const isAuthEnforced = () => AuthConfig.enabled === true;
> ```

The root client has the identical structure — `core/data-client.js:21-27` returns
`AuthConfig.proxyBaseUrl` only `if(isAuthEnforced() && AuthConfig.proxyBaseUrl)`, otherwise
`EndpointRegistry.url(key,…)` — and `config/auth.config.js:28` is likewise
`enabled: _pick('enabled', false)`.

**Therefore, in the default posture shipped in this repository:**

- The root platform posts **directly to Power Automate**, bypassing `proxy/`.
- The ActivityHub posts **directly to `https://exec-hub-proxy.kanihamza.workers.dev`**, a
  Cloudflare Workers subdomain, bypassing `proxy/`.
- `document-portal/` and `newack/` have no proxy concept at all.
- `proxy/` is exercised only by `proxy/test/proxy.test.mjs` and started only by an explicit
  `npm run start:proxy`.

Classification per §2.4: every RBAC control in every tree is `bypassable (call site does not
traverse proxy)` **in the default configuration**. Whether a deployed environment overrides
`enabled` and `proxyBaseUrl` is `INDETERMINATE` → OQ-6.

The `kanihamza.workers.dev` hostname is a personal-account Cloudflare Workers subdomain, not an
organisational domain. What it does — whether it validates anything, and who controls it — is
`INDETERMINATE` from repository contents → OQ-7. Carried to Phase 2 §7.4.

---

## 1.5 `document-portal_Central_NITDA_/` — resolved

Phase 0 deferred this. It existed and was deleted:

```
$ git log --all --oneline --diff-filter=D -- 'document-portal_Central_NITDA_/index.html'
776d26c Remediate every finding in the forensic structural audit
```

Comparing the deleted tree against the surviving `document-portal/` at the deletion's parent
`994c262`, then against the tree at `177d992`:

| Measure | Files |
|---|---:|
| Files in the deleted variant | 41 |
| Byte-identical to `document-portal/` at coexistence | 26 |
| Divergent at coexistence | 15 |
| Matching the **deleted variant** at `177d992` | 41 |

Every one of the 15 divergent files at `177d992` matches the deleted `_Central_NITDA_` copy,
not the pre-existing `document-portal/`. The commit recorded a deletion but performed a
**replacement**: the surviving directory carries the NITDA variant's content under the original
name.

Confidence `CONFIRMED-PRESENT` for the hashes; the *intent* is `INFERRED` — no commit message
states the replacement.

---

## 1.6 Phase 1 findings carried forward

| Ref | Title | Sev (provisional) | Confidence | Scope |
|---|---|---|---|---|
| P1-A | Proxy not in the default request path; all RBAC is `bypassable` | High | `CONFIRMED-PRESENT` | `CROSS` |
| P1-B | ActivityHub hardcodes a personal-account Cloudflare Worker as its API | Medium | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| P1-C | `newack/` is orphaned yet publishes a SAS signature | High | `CONFIRMED-PRESENT` | `NEWACK` |
| P1-D | Missing runtime config degrades silently, indistinguishable from a working deployment | Medium | `CONFIRMED-PRESENT` | `ROOT` |
| P1-E | `document-portal/` content was replaced, not merely deduplicated; history misstates it | Low | `CONFIRMED-PRESENT` | `DOCPORTAL` |
| P1-F | `config/product-definition.config.json` orphaned | Low | `CONFIRMED-ABSENT` | `ROOT` |

## 1.7 Open Questions raised in Phase 1

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| OQ-5 | Does any deployed environment supply `config.local.js`? | Git-ignored by design | Deployment configuration |
| OQ-6 | Is `auth.enabled` overridden to `true` in production? | Injected via `window.DGO_CONFIG` at runtime | Deployed page source or host config |
| OQ-7 | What does `exec-hub-proxy.kanihamza.workers.dev` do, and who controls it? | External service, no source in repo | Cloudflare account and Worker source |
| OQ-8 | Are `document-portal/` and `newack/` actually deployed anywhere? | No deploy step exists in-repo (Phase 3) | Hosting configuration |

---

**Phase 1 complete. Gate: awaiting acceptance.**
