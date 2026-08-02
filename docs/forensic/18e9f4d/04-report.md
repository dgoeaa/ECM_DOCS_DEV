# Phase 4 — Synthesis

**Repository:** `dgoeaa/ECM_DOCS_DEV` · branch `claude/platform-architecture-security-4iwgff`
**Audit target:** `18e9f4da4ff5e110643a7ea88fc3b306a71fa679` · 2026-08-02T05:16:15Z · working tree clean
**Brief:** v3.1

---

## 4.1 Executive summary

- **The repository distributes working credentials by design.** `npm run go` unzips a tracked
  16.99 MB archive, extracts a manifest titled `UNREDACTED`, and writes nine signed Power
  Automate URLs into local config — filling 11 of 19 contract keys including every write-side
  one. This is not a stale artefact; it is the documented onboarding path, and the input is
  committed.
- **Authorization is implemented well and is not in the request path.** `proxy/` verifies JWTs
  correctly against every classic attack and is covered by 67 assertions, but both clients
  select it only when `auth.enabled === true`, and the shipped default is `false`. Two trees
  have no proxy concept at all. Every RBAC control in every tree is currently `bypassable`.
- **`newack/` is the sharpest concentration of risk.** Five files, referenced by nothing except
  the line that suppresses it from the secret scan. It carries a committed SAS signature,
  renders API data into `innerHTML` with no escaping mechanism anywhere in the tree, has no
  CSP, has no test of any kind — and `npm start` serves it.
- **The test suite is green and certifies less than it appears to.** `check-imports` and
  `check-links` cover two of four trees; the smoke suite reaches ActivityHub's `index.html` and
  nothing deeper; the secret scan exits 0 while reporting 32 signatures. No test anywhere
  asserts authorization *behaviour*.
- **The repository's own documentation is unusually honest, and understates two numbers.**
  `README.md` and `STATUS_REPORT.md` correctly identify the credential problem and the
  advisory-only enforcement. They put the rotation backlog at 22 signatures where the archive
  alone holds 31, and rate that backlog **Low** on a "pilot-only, repository private" premise
  this audit cannot verify.

### Area risk

Ratings are the maximum severity of **confirmed** findings in that area. `INDETERMINATE` items
never drive a rating.

| Area | Risk | Confidence | One-line basis |
|---|---|---|---|
| Root platform | **Medium** | `CONFIRMED-PRESENT` | Uniform escaping (149 `esc()` calls), all 25 routes guarded; two unescaped backend-data sinks and silent degradation on missing config |
| `document-portal/` | **Medium** | `CONFIRMED-PRESENT` | CSP present, escaping present, 10 smoke tests; residual risk is conditional on deployed runtime config (OQ-9) |
| `ECM_ActivityHub_Portal/` | **High** | `CONFIRMED-PRESENT` | Route guard returns `true` unconditionally while auth is inert, opening `/admin`, `/audit`, `/directory`; unpinned CDN script, no CSP, tested only at `index.html` |
| `proxy/` | **Medium** | `CONFIRMED-PRESENT` | Implementation is sound; in-memory idempotency is unsafe under scaling and `/healthz` is unauthenticated |
| `newack/` | **High** | `CONFIRMED-PRESENT` | Committed SAS signature, unescaped API data into `innerHTML`, no CSP, no tests, orphaned yet served |
| Cross-cutting | **High** | `CONFIRMED-PRESENT` | Scripted credential distribution from a committed archive; proxy bypassable in every tree |

---

## 4.2 Findings ledger

Severity applied strictly per §2.3. Where a phase-level provisional rating differed, the
ledger rating governs and the change is noted.

### High

---
**F-001 · Committed archive is a scripted credential-distribution path**
`High` · `confirmed-present` · `CROSS`

**Evidence** — `scripts/setup-local.mjs:26-27`, `:50-54`, `:40-48`
> ```js
> const ARCHIVE = path.join(ROOT, 'ECM_DOCS_DEV.zip');
> const MANIFEST = 'DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json';
> …
> const raw = execFileSync('unzip', ['-p', ARCHIVE, MANIFEST], …);
> ```

