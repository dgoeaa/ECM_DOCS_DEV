# Forensic Investigation — Root Platform and Document Portal

**Date** 2 August 2026 · **Commit** `61604a3` · **Branch** `claude/quirky-babbage-1nomt5`
**Scope** root runtime (`index.html`, `config/`, `core/`, `modules/`, `shared/`, `styles/`, `assets/`, `scripts/`, `tests/`, `.github/`) and `document-portal/`.
**Explicitly out of scope** `ECM_ActivityHub_Portal/` — referenced only where it shares a file or a workflow with the root platform. No prior claim about that portal is carried into this report as evidence of root-platform behaviour.

Every finding is labelled **Confirmed** (read in the file, chain traced end to end), **Strong inference** (mechanism verified, trigger not executed), or **Unverified concern**.

---

## 0. Two named scopes do not exist — resolved

| Scope | Status |
|---|---|
| `tools/` | **Absent.** Never present on `main`; no commit ever added it. |
| `document-portal_Central_NITDA_/` | **Absent — existed, deleted, and the deletion was correct.** |

`document-portal_Central_NITDA_` was added in `3bd5231` ("Add files via upload") and deleted in `776d26c` ("Remediate every finding in the forensic structural audit"). I verified the deletion rather than trusting the earlier claim:

```
file lists      41 vs 41 — identical, no file unique to either side
blob hashes     41/41 identical, 0 differing
```

Git blob hashes are content hashes, so this is proof, not inference. **It was a byte-identical copy of `document-portal/`, not a divergent Central/NITDA variant.** There is one source of truth for the document portal and it is `document-portal/`. **Confirmed.**

---

## 1. Executive summary and risk ratings

| Area | Rating | One-line position |
|---|---|---|
| **Root platform** | **Medium** | Architecturally sound and defensively coded. One confirmed injection chain from URL to outbound official email; two lesser HTML sinks; no security headers. |
| **`document-portal/`** | **Critical** | Ships three live flow credentials and three plaintext staff passwords to every visitor, and its entire governed workflow is a local-browser simulation with no server of record. |
| **Cross-platform** | **High** | Zero CSP/SRI/framing/referrer policy across all 11 HTML entry points; no deployment workflow at all; `document-portal/` has no test coverage of any kind. |

The root platform and the document portal are **not** the same class of artefact and should not carry a shared rating. The root runtime is a real application with genuine controls whose weakness is that its identity input is untrusted while auth is inert. The document portal looks like a governed registry system and is, in its current form, a self-contained demonstration that persists nothing.

---

## 2. Architecture reconstruction

### 2.1 Root boot sequence — **Confirmed**

`index.html` is 61 lines and loads exactly four things:

| Line | Resource | Note |
|---|---|---|
| 10 | `styles/index.css` | Single deterministic `@layer` entry, replacing 19 unordered links |
| 13 | `config/config.local.js` | Classic script, `onerror="void 0"` — optional and git-ignored |
| 19 | `shared/figma-uiux-runtime.js` | ES module |
| 20 | `core/boot.js` | ES module — the real entry |
| 26–59 | Boot watchdog | Classic (non-module) script; records failing `SCRIPT`/`LINK` loads and, if `window.__DGO_BOOTED__` is unset after 15 s, replaces the spinner with the failing URLs |

The watchdog exists because static ES-module resolution failure precedes `boot()`'s own `try/catch` — nothing throws, nothing logs, and the spinner hangs. That is how 13 uncommitted config modules once shipped unnoticed.

`core/boot.js` then runs, in order (line 14–19):

1. `PlatformProvisioner.ensure()`, then `validate()` → `window.__DGO_PROVISIONING__`
2. `window.__DGO_DATA_OPS__` = cache / loading / performance / pending queue
3. **25 routes registered** as lazy dynamic imports (line 10, line 17)
4. `data-theme` and `data-density` set on `documentElement` from `State` (line 18)
5. `WelcomeExperience.run()` — awaited
6. `shared/shell.js`, `relationship-runtime.js`, `welcome-runtime.js` imported; relationship interceptors installed; `<dgo-shell>` replaces the boot spinner
7. `DeepLinkResolver.resolveInitial()` + `launchWelcome()` on the next animation frame
8. `window.__DGO_BOOTED__ = true`
9. `loadRuntimeData()` fired **un-awaited** — failure degrades to offline state rather than blocking boot

Boot is browser-guarded (line 23), keeping the entry importable for non-browser diagnostics.

### 2.2 Routing, state and guards — **Confirmed**

`core/router.js:2` is a single dense line implementing the whole router. Notable properties, all verified:

- **Generation token** (`++generation`) compared after every `await` — stale renders are discarded, so rapid hash changes cannot interleave. This is a correct race guard.
- **Authorization is checked before mount**: `if(!canCurrentUserAccess(p))` renders an "Access denied" panel and returns.
- **Unknown route** renders "Workspace not found".
- **Module failure** is caught and the message is escaped (`&<>`) before display.

`canAccess()` in `config/rbac.config.js` evaluates `status !== 'active'` → deny, then role-based route allowance, then persona fallback. `core/current-user.js:getCurrentUser()` returns token-derived identity when `isAuthEnforced()`, otherwise joins `state.profile.email` against `state.users`.

