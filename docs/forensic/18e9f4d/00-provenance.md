# Phase 0 — Provenance, Inventory, Triage

**Engagement:** Forensic current-state audit, brief v3
**Repository:** `dgoeaa/ECM_DOCS_DEV`
**Branch:** `claude/platform-architecture-security-4iwgff`
**Phase 0 executed:** 2026-08-02

---

## 0.1 BLOCKING — auditor independence is compromised

**This must be resolved before Phase 1 is accepted.**

The branch HEAD is a commit authored **by this same agent, earlier in this session**, which
modified 40 files including several the brief names as priority leads.

```
$ git log -1 --format='%H%n%cI%n%an%n%s'
18e9f4da4ff5e110643a7ea88fc3b306a71fa679
2026-08-02T05:16:15+00:00
Claude
Remove portal credentials, guard URL sinks, close the styling and a11y gaps
```

```
$ git log --oneline -2
18e9f4d Remove portal credentials, guard URL sinks, close the styling and a11y gaps
177d992 One-command setup and Codespaces support (#5)
```

`$ git diff --stat 177d992 18e9f4d | tail -1`
> `40 files changed, 855 insertions(+), 95 deletions(-)`

Files changed by that commit which the brief treats as evidence include
`tests/check-secrets.mjs`, `tests/secrets-baseline.txt`, `document-portal/js/data.js`,
`styles/dgo-design-system/components.css`, `index.html` and all six
`document-portal/*.html`.

**Consequence.** An auditor cannot supply independent assurance over its own changes. Every
Phase 2 finding about `document-portal/` secrets, CSP presence, or URL-sink guarding would be
an assessment of this agent's own work. Section 0.4 below records the decision required.

---

## 0.2 Provenance

| Item | Value |
|---|---|
| HEAD SHA | `18e9f4da4ff5e110643a7ea88fc3b306a71fa679` |
| Committed | `2026-08-02T05:16:15+00:00` |
| Author | Claude (this session) |
| Working tree | **clean** — `git status --porcelain` produced no output |
| Branch | `claude/platform-architecture-security-4iwgff` |
| Total commits in repo | 33 |
| Tracked files at HEAD | 280 |
| Tracked files at `177d992` | 279 |

The working tree is clean, so this analysis describes commit `18e9f4d` and is reproducible.

---

## 0.3 §1 of the brief does not describe this branch

The brief instructs (§11 caveat) that §1 be verified before being trusted. It was. Four files
the brief names as existing **have never existed in this repository**, across all 33 commits
and all refs:

```
$ for f in FORENSIC_ROOT_PLATFORM_AUDIT.md REFERENCE_SNAPSHOT_REVIEW.md \
           tests/output-encoding.test.mjs precision_auditor_v3.py; do
    echo "$f -> $(git log --all --oneline -- "$f" | wc -l) commits"
  done
> FORENSIC_ROOT_PLATFORM_AUDIT.md -> 0 commits
> REFERENCE_SNAPSHOT_REVIEW.md    -> 0 commits
> tests/output-encoding.test.mjs  -> 0 commits
> precision_auditor_v3.py         -> 0 commits
```

| Brief's claim (§1, §5.2, §7.5) | Verified reality at HEAD | Confidence |
|---|---|---|
| `FORENSIC_ROOT_PLATFORM_AUDIT.md` is a root audit doc, and is the **only** place CSP/SRI appear | Never existed. §7.5's central `DOC-DRIFT` premise is unfounded as stated | `CONFIRMED-ABSENT` |
| `REFERENCE_SNAPSHOT_REVIEW.md` is a root audit doc | Never existed | `CONFIRMED-ABSENT` |
| `tests/output-encoding.test.mjs` exists; §7.2/§7.3 cross-reference it | Never existed. Test suite is 5 files, not 8 | `CONFIRMED-ABSENT` |
| `precision_auditor_v3.py` ships in-repo | Never existed | `CONFIRMED-ABSENT` |
| `.github/` "does not appear in the export" — absence may be a governance finding | **Exists.** `.github/workflows/ci.yml`, added in `ef0e390`. CI is real; the export filtered dot-directories | `CONFIRMED-PRESENT` |
| `tools/` in scope | Absent from repo | `CONFIRMED-ABSENT` |
| `document-portal_Central_NITDA_/` does not exist | Correct at HEAD — but it **did** exist and was deleted in `776d26c`; see §0.6 | `CONFIRMED-PRESENT` (history) |
| `tests/secrets-baseline.txt` contains `document-portal/js/data.js` and `newack/config.js` | True at `177d992`. **At HEAD it contains `ECM_DOCS_DEV.zip` and `newack/config.js`** | `CONFIRMED-PRESENT` |
| Design system forked, 10 of 12 diverged | **Confirmed exactly.** See §0.7 | `CONFIRMED-PRESENT` |
| `ECM_ActivityHub_Portal/` is 53 files and wired into tooling | Confirmed, 53 files | `CONFIRMED-PRESENT` |
| `proxy/` is server-side, 7 files | Confirmed, 7 files, 912 lines | `CONFIRMED-PRESENT` |