Independent inspection: 10 registry entries, 9 with a configured signed URL, mapped onto 11 of
19 contract keys — `SINGLE_ASSIGNMENT`, `BULK_ASSIGNMENT`, `DYNAMIC_ACTIONS`,
`SUBSIDIARY_ACTIONS` among them.

**Failure narrative** — Anyone with repository read access obtains nine working signed flow
URLs, either by running `npm run go` or by opening the archive directly. `.gitignore` covers
the generated output and not the committed input.

**Impact** — Full unauthenticated invocation of the pilot governed-write flows by any party
with repository access.

**Remediation** — Rotate all nine in Power Automate, untrack the archive, and source setup
credentials from a secret store instead.

**Verification** — `rg -n 'ECM_DOCS_DEV\.zip' scripts/` returns nothing; `npm run setup` fails
closed with a clear message.

---
**F-002 · Live-shaped SAS signature committed in `newack/config.js`**
`High` · `confirmed-present` · `NEWACK`

**Evidence** — `newack/config.js:4` — a concrete tenant GUID, concrete workflow GUID and
43-character `sig=`, against the repository's own `ROTATE_ME` convention in
`config/config.example.js:29-45`.

**Impact** — Possession authorises invoking the acknowledgement flow.
**Remediation** — Rotate, then remove; move to runtime config.
**Verification** — `node tests/check-secrets.mjs` no longer lists the file, after rotation.

---
**F-003 · 31 distinct signatures and an UNREDACTED manifest inside the tracked archive**
`High` · `confirmed-present` · `CROSS`

**Evidence** — independent Python scan of `ECM_DOCS_DEV.zip`: 837 members, 18 carrying `sig=`,
**31 globally distinct signatures**, plus
`DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json`. Densest members
are two `*_state.forensic.json` files and two archived `config/endpoints.config.js` copies at
15 distinct each.

**Impact** — The archive is 90% of repository bytes and the single largest credential
concentration; it also re-exposes the three signatures removed from the working tree.
**Remediation** — Rotate all 31, then untrack the archive and retain it outside version control.
**Verification** — Independent archive scan returns zero.

---
**F-004 · Four distinct signatures recoverable from Git history**
`High` · `confirmed-present` · `CROSS`

**Evidence**
```
$ git log --all -p -- newack/config.js | rg -o 'sig=[A-Za-z0-9_-]{20,}' | sort -u   → 1
$ git log --all -p -- document-portal/js/data.js | rg -o 'sig=…' | sort -u          → 3
```
**Impact** — Removal from the working tree revokes nothing; history retains all four.
**Remediation** — Rotate first; history rewrite is optional and secondary.
**Verification** — Confirmed rotated in the Power Automate portal. Not verifiable in-repo.

---
**F-005 · Authorization proxy is not in the request path; every RBAC control is bypassable**
`High` · `confirmed-present` · `CROSS`

**Evidence** — `config/auth.config.js:28` and `ECM_ActivityHub_Portal/js/core/auth.js:25` both
`enabled: … false`; `core/data-client.js:21-27` and
`ECM_ActivityHub_Portal/js/api/client.js:5-11` both select the proxy only when
`isAuthEnforced() && AuthConfig.proxyBaseUrl`.
```
$ rg -n "proxyBaseUrl|authHeaders\(|ensureAuthenticated\(|isAuthEnforced\(" document-portal/js/ newack/
  ZERO HITS — CONFIRMED-ABSENT
```

**Failure narrative (conditional per §0.3)** — *If* a deployment leaves `auth.enabled` at its
default, then every route guard and action guard is a client-side affordance over a
`localStorage`-resident role, and the governed-write endpoints are reachable directly.

**Impact** — No enforced authorization boundary exists in the shipped default configuration.
**Remediation** — Supply `tenantId`, `clientId`, `proxyBaseUrl`; set `enabled: true`; deploy `proxy/`.
**Verification** — `authPosture().enforced === true` and traffic observed traversing the proxy.

---
**F-006 · ActivityHub route guard returns `true` unconditionally while auth is inert**
`High` · `confirmed-present` · `ACTIVITYHUB`

