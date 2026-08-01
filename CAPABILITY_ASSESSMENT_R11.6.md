# DGO R11.6 Runtime — Capability Assessment & Gap Analysis

**Subject:** DGO Digital Operations — R11.6 "Obsidian Harmonized Design System" Runtime (root app: `index.html` + `core/`, `modules/`, `shared/`, `config/`, `styles/`)
**Repository:** `dgoeaa/ECM_DOCS_DEV` @ `31ca711`
**Date:** 2026-08-01
**Method:** Static module-graph resolution, git-history forensics, and empirical browser execution (Chromium 1194 via Playwright, local static server). Every finding below is reproducible; the probes are described inline.

---

## 1. Executive summary

The R11.6 runtime is a **capable, thoughtfully-governed application that cannot currently start.** Those two facts must be held together, because they point to opposite conclusions about the work remaining.

The *engineering substance* is real. 105 ES modules, 25 route modules, and a genuine governance spine — action-ownership enforcement, module boundaries, an audit log, idempotency keys, an offline action queue, a receipt ledger, OTP step-up, and an endpoint-contract registry with signature redaction. When the missing pieces are restored, **all 25 routes render with zero page errors and zero console errors.** This is not scaffolding.

The *delivered artifact* is broken. **13 configuration modules that the runtime imports were never committed to this repository.** The app hangs on its boot spinner forever, and does so silently — no error is shown to the user. Around it, the entire quality apparatus the README describes (test suite, CI workflows, bundle manifest, deploy gate) is **absent from the repository**, so nothing detected this.

Layered on top is a **credential-exposure problem materially worse than the one the repo documents.** `README.md` and `AUDIT.md` both state that SAS-signed Power Automate URLs have been removed from the working tree and survive only in git history. That is **not correct for this repository**: 24 distinct live SAS signatures are present across 17 tracked files at HEAD, including the client-delivered JavaScript of two shipping portals.

**Overall posture: NOT DEPLOYABLE.** Three of the four blockers are mechanical and quick. The fourth (authentication) is a genuine engineering commitment.

| Dimension | Rating | Basis |
|---|---|---|
| Functional breadth | **Strong** | 25/25 routes render clean once configs restored |
| Governance & auditability | **Strong** | Ownership, audit, idempotency, receipts, OTP all present and wired |
| Build integrity | **Failed** | 13 required modules absent; app cannot boot |
| Quality gate / CI | **Absent** | No `tests/`, no `.github/`; 6 of 8 npm scripts cannot run |
| Security — secrets | **Critical** | 24 live SAS signatures in tracked files at HEAD |
| Security — authn/authz | **Critical** | No authentication; privilege escalation demonstrated |
| Presentation / theming | **Degraded** | Dark theme unreadable; high-contrast theme inert |
| Documentation accuracy | **Poor** | README describes a repository layout that does not exist here |

---

## 2. Capability assessment — what the runtime actually does

### 2.1 Verified working (empirical)

With the 13 missing config modules restored from `ECM_DOCS_DEV.zip`, a headless Chromium boot produced `window.__DGO_BOOTED__ === true`, a mounted `<dgo-shell>`, 17 primary navigation entries, and exactly one HTTP 404 — `config/config.local.js`, which is optional and expected by design.

All 25 routes declared in `config/routes.config.js` were then driven in sequence. **Every route mounted a `.route-stage`, rendered a heading, and raised no page or console errors.** Routes with no seeded data correctly showed purposeful empty states ("No work matches this queue.", "Queue empty. Completed tasks appear here for dispatch.") rather than blank panes or crashes — a meaningful sign of maturity.

| Group | Routes | Result |
|---|---|---|
| START HERE | home, ecm-erp-charter | Render; charter route is substantial (~11.9 KB text, 22 panels) |
| OPERATIONS | activities, correspondence, orchestrator, single-assignment, bulk-assignment, registry, comments | Render; correct empty states |
| CONTROL | response-tracking, fasttrack, approvals, reports, statistics, executive | Render; reports/statistics richest (17 controls each) |
| CLOSURE | dispatch, archive, correspondence-email | Render |
| SYSTEM | settings, diagnostics, user-admin, operator-hud, assistant, lookup, acknowledgment | Render; diagnostics is the deepest self-report (~4.1 KB) |

