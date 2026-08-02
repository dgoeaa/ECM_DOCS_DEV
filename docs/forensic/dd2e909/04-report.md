# Phase 4 — Synthesis

**Repository:** `dgoeaa/ECM_DOCS_DEV` · branch `claude/quirky-babbage-1nomt5`
**Analysis SHA:** `dd2e909ed0e337f7fe36a5f65201abca9ec7f28e` · working tree clean · 282 tracked files
**Scope:** current state only. No target-state architecture, no remediation design.

---

## 1. Executive summary

- **The authorization system is real, and nothing uses it.** `proxy/` implements correct JWT verification and RBAC — an algorithm allow-list with no `HS*`/`none`, key-type agreement, explicit `iss`/`aud`/`exp`/`nbf` checks, and a handler that returns 401 before 403 before forwarding. But both client trees route through it only when `auth.enabled` is `true`, which defaults to `false`, and two further trees contain no proxy code path at all. **Zero of four trees traverse it as configured.**

- **31 Power Automate SAS signatures require rotation — nine more than any prior count, because nothing has ever scanned the archive.** `tests/check-secrets.mjs:50` skips binary files, so the 16.4 MB `ECM_DOCS_DEV.zip` — which `scripts/setup-local.mjs` extracts working endpoints from — has never been inspected. It holds 31 signatures across 18 files; the 22 in git history are a strict subset.

- **There is no build step, so everything ships.** No bundler, no exclusion list, zero runtime dependencies. `npm start` is `http-server .` on the repository root, making the archive, both credential-bearing files and every audit document directly web-reachable. The devcontainer automates this: extract credentials, serve everything, auto-forward the port, open a browser.

- **The ECM Activity Hub's default backend is a personal Cloudflare Workers subdomain.** `ECM_ActivityHub_Portal/js/core/config.js:13` defaults `API_URL` to `https://exec-hub-proxy.kanihamza.workers.dev` under `ENV: "PROD"`. The override lives in a git-ignored file, so a fresh clone sends every API request to a third-party-controlled origin. The same tree loads two remote scripts with no SRI, one pinned to `@latest`.

- **Coverage is inverted relative to risk.** The root platform has six test suites and 168-module graph checking; `document-portal/` (41 files, 5 pages, a service worker, a client-side auth gate, 3 live credentials) and `newack/` (1 live credential) have **zero behavioural coverage** — their only appearances in the test surface are two credential-suppression entries and one read of a source file as text.

### Risk by area

Ratings are the maximum severity of **confirmed** findings in that area. `INDETERMINATE` items never drive a rating.

| Area | Risk | Confidence | One-line basis |
|---|---|---|---|
| **`proxy/`** | **Low** | `CONFIRMED-PRESENT` | Implementation is correct and well tested; its risk is that it is unused, which is charged to the trees that bypass it |
| **Root platform** | **Medium** | `CONFIRMED-PRESENT` | Real client-side guards over an untrusted input, one latent unsandboxed iframe, no CSP; no external origins at all |
| **`ECM_ActivityHub_Portal/`** | **High** | `CONFIRMED-PRESENT` | Default backend is a personal third-party origin; two remote scripts without SRI, one mutable |
| **`document-portal/`** | **High** | `CONFIRMED-PRESENT` | 3 live-shaped credentials + 3 plaintext passwords, no proxy path, no test coverage, service worker persists credentials |
| **`newack/`** | **High** | `CONFIRMED-PRESENT` | Orphaned tree holding a live-shaped credential, referenced only by a suppression list |
| **Cross-platform** | **High** | `CONFIRMED-PRESENT` | 31 signatures to rotate; whole repository served verbatim; secret scanner blind to binaries |

**No Critical findings.** §2.3 places a committed live credential at **High**; escalation to Critical requires public reachability, which is `INDETERMINATE` (`Q-02`, `Q-11`, `Q-12`). If any of those resolve unfavourably, `F-001`, `F-018` and `F-023` become Critical.

---