**This is real client-side enforcement, not presentation-only.** The guard runs before the module mounts and denies by rendering a terminal panel. Its weakness is not the guard — it is that while auth is inert the *input* (`state.profile`) is browser-editable. That distinction matters and has been conflated before.

### 2.3 How the document portal relates to the root platform — **Confirmed**

**It does not integrate. It is a separate, independently deployable static application that happens to live in the same repository.**

Evidence:

| Test | Result |
|---|---|
| Shared JS modules | **None.** `document-portal/js/*` are classic scripts on a `window.PF` namespace; root is ES modules. |
| Shared CSS | **None.** `document-portal/ds/` + `portal.css` is a self-contained copy of the design system; root uses `styles/index.css`. |
| Imported by root | **No.** `tests/check-imports.mjs:28` roots the graph at `index.html` and the ECM portal only; nothing reaches `document-portal/`. |
| iframe / postMessage from root | **No.** The only `postMessage` boundary is `core/nitda-module-adapter.js`, which targets a parent shell, not the document portal. |
| Navigation target from root | **No.** No root module links to `document-portal/`. |
| Own service worker, manifest, robots, sitemap | **Yes** — `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`. |

**Model: independent deployment, co-located in one repository.** Its README says so directly — *"Copy the folder to any web root … and it runs."* The relationship is repository co-tenancy, nothing more. Any statement that the document portal is an "extension" of the root platform is not supported by the code.

### 2.4 Route and module inventory — **Confirmed** (`core/boot.js:10`)

25 routes, each a lazy `import()`:

| # | Route | # | Route | # | Route |
|---|---|---|---|---|---|
| 1 | `home` | 10 | `acknowledgment` | 19 | `assistant` |
| 2 | `ecm-erp-charter` | 11 | `dispatch` | 20 | `lookup` |
| 3 | `activities` | 12 | `correspondence-email` | 21 | `archive` |
| 4 | `correspondence` | 13 | `registry` | 22 | `operator-hud` |
| 5 | `response-tracking` | 14 | `comments` | 23 | `settings` |
| 6 | `orchestrator` | 15 | `reports` | 24 | `diagnostics` |
| 7 | `single-assignment` | 16 | `statistics` | 25 | `user-admin` |
| 8 | `bulk-assignment` | 17 | `executive` | | |
| 9 | `fasttrack` | 18 | `approvals` | | |

**Module lifecycle:** every module exports `mount(el)`. The router creates a detached `div.route-stage`, awaits `mount`, re-checks the generation token, then `replaceChildren`. There is **no `unmount`/teardown hook** — see finding R-M2.

### 2.5 Document portal architecture — **Confirmed**

Five pages (`index`, `submit`, `track`, `support`, `admin`) plus `404.html`, over 9 classic scripts (2,858 lines) sharing `window.PF`.

**The decisive architectural fact** is `PF.flow` (`js/core.js:277–298`):

```js
return fetch(url, { method:'POST', headers:{...}, body: JSON.stringify(payload) })
  .then(function (r) { … return { delivered: r.ok, status: r.status }; })
```

**The response body is never read.** Only `r.ok` and `r.status` are used. The portal is **write-only**: it posts to Power Automate and ignores whatever comes back. Every record, status transition, decision, SLA clock, support case, device history, draft and audit line lives in `localStorage` under `nitda.portal.*` (`js/core.js:94`, `220–223`); the console session lives in `sessionStorage`.

Consequences, all following directly:

- Two browsers never see the same registry.
- An "approval" in the Operations console changes one visitor's `localStorage` and nothing else.
- Clearing site data destroys the audit trail.
- The lifecycle stepper, working-day SLA meter and timeline are computed locally from local records.

---

## 3. Trust-boundary inventory

| # | Boundary | Location | Handling |
|---|---|---|---|
| 1 | URL query / hash → deep-link context | `core/deeplink-resolver.js:10,12`; `config/deeplink.config.js:16` | **19 params copied verbatim into state.** Feeds R-C1. |
| 2 | Runtime config | `index.html:13` → `window.DGO_CONFIG` | Optional; absent in CI. |
| 3 | API responses → state | `core/data-client.js:32` | JSON-parsed; `!r.ok` throws. No schema validation. |
| 4 | `localStorage` state | `core/state.js` | Trusted while auth inert — the known G-04 input problem. |
| 5 | `postMessage` / parent shell | `core/nitda-module-adapter.js:22` | Posts to `window.parent` with `window.location.origin \|\| '*'`. Fallback `'*'` is permissive. |
| 6 | Module dynamic import | `core/boot.js:10` | Fixed literal map — not attacker-influenced. |
| 7 | Error objects → DOM | `core/boot.js:20`; `core/router.js:2` | Router escapes; **boot does not** (R-H1). |
| 8 | Portal URL params | `document-portal/js/track.js:270`, `support.js:273`, `submit.js:411` | Assigned to `.value` — **safe**, not an HTML sink. |
| 9 | Portal file upload | `document-portal/js/submit.js:162–175` | Extension allow-list + count/size caps — **verified clean**. |
| 10 | Portal `localStorage` records | `document-portal/js/core.js:94` | Sole source of truth (D-H1). |
| 11 | Portal staff sign-in | `document-portal/js/core.js:228–244` | Client-side only (D-C2). |
| 12 | Service worker cache | `document-portal/sw.js:6,18` | Precaches `admin.html` **and** `js/data.js`. |