### 2.2 Governance spine — genuinely strong

This is the runtime's most credible asset, and it is better than the surrounding packaging suggests.

- **Action ownership** (`core/action-authority.js` + `config/action-ownership.config.js`, `config/module-boundaries.config.js`) — every mutating action must be *owned* by the invoking module or explicitly list it as an allowed invoker, else it throws. `executeOwnedAction()` wraps each call in started/completed/failed audit records.
- **Audit log** (`core/audit-log.js`) — ring-buffered to 5000 events, indexed by reference, with frozen snapshots. `core/state.js` additionally auto-records an audit entry on every non-runtime state patch (capped at 1000).
- **Idempotency** (`core/idempotency.js`) — SHA-256 payload digest keyed by operation + ref + actor + a 5-minute time bucket. Correct construction for retry-safe writes.
- **Offline durability** (`core/offline-action-queue.js`, `core/pending-queue.js`, `core/receipt-ledger.js`) — failed writes enqueue with retry metadata; an `online` event listener drains the queue; each attempt writes a receipt (`queued` / `sent` / `failed`).
- **Endpoint contracts** (`core/endpoint-registry.js`) — three-tier resolution (deployment manifest → audited operator override → packaged default), per-key timeout/retry/dedupe policy, `redact()` that strips `sig`/`sv`/`sp`/`code` before any URL is logged or exported, and a diagnostics warning when any endpoint still resolves to a packaged signed URL. This module is well-designed and shows the authors understood the credential risk.
- **Step-up auth** (`core/otp-service.js`) — OTP request/verify/verify-and-execute, binding the OTP to a payload digest so a verified OTP cannot be replayed against a different payload.
- **Write discipline** (`core/write-manager.js`) — `local` / `backend` / `optimistic` modes, with state snapshot-and-rollback on optimistic failure.

**Assessment:** these are the right primitives, competently implemented. Their weakness is not design — it is that **every one of them is enforced only in the browser** (§4.2).

### 2.3 Accessibility — good foundation, one broken claim

Measured on the booted shell: skip-link present and `#main` resolvable, `lang="en"`, 0 images missing `alt`, 0 of 9 buttons without an accessible name, 3 ARIA live regions, exactly 1 `<nav>` and 1 `<main>` landmark. `shared/figma-uiux-runtime.js` implements a real focus trap for drawers (Tab/Shift-Tab wrap, focus restored to opener on close) and `core/focus-trap.js` adds 114 lines more. Tables get `data-label` attributes injected for responsive stacking.

Two defects: `<h1>` appears twice on the shell (one landmark heading, one page heading), and the **high-contrast theme does not visually apply** (§5.2) — which undermines the accessibility claim where it matters most.

---

## 3. Gap analysis — build integrity (CRITICAL)

### G-01 — 13 config modules were never committed; the runtime cannot boot

Resolving the full ES-module import graph from the two entry points in `index.html` reaches **105 modules and finds 35 broken import edges to 12 distinct missing files**. A 13th file (`product-definition.config.json`) is referenced by the platform but not imported by the graph.

```
config/workflow-clarity.config.js        ← config/nav.config.js, shared/shell.js, modules/home.js, shared/workspace-guide.js
config/rbac.config.js                    ← core/current-user.js, core/directorate-scope.js, modules/settings.js, modules/user-admin.js
config/priority.config.js                ← 15 importers (core/domain.js, core/enterprise-domain.js, 11 modules, …)
config/routes.config.js                  ← shared/shell.js
config/platform-provisioning.config.js   ← core/platform-provisioner.js, core/action-runtime.js
config/state-schema.config.js            ← core/platform-provisioner.js
config/welcome-experience.config.js      ← core/welcome-experience.js, shared/welcome-runtime.js
config/source-views.config.js            ← core/source-views.js, modules/single-assignment.js
config/source-routing.config.js          ← shared/relationship-runtime.js
config/support-routing.config.js         ← core/support-service.js, modules/assistant.js
config/receipt-ledger.config.js          ← core/receipt-ledger.js
config/performance-budget.config.js      ← core/performance-monitor.js
config/product-definition.config.json    (platform data; not import-reachable)
```