## 2. Corrections to my own earlier phases

Recorded prominently because §0.1 makes an unverified claim a failure, and three of mine did not survive.

| # | Phase | Claim made | Reality | How it was caught |
|---|---|---|---|---|
| 1 | Phase 0 | *"All 22 require rotation"* | **31.** The ratchet skips binaries, so the archive was never scanned; I inherited the tool's blind spot | Phase 3, opening the archive under §4's escalation clause |
| 2 | Phase 2 §5 | *"No third-party script or stylesheet origin"* and *"SRI has no practical gap"* | **False.** I enumerated `http://` and never ran `https://`. `ECM_ActivityHub_Portal/index.html` loads `cdn.tailwindcss.com` and `unpkg.com/lucide@latest` | Phase 4, while testing a README claim for `DOC-DRIFT` |
| 3 | Pre-brief | Audit prose quoted three live SAS signatures verbatim | Contained in `dd2e909`; `check-secrets.mjs` failed the build correctly | Phase 0 §5.2, running the repository's own tooling |

Correction 2 is the most serious: it produced a **false "verified clean"**, which is worse than an omission. It was caught only because a README claim I expected to be drift turned out to be accurate — the README describes those CDNs correctly, and the code, not the document, was what I had mischaracterised.

---

## 3. Findings ledger

### HIGH

---

**`F-001` · 31 distinct SAS signatures require rotation; 9 are invisible to every existing tool**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `CROSS`

*Evidence*
```
$ grep -rhoaE 'sig=[A-Za-z0-9_-]{20,}' <extracted ECM_DOCS_DEV.zip> | sort -u | wc -l   → 31
$ git rev-list --all | … git grep -hoE 'sig=…' | sort -u | wc -l                        → 22
$ comm -23 zip-sigs.txt git-sigs.txt | wc -l                                            → 9
```
`document-portal/js/data.js:25-27` (3), `newack/config.js:4` (1) at HEAD; 18 more in history; 9 only inside the archive, across 18 of its 837 files.

*Failure narrative* — If the signatures remain valid, any party holding one invokes the flow directly: no browser, no token, no proxy. 18 were deleted from the tree, which revoked nothing; all 22 remain reachable from `origin/main` history, and 9 more sit in a tracked binary.
*Impact* — Unauthenticated invocation of NITDA Power Automate workflows.
*Remediation* — Rotate all 31 in Power Automate before any file deletion.
*Verification* — Re-run the three commands above; the union must be empty of live values.

---

**`F-012` · The proxy is not in the request path; every browser control is bypassable**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `CROSS`

*Evidence* — `core/data-client.js:21-27`
```js
if(isAuthEnforced() && AuthConfig.proxyBaseUrl){ return `${…proxyBaseUrl…}/${encodeURIComponent(key)}`; }
return EndpointRegistry.url(key,{overrides:st.settings?.endpoints||{}});
```
`config/auth.config.js:76-77` — `isAuthEnforced()` returns `AuthConfig.enabled === true`; `:28` — `enabled: _pick('enabled', false)`. Same conditional at `ECM_ActivityHub_Portal/js/api/client.js:6-10`. Generated `config/config.local.js:30` emits `auth: { enabled: false }`.

*Failure narrative* — In the committed default, the route guard (`core/router.js:2`), ownership assertions (`core/action-authority.js:7-16`) and active-user checks all run in the browser while the request goes straight to a signed Power Automate URL. A caller who does not use the browser encounters none of them.
*Impact* — All RBAC is advisory; the implemented server-side enforcement protects nothing as configured.
*Remediation* — Set `auth.enabled` and `proxyBaseUrl` at deploy time and restrict the flows to the proxy's egress.
*Verification* — Assert that `resolveUrl()` returns a proxy URL for every contract key under deployment config.

---

**`F-013` · `document-portal/` and `newack/` have no proxy code path at all**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `DOCPORTAL`, `NEWACK`

