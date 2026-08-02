# Phase 3 — Build, Deployment and Test Reality

**Audit target:** `18e9f4da4ff5e110643a7ea88fc3b306a71fa679`

---

## 3.1 §8.1 What ships

### There is no build

`CONFIRMED-ABSENT`.

```
$ rg -n '"build"|webpack|rollup|vite|esbuild|parcel|tsc' package.json
  (no output)
```

`package.json` declares four `devDependencies` — `@playwright/test`, `http-server`,
`linkinator`, `puppeteer-core` — all test/dev tooling. No bundler, no transpiler, no `build`
script. The platform is genuinely zero-build: every file served is a file in the tree.

**Answering §8.1's last question directly: no file is served from a path that no build step
produces**, because there is no build step and no generated path. `CONFIRMED-ABSENT` for
tracked build output.

### What each script serves

| Script | Command | Serves |
|---|---|---|
| `start` | `http-server . -p 8080` | **The repository root** — therefore *every* tree at once, including `newack/`, `document-portal/`, `ECM_ActivityHub_Portal/`, `docs/`, and `ECM_DOCS_DEV.zip` |
| `serve:portal` | `http-server ECM_ActivityHub_Portal -p 8080` | ActivityHub alone |
| `start:proxy` | `node proxy/src/server.js` | The proxy, **separately and manually** |
| `go` | `setup-local.mjs && npm start` | Setup, then root |
| `setup` | `node scripts/setup-local.mjs` | Writes two `config.local.js` files — see §3.2 |

Two consequences worth recording:

1. **`npm start` serves the whole repository**, so in the local development posture
   `newack/` is reachable at `http://localhost:8080/newack/` — the only evidenced context in
   which that orphan tree is served at all. Whether any *hosted* environment does the same is
   `INDETERMINATE` → OQ-8/OQ-11.
2. **The proxy is never started by the app.** It has its own script and is absent from `go`.
   Nothing in the repository starts the platform and the proxy together. This corroborates
   Phase 2 §2.1 from the deployment side: the proxy is opt-in infrastructure, not a default.

### CI exists — v3.1's premise corrected

`.github/workflows/ci.yml`, 95 lines, four jobs:

| Job | Steps | Gating? |
|---|---|---|
| `imports` (Module graph) | `check-imports`, `governance.test`, `auth-posture.test`, `proxy.test` | **Gating** |
| `smoke` | `npm ci`, install Chromium, `test:smoke` | **Gating** (`needs: imports`) |
| `links` | `npm run test:links` | **Non-gating** — `continue-on-error: true` (line 75) |
| `secrets` | `check-secrets.mjs` | Nominally gating, but the script exits 0 on baselined exposure (Phase 0 §0.4.4) |

**`DOC-DRIFT` lead DD-1 is refuted.** v3.1 §1 and §8.1 direct me to resolve a contradiction
between `CONTRIBUTING.md`'s CI claim and an absent `.github/`. The directory exists and has
since commit `ef0e390`; the export filtered dot-directories. There is no contradiction. Per
§0.2 the actual text of `CONTRIBUTING.md` is not opened until Phase 4, but the code-side half
of the alleged drift is settled: **CI is real and runs four jobs.**

Two of the four jobs are weaker than they appear: `links` cannot fail the build at all, and
`secrets` cannot fail on the 32 known signatures.

### `.gitignore`

Present. Correctly excludes all four `config.local.js` paths, `node_modules/`, Playwright
output and `*.state.json`. **It does not exclude `ECM_DOCS_DEV.zip`** — see §3.2.

---

## 3.2 ESCALATION — the archive is an active credential-distribution path

v3.1 §4 rules the archive inventory-only "unless Phase 0 shows a build or deploy path
references it, in which case escalate." **A script path references it.** Escalating.

```
$ rg -n 'ECM_DOCS_DEV\.zip' scripts/
scripts/setup-local.mjs:8:  * inside ECM_DOCS_DEV.zip and writes the two git-ignored config.local.js files the
scripts/setup-local.mjs:26: const ARCHIVE = path.join(ROOT, 'ECM_DOCS_DEV.zip');
```

`scripts/setup-local.mjs:26-27`
> ```js
> const ARCHIVE = path.join(ROOT, 'ECM_DOCS_DEV.zip');
> const MANIFEST = 'DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json';
> ```

`:50-54`
> ```js
> function readManifest() {
>   if (!fs.existsSync(ARCHIVE)) throw new Error(`Archive not found: ${ARCHIVE}`);
>   const raw = execFileSync('unzip', ['-p', ARCHIVE, MANIFEST], { maxBuffer: 64 * 1024 * 1024 });
>   return JSON.parse(raw.toString('utf8'));
> }
> ```

