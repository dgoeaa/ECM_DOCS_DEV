# Phase 0 — Provenance, Inventory, Triage (brief v3.1)

**Repository:** `dgoeaa/ECM_DOCS_DEV`
**Branch:** `claude/platform-architecture-security-4iwgff`
**Audit target:** `18e9f4da4ff5e110643a7ea88fc3b306a71fa679`
**Phase 0 executed:** 2026-08-02

> This supersedes `docs/forensic/177d992/`, which was produced against brief v3. v3.1's
> anchors match `18e9f4d`, so the target moved. The `177d992/` directory is retained as a
> labelled appendix; where its conclusions still hold at this target they are re-verified
> here rather than carried across.

---

## 0.1 Target selection — v3.1 re-points the audit

Brief v3 was ambiguous about which commit its export described. v3.1 is not: its anchors match
`18e9f4d` exactly and match no other commit.

| v3.1 anchor | Value at `18e9f4d` | Value at `177d992` |
|---|---|---|
| `tests/secrets-baseline.txt` entries | `ECM_DOCS_DEV.zip`, `newack/config.js` ✅ | `document-portal/js/data.js`, `newack/config.js` ✗ |
| `document-portal/js/data.js` reads `window.PF_CONFIG` | yes ✅ | no ✗ |
| `check-secrets.mjs` scans ZIP members | yes ✅ | no ✗ |
| `document-portal/` file count | 42 ✅ | 41 ✗ |
| Per-tree counts (13 trees) | exact match ✅ | 2 mismatches ✗ |

```
$ git ls-tree -r --name-only 18e9f4d | awk -F/ '{print (NF>1?$1:"(root files)")}' | sort | uniq -c | sort -rn
     57 core            53 ECM_ActivityHub_Portal    42 document-portal    31 config
     25 modules         18 styles                    16 (root files)        8 shared
      7 tests            7 proxy                      6 universal_filename_policy_deliverables
      5 newack           2 scripts                    1 assets
      1 .github          1 .devcontainer
```

Every count in v3.1 §1 matches. The audit target is therefore `18e9f4d`.

### Why the SHA is `18e9f4d` and not branch HEAD

Branch HEAD has advanced past `18e9f4d` with this audit's own report commits. Those are
documentation-only:

```
$ git diff --name-only 18e9f4d HEAD | grep -v '^docs/forensic/'
  (no output — source tree at HEAD is identical to 18e9f4d)
```

`18e9f4d` is the last commit that changed source. Pinning there keeps the SHA stable while
this report is written into the same branch.

### Working tree

```
$ git status --porcelain
  (no output — clean)
$ git log -1 --format='%H%n%cI%n%an%n%s' 18e9f4d
18e9f4da4ff5e110643a7ea88fc3b306a71fa679
2026-08-02T05:16:15+00:00
Claude
Remove portal credentials, guard URL sinks, close the styling and a11y gaps
```

---

## 0.2 DECLARED CONFLICT — the audit target is the auditor's own commit

`18e9f4d` was authored by this agent earlier in this session. It changed 40 files
(855 insertions, 95 deletions), including the files v3.1 treats as primary evidence:
`document-portal/js/data.js`, `tests/check-secrets.mjs`, `tests/secrets-baseline.txt`,
`document-portal/*.html`, `index.html`, `core/ui.js`.

v3.1 was issued with these changes already reflected in its export, so the target selection is
the engagement owner's, not a drift. But the consequence stands and is stated once here rather
than repeated per finding:

**Findings about the following are self-assessment, not independent assurance:**
ZIP member scanning in `check-secrets.mjs`; the absence of signatures in
`document-portal/js/data.js`; CSP presence in any HTML; `safeUrl()` URL-sink guarding;
`th[scope]` coverage; the portal smoke tests.

Where such a control is assessed below, it is marked `[SELF-ASSESSED]` and an independent
re-derivation command is given. Findings about `newack/`, `ECM_ActivityHub_Portal/`, `proxy/`,
`config/`, and the ZIP contents are unaffected — that code was not touched.

---

## 0.3 v3.1 §1 claims that do not hold

v3.1 §1 instructs verification against the live branch. Three claims fail.

