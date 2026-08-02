# Phase 0 — Provenance, Inventory, Triage

**Engagement:** Forensic current-state audit v3
**Repository:** `dgoeaa/ECM_DOCS_DEV` · branch `claude/quirky-babbage-1nomt5`

---

## ⚠️ Report immediately — §5.3 authorises not waiting for the gate

**A live credential leak was introduced into this repository during the current session, by the audit document written before this brief was issued. It has been contained.**

`FORENSIC_ROOT_PLATFORM_AUDIT.md:172–174` reproduced three live Power Automate SAS signatures **verbatim** while documenting them as a finding. That copied the credentials into a third tracked file. `tests/check-secrets.mjs` detected it correctly and failed:

```
$ node tests/check-secrets.mjs
❌ NEW files carrying a Power Automate SAS signature:
   FORENSIC_ROOT_PLATFORM_AUDIT.md  (3 distinct)
EXIT=1
```

**Contained** in `dd2e909` by replacing each signature with `[REDACTED]`; the ratchet returns to exit 0. Workflow GUIDs were kept — they are identifiers, not secrets.

**Rotation scope is unchanged.** The three values were already present in `document-portal/js/data.js` since `501bc42`, so no new signature entered history. This is a repeat of an existing exposure, not an additional one.

This is recorded first because it is my own defect, it is exactly the failure mode §0.1 warns about, and an audit that conceals its own errors is worth nothing. It also produces the engagement's first hard result: **the secret ratchet works, and it caught the auditor.**

---

## 1. Provenance (§5.1)

```
$ git rev-parse HEAD
dd2e909ed0e337f7fe36a5f65201abca9ec7f28e

$ git log -1 --format='%H%n%cI%n%an%n%s'
dd2e909ed0e337f7fe36a5f65201abca9ec7f28e
2026-08-02T…
Claude
Redact live SAS signatures reproduced in the audit document

$ git status --porcelain
(empty — working tree clean)
```

| | |
|---|---|
| **Analysis SHA** | `dd2e909ed0e337f7fe36a5f65201abca9ec7f28e` |
| **Branch** | `claude/quirky-babbage-1nomt5` |
| **Working tree** | **Clean** — analysis is reproducible against the commit |
| **Tracked files** | **282** |

**SHA moved during Phase 0.** Analysis began at `d1f6640`. The containment fix above created `dd2e909`. Every citation in this and later phases is against `dd2e909`. The only delta between them is the redaction of three credential strings in one Markdown file — no source, config, or test behaviour changed.

---

## 2. Structure verification (§1) — three corrections to the brief

The brief's §1 derives from a 2026-08-02 export and instructs verification before trusting it. Verified:

```
$ for p in document-portal_Central_NITDA_ tools .github .gitignore precision_auditor_v3.py; do …
document-portal_Central_NITDA_     ABSENT from index
tools                              ABSENT from index
.github                            PRESENT (1 tracked)
.gitignore                         PRESENT (1 tracked)
precision_auditor_v3.py            ABSENT from index
```

| Brief's position | Verified reality | Consequence |
|---|---|---|
| `document-portal_Central_NITDA_/` does not exist | **Confirmed absent** | Brief §1 correct; v2 scope was wrong |
| `tools/` "does not appear in the export" | **Confirmed absent from the repo** — `CONFIRMED-ABSENT` | Not an export artefact |
| `.github/` "does not appear… absence of CI is a governance finding" | **PRESENT** — `.github/workflows/ci.yml` exists | ❌ **Brief is wrong. CI exists.** The export was filtered. §8.1's governance finding must not be written |
| `.gitignore` "does not appear" | **PRESENT**, and it git-ignores `config/config.local.js` with a stated credential rationale | ❌ **Brief is wrong** |
| `precision_auditor_v3.py` listed as tooling to run (§5.2) | **Not in this repository** | Cannot be run; not a repo artefact |
| 280 files | **282 tracked** | Export predates two commits made this session |

**`.github/` and `.gitignore` being present is the most consequential correction** — the brief instructed treating absent CI as a significant governance finding. It would have been a fabrication.

---

## 3. Existing tooling — run before writing (§5.2)

All eight suites executed at `dd2e909`.