**These files have zero commits in the entire repository history** (`git log --all -- config/<name>` returns nothing for all 13). This is not a deletion to recover from — they were never added.

**Empirical confirmation.** Serving the tree as-is and loading `index.html`:

```json
{ "booted": false, "shell": false, "navCount": 0,
  "appText": "Loading DGO Digital Operations…",
  "http4xx": ["404 /config/config.local.js", "404 /config/platform-provisioning.config.js",
              "404 /config/state-schema.config.js", "404 /config/performance-budget.config.js",
              "404 /config/rbac.config.js", "404 /config/priority.config.js"] }
```

The application hangs on its boot spinner permanently.

**The files exist and are correct.** `ECM_DOCS_DEV.zip` (tracked, 16 MB) contains `DGO_Targets_Platform/`, a complete copy of the platform. A recursive diff against the working tree shows `config/` is the **only** divergent directory — `core/`, `modules/`, `shared/`, `styles/`, `assets/`, `scripts/`, `tools/` and all six root files are **byte-identical**. Restoring the 13 files from the zip produced a clean boot, a mounted shell, 17 nav items, and the 25/25 route pass in §2.1.

**Fix:** copy the 13 files from `ECM_DOCS_DEV.zip::DGO_Targets_Platform/config/` into `config/` and commit. Verified working. Effort: minutes.

### G-02 — Boot failure is silent; the fatal-error handler cannot fire

`core/boot.js` wraps its logic in `try/catch` and renders a `.fatal` panel on error. But the 12 missing modules are **static** imports in the module graph, so resolution fails *before* `boot()` is ever invoked. The `catch` never runs, `pageerror` never fires, and the user sees an indefinite "Loading DGO Digital Operations…".

This is why G-01 could ship unnoticed: the failure mode is indistinguishable from a slow network.

**Fix:** add a boot watchdog in `index.html` (e.g. if `window.__DGO_BOOTED__` is still falsy after ~10 s, replace the spinner with a diagnostic panel listing failed module URLs). Independent of G-01 and worth doing regardless.

---

## 4. Gap analysis — security (CRITICAL)

### G-03 — 24 live SAS signatures in tracked files at HEAD

`README.md` states the SAS URLs "have been removed from the working tree, but **15 distinct SAS signatures remain in 5 git blobs**". `AUDIT.md` F-007 similarly reports no `sig=` token in shipped code.

**Both statements are inaccurate for this repository.** Scanning tracked files at HEAD for `sig=` followed by ≥20 signature-shaped characters:

| File | Distinct signatures | Client-delivered? |
|---|---:|---|
| `newack/unified-hub-ackflow.html` | 6 | **Yes** |
| `Consolidate_Merged_Folder_Files_Embed/Extract_NITDA_operations_manifest_ai_ready_UNREDACTED-1.json` | 7 | No |
| `document-portal/js/data.js` | 3 | **Yes** |
| `document-portal_Central_NITDA_/js/data.js` | 3 | **Yes** |
| `Bespoke platform welcome experience/reference-portal/assets/common.js` | 2 | **Yes** |
| `Bespoke platform welcome experience/uploads/nitda_intelligent_state.forensic.json` | 2 | No |
| `Flows_Sample/` — 9 flow-run records | 14 occurrences | No |
| **Total distinct** | **24** | — |

A Power Automate SAS URL is a bearer credential: possession alone authorizes invocation. Four of these files are **served to browsers** by shipping applications (`document-portal/`, `document-portal_Central_NITDA_/`, `newack/`, and the Bespoke welcome portal), so the signatures are readable by any visitor via View Source. These flows include task creation, bulk assignment, email dispatch, and OTP generation/verification.

Two clarifications, to be precise about scope:
- `config/config.example.js` is **clean** — its 17 `sig=ROTATE_ME` occurrences are placeholders, exactly as intended.
- `core/render-budget.js` is a **false positive** — `let sig='';` is a JavaScript variable.