---

## 4. Findings ledger

### CRITICAL

---

#### D-C1 · Three live Power Automate SAS credentials shipped to every visitor
**Confidence: Confirmed · Status: Open · Area: document-portal**
**`document-portal/js/data.js:25–27`**

```js
PF.ENDPOINTS = {
  submission: 'https://…/workflows/1ff7714c…/triggers/manual/paths/invoke?…&sig=jVUOseIHw17BG3tMiZfBMCEVSN1a65vOSLtsKURgr98',
  tracking:   'https://…/workflows/ca0bafc1…/triggers/manual/paths/invoke?…&sig=Yef7pmj6yGBRszqaS9BT7gosu2gYlaheAfqhmSgAJuo',
  support:    'https://…/workflows/3fc71cc2…/triggers/manual/paths/invoke?…&sig=FUeporOryvRDWA7z561j4LsLY4ey3YjUsgUCIqhEzyU'
};
```

**Failure narrative.** `data.js` is a plain `<script>` fetched by every browser that opens any portal page. A SAS-signed Power Automate URL is a bearer credential — possession alone authorises invoking the flow. Anyone who loads the page, or reads the repository, can invoke all three flows directly and without limit. `sw.js:18` additionally precaches `js/data.js`, so the credentials persist in the browser cache after the page is closed.

**Impact.** Unauthenticated third-party invocation of the submission, tracking and support workflows; forged registry submissions; spam amplification through official NITDA automation.

**Remediation.** Rotate all three signatures in Power Automate — deleting the file revokes nothing. Then move invocation behind the authenticating proxy in `proxy/`, exactly as the root runtime already provisions via `AuthConfig.proxyBaseUrl`, so signed URLs stop reaching the browser at all. Until then, set the three values to `''`; `PF.flow` already handles `not-configured` gracefully (`core.js:281`).

---

### HIGH

---

#### D-C2 · Plaintext staff credentials shipped and displayed; console gate is client-side
**Confidence: Confirmed · Status: Open (documented, but the stated mitigation is not a control) · Area: document-portal**
**`document-portal/js/data.js:86–88`, `js/admin.js:21`, `js/core.js:228–244`, `robots.txt:3`, `sw.js:6`**

```js
PF.STAFF = [
  { user: 'admin',      pass: 'password',   name: 'A. Bello',   role: 'Registry supervisor', scope: 'all'  },
  { user: 'reviewer',   pass: 'reviewer',   name: 'M. Adeyemi', role: 'Reviewing officer',   scope: 'unit' },
  { user: 'compliance', pass: 'compliance', name: 'C. Okonkwo', role: 'Compliance officer',  scope: 'unit' }
];
```

**Failure narrative.** Sign-in compares typed input against this shipped array and, on success, writes a session object to `sessionStorage` (`core.js:231–238`). There is no server round-trip. `admin.js:21` renders the accounts into `#demoAccounts` — the passwords are printed on the sign-in page. An attacker needs neither: setting the `sessionStorage` key directly satisfies `signedIn()`.

**On the documented mitigation.** The README states *"Replace this list with your identity provider before production use — the console is a client-side gate, and `robots.txt` excludes `admin.html` from indexing."* The first clause is a fair disclosure. The second is not a control: `robots.txt` is advisory to well-behaved crawlers and, by naming `Disallow: /admin.html`, **publishes the path to anyone who reads it**. `sw.js:6` also precaches `admin.html` for offline use, so the console is available even without the network. Meanwhile the same README opens with *"deployable package… copy the folder to any web root and it runs."*

**Impact.** Any visitor to a deployed instance reaches the Operations console and can triage, approve, decline and export — within their own browser (see D-H1), which bounds the blast radius but not the reputational exposure of an apparently-official NITDA console accepting `admin`/`password`.

**Remediation.** Delete `PF.STAFF` and `#demoAccounts`. Gate `admin.html` at the hosting layer (Entra ID / IIS / reverse proxy) — the only place a static site can be gated. Remove `admin.html` from the `sw.js` precache list. Keep the `robots.txt` entry, but stop describing it as a mitigation.

---

#### D-H1 · Governed workflow has no server of record
**Confidence: Confirmed · Status: Open (architectural) · Area: document-portal**
**`document-portal/js/core.js:277–298` (`PF.flow`), `js/core.js:94,220–223` (storage keys)**

**Failure narrative.** `PF.flow` posts and discards the response body. Nothing is ever read back from Power Automate. All state — records, statuses, decisions, timeline, support cases, audit trail — is `localStorage`. The Operations console therefore presents approvals, declines, bulk triage, SLA breach tracking, CSV export and an audit trail that exist only in the operator's browser.

**Impact.** A citizen's tracking lookup on their own device cannot see a decision made on a registry officer's device. Two officers hold divergent registries with no reconciliation. "Audit trail" and "CSV export" describe local data and carry no evidentiary weight. Clearing site data is an untraceable, unrecoverable deletion of the whole registry.

**Remediation.** Decide the portal's intended status and make the code state it. Two options:
- **(a) Label it a demonstration** — add an unmissable banner and remove the live endpoints. Cheap, honest, ~1 hour.
- **(b) Make it real** — read `PF.flow` responses, treat the backend as authoritative, and reduce `localStorage` to a cache with an explicit reconciliation path. Substantial.