| Tool | Runs | Result | What it actually asserts | Deliberately **not** covered |
|---|---|---|---|---|
| `tests/check-imports.mjs` | ✅ | pass — 168 modules, 2083 edges, 0 broken | Every relative import in the static graph resolves on disk | Entry points are `index.html` + `ECM_ActivityHub_Portal/index.html` **only**. `document-portal/` and `newack/` use classic scripts and are outside the graph entirely |
| `tests/check-secrets.mjs` | ✅ | pass (exit 0) **while reporting 4 live signatures** | Fails on a signature in a **non-baselined** tracked file; fails if baseline goes stale | **Does not fail on baselined exposure** — see §4 |
| `tests/governance.test.mjs` | ✅ | 63/63 | Ownership, RBAC, idempotency, audit, endpoint contracts | No browser; root platform only |
| `tests/output-encoding.test.mjs` | ✅ | 17/17 | Escaping at four named markup boundaries + escaper character coverage | Asserts `document-portal`'s `PF.esc` *definition* covers 5 chars; asserts nothing about its **use** |
| `tests/auth-posture.test.mjs` | ✅ | 21/21, both postures | Inert posture behaviour-preserving; enforced posture blocks anonymous requests and ignores local role tampering | Client-side postures only |
| `proxy/test/proxy.test.mjs` | ✅ | 66/66 | Token validation incl. forgery cases, role derivation, per-action authz, identity stripping, idempotency, audit | **Tests the proxy in isolation. Asserts nothing about whether clients traverse it** — the Phase 2 question |
| `tests/smoke.spec.js` | ⚠️ | 7/7 **only with an override** | Boot, a11y entry points, 25 routes mount, theme repaint, welcome overlay tokens, ECM portal load | See environment note below. **No document-portal or newack page is loaded by any test** |
| `scripts/check-links.mjs` | not run | — | Deferred to Phase 3 (external hosts) | — |
| `precision_auditor_v3.py` | n/a | — | **Not in this repository** | — |

**Environment note.** `npm run test:smoke` fails out of the box here: Playwright seeks `chromium_headless_shell-1234`, absent from `/opt/pw-browsers`. It passes with `DGO_CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Environment defect, not a repository defect — but it means the browser suite is silently skippable for anyone without that override.

**Scope-narrowing observed (§8.2's question).** Two cases, both real:
1. `check-secrets.mjs` suppresses two files by design (§4).
2. `check-imports.mjs` roots at two HTML entry points, so two of five app trees are structurally invisible to it.

---

## 4. Secret triage (§5.3) — the priority lead

### 4.1 Are these live credentials or fixtures? — **CONFIRMED-PRESENT: live-shaped**

`tests/secrets-baseline.txt` (verbatim, 2 lines):
```
document-portal/js/data.js
newack/config.js
```

The decisive evidence is **internal contrast inside `newack/config.js` itself**:

`newack/config.js:4-6`
```js
API_GET: "https://…/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/…&sig=DIStZ3aNpg…",
API_CREATE: "https://YOUR_FLOW_URL/create",   // Replace with your Live Flow 2 URL when ready
API_ACK: "https://YOUR_FLOW_URL/acknowledge",  // Replace with your Live Flow 3 URL when ready
```

Two of three endpoints are unmistakable placeholders with "replace when ready" comments. The third is a fully-formed signed URL with a real environment host and workflow GUID. **A fixture would not be selectively realistic.**

Corroborating: `config/config.example.js:29-36` uses `sig=ROTATE_ME` against `YOUR_ENV.api.powerplatform.com` for all 16 endpoints. The repository has an established placeholder convention, and neither baselined file follows it.

**Confidence: `CONFIRMED-PRESENT` that these are live-shaped credentials.** Whether the signatures are *still valid* is `INDETERMINATE` — only Power Automate can answer, and it goes to Open Questions.

### 4.2 Does the scanner suppress them, on what rationale? — **Yes, explicitly and defensibly**

`tests/check-secrets.mjs:5-16` states the rationale in the file:

> *"REPORT the baselined files … They cannot simply be scrubbed — deleting a file revokes nothing. Each signature must be ROTATED in Power Automate first; only then is removing it from the tree meaningful."*

Mechanics verified by reading:
- `SIG = /sig=[A-Za-z0-9_-]{20,}/` — `ROTATE_ME` is 10 characters and correctly does not match.
- Baselined files produce a warning and **exit 0**.
- Baseline may only shrink: a baselined file that loses its signature **fails** the build, so the list cannot silently drift.

**Assessment: the rationale is sound and the ratchet is well-built** — it caught my own leak within hours. But the consequence stands: **CI is green while four live-shaped credentials sit in tracked files.** There is no forcing function on rotation. That is the finding, not the suppression design.

### 4.3 Chronology — baseline followed the credentials

```
$ git log --diff-filter=A --format='%h %cI %s' -- <path>
document-portal/js/data.js    501bc42  2026-08-01T05:05:21+01:00  Add files via upload
newack/config.js              31ca711  2026-08-01T05:47:47+01:00  Add files via upload
tests/secrets-baseline.txt    ef0e390  2026-08-01T17:05:26+00:00  Add a quality gate…
```

The credentials were committed **~12 hours before** the baseline existed. The baseline grandfathered pre-existing exposure; it was not created to conceal a fresh leak. This supports the stated rationale rather than undermining it.

### 4.4 History — **the material finding**

```
$ git rev-list --all | while read c; do git grep -hoE 'sig=[A-Za-z0-9_-]{20,}' "$c"; done | sort -u | wc -l
22

