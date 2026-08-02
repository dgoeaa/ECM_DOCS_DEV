# Phase 2 — Security

**Audit target:** `18e9f4da4ff5e110643a7ea88fc3b306a71fa679`

> Per Phase 0 §0.2, controls introduced by this commit are marked `[SELF-ASSESSED]`.
> `proxy/`, `newack/`, `ECM_ActivityHub_Portal/`, `config/` were not touched by it.

---

## 2.1 §7.1 Proxy enforcement reality

All six files read in full. The implementation is **substantially stronger than typical** and
the comments are accurate — but it governs traffic that, by default, never reaches it.

### Q1 — Does `roleFromClaims()` read request-controlled input?

**No.** `CONFIRMED-PRESENT`. `proxy/src/authorize.js:24-33` takes `claims` only; the sole
caller (`handler.js:82`) passes the output of `verifyToken()`. No body reference exists in the
function or its call path.

### Q2 — Does authorization match `config/rbac.config.js` semantics, or only its shape?

**Partially — it consumes the capability model and ignores the route model.**

```
$ # imports in proxy/src/authorize.js
  imports: Roles, Permissions
  uses RoleRouteAccess? false
  uses canAccess()?     false
```

`rbac.config.js` exports two independent authorization axes: `RoleRouteAccess`/`canAccess()`
(which *routes* a role may open) and `Roles[].permissions` (which *capabilities* it holds). The
proxy imports only the second and maps contract keys to permissions in its own
`ACTION_PERMISSION` table (`authorize.js:42-61`).

That is defensible — the proxy guards actions, the client guards routes — but the two tables
are maintained separately and have already drifted. Enumerated exhaustively:

| Role | Route allowed client-side | Action denied server-side |
|---|---|---|
| `operator` | `/dispatch` | `DISPATCH_OUTBOUND` (needs `DISPATCH_APPROVE`) |
| `executive` | `/archive` | `ARCHIVE_REFERENCE` (needs `ROUTE_MANAGE`) |

Both divergences **fail closed** — the server is the stricter side, which is the safe
direction. The consequence is a UX defect (an operator can open Dispatch & Archive and be
refused on submit), not a security hole. No case was found where the client is stricter than
the server.

### Q3 — Does unknown-action handling fail closed?

**Yes, for every role except `systemAdmin`.** `CONFIRMED-PRESENT`.

```
$ authorize(role, 'TOTALLY_UNKNOWN_KEY')
  systemAdmin  ALLOWED via settings:manage
  userAdmin    DENIED (unknown_contract, HTTP 403)
  executive    DENIED (unknown_contract, HTTP 403)
  director     DENIED (unknown_contract, HTTP 403)
  operator     DENIED (unknown_contract, HTTP 403)
  viewer       DENIED (unknown_contract, HTTP 403)
```

Deliberate — `authorize.js:79-85` requires `SETTINGS_MANAGE` for an unlisted key rather than
allowing it. Worth noting: a mistyped or newly added contract key silently becomes
systemAdmin-only rather than raising a configuration error.

### Q4/Q6 — Is `handler.js` reachable without token verification? Are there paths around `authorize()`?

**No.** `CONFIRMED-PRESENT`. `server.js:37-57` has exactly two branches: `/healthz`, and
everything else → `handleRequest`. Within `handleRequest`, authentication (`handler.js:64-77`)
precedes authorization (`:79-88`) precedes forwarding (`:127-146`), with `return` on every
failure. No early-exit or alternate dispatch exists.

`/healthz` (`server.js:38-44`) is unauthenticated and returns `configuredEndpoints.length`,
the **names** of unconfigured endpoints, and `idempotencyEntries`. Minor information
disclosure — contract-key names and deployment completeness — rated Low.

### Q5 — Does `jwt.js` verify properly?

**Yes, thoroughly.** `CONFIRMED-PRESENT`, `proxy/src/jwt.js:95-142`:

| Check | Line | Implementation |
|---|---|---|
| Algorithm allow-list | 105-106 | `ALGS[header.alg]`; unknown → `unsupported_alg`. Defeats `alg=none` |
| Key-type agreement | 111-112 | `jwk.kty !== spec.kty` → reject. Defeats RS256→HS256 confusion |
| Signature | 118-124 | `crypto.verify`, PSS padding where required, `ieee-p1363` for EC |
| `exp` present and valid | 128-129 | Absent `exp` is rejected, not defaulted |
| `nbf` | 130 | Checked when present |
| `iss` | 132-134 | Required to be configured; exact match |
| `aud` | 136-139 | Required to be configured; intersection match |
| Identity source | 145-153 | `oid`/`sub` only; missing subject rejected |

JWKS (`jwt.js:47-83`) selects by `kid`, refreshes at most once per unknown `kid`, and is rate
limited — it does not fall back to trying every key.

### Q7 — Does `stripAssertedIdentity()` remove client identity?

**Yes, to two levels.** `authorize.js:98-115` strips `user`, `role`, `userEmail`, `actor`,
`persona` from the body root and from `body.payload`. Deeper nesting (e.g.
`payload.data.role`) is **not** stripped and is not covered by any test.

This is mitigated rather than exploitable: `handler.js:121-125` injects an authoritative
`_identity` object built from verified claims, and the comment states downstream flows "read
these and nothing else". Whether the Power Automate flows actually honour that is
`INDETERMINATE` → OQ-10.

### Q8 — Is idempotency multi-instance safe?

**No, and it is documented as such.** `handler.js:26`
> `/** In-memory idempotency store. Swap for Redis or a table in a multi-instance deployment. */`

A `Map` in process memory. Behind a load balancer or in a scaled container app, the same
idempotency key routed to a second instance replays the upstream write. Rated Medium: the
consequence is duplicate governed writes, and the condition (horizontal scaling) is not
evidenced in-repo.

Keys are correctly scoped to the caller — `${identity.subject}:${contractKey}:${rawKey}`
(`handler.js:100`) — so one principal cannot observe or replay another's cached response.

### Q9/Q10 — What does `proxy/test/proxy.test.mjs` assert, and what does it not?