**Recommended: (a) now, (b) only if the portal is actually on the delivery roadmap.** Shipping (b) halfway is worse than either.

---

#### R-C1 · Deep-link URL parameters reach outbound acknowledgement email HTML unescaped
**Confidence: Confirmed (chain traced end to end; payload not detonated) · Status: Open · Area: root platform**
**`config/deeplink.config.js:16` → `core/deeplink-resolver.js:10,12` → `core/acknowledgement-service.js:10,24–31,52`**

**The chain, link by link:**

1. `config/deeplink.config.js:16` — `preserveQueryParams` includes `actorName`, `actorEmail`, `userName`, `displayName`, `name`, `staffEmail`, `persona`, `role`, `department`, `phone`.
2. `core/deeplink-resolver.js:10` — `for(const p of DeepLinkConfig.preserveQueryParams){ const v=params.get(p); if(v) out.context[p]=v; }` — copied **verbatim**, no validation.
3. `core/deeplink-resolver.js:12` — `apply()` writes them into `State.deepLinkContext`.
4. `core/acknowledgement-service.js:24–31` — `resolveAcknowledgementActor` reads `context.actorName ?? context.userName ?? context.displayName ?? context.name` through `text()`.
5. `core/acknowledgement-service.js:10` — `const text = v => String(v ?? '').trim();` — **trims only; does not escape.**
6. `core/acknowledgement-service.js:52` — interpolated raw into the email body:

```js
`…has been acknowledged by <b>${payload.actorName}</b>.…
 <tr><th align="left">Reference</th><td>${payload.referenceId}</td></tr>…
 <td>${payload.actorName} &lt;${payload.actorEmail}&gt;</td>`
```

Note that `title`, `category`, `assignedTo`, `priority` and `due` are all routed through `text()` too — so the escaping gap is uniform, not specific to the actor fields.

**Exploit narrative.** A crafted link — `…/#/acknowledgment?taskId=NITDA-1234&actorName=<a href="https://attacker.example">Director-General</a>` — resolves, populates `deepLinkContext`, and when the recipient acknowledges, the generated HTML email carries attacker-authored markup. The email is addressed by the platform to the task assignee and CC'd to `dgsregistry@nitda.gov.ng` (line 53), so it arrives as a genuine, correctly-branded NITDA acknowledgement. A deep link must first match one of `acceptedParams` for the route to resolve, which is easily satisfied.

**Impact.** Content forgery inside official acknowledgement evidence, and a high-credibility phishing vector: the message is authentically sent by NITDA infrastructure to a NITDA recipient. Most mail clients strip `<script>`, so this is markup/link injection rather than script execution — which is the more effective attack here in any case.

**Remediation.** Escape at the boundary where HTML is built. `core/ui.js:1` already exports a correct `esc`. Apply it to every interpolation in `buildAcknowledgementNotification`, and additionally allow-list the deep-link identity parameters rather than copying 19 keys verbatim.

---

### MEDIUM

---

#### R-H1 · Unescaped error stack into `innerHTML` on boot failure
**Confidence: Confirmed · Status: Open · Area: root platform** · **`core/boot.js:20`**

```js
}catch(e){ console.error('[DGO BOOT]',e);
  host.innerHTML=`<div class="fatal"><h1>DGO could not start</h1><pre>${String(e.stack||e)}</pre></div>`; }
```

`core/router.js:2` escapes the equivalent value; boot does not. Reaching it requires an error whose message embeds attacker-controlled text during the boot window — narrow, but the asymmetry with the router is unjustifiable and the fix is one function call. **Strong inference** on exploitability; **Confirmed** on the sink.

**Remediation.** Reuse the same escape the router already applies.

---

#### R-H2 · Unescaped values in generated evidence index
**Confidence: Confirmed · Status: Open · Area: root platform** · **`core/export-bundle.js:6`**

```js
export function createEvidenceIndex(bundle){
  return `<!doctype html>…<title>Archive Evidence ${bundle.ref}</title>
          <h1>Archive Evidence: ${bundle.ref}</h1>
          <p>Archived: ${bundle.archivedAt}</p><p>Hash: ${bundle.hash}</p>`; }
```

`bundle.ref` derives from correspondence/registry reference data. This artefact is an **evidence** document; markup injected into it corrupts the record it exists to attest. **Remediation:** escape all three.

---

#### X-M1 · No CSP, SRI, framing, referrer or permissions policy anywhere
**Confidence: Confirmed · Status: Open · Area: cross-platform** · **all 11 HTML entry points**

Verified zero occurrences of `Content-Security-Policy`, `integrity=`, `referrer`, `X-Frame-Options`/`frame-ancestors`, and `Permissions-Policy` across `index.html`, the five document-portal pages, `404.html`, the three `newack/` pages and the ECM portal entry.

**Mitigating fact, verified:** the root platform and document portal have **no external CDN dependencies at all** — the only external hosts referenced anywhere are `nitda.gov.ng` (6), the Power Platform endpoint host (4) and `www.w3.org` (1, an XML namespace). So there is no SRI gap in practice, and a strict CSP would be unusually easy to adopt.