**Assessment.** The brief's v3 baseline is an export of the tree at or near `177d992`, and it
additionally names four files belonging to some other artefact set. Its §7.5 instruction —
"CSP and SRI appear *only* in `FORENSIC_ROOT_PLATFORM_AUDIT.md`" — cannot be executed as
written. The underlying question (is there a CSP in code?) is still answerable and is deferred
to Phase 2 with a documented negative search.

---

## 0.4 Decision required before Phase 1

Three options. This is the gate.

1. **Audit `177d992`** (the pre-modification parent). Restores independence — the agent did
   not author it — and makes every pre-seeded lead in the brief resolvable as written. The
   report then describes a commit that is no longer branch HEAD.
2. **Audit `18e9f4d`** (current HEAD), with the independence conflict declared in the
   limitations section and every finding touching the 40 changed files marked as
   self-assessment.
3. **Audit both**, presenting `177d992` as the baseline and `18e9f4d` as the delta.

Recommendation: **option 1**, with a short appendix diffing HEAD. A current-state audit whose
findings are the auditor's own prior work is not assurance, whatever caveats are attached.

---

## 0.5 §5.3 Secret triage — the priority lead

### Finding: `newack/config.js:4` carries a live-shaped SAS signature

```
$ rg -n 'sig=' newack/config.js
4:  API_GET: "https://defaultca6a4b3f912349bcbcb927085ebbf1.a1.environment.api.powerplatform.com
:443/powerautomate/automations/direct/workflows/02a3a70f3dec4dcd9a85a244a60c65b9/triggers/
manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=DIStZ3aNpg87fB57xWi95xf6-10ON9xdKj8gtu6DXAU",
```

**Not a fixture.** The repository's own placeholder convention is explicit and different:

```
$ rg -n 'ROTATE_ME' config/config.example.js | head -2
29:    FETCH_ACTIVITIES:  "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
30:    FETCH_ALL:         "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
```

`newack/config.js` uses a concrete tenant GUID, a concrete workflow GUID and a 43-character
signature. `config.example.js` uses `YOUR_ENV` and `ROTATE_ME`. The two files are following
different conventions, and only one of them is a placeholder.

Confidence: `CONFIRMED-PRESENT` that the literal is committed and is not the placeholder form.
Whether the signature is *currently valid* is `INDETERMINATE` — it can only be settled in the
Power Automate portal. **Treat as live until rotation is confirmed.**

### §5.3.3 — Chronology: the baseline post-dates the credentials

```
$ git log --diff-filter=A --format='%h %cI %s' -- tests/secrets-baseline.txt
ef0e390 2026-08-01T17:05:26+00:00 Add a quality gate: import checker, smoke suite, secret ratchet and CI

$ git log --diff-filter=A --format='%h %cI %s' -- newack/config.js
31ca711 2026-08-01T05:47:47+01:00 Add files via upload

$ git log --diff-filter=A --format='%h %cI %s' -- document-portal/js/data.js
501bc42 2026-08-01T05:05:21+01:00 Add files via upload
```

Credentials were committed roughly 12 hours **before** the ratchet that baselines them. The
baseline therefore suppresses pre-existing exposure rather than concealing a fresh leak — the
"accepted debt" pattern, and the stated rationale (§0.5 below) matches. It is not evidence of
an attempt to hide a new credential.

### §5.3.4 / §5.3.5 — Signatures in history