| v3.1 claim | Verified reality | Confidence |
|---|---|---|
| `precision_auditor_v3.py` is a root file and expected tooling (§1, §5.2) | **Never existed.** Not at `18e9f4d`, not in any of 33 commits, on any ref | `CONFIRMED-ABSENT` |
| `.github/` does not appear; `CONTRIBUTING.md`'s CI claim is a DOC-DRIFT lead (§1, §8.1) | **`.github/workflows/ci.yml` exists** and has since `ef0e390`. CI is real. The DOC-DRIFT lead is a false lead — the export filtered dot-directories | `CONFIRMED-PRESENT` |
| `.gitignore` does not appear as a file record (§1) | **Present** at repository root | `CONFIRMED-PRESENT` |
| `tools/` does not appear | Correct — absent | `CONFIRMED-ABSENT` |

```
$ git log --all --oneline -- precision_auditor_v3.py | wc -l
0
$ git ls-tree --name-only 18e9f4d | head -3
.devcontainer
.github
.gitignore
```

**Reconciling the 278 figure.** 280 tracked files minus `.github/workflows/ci.yml` and
`.devcontainer/devcontainer.json` = 278, with `.gitignore` retained. The export filtered dot
**directories** but kept dot **files**. `.github/`'s apparent absence is an export artefact, and
the CONTRIBUTING.md contradiction v3.1 flags does not exist.

---

## 0.4 §5.3 Secret triage

### 1. `newack/config.js` — live-shaped signature, committed

`CONFIRMED-PRESENT`.

```
$ rg -n 'sig=[A-Za-z0-9_-]{20,}' newack/config.js
4:  API_GET: "https://defaultca6a4b3f912349bcbcb927085ebbf1.a1.environment.api.powerplatform.com:443/
powerautomate/automations/direct/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/triggers/manual/paths/
invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=DIStZ3aNpg87fB57xWi95xf6-10ON9xdKj8gtu6DXAU",
```

Not a placeholder. The repository's own convention is visibly different:

```
$ rg -n 'ROTATE_ME' config/config.example.js | head -2
29:    FETCH_ACTIVITIES:  ".../invoke?sig=ROTATE_ME",
30:    FETCH_ALL:         ".../invoke?sig=ROTATE_ME",
```

Concrete tenant GUID, concrete workflow GUID, 43-character signature — against `YOUR_ENV` /
`ROTATE_ME`. Current validity is `INDETERMINATE` (server-side state) → OQ-1. **Treat as live.**

### 2. `ECM_DOCS_DEV.zip` — scanned independently, per v3.1 §4

`CONFIRMED-PRESENT`. Scanned with a standalone Python reader, **not** with the repository's own
scanner, precisely because that scanner is this agent's work:

```
$ python3 -c "import zipfile,re; z=zipfile.ZipFile('ECM_DOCS_DEV.zip'); …"
members scanned       : 837
members with sig=     : 18
globally distinct sig : 31
files named UNREDACTED: 1
    DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json
```

Highest-density members:

| Distinct sigs | Member |
|---:|---|
| 15 | `DGO_Targets_Platform/ECM_ActivityHub_Portal/Folder 5/…R11_5_0…_state.forensic.json` |
| 15 | `…R11_4_0…_state.forensic.json` |
| 15 | `…R11_5_0…/config/endpoints.config.js` |
| 15 | `…R11_4_0…/config/endpoints.config.js` |
| 7 | `DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json` |
| 6 | `DGO_Targets_References/NITDA_DGCEO_DOCOPS_EXEC_UI_PROD_v13_…html` |
| 6 | `DGO_Targets_References/newack/unified-hub-ackflow.html` |
| 3 | `DGO_Targets_Platform/document-portal/js/data.js` |

The archive is 16.99 MB — 90% of repository bytes — and carries **31 distinct signatures plus
an explicitly "UNREDACTED" operations manifest**. Note the last row: the three signatures
removed from the working-tree `document-portal/js/data.js` are still present inside the archive.

### 3. Does `check-secrets.mjs` scan ZIP members? `[SELF-ASSESSED]`

Yes. `tests/check-secrets.mjs:47,73,101-102` implement central-directory walking and
`zlib.inflateRawSync`. Independent confirmation is the scan above, which reproduces the same
31/18 figures without using that code.

### 4. Does the baseline suppress, and is it a ratchet?

Both. `tests/check-secrets.mjs:163`
> `process.exit(added.length || cleared.length ? 1 : 0);`