*This corrects the README troubleshooting section*, which tells users that fonts, Tailwind and Lucide load from `cdn.tailwindcss.com`, `unpkg.com` and Google Fonts. That is not true of the root platform or the document portal.

**Remediation.** A `default-src 'self'` CSP is achievable today for both. It needs one allowance for the root platform's inline watchdog (`index.html:26`) — either a hash or moving it to a file — and `connect-src` for the Power Platform host.

---

#### R-M2 · No module teardown contract
**Confidence: Confirmed · Status: Open · Area: root platform** · **`core/boot.js:17`, `core/router.js:2`**

Modules export `mount(el)` and nothing else. The router discards the previous stage via `replaceChildren`. Listeners bound to `el` and its descendants are collected with the detached tree, but anything a module binds to `window`, `document` or a timer survives the route change with no hook to release it.

Verified precedent that this is a live pattern, not hypothetical: `core/offline-action-queue.js` installs a `window` `online` listener (`boot.js:19`) and `document-portal/js/core.js:659` does the same. Those are boot-scoped and therefore correct; a *module* doing the same has no way to clean up.

**Remediation.** Add an optional `unmount()` to the module contract and call it before `replaceChildren`. Low effort, prevents a whole defect class.

---

#### X-M2 · `document-portal/` has no test coverage of any kind
**Confidence: Confirmed · Status: Open · Area: cross-platform**

`tests/check-imports.mjs:28` roots at `index.html` and `ECM_ActivityHub_Portal/index.html`. `tests/smoke.spec.js` has 6 root tests and 1 ECM test. The **only** reference to `document-portal` in the entire test and CI surface is `tests/secrets-baseline.txt:1`, which names it as a known-affected file.

Nothing verifies that the portal's five pages load, that its scripts parse, that `PF` initialises, or that its escaping holds. `newack/` is equally uncovered.

**Remediation.** Add the five portal pages to the smoke suite — they are static and fast. This is the cheapest coverage available in the repository.

---

### LOW

---

#### R-L1 · `postMessage` falls back to wildcard origin
**Confidence: Confirmed · Status: Open · Area: root platform** · **`core/nitda-module-adapter.js:22`**

```js
window.parent.postMessage({ source: SOURCE, type, payload, id }, window.location.origin || '*');
```

`window.location.origin` is `"null"` (a string) for sandboxed/`file://` contexts and is only falsy in exotic cases — so `'*'` is rarely reached. Where it is, the message is delivered to any parent origin. **Remediation:** replace the fallback with an explicit refusal to post.

#### X-L1 · No deployment workflow exists
**Confidence: Confirmed · Status: Open · Area: cross-platform**

`.github/workflows/` contains only `ci.yml`. There is no Pages, artefact or deployment job; the sole match for "pages" is a comment on line 73. **Nothing ships automatically, and no artefact selection has ever been made.** This is currently a containment benefit — D-C1's credentials are not being published by automation — and a planning gap. Any future deployment job must decide explicitly whether `document-portal/` is included, and must not ship it before D-C1 and D-C2 are closed.

#### R-L2 · No response schema validation
**Confidence: Confirmed · Status: Open · Area: root platform** · **`core/data-client.js:32`**

Responses are `JSON.parse`d and handed to callers unvalidated. Given the `REFERENCE_SNAPSHOT_REVIEW.md` finding that unmatched actions return a generic default envelope with `200 OK`, malformed or empty payloads propagate into state as success. **Remediation:** validate against the contract before patching state.

---

## 5. Verified clean — checked and found sound

Recording these so the report is a fair picture and so effort is not re-spent:

| Area | Result |
|---|---|
| `eval`, `new Function`, `document.write`, `outerHTML`, `insertAdjacentHTML` | **Zero occurrences** in every scanned area — root, portal, newack, proxy, tests, scripts. |
| Document-portal escaping | `PF.esc` (`js/core.js:14–18`) escapes `&<>"'` — identical coverage to the root helper. **161 call sites.** The record drawer (`admin.js:419–451`) escapes every user-supplied field; the unescaped interpolations are generated IDs, catalogue codes and numeric formatters. *This corrects my initial reading, which reported no escaping helper — that was a grep-pattern artefact, not a finding.* |
| Document-portal URL params | `track.js:270`, `support.js:273`, `submit.js:411` assign to `.value`, a property — **not an HTML sink**. |
| Document-portal file upload | `submit.js:162–175` enforces an extension allow-list (`OK_EXT`), max 5 files, 10 MB each, 50 MB total, plus duplicate detection; `submit.html:116` carries a matching `accept` attribute. |
| Root router race handling | Generation token re-checked after every `await`. Correct. |
| Root router error escaping | `core/router.js:2` escapes `&<>` before display. |
| Root route guard | Runs before mount and denies terminally. Real enforcement of an untrusted input, not decoration. |
| External CDN exposure | **None** in root or document portal. |

---

## 6. Test and deployment coverage matrix

| Surface | imports | secrets | governance | auth | proxy | smoke | links | CI | Deploy |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Root runtime | ✅ | ✅ | ✅ | ✅ | — | ✅ 6 | ✅ | ✅ | ❌ none |
| `proxy/` | — | ✅ | — | — | ✅ 66 | — | — | ✅ | ❌ none |
| `ECM_ActivityHub_Portal/` | ✅ | ✅ | — | ✅ | — | ✅ 1 | ✅ | ✅ | ❌ none |
| **`document-portal/`** | ❌ | ⚠️ baseline only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ none |
| **`newack/`** | ❌ | ⚠️ baseline only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ none |

