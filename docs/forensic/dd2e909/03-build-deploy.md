# Phase 3 — Build, Deployment, Test Reality

**SHA:** `dd2e909ed0e337f7fe36a5f65201abca9ec7f28e` · tree clean

---

## 0. Correction to Phase 0 — rotation scope is 31, not 22

Phase 0 concluded *"all 22 require rotation"*. **That was wrong, and it was wrong because I inherited the ratchet's own blind spot.**

`tests/check-secrets.mjs:50`:
```js
if (buf.includes(0)) continue; // binary
```

The scanner skips binary files. `ECM_DOCS_DEV.zip` is a tracked binary, so **its contents have never been scanned by anything.** §4 of the brief permitted opening it once Phase 0 showed it was referenced by a setup step — which it is (§1.3 below). Counting signatures inside it:

```
$ unzip -o -q ECM_DOCS_DEV.zip -d /tmp/zscan
$ find /tmp/zscan -type f | wc -l                                          → 837
$ grep -rhoaE 'sig=[A-Za-z0-9_-]{20,}' /tmp/zscan | sort -u | wc -l        → 31
$ grep -rlaE 'sig=[A-Za-z0-9_-]{20,}' /tmp/zscan | wc -l                   → 18
```

Set comparison against all git history:

| | Count |
|---|---:|
| Distinct signatures inside the archive | **31** |
| Distinct signatures across all git history (Phase 0) | 22 |
| Present in **both** | 22 |
| **Archive-only — absent from all text history, invisible to the ratchet** | **9** |
| History-only | 0 |
| **TRUE ROTATION SCOPE (union)** | **31** |

The 22 are a strict subset. **Nine additional live-shaped signatures exist only inside a 16.4 MB tracked binary that no tool in this repository has ever inspected**, across 18 files within the archive.

This supersedes Phase 0 §4.4. Finding `F-001` is restated in Phase 4 with the corrected figure.

---

## 1. What ships (§8.1)

### 1.1 There is no build step — `CONFIRMED-ABSENT`

```
$ ls vite.config* webpack.config* rollup.config* esbuild* tsconfig.json Dockerfile*
CONFIRMED-ABSENT: no bundler, no tsconfig, no Dockerfile
```

`package.json` declares **zero runtime dependencies** and four dev dependencies (`@playwright/test`, `http-server`, `linkinator`, `puppeteer-core`). No `build` script exists.

| Script | Command | Effect |
|---|---|---|
| `start` | `http-server . -p 8080 --cors -c-1 --silent` | **Serves the entire repository root** |
| `serve:portal` | `http-server ECM_ActivityHub_Portal -p 8080 …` | Serves that tree alone |
| `go` | `node scripts/setup-local.mjs && npm start` | Generate config, then serve everything |
| `setup` | `node scripts/setup-local.mjs` | Extract endpoints from the archive |
| `start:proxy` | `node proxy/src/server.js` | Server component, separate process |

**§8.1 asks whether any file is served from a path no build step produces. The question inverts here: there is no build step, no manifest, and no exclusion list, so *every tracked file is served verbatim*.**

```
$ ls .npmignore .serverignore .htaccess web.config staticwebapp.config.json
CONFIRMED-ABSENT: no exclusion config
```

`http-server .` therefore exposes, at minimum:

| Path | Consequence |
|---|---|
| `/ECM_DOCS_DEV.zip` | 16.4 MB archive containing **31 SAS signatures across 18 files** — downloadable |
| `/document-portal/js/data.js` | 3 live-shaped signatures + 3 plaintext staff passwords |
| `/newack/config.js` | 1 live-shaped signature |
| `/config/`, `/core/`, `/modules/` | All application source |
| `/.github/`, `/.gitignore` | CI configuration |
| 11 root `.md` files | Every audit document, including this one |

### 1.2 CI exists and does not deploy

**The brief's §8.1 instructed establishing whether CI genuinely does not exist. It does exist** — Phase 0 corrected this. Read in full:

`.github/workflows/ci.yml` — `permissions: contents: read`, four jobs:

| Job | Steps | Gating |
|---|---|---|
| `imports` | `check-imports`, `governance`, `output-encoding`, `auth-posture`, `proxy` — 5 node suites | Blocks the rest via `needs:` |
| `smoke` | `npm ci`, `playwright install chromium`, `npm run test:smoke` | Blocking; uploads report on failure |
| `links` | `npm run test:links` | **`continue-on-error: true`** — informational only |
| `secrets` | `check-secrets.mjs` | Independent; ratchet semantics |

**There is no deploy job, no artefact upload other than a failure report, no environment, and no registry push.** `permissions: contents: read` means the workflow cannot write to the repository at all.