*Evidence*
```
$ grep -rn "proxy" document-portal/js newack --include=*.js
(no output)
```
`document-portal/js/core.js:277-298` (`PF.flow`) posts directly to `PF.ENDPOINTS`; `newack/config.js:4` is consumed directly.

*Failure narrative* — Unlike `F-012`, this is not a configuration state. Activating auth cannot route these trees through the proxy because no code path exists to route.
*Impact* — The two trees holding live credentials are permanently outside enforcement.
*Remediation* — Add proxy-aware endpoint resolution to both, or retire them.
*Verification* — The negative search above must return a routing call site.

---

**`F-017` · The secret scanner skips binaries, so the archive has never been scanned**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `CROSS`

*Evidence* — `tests/check-secrets.mjs:50`
```js
if (buf.includes(0)) continue; // binary
```
`scripts/setup-local.mjs:52` — `execFileSync('unzip', ['-p', ARCHIVE, MANIFEST])` extracts working endpoints from that same archive.

*Failure narrative* — A new signature added inside the archive passes CI silently. This is the mechanism that hid 9 signatures from every audit, including Phase 0 of this one.
*Impact* — The repository's principal credential control has an unstated blind spot covering 87% of its bytes.
*Remediation* — Extend the scanner to archive members, or exclude the archive from the tree.
*Verification* — Add a known signature inside the archive; CI must fail.

---

**`F-018` · No build step and no exclusion list: `npm start` serves the whole repository**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `CROSS`

*Evidence* — `package.json` — `"start": "http-server . -p 8080 --cors -c-1 --silent"`; zero runtime dependencies; no `build` script.
```
$ ls vite.config* webpack.config* rollup.config* tsconfig.json Dockerfile*   → absent
$ ls .npmignore .serverignore .htaccess web.config staticwebapp.config.json → absent
```
*Failure narrative* — `/ECM_DOCS_DEV.zip` (31 signatures), `/document-portal/js/data.js`, `/newack/config.js`, `/config/`, `/.github/` and all 11 audit documents are directly fetchable from any host running the project's own start command.
*Impact* — Any exposure of the dev server exposes every credential in the repository.
*Remediation* — Define a deployment artefact and serve only it.
*Verification* — `curl -sI <host>/ECM_DOCS_DEV.zip` must not return 200.

---

**`F-023` · ECM Activity Hub defaults its backend to a personal Cloudflare Workers subdomain**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `ACTIVITYHUB`

*Evidence* — `ECM_ActivityHub_Portal/js/core/config.js:6-13`
```js
export const CONFIG = {
  APP_NAME: "NITDA DG/CEO Digital Operations Hub — Executive SPA",
  ENV: "PROD",
  …
  API_URL: _override.API_URL || "https://exec-hub-proxy.kanihamza.workers.dev",
```
The override arrives via `window.DGO_CONFIG` from `config.local.js`, which `.gitignore:9` excludes from the repository.

*Failure narrative* — On a fresh clone, or any deployment where `config.local.js` was not generated, every ActivityHub API request — carrying whatever correspondence payload the SPA builds — is sent to a subdomain under an individual's personal Cloudflare account, not a NITDA-controlled domain. `ENV` is declared `"PROD"`.
*Impact* — Default-path transmission of government correspondence data to a third-party-controlled origin.
*Remediation* — Replace the default with an empty string so the SPA falls back to its documented DEMO mode rather than a live third-party host.
*Verification* — Assert `CONFIG.API_URL === ''` when `window.DGO_CONFIG` is absent.

---

**`F-024` · Two remote scripts loaded with no SRI, one pinned to a mutable tag**
Severity **High** · Confidence `CONFIRMED-PRESENT` · Scope `ACTIVITYHUB`

*Evidence* — `ECM_ActivityHub_Portal/index.html:11,43`
```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
```
`integrity=` is `CONFIRMED-ABSENT` across all 200 tracked source files.