⚠️ = present in `tests/secrets-baseline.txt` as a known-affected file; the ratchet blocks *new* signatures but asserts nothing about behaviour.

---

## 7. Duplicate, divergence and source-of-truth analysis

| Question | Answer |
|---|---|
| Is `document-portal_Central_NITDA_` a divergent variant? | **No.** 41/41 blob hashes identical to `document-portal/`. Proven, not inferred. |
| Which is the source of truth? | **`document-portal/`** — sole surviving copy, and the one the README and `setup-local.mjs:145` reference. |
| Does the design system exist twice? | **Yes, by design.** `styles/dgo-design-system/` (root) and `document-portal/ds/` are independent copies because the portal is independently deployable. This is intentional duplication with a real cost: a token change must be made twice, and nothing detects drift. |
| Dead components in root? | None found reachable from `index.html`; the import checker reports 0 broken edges. |
| Stale artefacts? | `README.md` "Not yet decided" section still says *"No `.devcontainer/` exists"* — it does, added in `53c4f5a`. The troubleshooting CDN section is also stale (see X-M1). |

**Design-system drift is currently unmeasured.** Recommend a check that diffs the shared token files between the two trees and fails on divergence — cheap, and it converts an invisible maintenance hazard into a CI signal.

---

## 8. Forensic readiness

| Capability | Root platform | document-portal |
|---|---|---|
| Correlation ID | ✅ `crypto.randomUUID()` per request, sent as `X-Correlation-Id` and in the body (`core/data-client.js:32`) | ❌ none |
| Audit trail | ✅ `core/audit-log.js`, patched through `State` with `event:` tags | ⚠️ `PF.store.log` — **localStorage only** |
| Authenticated principal | ❌ **Not while auth is inert** — actor is `state.profile`, browser-editable | ❌ `sessionStorage` session, client-authored |
| Timestamps | ✅ ISO-8601 throughout | ✅ ISO-8601 |
| Error evidence | ✅ `runtime.lastLoad` / `lastWarnings` (last 10), Diagnostics surfaces posture | ⚠️ integration attempts logged locally |
| Server-side record | ⚠️ Flows log their own runs; platform cannot correlate to a verified principal | ❌ **none** |

**Can an incident be reconstructed today?**
- **Root platform: partially.** Request-level lineage is good — correlation IDs, timing, run IDs and the flow's own `contractVersion` envelope are all captured. What cannot be established is *who* did it: until the proxy runs, every audit entry attributes to a self-asserted identity.
- **document-portal: no.** The only record is in the actor's own browser, is fully editable by them, and is destroyed by clearing site data. Nothing is independently attestable.

---

## 9. Limitations — what I could not verify

Stated plainly rather than papered over:

1. **No runtime execution.** Every finding is from static reading of source at `61604a3`. I did not boot the platform, drive a browser, or send a request to any endpoint.
2. **R-C1 was not detonated.** The chain is traced link by link through six locations and I am confident in it, but I did not construct a live URL and observe a generated email. Rated Confirmed for the code path, not for a demonstrated exploit.
3. **The three flows' actual behaviour is unknown.** Whether the Power Automate flows behind D-C1 validate, rate-limit or reject anything cannot be determined from this repository. The credential exposure stands regardless; the blast radius does not.
4. **`ECM_DOCS_DEV.zip` internals were not re-audited.** Treated as an archive of record, consistent with its stated purpose.
5. **Deployed instances are out of view.** Whether `document-portal/` is currently hosted anywhere — and therefore whether D-C1/D-C2 are live or latent — cannot be established from the repository. **This is the single most important thing to confirm, and only you can confirm it.**
6. **CSS was inventoried, not audited for rendering.** No visual regression coverage exists (a standing G-08 gap), so claims about theming correctness rest on the smoke suite's theme check alone.
7. **`newack/`** was scanned for sinks and secrets but not architecturally reconstructed; it was outside the stated scope.

---

## 10. Recommended order of work

| # | Action | Area | Effort | Priority |
|---|---|---|---|---|
| 1 | **Confirm whether `document-portal/` is deployed anywhere** | portal | minutes | **Do first — it sets everything else** |
| 2 | Rotate the 3 signatures; blank `PF.ENDPOINTS` (D-C1) | portal | ~30 min | **Critical** |
| 3 | Remove `PF.STAFF` + `#demoAccounts`; drop `admin.html` from SW precache (D-C2) | portal | ~1 hour | **High** |
| 4 | Escape the acknowledgement email builder + allow-list deep-link params (R-C1) | root | ~1 hour | **High** |
| 5 | Escape `boot.js:20` and `export-bundle.js:6` (R-H1, R-H2) | root | ~15 min | Medium |
| 6 | Decide and declare the portal's status (D-H1) | portal | ~1 hour for (a) | **High** |
| 7 | Add the 5 portal pages to the smoke suite (X-M2) | cross | ~2 hours | Medium |
| 8 | Adopt `default-src 'self'` CSP on both (X-M1) | cross | ~2 hours | Medium |
| 9 | Add `unmount()` to the module contract (R-M2) | root | ~2 hours | Medium |
| 10 | Add a design-system drift check | cross | ~1 hour | Low |
| 11 | Correct the stale README sections | cross | ~15 min | Low |

