# Phase 3 findings and cleanup recommendations

Scope commit short SHA: **c2d78ba2ea23**
Tracked files analyzed: **294** (scope-integrity mismatches: 0)
Findings: **8** (1 critical, 2 high, 2 medium, 3 low)
Recommendations: **8** (1 × P1, 3 × P2, 2 × P3, 2 × P4)

Phase 3 answers the question the first three phases deliberately refused: *given what is
duplicated, unreachable and obsolete, what should be done about it, in what order, and at
what risk*. Every finding traces to Phase 0/1/2 evidence, and every recommendation carries
its prerequisite, its blast radius and the command that verifies it.

**Phase 3 recommends. It does not execute.** No tracked file outside
`docs/repository-hygiene/c2d78ba2ea23/` is created, edited, moved or deleted by this phase.

## Evidence for the Phase 3 analysis command

docs/repository-hygiene/c2d78ba2ea23/04-recommendation-analysis.log:1-15
> $ python3 Phase 3 findings/recommendation analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json, reference-graph.json and duplicate-obsolescence.json using scope re-hashing, signature-carrier detection against tests/secrets-baseline.txt, removal-blocker resolution and disposition/priority derivation
> > scope_commit=c2d78ba2ea23 tracked_files=294 scope_integrity_mismatches=0 missing=0
> > findings=8 critical=1 high=2 low=3 medium=2
> > recommendations=8 P1=1 P2=3 P3=2 P4=2
> > secret_carriers=4 baselined=2 unbaselined=2 stale_baseline_rows=0 globally_distinct_signatures=31 gate=FAILING carriers_inside_phase0_scope=4
> > $ node tests/check-secrets.mjs exited 1
> > archive=ECM_DOCS_DEV.zip bytes=16783981 share_of_tracked_bytes=0.8797 hard_blockers=2 documentation_mentions=18 mentions_in_out_of_scope_hygiene_artifacts=397 (excluded)
> > design_system_census=18 below_threshold_counterparts=1 unpaired=6 resolvable_by_deleting_one_side=2
> > superseded_dir=docs/forensic/177d992 files=4 bytes=40279 incoming_references=2 of_which_inside_unresolved_set=2
> > stale_references=39 in_code=7 in_documentation=32
> > bytes_recommended_for_removal_after_prerequisites=16783981 bytes_awaiting_owner_answer=158389 tracked_bytes=19080145
> > Phase 3 issues recommendations only. No tracked file outside docs/repository-hygiene/c2d78ba2ea23/ is created, edited, moved or deleted.
> > sig= values are redacted in all generated evidence

### Scope integrity

All 294 files were re-hashed against the Phase 0 inventory before analysis; 0 differ.
Phases 0, 1, 2 and 3 describe the same bytes.

### Two scope rules worth stating

The blocker and mention counts below are computed **over the Phase 0 scope only**. The
hygiene artifacts committed on top of the scope commit mention `ECM_DOCS_DEV.zip` 397 more
times; counting the audit's own prose as evidence about the repository would be circular,
so those are excluded. With that exclusion the figures reconcile exactly with Phase 2:
52 literal mentions across 18 files.

The signature scan is the opposite: it runs over **every** currently tracked file, because
that is what `tests/check-secrets.mjs` does and the finding is a claim about that gate. All
4 carriers it finds happen to lie inside the Phase 0 scope, so the two framings agree here.

## Findings