*Failure narrative* — `@latest` resolves to whatever the package currently publishes. Whoever controls the `lucide` package, or unpkg, executes arbitrary JavaScript in the ActivityHub origin, with access to its `localStorage` and session.
*Impact* — Third-party script execution in a government platform's origin.
*Remediation* — Pin exact versions with `integrity` hashes, or vendor both locally as the root platform already does.
*Verification* — Every remote `<script>` must carry `integrity` and a fixed version.

---

### MEDIUM

| ID | Title | Confidence | Scope | Evidence | Impact | Remediation |
|---|---|---|---|---|---|---|
| `F-002` | CI is green while 4 live-shaped credentials sit in tracked files | `CONFIRMED-PRESENT` | `CROSS` | `tests/check-secrets.mjs:5-16` rationale; exit 0 on baselined files | No forcing function on rotation | Time-box the baseline; fail after a deadline |
| `F-003` | Audit prose reproduced live credentials into a third file — **contained in `dd2e909`** | `CONFIRMED-PRESENT` | `CROSS` | Ratchet output at Phase 0 §5.2 | Repeat exposure of existing values | Never quote a credential to evidence it |
| `F-004` | Design system forked: 10 of 12 shared filenames diverged; no source of truth establishable | `CONFIRMED-PRESENT` | `CROSS` | Blob-hash table, Phase 0 §6.2; both trees single-import, no CSS edited since | Token changes must be made twice, undetected drift | Nominate one tree authoritative; add a drift check |
| `F-009` | `newack/` is orphaned — sole repository reference is a credential-suppression entry | `CONFIRMED-PRESENT` | `NEWACK` | `tests/secrets-baseline.txt:2`; negative search over all `.js`/`.html` | 791 unowned lines holding a live credential | Retire the tree or give it an owner and tests |
| `F-010` | `document-portal/` has deployment artefacts but no behavioural test or build reference | `CONFIRMED-PRESENT` | `DOCPORTAL` | `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`; zero test navigations | Deployed-shaped tree with no verification | Add the 5 pages to the smoke suite |
| `F-014` | `EmailPreviewFrame` renders `srcdoc` with no `sandbox` attribute (latent — zero callers) | `CONFIRMED-PRESENT` | `ROOT` | `shared/components.js:42`; exhaustive caller search returns only the definition | Any future caller passing email HTML gets same-origin script execution | Add `sandbox=""` or delete the export |
| `F-015` | No CSP, framing, or permissions policy in any entry point | `CONFIRMED-ABSENT` (repo) | `CROSS` | 4 documented negative searches, Phase 2 §5 | No defence in depth against injection or clickjacking | Adopt `default-src 'self'`; only one inline script exists |
| `F-019` | `.devcontainer` automates setup → serve → auto-forward → open browser | `CONFIRMED-PRESENT` | `CROSS` | `.devcontainer/devcontainer.json` `postCreateCommand`/`postAttachCommand`/`portsAttributes` | One click from clone to serving 31 credentials | Serve a restricted path; drop `openBrowser` |
| `F-020` | `sw.js` precaches `js/data.js` and `admin.html`; cache-first defeats rotation | `CONFIRMED-PRESENT` | `DOCPORTAL` | `document-portal/sw.js:5-19`, `:31-49` | Credentials persist in Cache Storage; rotation strands returning visitors on dead endpoints | Remove both from `SHELL`; bump `CACHE` when rotating |
| `F-021` | `document-portal/` and `newack/` have zero behavioural test coverage | `CONFIRMED-ABSENT` | `CROSS` | `smoke.spec.js` 7 navigations; `check-links.mjs:44-45`; `check-imports.mjs:28` | Highest-risk trees are least verified | Add page-load and escaping tests |

### LOW