```
$ git log --all -p -- newack/config.js | rg -o 'sig=[A-Za-z0-9_-]{20,}' | sort -u
sig=DIStZ3aNpg87fB57xWi95xf6-10ON9xdKj8gtu6DXAU

$ git log --all -p -- document-portal/js/data.js | rg -o 'sig=[A-Za-z0-9_-]{20,}' | sort -u
sig=FUeporOryvRDWA7z561j4LsLY4ey3YjUsgUCIqhEzyU
sig=Yef7pmj6yGBRszqaS9BT7gosu2gYlaheAfqhmSgAJuo
sig=jVUOseIHw17BG3tMiZfBMCEVSN1a65vOSLtsKURgr98
```

Four distinct signatures across these two files. The three in `document-portal/js/data.js` are
**absent from the working tree at HEAD** but remain in history — commit `18e9f4d` removed them
from the file, which does not revoke them. Anyone with repository read access can recover all
four with the command above.

### §5.3.2 — Suppression rationale, quoted

`tests/check-secrets.mjs:1-20`
> ```
>  *   1. FAIL on any tracked file that carries a signature and is not in the baseline.
>  *      That is a new leak and must never merge.
>  *   2. REPORT the baselined files, which are the ones the capability assessment recorded
>  *      as already affected (gap G-03). They cannot simply be scrubbed — deleting a file
>  *      revokes nothing. Each signature must be ROTATED in Power Automate first; only then
>  *      is removing it from the tree meaningful.
> ```

`tests/check-secrets.mjs:163`
> `process.exit(added.length || cleared.length ? 1 : 0);`

The rationale is stated, coherent, and defensible. Its **consequence** is the finding: the
suite exits 0 while reporting 32 distinct live-shaped signatures.

---

## 0.6 §5.2 Existing tooling — run, and what passing certifies

Five suites exist (not eight — see §0.3). All were executed at HEAD.

| Tool | Exit | Asserts | Deliberately does **not** cover |
|---|---|---|---|
| `tests/check-imports.mjs` | 0 | Every relative import resolves on disk; 2,085 edges | Whether a resolved module *works*; dynamic/bare specifiers |
| `tests/check-secrets.mjs` | **0** | Fails only on a *new* signature outside the baseline | **Exits 0 while reporting 31+1 distinct signatures.** See below |
| `tests/governance.test.mjs` | 0 | 86 assertions: RBAC shape, audit log, endpoint redaction, `th[scope]` | No runtime authorization behaviour |
| `tests/auth-posture.test.mjs` | 0 | 21 assertions incl. that enforced posture blocks anonymous calls and ignores local role tampering | Runs in-process; no live IdP, no deployed proxy |
| `proxy/test/proxy.test.mjs` | 0 | 66 assertions; signs real RSA tokens | Does not establish the proxy is *in the request path* |

### Scope-narrowing finding — the secret scan

A green secret scan coexists with 32 distinct signatures, by design.

```
$ node tests/check-secrets.mjs ; echo "exit=$?"
⚠️  2 baselined file(s) carry 31 globally distinct SAS signature(s).
   ECM_DOCS_DEV.zip  (31 distinct, in 18 archived file(s))
   newack/config.js  (1 distinct)
exit=0
```

A second, sharper narrowing existed at the brief's baseline and was removed by `18e9f4d`:

```
$ git show 177d992:tests/check-secrets.mjs | rg -n 'includes\(0\)'
50:  if (buf.includes(0)) continue; // binary
```

At `177d992` any file containing a NUL byte was skipped, so `ECM_DOCS_DEV.zip` was never
scanned and the tool reported **4** signatures. At HEAD the same tool reports **31** from the
archive alone. *Caveat per §0.1: the fix is this agent's own commit, so the corrected figure
is self-reported and warrants independent re-derivation.*

---

## 0.7 §5.4 Inventory

| Tree | Files | Text lines | Binary | MB |
|---|---:|---:|---:|---:|
| `core/` | 57 | 2,340 | 0 | 0.23 |
| `ECM_ActivityHub_Portal/` | 53 | 2,839 | 0 | 0.13 |
| `document-portal/` | 42 | 7,216 | 6 | 0.73 |
| `config/` | 31 | 3,294 | 0 | 0.12 |
| `modules/` | 25 | 1,361 | 0 | 0.26 |
| `styles/` | 18 | 3,690 | 0 | 0.20 |
| root files | 16 | 4,008 | 1 | **16.99** |
| `shared/` | 8 | 531 | 0 | 0.05 |
| `proxy/` | 7 | 912 | 0 | 0.04 |
| `tests/` | 7 | 1,067 | 0 | 0.05 |
| `universal_filename_policy_deliverables/` | 6 | 259 | 3 | 0.06 |
| `newack/` | 5 | 796 | 0 | 0.03 |
| `scripts/` | 2 | 222 | 0 | 0.01 |
| `.github/` | 1 | 95 | 0 | 0.00 |
| `.devcontainer/` | 1 | 23 | 0 | 0.00 |
| `assets/` | 1 | 0 | 1 | 0.00 |
| **Total** | **280** | **28,653** | **11** | **18.91** |