**Evidence** — `ECM_ActivityHub_Portal/js/core/router.js:18-24`
> ```js
>   if (!allowed) return true;                 // unrestricted route
>   if (!isAuthEnforced()) return true;        // inert: permissive, development unchanged
> ```
`ROUTE_ROLES` (`:12-16`) restricts `/admin`, `/audit`, `/directory` to
`SystemAdmin`/`DGCEO`/`COS`. Line 21 returns before those restrictions are consulted.

**Impact** — Three privileged executive routes open for any visitor in the default posture.
Classification: `none observed`, distinct from the root platform's `client-side check`.
**Remediation** — Evaluate `ROUTE_ROLES` in both postures; keep the server as the boundary.
**Verification** — A test asserting `canOpen('/admin') === false` for an unmapped role while inert.

---
**F-007 · `newack/` renders API data into `innerHTML` with no escaping mechanism**
`High` · `confirmed-present` · `NEWACK`

**Evidence** — `newack/index.html:122` fetches `window.NITDA_CONFIG.API_GET`; `:152-160`
> ```js
> row.innerHTML = `
>   <td>…${id}</td><td …>${title}</td>
>   <td><span class="badge …">${status}</span></td>
>   …<a href="email.html?taskId=${id}" …>
> ```
`rg 'escapeHtml|\besc\(|createTextNode|DOMPurify' newack/` → no escaper exists in the tree.
`title` and `status` reach element context; `id` reaches attribute context.

**Failure narrative (conditional)** — *If* the flow behind `API_GET` returns a `title`
containing markup — and the SAS signature required to write such a record is committed in the
same directory (F-002) — *then* that markup executes for anyone opening the page. Whether
`newack/` is served in any hosted environment is `INDETERMINATE` (OQ-11); `npm start` serves it
locally.

**Impact** — Script execution in the session of anyone viewing the acknowledgement dashboard.
**Remediation** — Escape at the sink or build rows with `textContent`; add a CSP.
**Verification** — A test rendering a record whose `title` is `<img src=x onerror=…>` and
asserting no execution.

### Medium

---
**F-008 · Unpinned third-party script with no SRI and no CSP in the executive portal**
`Medium` · `confirmed-present` · `ACTIVITYHUB`

**Evidence** — `ECM_ActivityHub_Portal/index.html:43`
> `<script src="https://unpkg.com/lucide@latest"></script>`
plus `:11` `cdn.tailwindcss.com`, `:9` Google Fonts. `rg 'integrity=' .` → **zero hits
repo-wide**. That page has no CSP (§4.3).

**Failure narrative (conditional)** — *If* unpkg or the `lucide` package is compromised, the
served script executes with full DOM access on a page that has no CSP and whose route guard is
permissive (F-006). Four mitigations are each absent.
**Impact** — Supply-chain arbitrary code execution in the DG/CEO portal session.
**Remediation** — Pin an exact version, add SRI, self-host, or add a CSP restricting `script-src`.
**Verification** — `rg 'unpkg|@latest' ECM_ActivityHub_Portal/index.html` returns nothing.
*Rubric note: Medium because the trigger is not evidenced in-repo; High under any supply-chain-weighted rubric.*

---
**F-009 · No Subresource Integrity anywhere in the repository**
`Medium` · `confirmed-absent` · `CROSS`
**Evidence** — `rg -n 'integrity=' .` → zero hits (excluding this report).
**Remediation** — Add SRI to every external subresource, or self-host.

---
**F-010 · `ECM_ActivityHub_Portal/` and `newack/` have no CSP or referrer policy**
`Medium` · `confirmed-absent` · `CROSS`
**Evidence** — per-file check: `index.html` and all six `document-portal/*.html` carry both;
`ECM_ActivityHub_Portal/index.html`, `newack/{index,ack,email}.html` carry neither.
**Remediation** — Extend the same meta CSP; add edge headers for `frame-ancestors`.

---
**F-011 · Proxy idempotency is in-memory and unsafe under horizontal scaling**
`Medium` · `confirmed-present` · `PROXY`
**Evidence** — `proxy/src/handler.js:26`
> `/** In-memory idempotency store. Swap for Redis or a table in a multi-instance deployment. */`
**Impact** — Duplicate governed writes when a retried key lands on a second instance.
**Remediation** — Back the store with Redis or a table before scaling out.

---
**F-012 · `modules/comments.js` renders a backend `referenceId` unescaped**
`Medium` · `confirmed-present` · `ROOT`
**Evidence** — `modules/comments.js:12` — `` `Scoped to ${ref}` `` where `ref = scopeRef(s)`
returns the record's `referenceId`. Every sibling interpolation in the file is escaped.
**Remediation** — Wrap in `esc()`.

---
**F-013 · Missing runtime config degrades silently and indistinguishably**
`Medium` · `confirmed-present` · `ROOT`
**Evidence** — `config/endpoints.config.js:19-22` resolves every URL to `''`;
`core/data-client.js` throws `Endpoint … is not configured`; `core/boot.js` catches it into
`state.runtime.lastLoad.offline` with a single `console.warn`.
**Impact** — A deployment that forgot its configuration renders identically to a working one.
**Remediation** — Surface an explicit banner when zero endpoints resolve.

---
**F-014 · `newack/` and `document-portal/` are outside the import and link checks**
`Medium` · `confirmed-present` · `CROSS`
**Evidence** — `tests/check-imports.mjs:28` `HTML_ENTRIES = ['index.html', 'ECM_ActivityHub_Portal/index.html']`;
`scripts/check-links.mjs:44-45` crawls the same two; `.github/workflows/ci.yml:75`
`continue-on-error: true`.
**Remediation** — Add the missing entry points; make the link job gating.

---
**F-015 · `ECM_ActivityHub_Portal/` is tested only at `index.html`**
`Medium` · `confirmed-present` · `ACTIVITYHUB`
*(Provisional High in Phase 3; Medium here — a coverage gap has no evidenced path to impact on
its own. It is the reason F-006 survived.)*
**Evidence** — `tests/smoke.spec.js` `page.goto` targets: root, three `document-portal` pages,
`/ECM_ActivityHub_Portal/index.html`. 19 pages, 13 services and both routers unexercised.
**Remediation** — Route-level smoke coverage plus a `canOpen()` unit test.

---
**F-016 · `newack/` has zero test coverage and is served by `npm start`**
`Medium` · `confirmed-absent` · `NEWACK`
**Evidence** — no test file references `newack` except `tests/secrets-baseline.txt`.
`package.json:15` `start` serves the repository root.
**Remediation** — Delete the tree, or bring it under test and into the import/link checks.

---
**F-017 · Secret ratchet permits known exposure indefinitely**
`Medium` · `confirmed-present` · `CROSS`
**Evidence** — `tests/check-secrets.mjs:163` `process.exit(added.length || cleared.length ? 1 : 0)`.
Current run reports 32 distinct signatures and exits 0.
**Impact** — A green CI secret job is compatible with unrotated credentials indefinitely.
**Remediation** — Add an expiry date per baseline entry that fails the build once passed.

### Low

---
**F-018 · RBAC route model and proxy action model have drifted (2 cases, both fail closed)**
`Low` · `confirmed-present` · `CROSS`
**Evidence** — `operator` may open `/dispatch` but is denied `DISPATCH_OUTBOUND`; `executive`
may open `/archive` but is denied `ARCHIVE_REFERENCE`. `proxy/src/authorize.js` imports
`Roles, Permissions` but not `RoleRouteAccess`/`canAccess()`.
**Impact** — UX defect: a permitted route refuses on submit. No security consequence — the
server is the stricter side in both cases.
**Remediation** — Derive one table from the other, or assert their consistency in `governance.test.mjs`.

---
**F-019 · Proxy `/healthz` is unauthenticated and discloses contract-key names**
`Low` · `confirmed-present` · `PROXY`
**Evidence** — `proxy/src/server.js:38-44` returns `unconfigured` endpoint **names**.
**Remediation** — Return a bare `{ok:true}` unauthenticated; gate detail behind auth.

---
**F-020 · `stripAssertedIdentity()` does not strip below `body.payload`, and it is untested**
`Low` · `confirmed-present` · `PROXY`
**Evidence** — `proxy/src/authorize.js:98-115` handles root and `payload` only. Mitigated by the
authoritative `_identity` injected at `handler.js:121-125`; whether flows honour it is OQ-10.
**Remediation** — Strip recursively; add a `payload.data.role` test case.

---
**F-021 · Unescaped values in `operator-hud.js` and `reports.js`**
`Low` · `confirmed-present` · `ROOT`
**Evidence** — `modules/operator-hud.js:11` `<b>${v}</b>` (backend count; key *is* escaped);
`modules/reports.js:34` `value="${filters.dgoStart}"` (attribute context).
**Remediation** — Wrap both in `esc()`.

---
**F-022 · Committed binary deliverables and an orphaned config**
`Low` · `confirmed-present` · `CROSS`
**Evidence** — `universal_filename_policy_deliverables/` holds 3 PDF/DOCX;
`config/product-definition.config.json` has zero importers.
**Remediation** — Move deliverables out of source control; delete or wire the orphan.

### DOC-DRIFT

---
**F-023 · Stated rotation backlog understates measured exposure**
`Medium` · `confirmed-present` · `CROSS`
**Evidence** — `README.md:15`
> "**22 distinct signatures were public before the structural cleanup.** … **All 22 must be rotated**"

Independent measurement: the tracked archive alone holds **31 globally distinct** signatures.
**Impact** — A rotation programme scoped to the documented figure leaves at least nine
signatures live.
**Remediation** — Re-derive the figure from `node tests/check-secrets.mjs` and restate it.

---
**F-024 · Credential exposure rated Low on an unverifiable premise**
`Medium` · `confirmed-present` · `CROSS`
**Evidence** — `STATUS_REPORT.md:90`
> `| 22 pilot signatures unrotated | **Low** | Pilot-only endpoints, repository private. Rotate at convenience. |`

Both premises are `INDETERMINATE` in-repo. `setup-local.mjs:14-16` asserts the same
"pilot, not production" claim; the manifest it reads is titled `UNREDACTED` and its entries
name flows such as "Deployed Create task" and "optimized bulk assign" (OQ-13). The rating also
omits that the credentials are actively distributed by `npm run go` (F-001).
**Impact** — The governing status document tells a reader this is a low-priority item.
**Remediation** — Re-rate against the evidence, or record the environment separation that
justifies "pilot-only".

---
**DD-1 · REFUTED — not a finding**
v3.1 §1/§8.1 direct resolution of an alleged contradiction between `CONTRIBUTING.md:57`
("`.github/workflows/ci.yml` runs automatically") and an absent `.github/`. **The directory
exists** and has since `ef0e390`. The claim is true; the export filtered dot-directories.

**Recorded as accurate, not drift:** `README.md:5` explicitly flags that the file previously
described a different repository and has been corrected; `README.md:227` correctly states there
is no Pages workflow; `README.md:68-74` correctly describes `setup-local.mjs` reading the
archive; `STATUS_REPORT.md:88` correctly rates absent server-side enforcement **High** — which
agrees with F-005.

---

## 4.3 Open Questions register

| # | Question | Why the repo cannot answer | What would establish it | Type |
|---|---|---|---|---|
| OQ-1 | Are the 31 archive and 4 history signatures currently valid? | Server-side state | Power Automate trigger configuration | Security |
| OQ-2 | Which design-system copy is authoritative? | Fork predates the repo; no common ancestor | Upstream design-system project | Architecture |
| OQ-3 | Is the archive referenced by a build/deploy path? | — | **RESOLVED in Phase 3: yes, `setup-local.mjs`** | Closed |
| OQ-6 | Is `auth.enabled` `true` in any deployed environment? | Injected via `window.DGO_CONFIG` at runtime | Deployed page source or host config | Security |
| OQ-7 | What does `exec-hub-proxy.kanihamza.workers.dev` do, and who controls it? | External service, no source in repo | Cloudflare account and Worker source | Security |
| OQ-8 | Are `document-portal/` and `newack/` deployed anywhere? | No deploy step in-repo | Hosting configuration | Deployment |
| OQ-9 | Does any deployed `document-portal/` supply `config.local.js` endpoints? | Git-ignored by design | Deployment configuration | Security |
| OQ-10 | Do the Power Automate flows read `_identity` and ignore client fields? | Flow definitions not in repo | Power Automate flow export | Security |
| OQ-11 | Is `newack/` served on any host? | No deploy step in-repo | Hosting configuration | Security |
| OQ-12 | Are CSP/HSTS/`X-Content-Type-Options`/`frame-ancestors` applied at the edge? | Static repo, no header config | Deployed response headers | Security |
| OQ-13 | Are the 9 manifest endpoints pilot or production? | `setup-local.mjs` asserts pilot; nothing corroborates | Power Automate environment inventory | Security |
| OQ-14 | Is any tree deployed by a mechanism outside this repository? | No deploy step, no Pages workflow, no host config | Hosting/CD configuration | Deployment |

**OQ-6, OQ-7, OQ-13 are the three that most change the report.** If auth is enforced in
production and traffic traverses the proxy, F-005 drops from High to informational. If the nine
manifest endpoints are genuinely an isolated pilot environment, F-001/F-003/F-023/F-024 drop
materially. Neither can be settled from repository contents.

---

## 4.4 Limitations

- **Auditor independence is compromised for part of the target.** `18e9f4d` was authored by
  this agent. Findings touching the ZIP scanner, `document-portal/js/data.js`, CSP presence,
  `safeUrl()` and the portal smoke tests are self-assessment. The archive was scanned with an
  independent Python reader for exactly this reason. `proxy/`, `newack/`,
  `ECM_ActivityHub_Portal/` and `config/` were untouched by that commit and are unaffected.
- **No endpoint was ever invoked.** No credential was used, no flow called. Every statement
  about what a Power Automate trigger authorises is `INDETERMINATE`.
- **The enforced auth posture was tested in-process, never deployed.** No live IdP, no tenant,
  no deployed proxy, no observed network path.
- **Runtime behaviour is largely unobserved.** This phase ran static analysis and targeted
  Node execution (`authorize()`, `safeUrl()`, the ZIP reader). The browser was not driven in
  this engagement; route-mount and theme claims rest on the repository's own smoke suite.
- **Excluded per §4:** `node_modules/`, lockfiles, minified assets, images, fonts, PDF/DOCX.
  The archive was scanned for secrets and its manifest read, per the §4 escalation; its
  application contents were not audited for behaviour.
- **Git history was read for structure and secrets, not exhaustively.** `git log -S` was run
  per-file for the two known credential files; a full historical sweep across all 33 commits
  and all paths was not performed, so 4 is a floor for history-resident signatures, not a total.
- **One browser engine, zero data.** No cross-browser testing. All prior route measurements ran
  against an empty store, so data-dependent rendering is unexercised.
- **Quarantined prose was read only in Phase 4** and only as claims. Any of the ~130 KB not
  matching the claim sweeps in §4.2 remains unassessed.

---

## 4.5 Self-verification (§9.5)

Cumulative across all phases. Citations were sampled per phase, reopened, and the stated
command re-run.

| Phase | Sample | Discrepancies | Rate |
|---|---|---|---|
| 0 | 6 of ~40 (15%) | 0 | 0% |
| 1 | 5 of ~34 (15%) | 0 | 0% |
| 2 | 6 of ~41 (15%) | **1** | **17%** |
| 3 | 5 of ~28 (18%) | 0 | 0% |
| 4 | 4 of ~30 (13%) | 0 | 0% |
| **Total** | **26 of ~173 (15%)** | **1** | **0.6%** |

```txt
Sample size:      26 of ~173 (15%)
Discrepancies:    1
Discrepancy rate: 0.6% — below the 5% threshold
Action taken:     The single failure was in Phase 2 — sw.js line numbers carried forward
                  from a reading taken at 177d992 and off by six after a comment block was
                  inserted. All sw.js citations were re-derived, all remaining Phase 2 line
                  references re-checked, and from Phase 3 onward every line number was
                  derived fresh at this target. The error and its cause are recorded in
                  02-security.md §2.8 rather than silently corrected.
```

Phase 4 sample: `README.md:15`, `STATUS_REPORT.md:90`, `CONTRIBUTING.md:57`,
`ECM_ActivityHub_Portal/js/core/router.js:18-24` — all reproduced exactly.

**One earlier claim withdrawn:** Phase 0 §0.8 stated v3.1's `.innerHTML =` count of 104 was two
high. It is correct — 104 occurrences on 102 lines. Corrected in 02-security.md §2.2.

---

**Phase 4 complete. Engagement closed.**