| ID | Title | Confidence | Scope | Evidence |
|---|---|---|---|---|
| `F-005` | Portal dark/hc theme tokens 27% / 18% smaller than root's | `CONFIRMED-PRESENT` | `DOCPORTAL` | 4,237 vs 3,096 and 3,159 vs 2,575 bytes |
| `F-006` | `check-imports.mjs` cannot see `document-portal/` or `newack/` | `CONFIRMED-PRESENT` | `CROSS` | `tests/check-imports.mjs:28` |
| `F-007` | Five source files exceed 4,000 characters on a single line | `CONFIRMED-PRESENT` | `ROOT` | `modules/settings.js` 7,056; `diagnostics.js` 5,181; `registry.js` 4,995; `correspondence.js` 4,379; `core/welcome-experience.js` 4,337 |
| `F-011` | `reports` and `statistics` invoke the `EMAIL` write contract without `executeOwnedAction` | `CONFIRMED-PRESENT` | `ROOT` | Phase 1 §2 inventory. Downgraded: with the proxy out of path, the guard is a UX/audit control, not a boundary |
| `F-016` | `modules/lookup.js:26` grants `allow-same-origin` to an iframe rendering backend email HTML | `CONFIRMED-PRESENT` | `ROOT` | `sandbox="allow-same-origin"`; `allow-scripts` absent, so scripts cannot run |
| `F-022` | No deployment automation; artefact selection has never been made | `CONFIRMED-ABSENT` | `CROSS` | `.github/workflows/ci.yml` — 4 test jobs, `permissions: contents: read`, no deploy job |

### DOC-DRIFT

| ID | Document asserts | Code reality | Severity |
|---|---|---|---|
| `DOC-DRIFT-001` | `FORENSIC_ROOT_PLATFORM_AUDIT.md` discusses Content-Security-Policy and SRI as controls under review | Both `CONFIRMED-ABSENT`; the **only** occurrence of `Content-Security-Policy` in the repository is inside that document | **Low** |
| `DOC-DRIFT-002` | The same document's sink table lists `insertAdjacentHTML` and `document.write` | Both **0 occurrences** in code. The brief's own export counted this prose as source and pre-seeded the wrong baseline | **Low** |

**Tested and found NOT drift** — recorded to prevent a false finding: `README.md:217-219` states that fonts, Tailwind and Lucide load from external CDNs. **This is accurate** (`ECM_ActivityHub_Portal/index.html:7-11,43`). My Phase 2 statement to the contrary was the error, not the README.

---

## 4. Open Questions register

This register is the specification for the next engagement.

| # | Question | Why the repository cannot answer | What would answer it |
|---|---|---|---|
| `Q-01` | Are the 31 signatures still valid? | Validity is server-side state | Power Automate flow configuration |
| `Q-02` | Is the repository private? | No visibility artefact in-tree | GitHub repository settings |
| `Q-03` | Which design system is authoritative? | Both trees are single-import snapshots; the fork predates the repository | The upstream source both uploads came from |
| `Q-04` | Is `document-portal/` deployed? | No deployment automation exists | Hosting configuration |
| `Q-05` | Is `newack/` deployed despite being orphaned in-repo? | Same | Hosting configuration |
| `Q-06` | Does the `EMAIL` contract perform a privileged send? | Flow logic is not in the repository | Power Automate flow definition |
| `Q-07` | Is `proxy/` deployed, with `config/` on disk? | Topology invisible | Runtime host configuration |
| `Q-08` | Does deployed topology force traffic through the proxy? | No egress config in-repo | Azure network + trigger IP restrictions |
| `Q-09` | Are CSP/framing/referrer headers applied at deploy time? | Headers are a hosting concern | Live response headers |
| `Q-10` | Is `auth.enabled` overridden in the deployed config? | `config.local.js` is git-ignored | Deployed config / host environment |
| `Q-11` | Has any Codespace forwarded port been made public? | Account/instance state | Codespaces port settings |
| `Q-12` | Which trees are deployed, and to what host? | No deployment config exists | Hosting configuration |
| `Q-13` | Do the 9 archive-only signatures correspond to flows still in service? | Flow state is server-side | Power Automate environment |
| `Q-14` | **Who controls `exec-hub-proxy.kanihamza.workers.dev`, and what does it do with received payloads?** | Third-party host, outside the repository | The Cloudflare account owner; egress logs |