The R11.6 runtime's own `config/endpoints.config.js` is also clean and correctly reads from `window.DGO_CONFIG.endpoints`. **The exposure is in the sibling apps and reference material, not in R11.6 itself** — but they share this repository, and publishing it publishes them.

**Fix (ordered):** (1) rotate all 24 signatures in Power Automate — this is the only action that actually revokes them; deleting files does not. (2) Purge the values from the tracked tree, replacing the forensic/sample JSON with redacted copies. (3) Only then consider history rewrite. (4) Correct the README and AUDIT claims.

### G-04 — No authentication; privilege escalation demonstrated

The R11.6 runtime has **no authentication layer of any kind**. There is no login, no session, no token exchange, and `core/data-client.js` sends **no `Authorization` header** — only `Content-Type` and `X-Correlation-Id`. Caller identity travels as a plain body field:

```js
body: { action: contract.action, payload,
        userEmail: State.get().profile?.email || '', requestId: id, … }
```

Identity originates in `core/state.js`, which seeds a **bootstrap `systemAdmin`** (`dgsregistry@nitda.gov.ng`, `accessScope:['all']`) and persists the whole state object — profile, role, user list — to `localStorage` under `dgo.r11.viewport.runtime.state`. Every RBAC decision in `config/rbac.config.js` reads from that store.

**Demonstrated exploit** (headless Chromium, no devtools required):

| Step | Action | Result |
|---|---|---|
| 1 | Default load | `role: systemAdmin`, `status: active` |
| 2 | Rewrite `localStorage` profile+users to a `viewer`, reload | `canCurrentUserAccess('user-admin') === false`; route renders *"Access denied — Your current role cannot open this workspace."* ✅ gate works as designed |
| 3 | Rewrite the same record's `role` to `systemAdmin`, reload | `canUserAdmin === true`; **User Administration renders in full, including Pilot User Enrollment** |

One `localStorage` edit converts a read-only viewer into a system administrator. The route guard is a **UX affordance, not a security control** — which is the correct way to build a client, but only if a server enforces the real boundary. Here, the backend receives an unauthenticated, self-asserted `userEmail` and nothing else.

`AUDIT.md` records exactly this class of failure (F-001/F-002/F-003) **for the ECM Activity Hub Portal only**. The identical — arguably worse, since the runtime ships a hardcoded `systemAdmin` — defect in the R11.6 runtime is **undocumented**.

**Fix:** authenticate at the edge (Entra ID / OIDC), pass a signed token, and have every Power Automate flow derive identity and role from that token, ignoring `userEmail` entirely. Keep the client RBAC as UX. This is real work — the largest single item in this report — and it is the one gap that cannot be closed by restoring files.

---

## 5. Gap analysis — presentation

### G-05 — Dark theme renders content unreadable

The **token layer is correct**: on `<html>`, `--dgo-color-surface-sunken` resolves to `#F5F4F4` (light), `#081109` (dark), `#F0EFEF` (hc), and `--bg`/`--fg` invert properly.

The **surfaces do not follow**. Measured across all three themes, `body` background is `rgb(245,244,244)` and `body` color is `rgb(27,26,26)` — **identical in every theme**; `.panel` stays `rgb(255,255,255)`; `<dgo-shell>` stays `rgb(245,244,244)`. Only `<html>` (fully covered by `body`, which is `100vh`) changes.

The screenshot evidence is unambiguous. In dark theme the sidebar and ministry bar darken, but the content region stays light-gray with white cards while foreground colors flip to light — so **KPI values, card titles, and the entire "Plain-language workflow" list become white-on-white and vanish**. Light theme renders the same view perfectly.

Contributing factor: `styles/dgo-design-system/tokens/tokens.theme-light.css` binds its tokens to **`[data-theme="light"], :root`**, so the light values remain live at `:root` under every theme, while `tokens.theme-dark.css` and `tokens.theme-hc.css` bind only to their own attribute selectors. Combined with the two-authority `overrides` layer that `styles/index.css` documents at length as unresolved measured debt, the light values win at the point where `body` and `.panel` resolve them. The exact winning declaration should be confirmed with the cascade tooling before patching — but the user-visible defect is reproducible and does not depend on that detail.