It fails on a *new* signature outside the baseline and on a *stale* baseline entry, but not on
baselined exposure. Stated rationale, `tests/check-secrets.mjs:8-13`:
> ```
>  *   2. REPORT the baselined files … They cannot simply be scrubbed — deleting a file
>  *      revokes nothing. Each signature must be ROTATED in Power Automate first
> ```

**Answering v3.1 §5.3.5 directly: it is a ratchet that permits known exposed credentials to
persist indefinitely.** Nothing in the mechanism forces rotation or expires the baseline. A
green CI secret job is compatible with 32 live-shaped signatures.

### 5. `document-portal/js/data.js` — current state

`CONFIRMED-ABSENT` for signatures. v3.1's correction is right:

```
$ rg -n 'sig=[A-Za-z0-9_-]{20,}' document-portal/js/data.js
  (no output)
$ rg -n 'PF_CONFIG|PF.ENDPOINTS' document-portal/js/data.js
35:var PF_CFG = (window.PF_CONFIG || {});
38:PF.ENDPOINTS = {
```

Endpoints default to `''`. `[SELF-ASSESSED]` — this is the agent's own change. Risk for
`document-portal/` is now **conditional on deployed runtime config** (→ OQ-9), not on committed
source. The three historical signatures remain in history and in the ZIP.

### 6. History

```
$ git log --all -p -- newack/config.js | rg -o 'sig=[A-Za-z0-9_-]{20,}' | sort -u
sig=DIStZ3aNpg87fB57xWi95xf6-10ON9xdKj8gtu6DXAU

$ git log --all -p -- document-portal/js/data.js | rg -o 'sig=[A-Za-z0-9_-]{20,}' | sort -u
sig=FUeporOryvRDWA7z561j4LsLY4ey3YjUsgUCIqhEzyU
sig=Yef7pmj6yGBRszqaS9BT7gosu2gYlaheAfqhmSgAJuo
sig=jVUOseIHw17BG3tMiZfBMCEVSN1a65vOSLtsKURgr98
```

### 7. Chronology — baseline post-dates the credentials

```
$ git log --diff-filter=A --format='%h %cI %s' -- tests/secrets-baseline.txt
ef0e390 2026-08-01T17:05:26+00:00 Add a quality gate: import checker, smoke suite, secret ratchet and CI
$ git log --diff-filter=A --format='%h %cI %s' -- newack/config.js
31ca711 2026-08-01T05:47:47+01:00 Add files via upload
$ git log --diff-filter=A --format='%h %cI %s' -- document-portal/js/data.js
501bc42 2026-08-01T05:05:21+01:00 Add files via upload
```

Credentials landed ~12 h before the ratchet. The baseline suppresses pre-existing exposure; it
is not evidence of concealing a fresh leak.

**Rotation urgency, reported at the gate as v3.1 §5.3 requires:** 4 distinct signatures are
recoverable from history and 31 from the tracked archive. Severity **High** — `CONFIRMED-PRESENT`
committed signatures. Not Critical: no in-repo path to unauthenticated protected-data access is
evidenced, because what the flow triggers authorise is `INDETERMINATE` → OQ-1.

---

## 0.5 §5.2 Existing tooling

Six tools exist. `tests/output-encoding.test.mjs` and `precision_auditor_v3.py` do not
(§0.3), so v3.1's eight-tool list is six.

| Tool | Ran | Exit | Asserts | Deliberately not covered / narrowing |
|---|---|---|---|---|
| `tests/check-imports.mjs` | yes | 0 | Every relative import resolves; 2,085 edges, 168 modules | Not that a module *executes*; not bare/dynamic specifiers |
| `tests/check-secrets.mjs` | yes | **0** | Fails on new or stale baseline entries | **Passes while reporting 32 distinct signatures.** `[SELF-ASSESSED]` for ZIP support |
| `tests/governance.test.mjs` | yes | 0 | 86 assertions: RBAC shape, audit log, endpoint redaction, `th[scope]`, `safeUrl` | No runtime authorization behaviour |
| `tests/auth-posture.test.mjs` | yes | 0 | 21 assertions; enforced posture blocks anonymous calls and ignores local role tampering | In-process only. **Does not prove deployment activation** |
| `proxy/test/proxy.test.mjs` | yes | 0 | 66 assertions; signs real RSA tokens | **Does not prove the proxy is in the request path** |
| `tests/smoke.spec.js` | yes | 0 | 16 Playwright tests; boot, 25 routes, themes, portal pages | Renders only; no authorization enforcement |
| `scripts/check-links.mjs` | not run | — | Crawls live pages | CI marks it `continue-on-error: true` — non-gating |