| ID | Severity | Category | Finding | Files |
|---|---|---|---|---:|
| H-01 | critical | credential-exposure | Two tracked files carry unrotated SAS signatures and are absent from the secret baseline, so the repository's own secret gate exits non-zero | 2 |
| H-02 | high | credential-exposure | A 16 MB build artefact holding most of the repository's distinct SAS signatures is tracked, and tracked tooling reads it at runtime | 1 |
| H-03 | high | duplication-drift | The design system exists as two live forks that have drifted apart in both directions | 30 |
| H-04 | medium | false-assurance | Shipped source comments cite verification tooling that does not exist in the repository | 5 |
| H-05 | medium | obsolescence | A directory that declares itself superseded is kept alive only by citations from the directory whose own future is unresolved, and one of its files is a signature carrier | 4 |
| H-06 | low | stale-documentation | Documentation describes a pre-consolidation directory layout that no longer exists | 8 |
| H-07 | low | unclear-ownership | A forensic directory and one portal README have no incoming reference and no signal resolving whether they are current | 10 |
| H-08 | low | duplication-drift | Two design-system token sheets are byte-identical across both trees, so one is pure redundancy that can drift at any time | 4 |

Per-finding fields and full affected-path lists are in
`docs/repository-hygiene/c2d78ba2ea23/04-findings.tsv`.

### H-01 — the secret gate is red, so it is no longer a ratchet

This is the only finding Phase 3 rates critical, and it is the only one that is a *live
regression* rather than an accumulation of debt.

tests/check-secrets.mjs is designed as a ratchet: fail on a **new** carrier, merely report
the known ones listed in `tests/secrets-baseline.txt`. Two tracked files carry signatures and
are not baselined, so the check exits 1 on every run.

docs/repository-hygiene/c2d78ba2ea23/04-secret-gate-raw.txt:1-9
$ node tests/check-secrets.mjs ; echo "exit=$?"
> ❌ NEW files carrying a Power Automate SAS signature:
> docs/forensic/177d992/00-provenance.md  (4 distinct)
> docs/forensic/18e9f4d/00-provenance.md  (4 distinct)
> A SAS URL is a credential. Rotate it in Power Automate and keep it out of
> the tree — use config/config.local.js, which is git-ignored.
> exit=1

The consequence is worse than the two files. A ratchet that is already failing cannot
signal that something new has been added — the next genuine leak lands in an already-red
build and is indistinguishable from these two. The check's own header says so:

tests/check-secrets.mjs:10-13
$ sed -n '10,13p' tests/check-secrets.mjs
>  *   2. REPORT the baselined files, which are the ones the capability assessment recorded
>  *      as already affected (gap G-03). They cannot simply be scrubbed — deleting a file
>  *      revokes nothing. Each signature must be ROTATED in Power Automate first; only then
>  *      is removing it from the tree meaningful.

Both carriers are documentation, not runtime code, so nothing imports them and the fix
carries no runtime risk. The full carrier table, with redacted counts only, is in
`docs/repository-hygiene/c2d78ba2ea23/04-secret-exposure.tsv`.

| Carrier | Kind | Distinct signatures | Baselined | Gate effect |
|---|---|---:|---|---|
| docs/forensic/177d992/00-provenance.md | tracked-text-file | 4 | no | fails-the-gate |
| docs/forensic/18e9f4d/00-provenance.md | tracked-text-file | 4 | no | fails-the-gate |
| ECM_DOCS_DEV.zip | tracked-archive | 31 | yes | reported-only |
| newack/config.js | tracked-text-file | 1 | yes | reported-only |

31 globally distinct signatures are reachable from the tree. Signature values are never
emitted; only counts.

### H-02 — the archive is 88% of the repository and holds most of the credentials

`ECM_DOCS_DEV.zip` is 16,783,981 of 19,080,145 tracked bytes — **88.0%** of the repository —
and carries 31 distinct signatures across 18 members, more than the rest of the tree
combined. The repository has already reached this conclusion itself:

tests/secrets-baseline.txt:12-16
$ sed -n '12,16p' tests/secrets-baseline.txt
> # ECM_DOCS_DEV.zip was invisible to this check until the scanner learned to read archives.
> # It carries more distinct signatures than the rest of the tree combined, plus an
> # "UNREDACTED" operations manifest. It should be removed from the repository entirely —
> # it is a 17 MB build artefact, not source — but only after its signatures are rotated.
> ECM_DOCS_DEV.zip