$ git grep -hoE 'sig=[A-Za-z0-9_-]{20,}' HEAD | sort -u | wc -l
4

$ git rev-list origin/main | … | sort -u | wc -l
22
```

| | Count |
|---|---:|
| Distinct signatures **across all history** | **22** |
| Distinct at `HEAD` (tracked) | **4** |
| Removed from the tree but **still in history** | **18** |
| Reachable from `origin/main` | **22** |

**All 22 require rotation.** Eighteen were deleted from the working tree, which revoked nothing — they remain retrievable from `origin/main` history by anyone with repository access. The four at `HEAD` are additionally served to every browser that loads the affected pages.

Location of the four at `HEAD` after containment:
```
document-portal/js/data.js  :25, :26, :27   (3 distinct)
newack/config.js            :4              (1 distinct)
```

### 4.5 Severity

**High**, scope `CROSS` (`DOCPORTAL` + `NEWACK`), confidence `CONFIRMED-PRESENT`.

Not rated Critical: the repository is private (`INDETERMINATE` from repo contents — inferred from the absence of any public-deployment artefact, and to be resolved in Phase 3), and whether the signatures remain valid is unestablished. Both caveats are recorded in Open Questions. Should either resolve unfavourably, this becomes Critical.

---

## 5. Inventory (§5.4)

| Tree | Files | Lines (text) | Character |
|---|---:|---:|---|
| `core/` | 57 | 2,304 | Root runtime — boot, router, auth, ui, data-client |
| `ECM_ActivityHub_Portal/` | 53 | 2,839 | Second-largest tree; own entry, router×2, api client, services + pages |
| `document-portal/` | 41 | 6,961 | Multi-page app; own `ds/` design system, `sw.js` |
| `config/` | 31 | 3,293 | 31 config modules |
| `modules/` | 25 | 1,361 | Root feature modules |
| root files | 18 | 4,730 | incl. `ECM_DOCS_DEV.zip` and 11 doc/audit files |
| `styles/` | 18 | 3,539 | `dgo-design-system/` + `app.css` + `index.css` |
| `tests/` | 8 | 971 | |
| `shared/` | 8 | 488 | |
| `proxy/` | 7 | 912 | **Server-side** |
| `universal_filename_policy_deliverables/` | 6 | 258 | PDF/DOCX committed to source |
| `newack/` | 5 | 791 | Standalone; holds a live-shaped credential |
| `scripts/` | 2 | 222 | |
| `.github/` | 1 | 100 | `workflows/ci.yml` |
| `.devcontainer/` | 1 | 23 | |
| `assets/` | 1 | 0 | |

### 5.1 Line counts understate the code — **structural finding**

`core/` holds 57 files in 2,304 lines. That is not compactness; it is line density:

```
$ awk '{print length}' <file> | sort -rn | head -1
13794  document-portal/js/icons.js      (SVG sprite — expected)
 7056  modules/settings.js
 5181  modules/diagnostics.js
 4995  modules/registry.js
 4379  modules/correspondence.js
 4337  core/welcome-experience.js