**Scope-narrowing findings.** Three tests pass in ways that could mislead:
1. `check-secrets.mjs` — green with 32 signatures outstanding (§0.4.4).
2. `auth-posture.test.mjs` — proves the *enforced* posture is sound, while the shipped default
   is `enabled: false`. A reader could take the green tick as evidence enforcement is on.
3. `proxy.test.mjs` — proves handler logic, not topology. See Phase 1 §1.4.

---

## 0.6 §5.4 Inventory

| Tree | Files | Text lines | MB | Notes |
|---|---:|---:|---:|---|
| `core/` | 57 | 2,340 | 0.23 | |
| `ECM_ActivityHub_Portal/` | 53 | 2,839 | 0.13 | Own auth, API client, 2 routers |
| `document-portal/` | 42 | 7,216 | 0.73 | 6 binaries; forked DS; service worker |
| `config/` | 31 | 3,294 | 0.12 | 30 referenced, 1 orphan |
| `modules/` | 25 | 1,361 | 0.26 | |
| `styles/` | 18 | 3,690 | 0.20 | |
| root files | 16 | 4,008 | **16.99** | `ECM_DOCS_DEV.zip` dominates |
| `shared/` | 8 | 531 | 0.05 | |
| `proxy/` | 7 | 912 | 0.04 | Server-side |
| `tests/` | 7 | 1,067 | 0.05 | |
| `universal_filename_policy_deliverables/` | 6 | 259 | 0.06 | 3 PDF/DOCX committed |
| `newack/` | 5 | 796 | 0.03 | Orphan; holds a signature |
| `scripts/` | 2 | 222 | 0.01 | |
| `.github/` | 1 | 95 | 0.00 | **Exists** — contra v3.1 |
| `.devcontainer/` | 1 | 23 | 0.00 | |
| `assets/` | 1 | 0 | 0.00 | |
| **Total** | **280** | **28,653** | **18.91** | |

Flagged: `ECM_DOCS_DEV.zip` (committed archive, 90% of bytes, 31 signatures);
`universal_filename_policy_deliverables/` (3 committed PDF/DOCX); 9 root `.md` files, 8 of them
quarantined prose; `newack/` (undeclared workspace). No backup-suffixed files and no tracked
build output found.

---

## 0.7 §5.5 Duplicates and divergence

**Byte-identical across trees: exactly 2.**

```
document-portal/ds/tokens/tokens.component.css | styles/dgo-design-system/tokens/tokens.component.css
document-portal/ds/tokens/tokens.density.css   | styles/dgo-design-system/tokens/tokens.density.css
```

**Design system fork — 12 common files, 2 identical, 10 diverged.**

Root-only: `brand-type.css`, `platform-authority.css`, `tokens.enhanced.css`,
`tokens.legacy-bridge.css`. Portal-only: `ds.css`, `command-palette.css`, `sprite.svg`,
`CascadiaMono-Regular.woff2`, 3 NITDA logo PNGs.

**Direction of drift — `INDETERMINATE`, and for a specific reason:**

```
$ a=$(git log --diff-filter=A --format='%h' -- styles/dgo-design-system/components.css | tail -1)  # 5a0a93a
$ b=$(git log --diff-filter=A --format='%h' -- document-portal/ds/styles/components.css | tail -1) # 501bc42
$ git show $a:styles/dgo-design-system/components.css  | sha256sum  # 1b96d95a0ac6a1c4…
$ git show $b:document-portal/ds/styles/components.css | sha256sum  # f0c9e0e641e04fa7…
```

The two copies were **never identical inside this repository**. They differed at the moment each
was first added, in two separate "Add files via upload" commits 11 minutes apart. There is no
common ancestor here from which drift could be measured.

```txt
INDETERMINATE - no source-of-truth marker found; the fork predates this repository
```

→ OQ-2.

**ActivityHub service/page pairing** — partial, not systematic:

```
services (13): ai approvals bootstrap briefs correspondence decisions inbox kpi meetings minutes ops projects tasks
pages    (19): admin ai approvals audit briefs dashboard decisions directory inbox inward kpi
               meetings minutes notfound notifications outward projects reports tasks
paired      (10)   service-only (3): bootstrap correspondence ops
                   page-only    (9): admin audit dashboard directory inward notfound notifications outward reports
```

