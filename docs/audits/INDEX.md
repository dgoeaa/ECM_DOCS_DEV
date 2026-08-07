# Audit record — index and supersession chain

Nine audit documents, written between 1 and 7 August 2026. Seven of them were
previously at the repository root. They are kept **unedited** — an audit record that
gets rewritten when it becomes inconvenient is not a record — so several of them
contain claims that were true of the commit they examined and are not true now.

Two exceptions, both structural rather than revisionist:
[`OPERATIONAL_READINESS_AUDIT.md`](./OPERATIONAL_READINESS_AUDIT.md) is the current
audit and carries its own findings live; and `FRONTEND_REVIEW_PARITY_VERDICT.md` was
folded into [`FRONTEND_REVIEW_ASSESSMENT.md`](./FRONTEND_REVIEW_ASSESSMENT.md) rather
than kept beside it, because two records of one review is how a finding gets fixed
twice or not at all. The fold preserves both documents' text and marks what came from
which.

**None of these is guidance.** For what the platform does today, read
[`../../PLATFORM_DOCUMENTATION.md`](../../PLATFORM_DOCUMENTATION.md); for what it
must do to go live, [`../deployment/COMMISSIONING.md`](../deployment/COMMISSIONING.md).

## The documents

| Document | Date | Commit examined | Scope | Status |
|---|---|---|---|---|
| [`AUDIT.md`](./AUDIT.md) | 2026-08-01 | ECM Activity Hub Portal era | The retired `ECM_ActivityHub_Portal/` | **Superseded.** Opens by declaring two of its own findings mis-scoped. Its subject tree no longer exists in this repository |
| [`CAPABILITY_ASSESSMENT_R11.6.md`](./CAPABILITY_ASSESSMENT_R11.6.md) | 2026-08-01 | `31ca711` | The R11.6 runtime — capability and gaps `G-01`…`G-09` | **Partly live.** The `G-nn` numbering is still the canonical reference for the open gaps |
| [`REPOSITORY_AUDIT.md`](./REPOSITORY_AUDIT.md) | 2026-08-01 | 399 tracked files | Repository-wide security and data, findings `R-nn` | **Superseded on facts, live on method** |
| [`FORENSIC_REPOSITORY_AUDIT.md`](./FORENSIC_REPOSITORY_AUDIT.md) | 2026-08-01 | 400 tracked files | Structural classification and duplicate detection. Explicitly *not* security | **Superseded.** Its file inventory predates the corpus trim |
| [`FORENSIC_ROOT_PLATFORM_AUDIT.md`](./FORENSIC_ROOT_PLATFORM_AUDIT.md) | 2026-08-02 | `61604a3` | Root runtime and `document-portal/` behaviour | **Partly live.** `tests/output-encoding.test.mjs` is written case-for-case against its findings |
| [`REFERENCE_SNAPSHOT_REVIEW.md`](./REFERENCE_SNAPSHOT_REVIEW.md) | 2026-08-02 | `main` at the time | The `dgo_targets__state.json` snapshot; envelope mismatch `A-1`/`A-2` | **Live.** `A-1`/`A-2` are cited as prerequisites by the root platform audit |
| [`FRONTEND_REVIEW_ASSESSMENT.md`](./FRONTEND_REVIEW_ASSESSMENT.md) | 2026-08-05, folded 08-06 | `8613358` | Assessment of an external frontend design review, 18 findings, **plus the 2 it missed** | **Live.** Wave 1 shipped; findings 19 and 20 closed; `tests/containment.spec.js` and `tests/portal.spec.js` cover them. The former `FRONTEND_REVIEW_PARITY_VERDICT.md` is folded into this document |
| [`OPERATIONAL_READINESS_AUDIT.md`](./OPERATIONAL_READINESS_AUDIT.md) | 2026-08-06 | `main` | End-to-end audit of both platforms, all branches, and readiness for live operationalization. Findings `O-nn` | **Live.** The current audit |
| [`DESIGN_AUDIT_BRIEF_ASSESSMENT.md`](./DESIGN_AUDIT_BRIEF_ASSESSMENT.md) | 2026-08-07 | `b003acd` | Assessment of an external visual/UX audit of both platforms, 33 findings, **plus the 7 it missed** (`V-nn`) | **Live.** 22 findings confirmed, 8 half right, 3 not reproducible — including `P-06`, one of the report's own release gates |