```

Excluding the sprite, **five source files carry single lines over 4,000 characters.** `modules/settings.js` implements its entire `mount()` — form rendering, six event handlers, endpoint management, state persistence — on one 7,056-character line. Consequences: line-range citations lose precision, `git blame` and diffs are near-useless at statement level, and review is impractical. **Severity Low** (maintainability, no evidenced security path) but it materially raises the cost of every later phase.

### 5.2 Committed binaries

```
$ git ls-files | … size > 100KB
16,783,981  ECM_DOCS_DEV.zip
   143,932  document-portal/ds/fonts/CascadiaMono-Regular.woff2
   112,180  document-portal/ds/logo/nitda-lockup.png
```

`ECM_DOCS_DEV.zip` is **16.4 MB — ~87% of repository bytes**. Per §4 it is inventoried, not opened. **Escalation check performed:** `scripts/setup-local.mjs` reads it at setup time (`unzip -p` against an archived manifest) to generate `config/config.local.js`. It is therefore **referenced by a setup step**, which §4 says escalates. Flagged for Phase 3; not opened here.

`universal_filename_policy_deliverables/` — 6 files, PDF/DOCX/MD/JSON committed to source, referenced by nothing yet examined. Orphan candidate; confirm in Phase 1.

---

## 6. Duplicate and divergence analysis (§5.5)

### 6.1 Repo-wide byte-identical files across trees — **only two pairs**

```
$ git ls-files -s | awk '{print $2, $4}' | … c[hash]>1
2  document-portal/ds/tokens/tokens.density.css    styles/dgo-design-system/tokens/tokens.density.css
2  document-portal/ds/tokens/tokens.component.css  styles/dgo-design-system/tokens/tokens.component.css
```

**There is no widespread file duplication in this repository.** Exactly two blobs appear in more than one location, both design-system token files.

### 6.2 The design system fork — **confirmed, and it is worse than "drifted"**

The trees are structurally different: root is flat (`dgo-design-system/base.css`); the portal nests (`ds/styles/base.css`). Comparing by filename:

| File | Status | bytes root / portal |
|---|---|---|
| `tokens/tokens.component.css` | **IDENTICAL** | — |
| `tokens/tokens.density.css` | **IDENTICAL** | — |
| `components.css` | DIVERGED | 39,791 / 39,333 |
| `colors_and_type.css` | DIVERGED | 8,817 / 10,767 |
| `tokens/tokens.primitive.css` | DIVERGED | 8,820 / 8,731 |
| `tokens/tokens.semantic.css` | DIVERGED | 7,077 / 7,088 |
| `base.css` | DIVERGED | 5,499 / 4,566 |
| `tokens/tokens.theme-dark.css` | DIVERGED | 4,237 / 3,096 |
| `tokens/tokens.theme-hc.css` | DIVERGED | 3,159 / 2,575 |
| `layout.css` | DIVERGED | 3,263 / 3,252 |
| `reset.css` | DIVERGED | 1,129 / 1,152 |
| `tokens/tokens.theme-light.css` | DIVERGED | 729 / 753 |
| `brand-type.css`, `platform-authority.css` | root only | — |
| `tokens.enhanced.css`, `tokens.legacy-bridge.css` | root only | — |
| `ds.css`, `styles/components/command-palette.css` | portal only | — |

**12 shared filenames: 2 identical, 10 diverged.** The brief's two sample figures — `components.css` 39,791/39,333 and `colors_and_type.css` 8,817/10,767 — are **confirmed exactly**.

The theme tokens diverge most in proportional terms: dark 4,237 vs 3,096 (**27% smaller** in the portal), hc 3,159 vs 2,575 (**18% smaller**). The portal's dark and high-contrast themes are materially less complete than the root platform's.

### 6.3 Direction of drift — **CONFIRMED: the fork was imported, not created here**

```
$ git log --format='%h %cI %s' -- styles/dgo-design-system
5a0a93a 2026-08-01T04:54:15+01:00 Add files via upload      ← only commit