**Fix:** scope the light theme to `[data-theme="light"]` only and set a neutral default separately; re-measure `body`/`.panel`/`dgo-shell` computed backgrounds across all three themes.

### G-06 — High-contrast theme is visually inert

`data-theme="hc"` is pixel-near-identical to light: `body` background, `body` color, and `.panel` background are unchanged, and the rendered shell differs only in minor button borders. Same root cause as G-05. Because `hc` is the accessibility affordance, this makes the platform's WCAG contrast posture **unsupported by the build**, even though `tokens.theme-hc.css` defines correct values (`--bg: #FFFFFF`, `--fg: #000000`) and includes a `@media (forced-colors: active)` block.

### G-07 — Two competing welcome layers; `?skipWelcome=1` only half-honoured

`config/welcome-experience.config.js` lists `skipQueryParams: ['skipWelcome','embed']`, and `core/welcome-experience.js` honours it. But `shared/welcome-runtime.js` `launchWelcome()` gates independently on `!embedded() && settings.welcomeSeen === false` and **ignores the query parameter**. Loading `index.html?skipWelcome=1` therefore still renders a full-screen welcome overlay.

`CONTRIBUTING.md` instructs test authors to use `?skipWelcome=1` "when the root app's welcome overlay would block the shell from rendering" — so the documented test idiom does not work.

**Fix:** make `launchWelcome()` defer to the same `shouldSkip()` predicate, or collapse the two layers into one.

---

## 6. Gap analysis — quality gate & documentation

### G-08 — The entire test and CI apparatus is absent

The README documents a UI-contract suite, a baseline ratchet, three GitHub workflows, a bundle drift check, and a Pages deploy gate. **None of it is in the repository** — and none of it is in `ECM_DOCS_DEV.zip` either, so it cannot be recovered the way `config/` can.

| Documented artifact | Status | Consequence |
|---|---|---|
| `tests/` (run.mjs, baseline.json, static/, browser/, smoke.spec.js) | **Missing** | `npm test`, `test:static`, `test:browser`, `test:full`, `baseline:update` all fail |
| `.github/workflows/{ci,ui-contracts,pages}.yml` | **Missing** | No CI, no deploy gate, no bundle drift check |
| `CLEAN_PACKAGE_MANIFEST.json` | **Missing** | `tools/rebuild_bundle.py` and `expand_bundle.py` are inoperative |
| `DGO_Target_CLEAN_RUNTIME.state.json` | **Missing** | Nothing to expand or drift-check |
| `rehydrate.py` | **Missing** | AUDIT.md's integrity procedure cannot be re-run |
| `.gitignore` | **Missing** | `config/config.local.js` is **not** ignored — real endpoint URLs can be committed by accident |
| `.devcontainer/` | **Missing** | Documented one-click Codespaces setup does not exist |
| `.nojekyll`, `.gitattributes` | **Missing** | Pages/diff behaviour as documented won't hold |

**6 of the 8 npm scripts cannot run.** `playwright.config.js` points at `testDir: './tests'`, which does not exist. `scripts/check-links.mjs` (present) targets `ECM_ActivityHub_Portal/htdocs/index.html`, but the portal has **no `htdocs/` directory** in this repo — its files sit one level up — so the link check fails on a path that cannot resolve. The same stale path appears in the README run instructions, the `serve:portal` npm script, and the Pages staging allow-list.

The absence of `.gitignore` deserves separate emphasis: the documented secret-handling pattern depends entirely on `config.local.js` being ignored. It isn't.

### G-09 — README describes a different repository

`README.md` and `CONTRIBUTING.md` were written for `dgoeaa/DGO_Targets`. This repository is `dgoeaa/ECM_DOCS_DEV`. Beyond the clone URL and the Pages URLs, the documented "Repo structure" tree lists directories that do not exist here, and omits everything that does — `document-portal/`, `document-portal_Central_NITDA_/`, `newack/`, `Flows_Sample/`, `Bespoke platform welcome experience/`, `CLient_Proxy_App_Backend/`, `Consolidate_Merged_Folder_Files_Embed/`, `universal_filename_policy_deliverables/`, and two tracked zip archives (17 MB combined).