Phase 3 adds the part that was missing: **what actually blocks the removal**. Of the 52
mentions across 18 files, only 2 are blocking.

| Blocker | Line | Kind | Why it blocks |
|---|---:|---|---|
| scripts/setup-local.mjs | 26 | runtime-read | `npm run setup` extracts the operations manifest from the archive to write the git-ignored `config.local.js` files |
| tests/secrets-baseline.txt | 16 | gate-data-row | Untracking the archive without editing this row trips the scanner's "baseline is stale" branch, which also exits 1 |

scripts/setup-local.mjs:26-26
$ sed -n '26p' scripts/setup-local.mjs
> const ARCHIVE = path.join(ROOT, 'ECM_DOCS_DEV.zip');

The remaining 50 mentions across 18 files are prose. Two of them read like code but are
continuation lines inside block comments, and the analyzer tracks `/* */` state specifically
so they are not counted as dependencies:

document-portal/js/data.js:30-30
$ sed -n '30p' document-portal/js/data.js
> ECM_DOCS_DEV.zip. Deleting a file revokes nothing.

The complete blocking/non-blocking split is in
`docs/repository-hygiene/c2d78ba2ea23/04-archive-removal-blockers.tsv`.

### H-03 — the design system is two forks, and neither is ahead

Phase 2 found 2 exact duplicate groups and 9 near-duplicate pairs spanning
`document-portal/ds/` and `styles/dgo-design-system/`. Phase 2's thresholds answer *which
files look alike*. Reconciliation needs a different question — *which files are
counterparts* — because a counterpart that has drifted **below** every similarity threshold
is the most expensive kind to reconcile, not the least, and would otherwise fall out of
scope for being too different.

Phase 3 therefore recomputes the relation by basename across both trees, threshold-free:

| Counterpart status | Relations | Resolvable by deleting one side? |
|---|---:|---|
| byte-identical | 2 | yes |
| one side is a clean superset | 2 | no, but the merge direction is unambiguous |
| content unique to both sides (above threshold) | 7 | no |
| content unique to both sides (below threshold) | 1 | no |
| no counterpart in the other tree | 6 | not applicable |

Only **2 of 18** relations can be resolved by deleting a file. The claim that
`document-portal/ds/` is "a copy of" `styles/dgo-design-system/` does not survive the
evidence.

The single below-threshold counterpart is the clearest illustration. `colors_and_type.css`
exists in both trees under the same name, but at a similarity ratio of 0.548 it falls under
Phase 2's lowest band (0.60) and never appeared in any Phase 2 table:

| Pair | Ratio | Lines only in document-portal | Lines only in styles |
|---|---:|---:|---:|
| `colors_and_type.css` | 0.548 | 150 | 43 |

The two barrels are also architecturally different, which is why "merge them" is a refactor
and not a delete: `document-portal/ds/ds.css` is a flat `@import` barrel, while
`styles/index.css` builds a deterministic `@layer` cascade whose ordering was measured and
found not to be freely reorderable.