$ git log --format='%h %cI %s' -- document-portal/ds
776d26c 2026-08-01T22:05:57+00:00 Remediate every finding…  ← logo assets only
501bc42 2026-08-01T05:05:21+01:00 Add files via upload
```

`776d26c` touched **five logo files only** (`--stat` verified: `mark.svg`, `nitda-endorsed.svg` deleted; three PNGs added) — **no CSS**.

**Therefore: no CSS file in either design system has been modified since its import commit.** The two trees were uploaded 11 minutes apart, already divergent.

**Source-of-truth conclusion: `INDETERMINATE`, and the repository cannot resolve it.** Neither tree has authority conferred by this repository's history — both are single-import snapshots of a fork that happened upstream. Determining which is authoritative requires the upstream source, which is outside the repository. Filed to Open Questions.

### 6.4 ActivityHub services/pages pairing — layering, not duplication (preliminary)

```
services: 13   pages: 19   paired names: 10
paired: ai approvals briefs decisions inbox kpi meetings minutes projects tasks
```

10 of 13 services share a name with a page. Whether this is layering or duplicated logic requires reading both sides — **deferred to Phase 1**, not asserted here.

Two routers confirmed present: `js/core/router.js` (61 lines) and `js/views/router.js` (46 lines). Relationship deferred to Phase 1.

---

## 7. Phase 0 findings (provisional IDs, ledger assembled in Phase 4)

| ID | Title | Sev | Confidence | Scope |
|---|---|---|---|---|
| `F-001` | 22 distinct SAS signatures in history; 4 live-shaped at HEAD; 18 deleted-but-unrevoked | **High** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-002` | CI green on known live credential exposure — no forcing function on rotation | **Medium** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-003` | Audit prose reproduced live credentials into a third file (**contained in `dd2e909`**) | **Medium** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-004` | Design system forked; 10 of 12 shared files diverged; no source of truth establishable | **Medium** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-005` | Portal dark/hc theme tokens 27%/18% smaller than root's | **Low** | `CONFIRMED-PRESENT` | `DOCPORTAL` |
| `F-006` | `check-imports.mjs` cannot see `document-portal/` or `newack/` | **Low** | `CONFIRMED-PRESENT` | `CROSS` |
| `F-007` | Five source files exceed 4,000 characters on a single line | **Low** | `CONFIRMED-PRESENT` | `ROOT` |
| `F-008` | 16.4 MB self-archive is 87% of repo bytes **and is read by `setup-local.mjs`** | **Low** | `CONFIRMED-PRESENT` | `ROOT` |

`DOC-DRIFT` candidates are held until Phase 2 per §0.2 ordering.

---

## 8. Open Questions opened in Phase 0

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| `Q-01` | Are the 22 signatures still valid? | Validity is server-side state | Power Automate flow configuration |
| `Q-02` | Is the repository private? | No deployment or visibility artefact in-tree | GitHub repository settings |
| `Q-03` | Which design system is authoritative? | Both are single-import snapshots; the fork predates the repo | Upstream source the two uploads came from |
| `Q-04` | Is `document-portal/` deployed anywhere? | No deployment workflow examined yet — Phase 3 | Hosting configuration |

---

## 9. Phase 0 limitations

1. **The analysis SHA moved** from `d1f6640` to `dd2e909` because of the containment fix. Delta is three redacted strings in one Markdown file.
2. **`ECM_DOCS_DEV.zip` was not opened** per §4 — but it *is* read by `scripts/setup-local.mjs`, which §4 says escalates. Carried to Phase 3.
3. **`scripts/check-links.mjs` was not run** — depends on external hosts; deferred to Phase 3.
4. **Signature validity is untested.** No credential was exercised against any endpoint. Establishing validity would require invoking a live government workflow, which is out of scope and inappropriate.
5. **No quarantined document (§0.2) was used as evidence.** `check-secrets.mjs` prints a reference to `CAPABILITY_ASSESSMENT_R11.6.md`; that reference is quoted as *scanner output*, not relied on as fact.
6. **ActivityHub pairing and router relationship are stated as counts only** — no behavioural claim is made pending Phase 1.

---

**Gate: Phase 0 complete. Awaiting acceptance before Phase 1.**