67 assertions, signing real RSA/EC keys at runtime. Coverage includes every classic token
attack: tampered payload, wrong key, `alg=none`, HS256 confusion, wrong key type, unknown
`kid`, expired, not-yet-valid, missing `exp`, foreign issuer, foreign audience, malformed,
empty, unconfigured issuer. Also role mapping (including "multiple roles resolve to the most
capable, not array order"), identity stripping, per-action authorization for five roles,
fail-closed on unknown contracts, and that a spoofed `role`/`user` in the body does not reach
upstream.

**Not covered:** nesting deeper than `body.payload`; multi-instance idempotency;
`/healthz` exposure; and — the material one — **whether the proxy is in the request path at
all**. A green suite here says the handler is correct, not that it is used.

### Client call-site routing (§7.1 table)

| Tree | Call site | Traverses proxy when auth **enabled** | when auth **inert** (default) | Direct endpoint possible | Confidence |
|---|---|---|---|---|---|
| Root | `core/data-client.js:21-27` | Yes, if `proxyBaseUrl` set | **No** → `EndpointRegistry.url()` | Yes | `CONFIRMED-PRESENT` |
| ActivityHub | `js/api/client.js:5-11` | Yes, if `proxyBaseUrl` set | **No** → `CONFIG.API_URL` | Yes | `CONFIRMED-PRESENT` |
| document-portal | `js/core.js:277-290` | **Never** — no proxy concept | Never | Yes | `CONFIRMED-PRESENT` |
| newack | `index.html:122,192` | **Never** — no proxy concept | Never | Yes | `CONFIRMED-PRESENT` |

```
$ rg -n "proxyBaseUrl|authHeaders\(|ensureAuthenticated\(|isAuthEnforced\(" document-portal/js/ newack/
  ZERO HITS — CONFIRMED-ABSENT
```

**Conclusion.** The proxy is a correct, well-tested authorization component that is
`bypassable (call site does not traverse proxy)` in the shipped default for all four trees.
Whether deployment forces traffic through it is `INDETERMINATE` → OQ-6.

---

## 2.2 §7.2 Unsafe sink survey — triaged, not padded

Reproduced across all tracked `.js`/`.mjs`/`.html` at this commit:

| Pattern | v3.1 baseline | Measured | Note |
|---|---:|---:|---|
| `.innerHTML =` | 39 files / 104 | **39 files / 104 occurrences on 102 lines** | v3.1's 104 is occurrences; my Phase 0 figure of 102 was lines. **v3.1 is correct.** |
| `insertAdjacentHTML` | 0 | 0 | `CONFIRMED-ABSENT` |
| `document.write` | 0 | 0 | `CONFIRMED-ABSENT` |
| `eval` / `new Function` / `.outerHTML =` | 0 | 0 | `CONFIRMED-ABSENT` |

### Triage of all 104

| Class | Count | Finding? |
|---|---:|---|
| Static — no interpolation | 56 | No, per §7.2 |
| Interpolated, every interpolation escaped | 10 | No |
| Interpolated, composition only (nested render fns, config literals, ternary class names) | 34 | No |
| **Interpolated with unescaped external data** | **4** | **Yes** |

The 34 refuted are the important discipline here. A mechanical "unescaped `${}`" scan flags 38
sites; manual review shows 34 interpolate either the return value of another render function
that has already escaped its own inputs (`${head(...)}`, `${table(...)}`, `${badge(...)}`,
`${this.navHtml()}`), or literals from `config/` (`${AppConfig.themes.map(...)}`,
`${RegistryStates.map(...)}`), or ternaries producing CSS class names. One,
`core/router.js:2`, escapes with an inline `.replace(/[&<>]/g, …)` that no `esc(` pattern
matches. None is a finding.

The root platform's escaping discipline is otherwise uniform: **149 `esc()` calls across 35
`innerHTML` sites in `modules/` and `core/`.**

### The 4 confirmed unescaped external-data sinks

| # | Site | Data source | Context | Severity |
|---|---|---|---|---|
| S-1 | `newack/index.html:152-160` | `fetch(NITDA_CONFIG.API_GET)` response | element + attribute | **High** |
| S-2 | `modules/comments.js:12` — `Scoped to ${ref}` | backend `referenceId` via `scopeRef()` | element | Medium |
| S-3 | `modules/operator-hud.js:11` — `<b>${v}</b>` | backend `load.counts` values | element | Low |
| S-4 | `modules/reports.js:34` — `value="${filters.dgoStart}"` | user-entered date via `UIState` | attribute | Low |

**S-1 is the significant one.** `newack/` has **no escaping mechanism at all**:

```
$ rg -n 'escapeHtml|\besc\(|createTextNode|DOMPurify' newack/
  (only textContent usages in ack.html / email.html — no HTML escaper anywhere)
```

`newack/index.html:122` fetches from the signed Power Automate URL, then `:152-160`:

> ```js
> row.innerHTML = `
>   <td><span style="…">${id}</span></td>
>   <td style="…">${title}</td>
>   <td><span class="badge ${status === 'Acknowledged' ? 'badge-ok' : 'badge-pending'}">${status}</span></td>
>   <td style="…">${displayDate}</td>
>   …<a href="email.html?taskId=${id}" class="btn btn-ghost btn-sm">Staging Preview</a>
> ```

`title` and `status` reach an element context and `id` reaches an **attribute** context, all
unescaped. `newack/` also has no CSP (§2.4). By contrast `ack.html` and `email.html` use
`textContent` throughout and are safe.

**Failure narrative (conditional per §0.3).** *If* the flow behind `API_GET` returns a `title`
containing markup — through operator input, an upstream integration, or possession of the
committed SAS signature (Phase 0 §0.4.1) allowing a record to be written — *then* that markup
executes in the session of anyone who opens `newack/index.html`. The SAS signature required to
write such a record is itself committed in the same directory. Whether `newack/` is served
anywhere is `INDETERMINATE` → OQ-8.

---

## 2.3 §7.3 Input → sink traces

Only inputs with an evidenced path to a sink are listed.

| Input | Entry point | Path to sink | Sink | Validation | Encoding | Risk | Confidence |
|---|---|---|---|---|---|---|---|
| API response | `newack/index.html:122` | `data` → `renderTable` → template | `row.innerHTML` `:152` | none observed | **none** | **High** | `CONFIRMED-PRESENT` |
| URL `?taskId=` | `newack/ack.html:84` | `taskId` → `AckFlowStore.getTask()` | `textContent` `:91` | none observed | safe sink | Low | `CONFIRMED-PRESENT` |
| URL `?taskId=` | `newack/email.html:105` | `id` → `location.href` `:125` | navigation | `encodeURIComponent` | n/a | Low | `CONFIRMED-PRESENT` |
| API response | Power Automate → `State` | `referenceId` → `scopeRef()` | `innerHTML` `modules/comments.js:12` | none observed | **none** | Medium | `CONFIRMED-PRESENT` |
| API response | Power Automate → `loadRuntimeData` | `load.counts[k]` | `innerHTML` `modules/operator-hud.js:11` | none observed | key escaped, **value not** | Low | `CONFIRMED-PRESENT` |
| Form input | Reports date fields | `UIState` round-trip | attribute `modules/reports.js:34` | none observed | **none** | Low | `CONFIRMED-PRESENT` |
| URL query/hash | `core/deeplink-resolver.js:5-13` | merged params → `State.deepLinkContext` | `State`, route selection | route from config, not input | escaped at render | Low | `CONFIRMED-PRESENT` |
| API/backend data | root modules | 35 `innerHTML` sites | `innerHTML` | none | **149 `esc()` calls** | Low | `CONFIRMED-PRESENT` |
| `localStorage` | `core/state.js` hydrate | `state.users[].role` | route + action guards | schema merge only | n/a | see §2.1 | `CONFIRMED-PRESENT` |
| `postMessage` | — | — | — | — | — | — | `CONFIRMED-ABSENT` (no listener in any tree) |

### `document-portal/sw.js` — dedicated review

`CONFIRMED-PRESENT`, 49 lines. Scope is correctly constrained:

`sw.js:39`
> `if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;`

Non-GET and cross-origin requests are passed through untouched, so the worker cannot cache or
observe the Power Automate POSTs. Navigations are network-first with cache fallback
(`:40-49`); subresources are cache-first (`:50-54`).

The residual property is **staleness, not poisoning**: a cache-first subresource is served from
Cache Storage indefinitely until `CACHE` changes, because `activate` (`:31-35`) deletes only
caches whose key differs from the current one. Any secret or defect in a precached asset
persists on every prior visitor's device across redeploys unless the version string is bumped.
`js/data.js` is in the precache list (`:23`). `[SELF-ASSESSED]` — this commit bumped
`nitda-portal-v2` → `v3` for exactly that reason.

No `postMessage` handler, no `importScripts`, no dynamic cache key.

---

## 2.4 §7.4 Secrets and endpoints

| Path | Nature | Committed or injected | Proxied or direct | Authorization assumed | Confidence |
|---|---|---|---|---|---|
| `config/endpoints.config.js` | 19 contract keys, all `''` | runtime `window.DGO_CONFIG` | direct by default | SAS possession | `CONFIRMED-PRESENT` |
| `config/config.example.js` | 17 `ROTATE_ME` placeholders | template | n/a | n/a | `CONFIRMED-PRESENT` |
| `document-portal/config.example.js` | empty-string template | template | n/a | n/a | `CONFIRMED-PRESENT` |
| `document-portal/js/data.js` | `PF.ENDPOINTS` all `''` | runtime `window.PF_CONFIG` | **direct**, no `Authorization` header | SAS possession | `CONFIRMED-PRESENT` `[SELF-ASSESSED]` |
| **`newack/config.js:4`** | **1 live-shaped SAS signature** | **committed** | **direct** | **SAS possession only** | `CONFIRMED-PRESENT` |
| `newack/config.js:5-6` | 2 `YOUR_FLOW_URL` placeholders | template | direct | n/a | `CONFIRMED-PRESENT` |
| `ECM_ActivityHub_Portal/config.example.js` | template | template | n/a | n/a | `CONFIRMED-PRESENT` |
| `ECM_ActivityHub_Portal/js/core/config.js:13` | `exec-hub-proxy.kanihamza.workers.dev` | **committed default** | direct to a personal Cloudflare Worker | unknown → OQ-7 | `CONFIRMED-PRESENT` |
| `ECM_DOCS_DEV.zip` | **31 distinct signatures, 18 members** + UNREDACTED manifest | committed archive | n/a | n/a | `CONFIRMED-PRESENT` |

Carried from Phase 0: 4 distinct signatures recoverable from Git history; 31 from the archive.
`document-portal/`'s risk is now **conditional on deployed runtime config** (OQ-9), not on
committed source.

---

## 2.5 §7.5 Browser security posture

Documented searches, excluding `docs/forensic/**` and `*.md`:

| Control | Result | Classification |
|---|---|---|
| `Content-Security-Policy` | 7 source files: `index.html` + all 6 `document-portal/*.html` | `CONFIRMED-PRESENT` (partial) `[SELF-ASSESSED]` |
| `integrity=` (SRI) | **0 files** | **`CONFIRMED-ABSENT`** |
| `Referrer-Policy` header | 0 files; `<meta name="referrer">` present in the same 7 | `CONFIRMED-PRESENT` (meta only) |
| `X-Frame-Options` / `frame-ancestors` | 6-7 hits, **all inside comment prose** in the CSP block I authored — no real directive | `CONFIRMED-ABSENT` (repo) / `INDETERMINATE` (runtime) |
| `X-Content-Type-Options` | 0 files | `CONFIRMED-ABSENT` (repo) / `INDETERMINATE` (runtime) |
| `Strict-Transport-Security` | 0 files | `CONFIRMED-ABSENT` (repo) / `INDETERMINATE` (runtime) |

### CSP coverage is partial — two trees have none

```
  index.html                         CSP=1  referrer=1
  document-portal/index.html         CSP=1  referrer=1
  document-portal/admin.html         CSP=1  referrer=1
  ECM_ActivityHub_Portal/index.html  CSP=0  referrer=0     ← none
  newack/index.html                  CSP=0  referrer=0     ← none
  newack/ack.html                    CSP=0  referrer=0     ← none
  newack/email.html                  CSP=0  referrer=0     ← none
```

### Third-party script with no SRI and no CSP — the compounding finding

`ECM_ActivityHub_Portal/index.html` is the only page loading external origins:

```
$ rg -n '<script[^>]*src="https?://|<link[^>]*href="https?://' --glob '*.html' .
./ECM_ActivityHub_Portal/index.html:7:  <link rel="preconnect" href="https://fonts.googleapis.com">
./ECM_ActivityHub_Portal/index.html:8:  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
./ECM_ActivityHub_Portal/index.html:9:  <link href="https://fonts.googleapis.com/css2?family=Inter…" rel="stylesheet">
./ECM_ActivityHub_Portal/index.html:11: <script src="https://cdn.tailwindcss.com"></script>
./ECM_ActivityHub_Portal/index.html:43: <script src="https://unpkg.com/lucide@latest"></script>
```

Line 43 is the sharpest: **`@latest` is an unpinned floating version**, fetched from a public
package CDN, with no SRI (impossible with `@latest`), on a page with no CSP, into the DG/CEO
executive portal — whose route guard is permissive by default (Phase 1 §1.2). Four independent
mitigations are each absent.

Per the §2.3 rubric this is **Medium**, because the trigger (compromise of unpkg or the
`lucide` package) is a condition not evidenced in-repo. It would be High under any rubric that
scores supply-chain exposure on its own.

`http://` appears in 13 non-Markdown files; all reviewed instances are localhost dev-server
URLs (`scripts/`, `tests/`, `playwright.config.js`, `proxy/src/server.js`) or XML namespace
URIs in SVG. No mixed-content risk found.

### `DOC-DRIFT` check

The v3.1 §7.5 premise — that CSP/SRI appear only in `FORENSIC_ROOT_PLATFORM_AUDIT.md` — could
not be executed: that file has never existed (Phase 0 §0.3). CSP genuinely exists in 7 source
files. SRI genuinely does not exist anywhere. Quarantined prose is not opened until Phase 4, so
any true `DOC-DRIFT` finding is deferred there.

---

## 2.6 Phase 2 findings carried forward

| Ref | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| P2-A | `newack/index.html:152-160` renders API data into `innerHTML` with no escaping anywhere in the tree | High | `CONFIRMED-PRESENT` | `NEWACK` |
| P2-B | Proxy is bypassable — no call site traverses it in the default posture | High | `CONFIRMED-PRESENT` | `CROSS` |
| P2-C | Unpinned third-party script (`lucide@latest`) with no SRI and no CSP in the executive portal | Medium | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| P2-D | No SRI anywhere in the repository | Medium | `CONFIRMED-ABSENT` | `CROSS` |
| P2-E | `ECM_ActivityHub_Portal/` and `newack/` have no CSP or referrer policy | Medium | `CONFIRMED-ABSENT` | `CROSS` |
| P2-F | Proxy idempotency is in-memory; unsafe under horizontal scaling | Medium | `CONFIRMED-PRESENT` | `PROXY` |
| P2-G | `modules/comments.js:12` renders backend `referenceId` unescaped | Medium | `CONFIRMED-PRESENT` | `ROOT` |
| P2-H | RBAC route model and proxy action model drift (2 cases, both fail closed) | Low | `CONFIRMED-PRESENT` | `CROSS` |
| P2-I | `/healthz` unauthenticated, discloses contract-key names | Low | `CONFIRMED-PRESENT` | `PROXY` |
| P2-J | `stripAssertedIdentity()` does not strip below `body.payload`; untested | Low | `CONFIRMED-PRESENT` | `PROXY` |
| P2-K | `operator-hud.js:11` and `reports.js:34` render unescaped values | Low | `CONFIRMED-PRESENT` | `ROOT` |

**Refuted, and recorded as such:** 34 of the 38 mechanically-flagged `innerHTML`
interpolations are composition or config literals, not external data. `insertAdjacentHTML`,
`document.write`, `eval`, `new Function` and `.outerHTML =` are absent from the entire
repository. `document-portal/sw.js` does not cache or observe cross-origin or non-GET traffic.

## 2.7 Open Questions added

| # | Question | Why the repo cannot answer | What would establish it |
|---|---|---|---|
| OQ-10 | Do the Power Automate flows read `_identity` and ignore client-supplied fields? | Flow definitions are not in the repo | Power Automate flow export |
| OQ-11 | Is `newack/` served on any host? | No deploy step in-repo | Hosting configuration |
| OQ-12 | Are CSP/HSTS/`X-Content-Type-Options`/`frame-ancestors` applied at the edge? | Static repo, no header config | Deployed response headers |

---

## 2.8 Self-verification (§9.5)

Six of ~41 citations (15%) reopened and re-run.

| # | Citation | Result |
|---|---|---|
| 1 | `proxy/src/jwt.js:105-111` alg/key checks | Exact |
| 2 | `proxy/src/handler.js:26` idempotency comment | Exact |
| 3 | `newack/index.html:152-160` | Exact |
| 4 | `ECM_ActivityHub_Portal/index.html:43` | Exact |
| 5 | `document-portal/sw.js:33` origin guard | **WRONG LINE — actual is `:39`; corrected in §2.3** |
| 6 | `integrity=` zero-hit | Reproduced |

```txt
Sample size:      6 of ~41 (15%)
Discrepancies:    1  (sw.js line numbers, off by 6)
Discrepancy rate: 17%  — ABOVE the 5% threshold in §9.5
Action taken:     every sw.js citation re-derived from a fresh rg; all other
                  Phase 2 line citations re-checked against their files.
```

**Why it happened, recorded so the pattern is visible:** the `sw.js` line numbers were carried
forward from a reading taken at `177d992`. Commit `18e9f4d` inserted a six-line comment block
at the top of that file, shifting every subsequent line by 6. This is the exact failure mode
§2.2 of the brief exists to catch — a citation that cannot be reproduced by re-running the
stated command. No other file in Phase 2 was read at the earlier target.

**Correction to Phase 0 §0.8:** v3.1's `.innerHTML =` count of **104 is correct**; my 102 was a
line count, not an occurrence count. Phase 0's "v3.1 is 2 high" is withdrawn.

---

**Phase 2 complete. Gate: awaiting acceptance.**