Items 2–5 are the security core and total roughly half a day.

---

## 11. Sectioning, styling and journey assessment

Measured rather than asserted. Two of my own first-pass measurements were wrong and are corrected here.

### 11.1 Sectioning — **already consistent, no work required**

| Primitive | Coverage |
|---|---|
| `head()` workspace header | **25 / 25 modules** |
| `class="workspace…"` wrapper | **25 / 25 modules** |
| `class="panel…"` section | **25 / 25 modules** |
| `kpis()` band | 9 / 25 — appropriate; not every workspace has metrics |

*Correction: I initially reported 21/25 and 24/25. Both were grep artifacts — I matched `class="workspace"` with a closing quote, which misses every module that adds a modifier (`workspace cc-workspace`, `panel grid`). There is no sectioning inconsistency to fix.*

### 11.2 Styling, theming and branding — **one real gap, now closed**

Raw counts looked alarming (53 colour literals, 70 inline `style=`), but they concentrate almost entirely in three files, and two of those are legitimate:

| File | Literals | Inline styles | Verdict |
|---|---:|---:|---|
| `core/welcome-experience.js` | 38 | 47 | **The real gap — fixed this pass** |
| `core/acknowledgement-service.js` | 7 | 7 | **Legitimate** — HTML email; clients support neither custom properties nor external stylesheets |
| `core/correspondence-email-service.js` | 6 | 11 | **Legitimate** — same reason |
| `modules/*` (3 files) | 2 | 3 | Negligible |

The welcome overlay declared eight private `--wel-*` literals and referenced **no platform token at all**, so it painted identically in light, dark and high-contrast — on the first screen a user sees. It now resolves from platform tokens with the literals as fallbacks. Measured: high-contrast moves `rgb(5,88,59)` → `rgb(2,40,25)`. Light and dark stay equal because `tokens.theme-dark.css:22` deliberately keeps `--dgo-color-surface-brand` at `green-700` — the overlay now follows the design system's actual decision instead of a hardcoded guess.

**Remaining, not fixed:** the responsive scale is unsystematic — breakpoints at 560, 720, 900 and 1100 px with no shared ladder, and `@media(max-width:900px)` and `@media (max-width:900px)` both in use. Cosmetic today; worth normalising into a token before the next layout change.

### 11.3 Feature relationships, per-row behaviour and user journeys — **not attempted, and why**

This is the one part of the request I did not execute, and I want to be explicit rather than imply otherwise.

The substance of it is already documented, with screenshot evidence, in `DGO_R11_6_UI_SCREENSHOT_DEFECT_REGISTER-2.md` inside the reference snapshot: **14 defects, 9 rated High**, concentrated on `#/correspondence` and `#/home` — split-pane density, portrait layouts retaining desktop toolbar logic, raw email bodies rendered unprocessed, assignment previews exposing technical payloads instead of decision summaries. **UI-001 is still live**: `core/flow-confirmation.js` still `JSON.stringify`s the payload into the operator's confirmation modal.

I did not act on these because:

1. **They are visual defects and there is no visual regression coverage** (the standing G-08 gap). Changing 25 modules' layout with only a 7-test smoke suite as a safety net would be changing what I cannot verify.
2. **The evidence is 14 screenshots I do not have** — `Notes_260728_213651.pdf` holds them, but judging "over-dense" or "weak hierarchy" against a capture I cannot see would be guesswork dressed as engineering.
3. **It is a multi-day design program, not a remediation pass**, and it needs your judgement on the target layout.

**Recommendation.** Take UI-001 now — it is small, isolated, and the register names the exact fix (operator summary card first, technical payload collapsed behind a disclosure). Then, before touching the other 13, add rendered-appearance coverage so the work is verifiable. Doing the layout work first and the coverage second inverts the risk.

---

## 12. Intake architecture — intended vs as-built

**Stated intent.** The root platform is the system of record. It receives correspondence from at least three channels — physical documents scanned and uploaded, email, and the document portal (externally facing) — plus other sources. Root and its related internal services are for internal use.

Assessed against that intent, **the root platform has a working intake path for one of its three named channels.**

### 12.1 Channel-by-channel

| Channel | Intended | As-built | Verdict |
|---|---|---|---|
| **Email** | Intake into root | `FETCH_ALL` populates `state.emails`; `modules/lookup.js:26` and `modules/correspondence-email.js` render them; "Create task from email" posts to `EMAIL_RELATED_TASK`; `modules/activities.js:89` pulls attachments via `FETCH_EMAIL_ATTACHMENTS` | ✅ **Implemented** |
| **Scanned / physical** | Intake into root | **No upload path exists.** The only `type="file"` in the entire root platform is `modules/settings.js`, `accept="application/json"`, importing an activities array. Correspondence is created by typing metadata into a form (`modules/correspondence.js:31`) — subject, sender, contact, dates, category. The record carries `channel:'Document'` but no document. | ⚠️ **Metadata only** |
| **Document portal** | External intake into root | **Absent end to end.** No shared code, no shared flow, no shared state. Root's channel vocabulary is `Document`, `Email`, `Registry` — there is no `Portal` value. | ❌ **Absent** |
| **Other / internal** | — | `newack/` posts to a fourth, equally disjoint flow | ⚠️ **Fragmented** |

