# Audit record — index and supersession chain

Eight audit documents, written between 1 and 5 August 2026, all previously at the
repository root. They are kept **unedited** — an audit record that gets rewritten
when it becomes inconvenient is not a record — so several of them contain claims
that were true of the commit they examined and are not true now.

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
| [`FRONTEND_REVIEW_ASSESSMENT.md`](./FRONTEND_REVIEW_ASSESSMENT.md) | 2026-08-05 | `8613358` | Assessment of an external frontend design review, 18 findings | **Live.** Wave 1 shipped; `tests/containment.spec.js` covers it |
| [`FRONTEND_REVIEW_PARITY_VERDICT.md`](./FRONTEND_REVIEW_PARITY_VERDICT.md) | 2026-08-05 | `8613358` | Whether an attached prototype was at parity | **Live.** Companion to the assessment above |

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

FRONTEND_REVIEW_ASSESSMENT.md ── FRONTEND_REVIEW_PARITY_VERDICT.md
   (independent line: external design review, August 2026)
```

`docs/forensic/dd2e909/` is deliberately **not** rewritten by later reorganisations,
including the one that moved these files here. It is a snapshot of one commit and
cites paths as they were at that commit; correcting it would falsify it.

## What remains open

Two gaps only. Everything else recorded across these eight documents has either
been fixed and verified, or has had its subject removed from the repository.

| Gap | What | Why it is still open |
|---|---|---|
| **G-03** | Live Power Automate SAS signatures in tracked files under `docs/reference/foundational/` | Deleting a file revokes nothing. These must be **rotated in Power Automate** — `../deployment/MINIMAL-PILOT.md` §3a. `tests/check-secrets.mjs` holds the count at its recorded baseline and fails on any new one; `tests/secrets-baseline.txt` may only shrink |
| **G-04** | No server-side authentication; client-asserted identity is trusted | The client half is complete and tested. The server half is seven obligations that belong to the Power Automate flows, specified in [`../architecture/AUTHENTICATION_CONTRACT.md`](../architecture/AUTHENTICATION_CONTRACT.md) §2 and sequenced in [`../deployment/FLOW-BUILD-PLAN.md`](../deployment/FLOW-BUILD-PLAN.md). Until they are implemented, all governance in this repository is advisory |

Both are outside this repository to close. `npm run commission` reports which
obligations stand between the current state and a live deployment.