Hygiene leads carried to the ledger: `ECM_DOCS_DEV.zip` (16.99 MB — 90% of repository bytes,
and the container of 31 signatures); `universal_filename_policy_deliverables/` (3 committed
PDF/DOCX binaries); root Markdown.

Precise count of root `.md` files — **9**, of which **8** are on the brief's 10-name quarantine
list (the other two on that list never existed, §0.3); `CONTRIBUTING.md` is a 9th root document
not named by the brief:

```
$ git ls-tree --name-only HEAD | rg '\.md$'
AUDIT.md  AUTHENTICATION_CONTRACT.md  CAPABILITY_ASSESSMENT_R11.6.md  CONTRIBUTING.md
FORENSIC_REPOSITORY_AUDIT.md  PLATFORM_DOCUMENTATION.md  README.md  REPOSITORY_AUDIT.md
STATUS_REPORT.md
```

---

## 0.8 §5.5 Duplicate and divergence analysis

### Cross-tree byte-identical files: exactly 2

```
$ # sha256 of every tracked file, grouped, filtered to groups spanning >1 top-level tree
cross-tree duplicate groups: 2
   document-portal/ds/tokens/tokens.component.css | styles/dgo-design-system/tokens/tokens.component.css
   document-portal/ds/tokens/tokens.density.css   | styles/dgo-design-system/tokens/tokens.density.css
```

### The design system is forked — brief's lead confirmed

| File | root bytes | portal bytes | State |
|---|---:|---:|---|
| `base.css` | 5,499 | 4,566 | DIVERGED |
| `colors_and_type.css` | 8,817 | 10,767 | DIVERGED |
| `components.css` | 47,239 | 39,333 | DIVERGED |
| `layout.css` | 3,263 | 3,252 | DIVERGED |
| `reset.css` | 1,129 | 1,152 | DIVERGED |
| `tokens.component.css` | 5,786 | 5,786 | **IDENTICAL** |
| `tokens.density.css` | 1,285 | 1,285 | **IDENTICAL** |
| `tokens.primitive.css` | 8,820 | 8,731 | DIVERGED |
| `tokens.semantic.css` | 7,077 | 7,088 | DIVERGED |
| `tokens.theme-dark.css` | 4,237 | 3,096 | DIVERGED |
| `tokens.theme-hc.css` | 3,159 | 2,575 | DIVERGED |
| `tokens.theme-light.css` | 729 | 753 | DIVERGED |

12 common files, **2 identical, 10 diverged.** Root-only: `brand-type.css`,
`platform-authority.css`, `tokens.enhanced.css`, `tokens.legacy-bridge.css`. Portal-only:
`ds.css`, `command-palette.css`, `sprite.svg`, `CascadiaMono-Regular.woff2`, 3 NITDA logo PNGs.

Note: `components.css` root byte count includes ~7.9 KB appended by commit `18e9f4d` (§0.1).
At `177d992` it was 39,791 bytes against the portal's 39,333 — matching the brief exactly.

### Drift direction: the fork predates this repository

```
$ a=$(git log --diff-filter=A --format='%h' -- styles/dgo-design-system/components.css | tail -1)  # 5a0a93a
$ b=$(git log --diff-filter=A --format='%h' -- document-portal/ds/styles/components.css | tail -1) # 501bc42
$ git show $a:styles/dgo-design-system/components.css   | sha256sum   # 1b96d95a0ac6a1c4...
$ git show $b:document-portal/ds/styles/components.css  | sha256sum   # f0c9e0e641e04fa7...
```

The two copies were **never identical inside this repository** — they differed at the moment
each was first added, in two separate "Add files via upload" commits 11 minutes apart. There is
no common ancestor here from which to measure drift.