### 12.2 The decisive evidence — four applications, twelve flows, zero shared

| Application | Workflow GUIDs |
|---|---|
| Root platform | `ff455c68`, `818ec405`, `37642ba3`, `3931e2ff`, `85c556f1`, `4a250f97`, `6b3bad30`, `1154b50e`, `7e71fffe` |
| document-portal | `1ff7714c`, `ca0bafc1`, `3fc71cc2` |
| newack | `02a3a70f` |

**The intersection is empty.** The portal's three flows are read by no root endpoint, and root's nine flows are called by no portal code. Combined with §2.3 (no shared modules, CSS, import graph, iframe or postMessage), there is no channel — client-side or server-side — by which a portal submission can become a root correspondence record.

This upgrades the earlier D-H1 finding. I previously described the portal's write-only design as making it a local simulation. Against the stated intent it is worse than that: **the portal is the one deliberately external-facing channel, and it is the one with no path into the system of record.** A citizen submission is written to the submitter's own `localStorage`, posted to a flow nothing reads, and is invisible to the platform that is supposed to own it.

### 12.3 What the attachment model tells us — **this part is coherent**

Root never handles file bytes, and that is a design decision rather than an omission. Documents are referenced, not carried:

```js
attachmentLink: c.attachmentLink || c.AttachmentLink || c.Link || c.webUrl || c.documentUrl || ''
```

`webUrl` / `documentUrl` are SharePoint shapes. The implied architecture is sound: **documents live in SharePoint; root holds governance metadata and a link.** The `DGO_SHAREPOINT_RUNTIME_PACKAGE` in the reference snapshot (10 lists, target site `…/sites/NITDADGO-EAAACTIVITYTRACKING`) is the other half of exactly this design.

So the scanned-document gap is narrower than "no upload". It is: **nothing in root initiates, tracks or reconciles that upload.** A registry clerk scanning a letter must put it into SharePoint by some route outside the platform, then separately type a correspondence record, and hope the two meet. There is no correlation between the record and the file, no receipt, and no way for the platform to report an unmatched scan.

### 12.4 Consequences

1. **The system of record is not the system of receipt.** Root can only govern what already reached SharePoint or a mailbox. Two of the three declared channels bypass it.
2. **Portal submissions cannot be assigned, tracked, acknowledged or archived** — the entire governed lifecycle in `modules/` is unreachable for externally-submitted correspondence.
3. **SLA claims on the portal are unbacked.** `track.html` shows a working-day SLA meter against a due date computed locally, for a request no internal system has seen.
4. **`REFERENCE_SNAPSHOT_REVIEW.md` A-1 compounds this.** Even the channels that *are* wired send the nested envelope the flows cannot read, so several root calls already return `200 OK` with empty data.

### 12.5 Options, with a recommendation

**These are architecture decisions, not defects to patch, so I am presenting them rather than choosing.**

| # | Option | What it means | Effort | Assessment |
|---|---|---|---|---|
| **A** | **Portal posts to a root intake contract** | Add an `INTAKE_SUBMISSION` contract in `config/endpoints.config.js`, a `Portal` channel in the correspondence vocabulary, and point `PF.ENDPOINTS.submission` at it via the proxy. The portal stops owning state and becomes a submission client. | ~1 week | **Recommended.** Smallest change that makes the stated architecture true. It also retires D-C1 — signed URLs leave the browser entirely — and gives external submissions the full governed lifecycle. |
| **B** | **Flow-level bridge** | Leave both clients alone; add a Power Automate flow that writes portal submissions into the same SharePoint lists root reads. | ~3 days | Faster, and invisible to both codebases. But it leaves the portal as a second system of record and does nothing about D-C1 or D-C2. A staging post, not a destination. |
| **C** | **Formally separate them** | Declare the portal a standalone public service with its own backend, and integrate later or never. | ~1 day | Honest and cheap, but it concedes that external correspondence never enters the platform that is meant to govern it. Only defensible if the portal is not on the delivery roadmap. |
| **D** | **Add scan intake to root** | A registry upload workspace: file → SharePoint via the proxy → correspondence record created with the link already attached. | ~1 week | **Recommended alongside A.** Closes the second missing channel and makes `channel:'Document'` mean something. Independent of the portal decision. |

**Recommended path: A then D**, in that order — A closes the externally-facing gap and a Critical security finding in the same change, and D closes the internal one. B is the right choice only if the portal must keep working during a longer migration.

**Prerequisite for all four:** fix the envelope mismatch (`REFERENCE_SNAPSHOT_REVIEW.md` A-1/A-2) first. Building new intake on a transport that silently returns empty results would make the new path look broken for reasons that have nothing to do with it.

### 12.6 Limitation on this section

I have assessed intent against code. I cannot see the SharePoint tenant, the Power Automate environment, or any deployed instance, so I cannot rule out that a flow-level bridge (option B) **already exists** outside this repository and joins the portal's three flows to root's lists. Nothing in the repository references one, and the flow definition I examined contains no such path — but the repository is not the whole system. **If such a bridge exists, §12.2's conclusion holds for the codebase but not for the platform, and this section should be re-read with that correction.**