Two router files confirmed: `js/core/router.js` (61 lines), `js/views/router.js` (46 lines).
Whether this is layering or duplication is **deferred to Phase 1** — not asserted.

---

## 0.8 v3.1 §7.2 sink baseline — reproduced, one correction

Run against all tracked `.js`/`.mjs`/`.html` at `18e9f4d`:

| Pattern | v3.1 says | Measured | Verdict |
|---|---:|---:|---|
| `.innerHTML =` files | 39 | **39** | matches |
| `.innerHTML =` occurrences | 104 | **102** | **v3.1 is 2 high** |
| `insertAdjacentHTML` | 0 | 0 | matches |
| `document.write` | 0 | 0 | matches |
| `eval` / `new Function` / `.outerHTML =` | 0 | 0 | matches |

102 is stable across four regex variants and across all tracked text files, so the delta is in
v3.1's counting method, not in the pattern. The per-file concentration matches v3.1 exactly:

```
$ rg -c '\.innerHTML\s*=' document-portal/js/*.js
submit.js:14  support.js:13  core.js:10  admin.js:8  track.js:7  home.js:6      → 58 of 102
```

---

## 0.9 Phase 0 findings carried forward

| Ref | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| P0-A | Live-shaped SAS signature committed in `newack/config.js:4` | High | `CONFIRMED-PRESENT` | `NEWACK` |
| P0-B | `ECM_DOCS_DEV.zip` carries 31 distinct signatures + an UNREDACTED manifest | High | `CONFIRMED-PRESENT` | `CROSS` |
| P0-C | 4 distinct signatures recoverable from Git history | High | `CONFIRMED-PRESENT` | `CROSS` |
| P0-D | Secret ratchet permits baselined exposure indefinitely; exits 0 with 32 outstanding | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-E | Design system forked; 10/12 diverged; no source of truth | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-F | Auth-posture and proxy tests pass without proving deployment activation or topology | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-G | Committed PDF/DOCX deliverables in source | Low | `CONFIRMED-PRESENT` | `CROSS` |
| P0-H | `config/product-definition.config.json` orphaned | Low | `CONFIRMED-ABSENT` | `ROOT` |

### `DOC-DRIFT` candidates raised (to be confirmed in Phase 4, after quarantine lifts)

| Ref | Claim source | Contradiction |
|---|---|---|
| DD-1 | v3.1 §1/§8.1 — "CONTRIBUTING.md claims CI runs but `.github/` is absent" | `.github/workflows/ci.yml` **exists**; the lead itself is the drift |

---

## 0.10 Open Questions

| # | Question | Why the repo cannot answer | What would establish it |
|---|---|---|---|
| OQ-1 | Are the 4 history signatures and 31 archive signatures currently valid? | Server-side state | Power Automate trigger configuration |
| OQ-2 | Which design-system copy is authoritative? | Fork predates the repo; no common ancestor | Upstream design-system project |
| OQ-3 | Is `ECM_DOCS_DEV.zip` referenced by any build or deploy path? | No deploy step in-repo | Hosting/CD configuration → resolved in Phase 3 |
| OQ-9 | Does any deployed `document-portal/` supply `config.local.js` endpoints? | Git-ignored by design | Deployment configuration |

---

## 0.11 Self-verification (§9.5)

Six citations sampled from ~40 in this document (15%), each reopened and the stated command
re-run.

| # | Citation | Result |
|---|---|---|
| 1 | `newack/config.js:4` signature | Exact |
| 2 | `tests/check-secrets.mjs:163` exit logic | Exact |
| 3 | ZIP scan 31/18/837 | Reproduced by independent reader |
| 4 | `document-portal/js/data.js` zero signatures | Reproduced |
| 5 | DS fork 12/2/10 | Reproduced |
| 6 | `.innerHTML =` 39 files / 102 occurrences | Reproduced across 4 variants |

```txt
Sample size:      6 of ~40 (15%)
Discrepancies:    0
Discrepancy rate: 0%
Action taken:     none required
```

---

**Phase 0 complete. Gate: awaiting acceptance.**

Note on Phase 1: `docs/forensic/177d992/01-architecture.md` was produced against the previous
target. Its central conclusions were re-verified at `18e9f4d` during this phase and hold —
including the two-proxy topology, `newack/` orphan status, and the zero-hit negative searches —
but the document itself must be re-anchored before the Phase 1 gate is re-accepted.