**Conclusion: nothing ships from this repository by automation.** Deployment is manual and undefined. Which trees are deployed, together or separately, is **`INDETERMINATE`** from repository contents.

### 1.3 The devcontainer automates the exposure

`.devcontainer/devcontainer.json`:
```json
"postCreateCommand": "npm install && npm run setup",
"postAttachCommand": "npm start",
"forwardPorts": [8080, 8081],
"portsAttributes": { "8080": { "label": "DGO Platform", "onAutoForward": "openBrowser" } }
```

Creating a Codespace therefore, without any further instruction:

1. runs `npm run setup`, which **extracts live endpoint URLs from the archive** (`scripts/setup-local.mjs:52`: `execFileSync('unzip', ['-p', ARCHIVE, MANIFEST])`) and writes them to `config/config.local.js`;
2. runs `npm start`, serving **the whole repository** on port 8080;
3. auto-forwards 8080 and **opens a browser**.

Codespaces forwarded ports default to private. **Whether any instance has been made public is `INDETERMINATE`** → `Q-11`. The finding is that the repository ships a one-click path from clone to serving 31 credentials over HTTP, with no step that warns or excludes.

### 1.4 The archive is a setup input, a credential store, and ratchet-invisible

Three properties that are individually defensible and jointly not:

| Property | Evidence |
|---|---|
| It is **read by setup** | `scripts/setup-local.mjs:26-27,51-52` — extracts `DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json` |
| It **contains credentials** | 31 distinct signatures across 18 of its 837 files; the single manifest above holds 7 |
| It is **invisible to the ratchet** | `tests/check-secrets.mjs:50` skips any file containing a NUL byte |
| It is **web-served** | `http-server .` with no exclusion list |

A new signature added to the archive would pass CI silently. The file name of the manifest — `…_UNREDACTED-1.json` — states its own nature.

### 1.5 Service worker (carried from Phase 2 §7.3)

`document-portal/sw.js` — **the fetch logic is correctly written**:
```js
if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
```
Same-origin GET only, so the classic cross-origin cache-poisoning vector does not apply. No `importScripts`, no dynamic code. Navigations are network-first with cache fallback; assets are cache-first.

**The defect is the precache manifest, not the strategy.** `sw.js:5-19` precaches `'./js/data.js'` — the file holding the three signatures and three plaintext passwords — and `'./admin.html'`, the console `robots.txt` disallows. Consequences:

- Credentials are written durably into Cache Storage and survive the tab closing.
- The operations console is available **offline**.
- Because assets are **cache-first**, rotating the signatures will not reach returning visitors until the `CACHE` constant (`'nitda-portal-v2'`) is bumped. **Rotation alone will leave returning users pinned to dead endpoints** — an operational trap for the remediation itself.

---

## 2. Test reality (§8.2)

Coverage roots, verified:

```
$ grep -noE "page\.goto\('[^']*'" tests/smoke.spec.js
6 × '/index.html…'   1 × '/ECM_ActivityHub_Portal/index.html'

$ grep -nE "http://localhost" scripts/check-links.mjs
44: `…/index.html`   45: `…/ECM_ActivityHub_Portal/index.html`

tests/check-imports.mjs:28  HTML_ENTRIES = ['index.html', 'ECM_ActivityHub_Portal/index.html']
playwright.config.js:9      testMatch: '**/*.spec.js'   (narrowed deliberately — comment at :5)
```

| Area | Test files | What they actually assert | Untested critical path | Risk |
|---|---|---|---|---|
| **Root platform** | `check-imports`, `governance` (63), `output-encoding` (17), `auth-posture` (21), `smoke` (6 tests), `check-links` | Module graph resolves; ownership/RBAC/idempotency/audit contracts; escaping at 4 markup boundaries; both auth postures; boot, a11y entry points, 25 routes mount, theme repaint, welcome tokens | **Nothing asserts the proxy is in the request path.** No rendered-appearance coverage. No test drives a denial path at runtime | **Medium** |
| **`proxy/`** | `proxy/test/proxy.test.mjs` (66) | Token forgery cases, role derivation, per-action authz, identity stripping, idempotency, audit — real RSA signing at run time | **Tested in isolation.** No test asserts any client reaches it. This is precisely the `F-012` blind spot | **High** |
| **`ECM_ActivityHub_Portal/`** | `check-imports` (3rd entry point), `auth-posture`, `smoke` (1 test), `check-links` | Module graph resolves; auth postures; page loads without same-origin failures | Its two routers, 13 services, 19 pages; its 1 `innerHTML` site; its API client's non-proxy path | **Medium** |
| **`document-portal/`** | **none** | `output-encoding.test.mjs:92-93` reads `js/core.js` **as text** to assert `PF.esc`'s character set. `secrets-baseline.txt:1` suppresses it | **Everything.** 41 files, 6,961 lines, 5 HTML pages, 58 `innerHTML` sites, a service worker, a client-side auth gate, 3 live credentials — no page is ever loaded | **High** |
| **`newack/`** | **none** | `secrets-baseline.txt:2` — a suppression entry, not a test | **Everything.** 791 lines, 3 HTML pages, 2 `innerHTML` sites, 1 live credential | **High** |
| **Secret scanning** | `check-secrets.mjs` | Fails on a signature in a non-baselined **text** file; fails if the baseline goes stale | **Binary files entirely** — the archive's 31 signatures, 9 of them found nowhere else | **High** |