A reader following the README will clone the wrong repo, run tests that don't exist, and trust a secrets claim that is false.

---

## 7. Consolidated findings

| ID | Finding | Severity | Effort |
|---|---|---|---|
| G-01 | 13 config modules never committed; runtime cannot boot | **Critical** | Minutes (verified fix available) |
| G-03 | 24 live SAS signatures in 17 tracked files at HEAD, 4 client-delivered | **Critical** | Hours + rotation window |
| G-04 | No authentication; privilege escalation demonstrated | **Critical** | Weeks (backend work) |
| G-08 | Test suite, CI, bundle manifest, `.gitignore` all absent | **High** | Days |
| G-05 | Dark theme renders content unreadable | **High** | Hours |
| G-06 | High-contrast theme inert; WCAG claim unsupported | **High** | Hours (same fix as G-05) |
| G-02 | Boot failure silent; fatal handler unreachable | **Medium** | Hours |
| G-09 | README/AUDIT describe a different repository; secrets claim false | **Medium** | Hours |
| G-07 | Duplicate welcome layers; `?skipWelcome=1` not honoured | **Low** | Hours |

## 8. Recommended sequence

**Immediate (day 0)**
1. **Rotate all 24 SAS signatures in Power Automate.** Everything else is cosmetic until this is done — the credentials are live and, for four files, publicly readable wherever those portals are hosted. Do this *before* any history rewrite; a rewrite invalidates clones without revoking anything.
2. **Restore the 13 config modules** from `ECM_DOCS_DEV.zip::DGO_Targets_Platform/config/`. Verified to produce a clean boot and 25/25 route pass.
3. **Add `.gitignore`** covering `config/config.local.js`, `ECM_ActivityHub_Portal/config.local.js`, `node_modules/`, `*.state.json`.

**Short term (this sprint)**
4. Purge signature values from tracked files; replace forensic/sample JSON with redacted copies.
5. Fix G-05/G-06 — scope `tokens.theme-light.css` to `[data-theme="light"]`, verify computed backgrounds across all three themes.
6. Add the boot watchdog (G-02) so this failure class is never silent again.
7. Correct `README.md` and `AUDIT.md`: repository name, structure, `htdocs` paths, and the secrets claim.

**Medium term**
8. **Design and implement real authentication** (G-04). Until a server independently derives identity and role, every governance control in §2.2 is advisory. This is the difference between a well-built prototype and a deployable government system.
9. Rebuild a minimal quality gate (G-08): a smoke test that asserts `__DGO_BOOTED__`, a static check that every relative import resolves on disk — which alone would have caught G-01 — and a CI workflow to run them.
10. Resolve G-07 and the duplicate `<h1>`.

---

## 9. Method & reproducibility

- **Import graph:** recursive resolution of static and dynamic `import`/`export … from` specifiers from `core/boot.js` and `shared/figma-uiux-runtime.js`; 105 modules reached, 35 broken edges to 12 files.
- **History forensics:** `git log --all -- <path>` per missing file (0 commits each); `git ls-files | xargs grep` for signature-shaped tokens at HEAD.
- **Boot/route/RBAC/theme probes:** Playwright-driven Chromium (`/opt/pw-browsers/chromium-1194`) against a minimal Node static server, one port per probe. Route sweep sets `location.hash` per route and inspects the `[data-outlet]` subtree. RBAC probe mutates `localStorage` and reloads. Theme probes read `getComputedStyle` on `<html>`, `<body>`, `.panel`, `<dgo-shell>` and capture 1400×880 screenshots.
- **Zip comparison:** `diff -rq` of `ECM_DOCS_DEV.zip::DGO_Targets_Platform/` against the working tree, per directory.

**One caveat, stated plainly:** the precise CSS declaration that pins `body`'s background across themes was not isolated to a single line — the `overrides` layer holds two authorities that `styles/index.css` itself documents as unresolved, measured cascade debt. The *defect* (G-05/G-06) is reproducible and screenshot-evidenced; the *one-line cause* should be confirmed with the cascade-measurement tooling described in that file before patching. That tooling is part of the missing `tests/` tree (G-08).