`Q-14` is new in Phase 4 and is the most urgent of the register.

---

## 5. Self-verification pass (§9.5)

```
$ grep -ohE '<path>:<line>' docs/forensic/dd2e909/0*.md | sort -u | wc -l   → 54 distinct citations
10% sample = 6, drawn with shuf
```

| # | Citation | Expected | Verified |
|---|---|---|---|
| 1 | `core/boot.js:19` | `loadRuntimeData` + `offline:true` | ✅ both present |
| 2 | `document-portal/sw.js:5-19` | precache incl. `js/data.js`, `admin.html` | ✅ both present |
| 3 | `proxy/src/server.js:52` | `new URL(req.url, 'http://x')` | ✅ exact |
| 4 | `tests/check-secrets.mjs:50` | `if (buf.includes(0)) continue; // binary` | ✅ exact |
| 5 | `core/data-client.js:21-27` | `resolveUrl` conditional | ✅ exact, range correct |
| 6 | `newack/config.js:4` | `API_GET` + `sig=` | ✅ both present |

**Sample size 6 of 54 (11.1%). Discrepancies: 0. Error rate 0%, below the 5% threshold — no full re-verification triggered.**

One **format** imprecision, not a content error: Phase 3 §1.5 cites `sw.js:5-19` in shorthand after establishing context, where §2.2 requires a repo-root-relative path. Content verified correct; the citation should read `document-portal/sw.js:5-19`.

---

## 6. Diagram 4

`diagrams/04-fork-comparison.mmd` — design-system fork and the ActivityHub services/pages pairing.

---

## 7. Limitations

**Method**
1. **Static analysis only.** No runtime execution beyond running the repository's own eight test suites. No token minted, no request sent, no credential exercised.
2. **No credential validity testing.** Establishing whether the 31 signatures still work would require invoking live government workflows — out of scope and inappropriate.
3. **No deployed instance observed.** Every statement about what ships describes what the repository's scripts would serve, not what any host serves.

**Coverage**
4. **`ECM_ActivityHub_Portal/` was assessed at its boundaries only** — entry HTML, `js/core/config.js`, `js/api/client.js`. Its two routers, 13 services and 19 pages were not read. Given `F-023` and `F-024` emerged from two files, **this tree is under-examined relative to its risk and should be the first target of any follow-on work.**
5. **`ecm-erp-charter` (288 lines, the largest root module) was inventoried, not read.**
6. **`newack/`'s 2 `innerHTML` sites were counted, not traced.**
7. **The archive was opened only to count signature strings** across 837 files; its contents were not read.
8. **The 104 `innerHTML` sites were assessed by input-origin tracing**, not documented individually, per §7.2's instruction not to pad the ledger.
9. **`scripts/check-links.mjs` was never executed** — it needs reachable external hosts. Its crawl roots were read from source instead.

**Reproducibility**
10. **The analysis SHA moved once**, from `d1f6640` to `dd2e909`, to contain the credential leak in `F-003`. All citations are against `dd2e909`.
11. **`config/config.local.js` exists in the analysis working tree** (git-ignored, generated). Tracked-content analysis is reproducible; runtime observations were made with endpoints configured, unlike a fresh clone.
12. **`npm run test:smoke` requires `DGO_CHROME_PATH`** in this environment. CI installs its own Chromium and is unaffected.

**Conclusions that would change**
13. If `Q-02`/`Q-11`/`Q-12` show public reachability → `F-001`, `F-018`, `F-023` become **Critical**.
14. If `Q-08` shows network-enforced egress → `F-012` drops to **Medium**.
15. If `Q-14` shows the Workers subdomain is NITDA-controlled and audited → `F-023` drops to **Low**.
16. If `Q-01`/`Q-13` show all 31 signatures are already rotated → `F-001` becomes hygiene, **Low**.

---

**Phase 4 complete. Engagement closed at `dd2e909`.**