styles/index.css:1-5
$ sed -n '1,5p' styles/index.css
> /* DGO R11.6 — deterministic @layer cascade. Later layer wins.
>    `overrides` still holds two authorities (platform-authority.css, then app.css). Phase 1
>    attempted to give each its own sub-layer and MEASURED the result with
>    tests/tools/cascade-snapshot.mjs: no sub-layer order is behaviour-preserving.

The full census is in `docs/repository-hygiene/c2d78ba2ea23/04-design-system-census.tsv`;
per-pair line-level drift for all 30 duplicate relations is in
`docs/repository-hygiene/c2d78ba2ea23/04-fork-reconciliation.tsv`.

### H-04 — shipped source cites tooling that does not exist

7 of Phase 2's 39 stale references sit in code rather than documentation. These are the
subset that matter most, because a comment in shipped source that names a test asserts a
guarantee the repository cannot honour — the exact failure mode the CI module-graph job was
built to catch.

| File | Line | Cited but absent |
|---|---:|---|
| config/activity-parity.config.js | 50 | tests/activity-source-view-alignment-contract.mjs |
| core/endpoint-registry.js | 101 | evidence/ENDPOINT_CONTRACT_AUDIT.json |
| styles/app.css | 503 | evidence/SELECTOR_OWNERSHIP_REGISTRY.json |
| styles/dgo-design-system/colors_and_type.css | 50 | tests/baseline.json |
| styles/index.css | 5 | tests/tools/cascade-snapshot.mjs |
| styles/index.css | 15 | tests/static/css-contract.mjs |
| styles/index.css | 16 | tests/baseline.json |

config/activity-parity.config.js:50-50
$ sed -n '50p' config/activity-parity.config.js
> // Proven by tests/activity-source-view-alignment-contract.mjs.

The `styles/index.css` cluster is the sharpest case: the cascade comment quoted under H-03
cites a measurement tool, a contract test and a baseline file, and none of the three is in
the tree. The measurement may well have happened; the repository simply cannot re-run it.

### H-05 — the superseded directory is cited only from the undecided one

`docs/forensic/177d992/` declares itself superseded in its own README:

docs/forensic/177d992/README.md:1-1
$ sed -n '1p' docs/forensic/177d992/README.md
> # SUPERSEDED — prior audit target

The obvious conclusion — that it should therefore go — is not what the evidence says. The
same README states its retention rationale, and qualifies rather than forbids citation:

docs/forensic/177d992/README.md:9-11
$ sed -n '9,11p' docs/forensic/177d992/README.md
> Retained because the Phase 1 architecture analysis here was independent of the auditor's own
> changes and its central conclusions were re-verified at `18e9f4d`. It must not be cited as
> current-state evidence without checking against the authoritative directory.

So the directory is superseded, deliberately retained, and says so. What Phase 3 adds is the
part the README could not know: **who actually cites it**. Phase 1 recorded 2 incoming
references to `docs/forensic/177d992/01-architecture.md`, and *both come from inside
`docs/forensic/18e9f4d/`* — the very set H-07 cannot resolve.

| Referrer | In the H-07 unresolved set? |
|---|---|
| docs/forensic/18e9f4d/00-provenance.md | yes |
| docs/forensic/18e9f4d/01-architecture.md | yes |

The two directories hold each other up. The superseded one is kept reachable only by
citations from a directory that nothing else references, and the referencing directory's own
justification rests partly on the superseded one. Neither can be settled in isolation, which
is why R-05 is explicitly coupled to R-07 and is **not** a removal recommendation.

One of the four files, `docs/forensic/177d992/00-provenance.md`, is also an unbaselined
signature carrier from H-01, so this directory is on two lists at once. That part is
actionable today and does not wait for the ownership question.

### H-06 — documentation describes a layout that no longer exists

The other 32 stale references are in documentation. They divide cleanly:

| Referring file | Stale references |
|---|---:|
| AUDIT.md | 15 |
| CAPABILITY_ASSESSMENT_R11.6.md | 5 |
| FORENSIC_REPOSITORY_AUDIT.md | 4 |
| REPOSITORY_AUDIT.md | 2 |
| docs/forensic/177d992/00-provenance.md | 2 |
| docs/forensic/177d992/01-architecture.md | 2 |
| docs/forensic/18e9f4d/00-provenance.md | 1 |
| docs/forensic/177d992/diagrams/01-architecture.mmd | 1 |

They name a pre-consolidation layout — `ECM_ActivityHub_Portal/htdocs/`,
`document-portal_Central_NITDA_/`, `reference-portal/`, `experience/` and dated audit output
directories — that Phase 2 confirmed is absent from the working tree, from the git-ignore
rules, and from inside the tracked archive.

Most of these files are dated audit records. Rewriting an audit record to match a later
layout is not obviously correct, which is why R-06 offers dating as an equal alternative to
correction and does not recommend deletion.

### H-07 — unreferenced is not unnecessary

10 files have no incoming tracked reference and no duplicate or supersession signal:
the nine files of `docs/forensic/18e9f4d/` and `document-portal/README.md`, totalling
118,110 bytes.

Phase 2 declined to convert *unreferenced* into *unnecessary*, and Phase 3 does not overturn
that. Nothing in the evidence distinguishes "a current audit record that simply is not
linked" from "a leftover". That distinction requires an owner, so R-07 asks a question
rather than proposing a removal.

### H-08 — two files are byte-identical today and can disagree tomorrow

`tokens.component.css` and `tokens.density.css` are byte-identical across the two trees:
4 files, 7,071 redundant bytes. Both copies are `asset-referenced`, so neither is dead.

The cost is not the bytes. It is that these two are the only pairs in the design system that
currently agree, and any single-sided edit silently moves them into the H-03 population.

## Recommendations

Priority is assigned on a fixed rule, not on judgement:

- **P1** — the repository currently makes a false or unsafe claim about itself.
- **P2** — correctness of the tree; deferring lets divergence grow.
- **P3** — weight and clarity; gated on a prerequisite.
- **P4** — needs an owner decision or another recommendation to land first.

| ID | Priority | Finding | Action | Prerequisite | Verification |
|---|---|---|---|---|---|
| R-01 | P1 | H-01 | Rotate every signature reachable from the tree, then reconcile `tests/secrets-baseline.txt` | Rotation in Power Automate | `node tests/check-secrets.mjs` |
| R-02 | P2 | H-02 | Decouple tooling from `ECM_DOCS_DEV.zip`, then untrack it and publish out-of-band | R-01, plus 2 blockers | `node tests/check-secrets.mjs && node scripts/setup-local.mjs --force` |
| R-03 | P2 | H-03 | Pick one design-system tree as source of truth; reconcile two-way drift first | Per-counterpart diff review | `npm run test:smoke` |
| R-04 | P2 | H-04 | Add the cited tooling, or delete the claim | none | `node tests/check-imports.mjs && node tests/governance.test.mjs` |
| R-05 | P3 | H-05 | Rotate the carrier inside `docs/forensic/177d992/`, then settle the directory jointly with R-07 | R-01, coupled to R-07 | `node tests/check-secrets.mjs && npm run test:links` |
| R-06 | P3 | H-06 | Correct the documented layout, or date the documents as historical | none | `npm run test:links` |
| R-07 | P4 | H-07 | Ask the owner whether the unreferenced set is still wanted; record the answer | owner decision | `node tests/check-imports.mjs` |
| R-08 | P4 | H-08 | Fold the two identical token sheets into the tree chosen in R-03 | R-03 | `npm run test:smoke` |

Full fields — risk if done, risk if deferred, blast radius, reversibility and per-item notes
— are in `docs/repository-hygiene/c2d78ba2ea23/04-recommendations.tsv`.

### Ordering constraints

The dependencies are not stylistic; each one exists because doing the work out of order
produces a worse outcome than not doing it.

```
R-01 (rotate)
  ├── R-02 (untrack the archive)   — removing a carrier before rotation revokes nothing
  └── R-05 (rotate the superseded  — same reason; one of its files is a carrier
            directory's carrier)
                └── coupled to R-07 (owner decision) — R-05's only citations live there,
                                                       and neither resolves alone

R-03 (choose one design system)
  └── R-08 (fold the identical sheets into it)

R-04, R-06 — independent, no prerequisites
```

**R-01 first, and it is not a code change.** R-02 deletes a file that still holds valid
credentials; a deleted file remains readable in Git history and in the tracked archive.
Doing R-02 before R-01 produces a tidier tree and exactly the same exposure, while removing
the evidence needed to know what to rotate.

**R-05 and R-07 are a single decision, not two.** The superseded directory is reachable only
from the unresolved one, and the unresolved one cites the superseded one. Resolving either
alone either breaks a citation or strands a directory. The credential half of R-05 is
separable and can be done immediately under R-01.

**R-04 and R-06 have no prerequisites and no runtime risk** — they are comment and
documentation edits. If only one item is actioned from this phase, R-04 is the cheapest
thing on the list with a real correctness payoff.

## Per-file dispositions

Every one of the 294 scoped files carries exactly one disposition.

| Phase 3 disposition | Files | Meaning |
|---|---:|---|
| keep-as-is | 248 | No finding attaches to this file |
| reconcile-two-way-drift | 18 | A counterpart exists and both sides hold unique content |
| correct-stale-claim | 9 | Carries an outbound reference that resolves nowhere |
| owner-decision-required | 9 | Unreferenced with no signal resolving currency |
| consolidate-into-single-source | 4 | Byte-identical to a counterpart |
| rotate-then-decide-jointly | 3 | Inside the self-declared superseded directory |
| rotate-then-remove-carrier | 2 | Unbaselined signature carrier failing the gate |
| rotate-decouple-then-untrack | 1 | The tracked archive |

Total: 294. Per-file rows with reachability, Phase 2 verdict, disposition, the
recommendation IDs that touch the file and the signals behind it are in
`docs/repository-hygiene/c2d78ba2ea23/04-file-dispositions.tsv`.

Dispositions are assigned by first-match rule, strongest first, so a file that is both a
signature carrier and inside the superseded directory
(`docs/forensic/177d992/00-provenance.md`) is dispositioned on the credential, not the
obsolescence — but it appears in the target lists of both R-01 and R-05. That is why the
disposition counts for the superseded directory (3) and the unreferenced set (9) are each
one lower than the corresponding Phase 2 verdict counts (4 and 10).

## What Phase 3 would recover, and what it would not

| | Bytes | Share of tracked |
|---|---:|---:|
| Recommended for removal once prerequisites are met (R-02) | 16,783,981 | 88.0% |
| Awaiting a decision, not recommended for removal (R-05 + R-07) | 158,389 | 0.8% |
| Exact redundancy removable without judgement (R-08) | 7,071 | 0.04% |

Effectively all recoverable weight is one file. The other seven recommendations are worth
doing for correctness, not for size, and the report would say the same thing if they saved
nothing at all.

Only **one** of the eight recommendations proposes removing anything, and it is conditional
on two prerequisites. That is the honest shape of this repository's hygiene problem: it is
not carrying much dead weight, it is carrying unrotated credentials, a forked design system
and a set of claims it cannot substantiate.

## Notes and limits

- `findings-recommendations.json` carries every finding, recommendation, disposition,
  blocker, carrier and counterpart relation for all 294 scoped files.
- Priority is derived from a fixed rule stated above, not tuned to produce a preferred
  ordering. Severity and priority are separate: H-03 is `high` severity but P2, because
  nothing about it is unsafe — it is expensive.
- Every removal recommendation is stated conditionally, with the prerequisite that makes it
  safe. None is an instruction to delete.
- Verification commands are existing repository scripts. Phase 3 introduces no new test,
  linter or tool.
- `sig=` values are redacted in every generated artifact; only counts are published. Phase 3
  introduced no new signature-bearing file, and `node tests/check-secrets.mjs` fails on
  exactly the two pre-existing files named in H-01, as it did before Phase 3.
- Blocker and mention counts are computed over the Phase 0 scope; the 397 additional
  mentions inside the hygiene artifacts themselves are excluded and reported separately.
- Phase 3 closes the analysis. Executing any recommendation is a separate change, gated on
  acceptance of this report and — for R-01, R-02, R-05 and R-07 — on decisions that only the
  repository owner can make.