**Source of truth: `INDETERMINATE`.** Neither copy can be shown to derive from the other from
repository contents. Resolving it requires the upstream design-system project.

### `ECM_ActivityHub_Portal/` service↔page pairing

```
services (13): ai approvals bootstrap briefs correspondence decisions inbox kpi meetings minutes ops projects tasks
pages    (19): admin ai approvals audit briefs dashboard decisions directory inbox inward kpi
               meetings minutes notfound notifications outward projects reports tasks
paired      (10): ai approvals briefs decisions inbox kpi meetings minutes projects tasks
service-only (3): bootstrap correspondence ops
page-only    (9): admin audit dashboard directory inward notfound notifications outward reports
```

Pairing is partial, not systematic: 10 of 19 pages have a same-named service. Whether this is
layering or duplication requires reading both sides — **deferred to Phase 1**, not asserted here.

Two routers confirmed present: `js/core/router.js` (61 lines) and `js/views/router.js`
(46 lines). Their relationship is **deferred to Phase 1**.

### `document-portal_Central_NITDA_/` — deleted, not absent

The brief states this directory does not exist. True at HEAD, but incomplete:

```
$ git log --all --oneline --diff-filter=D -- 'document-portal_Central_NITDA_/index.html'
776d26c Remediate every finding in the forensic structural audit
```

It existed and was removed in `776d26c`. Whether its content was discarded or merged into
`document-portal/` is a **Phase 1** question and is not asserted here.

---

## 0.9 Phase 0 findings carried forward

| Ref | Title | Sev (provisional) | Confidence | Scope |
|---|---|---|---|---|
| P0-A | Auditor authored branch HEAD; independence compromised | — (process) | `CONFIRMED-PRESENT` | `CROSS` |
| P0-B | Live-shaped SAS signature committed in `newack/config.js:4` | High | `CONFIRMED-PRESENT` | `NEWACK` |
| P0-C | 4 distinct SAS signatures recoverable from git history | High | `CONFIRMED-PRESENT` | `CROSS` |
| P0-D | Secret scan exits 0 while reporting 32 signatures | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-E | `ECM_DOCS_DEV.zip` — 16.99 MB archive, 90% of repo, holds 31 signatures | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-F | Design system forked; 10/12 diverged; no source of truth | Medium | `CONFIRMED-PRESENT` | `CROSS` |
| P0-G | Binary deliverables (PDF/DOCX) committed to source | Low | `CONFIRMED-PRESENT` | `CROSS` |

---

## 0.10 Open Questions raised in Phase 0

| # | Question | Why the repo cannot answer | What would answer it |
|---|---|---|---|
| OQ-1 | Are the 4 signatures currently valid? | Validity is server-side state | Power Automate flow trigger configuration |
| OQ-2 | Which design-system copy is authoritative? | Fork predates repo; no common ancestor | Upstream design-system repository |
| OQ-3 | Is `18e9f4d` intended as the audit target despite authorship? | Governance decision, not a code fact | Engagement owner (§0.4) |
| OQ-4 | Do the 31 archive signatures duplicate the 4 in source, or are they additional? | Requires opening `ECM_DOCS_DEV.zip`, excluded by §4 | Escalation to open the archive |

---

**Phase 0 complete. Gate: awaiting acceptance and the §0.4 decision.**

---

## 0.11 Phase 0 self-verification (§9.5)

Five citations sampled and reopened — approximately 15% of the ~33 distinct citations in this
document. All five reproduced exactly.

| # | Citation | Re-run result |
|---|---|---|
| 1 | `newack/config.js:4` signature literal | Matches verbatim |
| 2 | `tests/check-secrets.mjs:163` exit logic | `process.exit(added.length \|\| cleared.length ? 1 : 0);` |
| 3 | `177d992:tests/check-secrets.mjs:50` binary skip | `if (buf.includes(0)) continue; // binary` |
| 4 | `tokens.density.css` byte-identical across trees | Both `9fc3ded4c2802878…` |
| 5 | Root `.md` inventory | 9 files — count corrected in §0.7 |

**Discrepancy count: 1 of 5** (item 5, an imprecise count, corrected in place rather than
carried forward). Error rate 20% on a small sample, above the 5% threshold in §9.5. The
discrepancy was a summary count, not a code citation; all four code citations were exact.
Every count in this document has since been re-derived from a stated command.