That member is **exactly the file my independent Phase 0 scan flagged** as carrying 7 distinct
SAS signatures and being named `UNREDACTED`.

Inspecting the manifest (URLs deliberately not reproduced):

```
endpoint_registry entries       : 10
entries with configured full_url:  9
   E01  configured=True  has_sig=YES  Fetch_References_and_Lookups_Data
   E02  configured=True  has_sig=YES  Get Docs
   E03  configured=True  has_sig=YES  fetch tasks
   E04  configured=True  has_sig=YES  get emails
   E05  configured=True  has_sig=YES  Deployed Create task
   E06  configured=True  has_sig=YES  bulk Assign direct
   E07  configured=True  has_sig=YES  optimized bulk assign
   E08  configured=True  has_sig=YES  Flag Document Action
   E10  configured=True  has_sig=YES  Update Task
   E09  configured=False has_sig=no   Send Email (Not Configured)
```

`setup-local.mjs:40-48` maps seven of those ids onto **11 of the platform's 19 contract keys**:

```
  REFERENCE_DATA, GET_DOCS, FETCH_EMAIL_ATTACHMENTS, FETCH_ALL, FETCH_ACTIVITIES,
  EMAIL_RELATED_TASK, SINGLE_ASSIGNMENT, DYNAMIC_ACTIONS, SUBSIDIARY_ACTIONS,
  BULK_ASSIGNMENT_DIRECT, BULK_ASSIGNMENT
```

Including every write-side contract: single assignment, bulk assignment, and
`DYNAMIC_ACTIONS`/`SUBSIDIARY_ACTIONS`, which `config/endpoints.config.js:53-64` shows backing
dispatch, archive, status transition and audit logging.

### What this means

`npm run go` on a fresh clone extracts nine signed Power Automate URLs from a tracked archive
and writes them, working, into `config/config.local.js` and
`ECM_ActivityHub_Portal/config.local.js`. The `.gitignore` entry prevents the *output* from
being committed; it does nothing about the *input*, which is committed.

This reframes the archive finding. It is not a stale artefact that happens to contain secrets —
it is the **designed mechanism** by which a developer obtains working credentials, and it is
tracked in the repository. Anyone with read access to the repository has the credentials,
whether or not they run the script.

`setup-local.mjs:14-16` asserts:
> ```
>  * These are PILOT credentials for a development environment, recovered from this
>  * private repository's own archive. They are not production endpoints.
> ```

That claim is **`INDETERMINATE`** from repository contents and is not accepted here. The
manifest is titled `UNREDACTED`, several entries name deployed-sounding flows
("Deployed Create task", "optimized bulk assign"), and nothing in the repository distinguishes
a pilot Power Automate environment from a production one. → OQ-13.

Severity **High**: `CONFIRMED-PRESENT` committed credentials with a documented, scripted path
to use. Not Critical, because what the flows authorise remains `INDETERMINATE` (OQ-1).

---

## 3.3 §8.2 Test reality

Six suites. What each *actually* asserts, having opened it:

| Area | Test files | What they actually assert | Untested critical path | Risk |
|---|---|---|---|---|
| **Root platform** | `smoke.spec.js` (5 tests), `check-imports.mjs`, `governance.test.mjs` | Boots and sets `__DGO_BOOTED__`; all 25 routes mount without `Module failed`; light/dark/hc repaint; skip-link and `lang`; no same-origin 4xx/5xx; 2,085 imports resolve; 86 governance assertions | Any authorization *behaviour*; all data-dependent rendering (suite runs with an empty store); form submission; governed writes | Medium |
| **`document-portal/`** | `smoke.spec.js` (10 tests) `[SELF-ASSESSED]` | 6 pages boot clean; no asset serves a SAS signature; console ships no password and shows its notice; every page has CSP + referrer; a seeded record tracks end to end | Submission wizard; console triage/decision actions; `sw.js` behaviour; the S-1 sink class | Medium |
| **`ECM_ActivityHub_Portal/`** | `smoke.spec.js` (1 test), `auth-posture.test.mjs` (6 of 21), `check-imports.mjs`, `check-links.mjs` | Loads with no page error or same-origin 4xx/5xx; enforced posture drops client-asserted identity, refuses in-browser role switch, blocks unauthenticated calls, resists `Store` tampering | **Every route beyond `index.html`**; `canOpen()` permissive-by-default behaviour; the CDN dependencies; all 13 services and 19 pages | **High** |
| **`proxy/`** | `proxy/test/proxy.test.mjs` | 67 assertions — full JWT attack surface, role derivation, identity stripping, per-action authz, fail-closed, upstream forwarding | Whether the proxy is in the request path; multi-instance idempotency; `/healthz`; nesting below `body.payload` | **High** |
| **`newack/`** | **none** | — | **Everything.** No test references it | **High** |
| **Secret scanning** | `check-secrets.mjs`, `secrets-baseline.txt` | Fails on a *new* signature or a *stale* baseline entry | Fails on nothing currently outstanding — exits 0 with 32 signatures | **High** |
| **Build / import graph** | `check-imports.mjs` | Relative specifiers resolve on disk from 2 HTML entry points | Bare/dynamic specifiers; that a module *executes* | Low |
| **Browser posture** | none | — | CSP/SRI/headers are asserted only for `document-portal` inside `smoke.spec.js` | Medium |