## Also here

[`repository-hygiene/`](./repository-hygiene/README.md) — the narrative half of a
machine-assisted hygiene audit of commit `c2d78ba2ea23`, recovered from the
`archive/repo-hygiene-audit` branch. Its ~63,000 lines of raw `.tsv`/`.log`/`.json`
output were deliberately left behind; see that README. It sits outside the chain below
because it audited repository structure rather than the platform.

## Supersession chain

```
AUDIT.md  (ECM Activity Hub Portal only)
   │  scope corrected and extended to the root runtime by
   ▼
CAPABILITY_ASSESSMENT_R11.6.md   ──┐  G-nn  runtime capability
REPOSITORY_AUDIT.md              ──┤  R-nn  repository-wide security
FORENSIC_REPOSITORY_AUDIT.md     ──┤        structural classification
   │                                │
   │  all three superseded on FACTS by
   ▼                                │
docs/forensic/dd2e909/             ─┘  the current forensic snapshot, on main
   │
   ├─ FORENSIC_ROOT_PLATFORM_AUDIT.md   behaviour, still the basis of a test suite
   └─ REFERENCE_SNAPSHOT_REVIEW.md      A-1/A-2 envelope mismatch, still open

FRONTEND_REVIEW_ASSESSMENT.md  ←── FRONTEND_REVIEW_PARITY_VERDICT.md
   (independent line: external design review, August 2026)
   The verdict was FOLDED IN, not superseded: its two findings, 19 and 20, are the
   ones the review itself missed, and both are now closed.
        │
        ├─ DESIGN_AUDIT_BRIEF_ASSESSMENT.md   (7 August 2026)
        │     Same line, second external report — a visual/UX audit of both platforms,
        │     assessed at b003acd. Neither supersedes the other: the frontend review
        │     examined the stylesheet and shell, this one examined navigation, copy and
        │     rendered layout. Its V-nn findings are the ones this report missed.
        │
        ▼
OPERATIONAL_READINESS_AUDIT.md   (6 August 2026)
   Draws every open item above into one register and adds its own, O-nn. This is
   the document to read for current state; the ones above it are the record of how
   it got there.
```

`docs/forensic/dd2e909/` is deliberately **not** rewritten by later reorganisations,
including the one that moved these files here. It is a snapshot of one commit and
cites paths as they were at that commit; correcting it would falsify it.

## What remains open

Two gaps, both outside this repository to close. Everything else recorded across
these documents has either been fixed and verified, or has had its subject removed
from the repository. The current audit's own register is in
[`OPERATIONAL_READINESS_AUDIT.md`](./OPERATIONAL_READINESS_AUDIT.md).

| Gap | What | Why it is still open |
|---|---|---|
| **G-03** | **55 distinct Power Automate SAS signatures across 28 tracked files** under `docs/reference/foundational/` | Deleting a file revokes nothing. These must be **rotated in Power Automate** — `../deployment/MINIMAL-PILOT.md` §3a. The corpus documents the deployed estate verbatim by explicit decision (D5), so `tests/check-secrets.mjs` excludes it from the ratchet and reports the excluded figure on every run instead; `tests/secrets-baseline.txt` covers the application tree and may only shrink. `npm run package` refuses to build a pilot or enforced package wired to any of these |
| **G-04** | No server-side authentication; client-asserted identity is trusted | The client half is complete and tested. The server half is seven obligations that belong to the Power Automate flows, specified in [`../architecture/AUTHENTICATION_CONTRACT.md`](../architecture/AUTHENTICATION_CONTRACT.md) §2 and sequenced in [`../deployment/FLOW-BUILD-PLAN.md`](../deployment/FLOW-BUILD-PLAN.md). Until they are implemented, all governance in this repository is advisory |

`npm run commission` reports which obligations stand between the current state and a
live deployment. The G-03 figure above was previously recorded as *4 signatures in 2
files*; that was the application tree only, and the whole-repository figure is the one
that matters for rotation.