---

## 0.12 ADDENDUM — §5.5 tables 2 and 3, completed repo-wide

Self-audit of this deliverable found §5.5 under-delivered: it requires **three** tables, and
§0.7 above scoped tables 2 and 3 to the design-system fork — the named lead — rather than the
whole repository. Completed here. Table 1 (byte-identical across trees, exactly 2) stands.

### Table 2 — same filename, divergent content, in more than one tree

**23 basenames**, `docs/forensic/**` excluded:

| Basename | Distinct versions | Trees |
|---|---:|---|
| `README.md` | 5 | root, ECM_ActivityHub_Portal, document-portal, proxy, tests |
| `index.html` | 4 | root, ECM_ActivityHub_Portal, document-portal, newack |
| `approvals.js` | 3 | ECM_ActivityHub_Portal (services + views/pages), modules |
| `config.example.js` | 3 | ECM_ActivityHub_Portal, config, document-portal |
| `config.js` | 3 | ECM_ActivityHub_Portal, newack, proxy |
| `router.js` | 3 | ECM_ActivityHub_Portal (core + views), core |
| `admin.js` | 2 | ECM_ActivityHub_Portal, document-portal |
| `archive.js` | 2 | core, modules |
| `auth.js` | 2 | ECM_ActivityHub_Portal, core |
| `correspondence.js` | 2 | ECM_ActivityHub_Portal, modules |
| `home.js` | 2 | document-portal, modules |
| `reports.js` | 2 | ECM_ActivityHub_Portal, modules |
| `ui.js` | 2 | ECM_ActivityHub_Portal, core |
| `base.css`, `colors_and_type.css`, `components.css`, `layout.css`, `reset.css`, `tokens.primitive.css`, `tokens.semantic.css`, `tokens.theme-dark.css`, `tokens.theme-hc.css`, `tokens.theme-light.css` | 2 each | document-portal, styles |

The ten CSS rows are the design-system fork already analysed in §0.7. The **thirteen JS/HTML
rows are new** and were not visible in the DS-scoped view.

`auth.js`, `router.js` and `ui.js` each exist in both `core/` and
`ECM_ActivityHub_Portal/js/core/` with divergent content. Phase 1 §1.4 established the two
trees share no runtime code, so these are parallel implementations of the same concern, not a
shared module — which is precisely how the guard asymmetry in Phase 1 §1.2 (`core/router.js`
evaluates `canCurrentUserAccess` always; `ECM_ActivityHub_Portal/js/core/router.js:21` returns
`true` while inert) arose without any single change being visibly wrong.

`config.js` in three trees — `ECM_ActivityHub_Portal/js/core/`, `newack/`, `proxy/src/` — is
the same pattern for endpoint configuration, and is why the credential in `newack/config.js:4`
sits outside every mechanism that governs the other two.

### Table 3 — files whose basename is unique to one tree

| Tree | Files | Unique basename | Shares a basename |
|---|---:|---:|---:|
| `core/` | 57 | 53 | 4 |
| `ECM_ActivityHub_Portal/` | 53 | 40 | 13 |
| `document-portal/` | 42 | 25 | 17 |
| `config/` | 31 | 30 | 1 |
| `modules/` | 25 | 20 | 5 |
| `styles/` | 18 | 6 | 12 |
| root files | 16 | 14 | 2 |
| `shared/` | 8 | 8 | 0 |
| `proxy/` | 7 | 5 | 2 |
| `tests/` | 7 | 6 | 1 |
| `universal_filename_policy_deliverables/` | 6 | 6 | 0 |
| `newack/` | 5 | 3 | 2 |
| `scripts/` | 2 | 2 | 0 |
| `.github/`, `.devcontainer/`, `assets/` | 1 each | 1 each | 0 |
| **Total** | **280** | **221** | **59** |

`styles/` (12 of 18) and `document-portal/` (17 of 42) carry the highest proportion of
shared basenames — both driven by the design-system fork. `shared/`, despite its name, shares
**no** basename with any other tree.

**No new finding arises from this addendum.** It supplies the evidence base that F-018 (RBAC
model drift) and Phase 1 §1.2 (guard asymmetry) already describe, and reinforces F-002 —
`newack/config.js` is one of three same-named configuration modules and the only one outside
any governing mechanism.