### Scope narrowing — four instances, beyond the one v3.1 names

v3.1 identifies `secrets-baseline.txt` as the proven suppression. Three more exist:

1. **`check-imports.mjs:28`** — `HTML_ENTRIES = ['index.html', 'ECM_ActivityHub_Portal/index.html']`.
   `document-portal/` and `newack/` are **not** entry points, so their module graphs are never
   validated. A broken reference in either would not be caught.
2. **`check-links.mjs:44-45`** — crawls the same two pages only. `document-portal/` and
   `newack/` links are never checked, *and* the job is `continue-on-error: true`.
3. **`smoke.spec.js`** — covers `/ECM_ActivityHub_Portal/index.html` and nothing deeper. The
   tree's 19 pages, 13 services and both routers are untested, including the
   permissive-by-default `canOpen()` (Phase 1 §1.2).

`newack/` is the intersection of every gap: no import check, no link check, no smoke test, no
escaping (Phase 2 §2.2), no CSP, and a committed credential — while being served by
`npm start`, which serves the repository root.

**A passing `npm test` therefore certifies:** the module graph of two trees resolves, the root
boots and routes, `document-portal` pages boot, the proxy handler is correct in isolation, and
no *new* secret was added. It does not certify that authorization is enforced anywhere, that
the proxy is used, that `newack/` works or is safe, or that any secret has been rotated.

---

## 3.4 Phase 3 findings carried forward

| Ref | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| P3-A | `ECM_DOCS_DEV.zip` is a scripted credential-distribution path: `npm run go` materialises 9 signed URLs across 11 of 19 contract keys | High | `CONFIRMED-PRESENT` | `CROSS` |
| P3-B | `newack/` has zero test coverage of any kind and is served by `npm start` | High | `CONFIRMED-ABSENT` | `NEWACK` |
| P3-C | `ECM_ActivityHub_Portal/` is tested only at `index.html`; 19 pages, 13 services and the permissive guard are untested | High | `CONFIRMED-PRESENT` | `ACTIVITYHUB` |
| P3-D | `check-imports` and `check-links` cover 2 of 4 trees; link job is non-gating | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P3-E | No test asserts authorization *behaviour* anywhere in the client trees | Medium | `CONFIRMED-ABSENT` | `CROSS` |
| P3-F | `npm start` serves the repository root, exposing `newack/` and the archive over HTTP locally | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P3-G | CI exists and is real; `links` non-gating, `secrets` cannot fail on known exposure | Low | `CONFIRMED-PRESENT` | `CROSS` |

**Refuted:** DD-1 (the `CONTRIBUTING.md` / absent-`.github` contradiction) — `.github/` exists.
No bundler, no build step, no tracked build output, no file served from an unproduced path.

## 3.5 Open Questions added

| # | Question | Why the repo cannot answer | What would establish it |
|---|---|---|---|
| OQ-13 | Are the 9 manifest endpoints pilot or production? | `setup-local.mjs` asserts pilot; nothing in the repo corroborates it | Power Automate environment inventory |
| OQ-14 | Is any tree deployed by a mechanism outside this repository? | No deploy step, no Pages workflow, no host config in-repo | Hosting/CD configuration |

---

## 3.6 Self-verification (§9.5)

Five of ~28 citations (18%) reopened and re-run. Line numbers re-derived at this target, not
carried from any earlier reading — the corrective action from Phase 2 §2.8.

| # | Citation | Result |
|---|---|---|
| 1 | `scripts/setup-local.mjs:26-27` | Exact |
| 2 | `scripts/setup-local.mjs:50-54` | Exact |
| 3 | `.github/workflows/ci.yml:75` `continue-on-error: true` | Exact |
| 4 | `tests/check-imports.mjs:28` `HTML_ENTRIES` | Exact |
| 5 | `scripts/check-links.mjs:44-45` | Exact |

```txt
Sample size:      5 of ~28 (18%)
Discrepancies:    0
Discrepancy rate: 0%
Action taken:     none required
```

---

**Phase 3 complete. Gate: awaiting acceptance.**