### 2.1 Scope narrowing — three instances, all real

§8.2 asked for suppressions that make a passing test misleading. Three found:

1. **`secrets-baseline.txt`** — two files suppressed by design, with a written rationale (Phase 0 §4.2). CI is green while 4 live-shaped credentials sit in tracked files.
2. **`check-secrets.mjs:50` binary skip** — undocumented as a limitation. It is what hid 9 signatures from every audit, including Phase 0 of this one.
3. **`check-imports.mjs:28`** — two HTML entry points, so `document-portal/` and `newack/` are structurally invisible. Defensible (they use classic scripts, not modules) but nothing else covers them either.

`playwright.config.js:9`'s `testMatch: '**/*.spec.js'` is a **correct** narrowing, not a suppression — the comment at line 5 explains it prevents Playwright globbing `*.test.mjs` files that call `process.exit()`. Recorded so it is not miscounted as a fourth.

### 2.2 Environment fragility

`npm run test:smoke` fails in this environment out of the box — Playwright seeks `chromium_headless_shell-1234`, absent from `/opt/pw-browsers`. It passes with `DGO_CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. CI installs its own Chromium (`npx playwright install --with-deps chromium`) so CI is unaffected. **Local developers can silently skip the only browser coverage.**

---

## 3. Diagram 3

See `diagrams/03-build-deploy.mmd`.

---

## 4. Phase 3 findings (provisional)

| ID | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| `F-001` *(restated)* | **31** distinct SAS signatures require rotation — 22 in history plus **9 found only inside the ratchet-invisible archive** | **High** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-017` | `check-secrets.mjs` skips binaries, so the 16.4 MB archive has never been scanned by any tool | **High** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-018` | No build step and no exclusion list: `npm start` serves the whole repository, including the archive and both credential files | **High** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-019` | `.devcontainer` automates setup→serve with port auto-forward and `openBrowser` | **Medium** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-020` | `sw.js` precaches `js/data.js` (credentials) and `admin.html`; cache-first means rotation will not reach returning visitors until `CACHE` is bumped | **Medium** | `CONFIRMED-PRESENT` | `DOCPORTAL` |
| `F-021` | `document-portal/` and `newack/` have zero behavioural test coverage of any kind | **Medium** | `CONFIRMED-ABSENT` | `CROSS` |
| `F-022` | No deployment automation exists; artefact selection has never been made | **Low** | `CONFIRMED-ABSENT` | `CROSS` |

**Verified clean:** `sw.js` fetch logic is correctly origin-scoped; CI has `contents: read` only and cannot write; `playwright.config.js` narrowing is correct and documented; `proxy/` runs as a separate process with its own entry point.

---

## 5. Open Questions added in Phase 3

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| `Q-11` | Has any Codespace forwarded port been made public? | Port visibility is account/instance state | GitHub Codespaces port settings |
| `Q-12` | Which trees are actually deployed, and to what host? | No deployment automation or config exists | Hosting configuration |
| `Q-13` | Do the 9 archive-only signatures correspond to flows still in service? | Flow state is server-side | Power Automate environment |

---

## 6. Phase 3 limitations

1. **The archive was opened only to count signature strings** — 837 files were extracted and pattern-matched, not read. Its contents remain out of scope per §4 beyond the escalation that justified the count.
2. **`scripts/check-links.mjs` was still not executed** — it requires reachable external hosts. Its crawl roots were read from source instead, which answers the coverage question without the network dependency.
3. **No deployment was observed.** Every statement about what ships describes what the repository's own scripts would serve, not what any host currently serves.
4. **Codespace port visibility was not inspected** — it is account state, not repository state.
5. **The 9 archive-only signatures were counted, not attributed** — which of the 18 archive files hold them, and whether they duplicate the pilot endpoints, was not determined.

---

**Gate: Phase 3 complete. Awaiting acceptance before Phase 4 synthesis.**
