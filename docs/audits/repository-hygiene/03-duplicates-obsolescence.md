# Phase 2 duplicate and obsolescence analysis

Scope commit short SHA: **c2d78ba2ea23**
Tracked files analyzed: **294** (text: 286, scope-integrity mismatches: 0)
Duplicate relations detected: **2 exact group(s)**, **28 near-duplicate pair(s)**

Phase 2 answers three questions and nothing else: what is duplicated, what is
obsolete, and what evidence supports each claim. No file is deleted, moved or edited,
and no cleanup recommendation is issued — that is Phase 3.

## Evidence for the Phase 2 analysis command

docs/repository-hygiene/c2d78ba2ea23/03-duplicate-analysis.log:1-11
> $ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> > scope_commit=c2d78ba2ea23 tracked_files=294 text_files=286 scope_integrity_mismatches=0
> > exact_groups=2 exact_files=4 redundant_bytes=7071
> > near_pairs=28 divergent=8 partial_fork=1 shared_lineage=19
> > archive_members=837 identical_to_tracked=228 member_to_path_rows=240 same_path_divergent=58 archive_only=551
> > marker_hits=8 self_declared=1 superseded_dirs=1
> > path_reference_anomalies=590 stale=39 git_ignored_by_design=32 resolves_under_ancestor=458 resolves_under_another_tree=47 ambiguous_suffix=0 resolves_inside_archive=14
> > archive_reference_recheck archive=ECM_DOCS_DEV.zip literal_mentions=52 referencing_files=18 phase0_claim=CORRECTED
> > similarity thresholds: divergent-copy >=0.90, partial-fork >=0.75, shared-lineage >=0.60 on normalized non-blank lines
> > rejected heuristic: 'legacy-bridge' marker - every hit named the tracked, live file styles/dgo-design-system/tokens/tokens.legacy-bridge.css
> > sig= values are redacted in all generated evidence

### Scope integrity

All 294 files inventoried in Phase 0 were re-hashed before analysis; 0 differ from their recorded sha256. Phase 0, Phase 1 and
Phase 2 therefore describe the same bytes, even though the commits that carry the Phase 0
and Phase 1 outputs sit on top of the scope commit.

## Phase 2 verdict distribution

| Phase 2 verdict | File count | Confidence |
|---|---:|---|
| no-duplicate-or-obsolescence-signal | 248 | high |
| duplicate-divergent | 16 | medium |
| unreferenced-review | 10 | low |
| stale-content-review | 9 | low |
| duplicate-exact | 4 | high |
| obsolete-superseded | 4 | high |
| partial-fork-review | 2 | low |
| load-bearing-archive | 1 | high |

Total: 294 files. Per-file rows, signals and confidence are in
`docs/repository-hygiene/c2d78ba2ea23/03-verdicts.tsv`.

## 1. Exact duplicates (byte-identical tracked files)

2 sha256 group(s) contain more than one tracked path, covering
4 files and 7,071 redundant bytes.

| sha256 (first 12) | Bytes | Members | Trees | Phase 1 reachability |
|---|---:|---|---|---|
| `9fc3ded4c280` | 1,285 | document-portal/ds/tokens/tokens.density.css<br>styles/dgo-design-system/tokens/tokens.density.css | document-portal + styles | asset-referenced |
| `d94ae4a79888` | 5,786 | document-portal/ds/tokens/tokens.component.css<br>styles/dgo-design-system/tokens/tokens.component.css | document-portal + styles | asset-referenced |

Both groups are design-system token sheets duplicated across the `styles/` and
`document-portal/` trees. Both copies are `asset-referenced` in Phase 1, so neither is
dead — they are two live copies of one source of truth.

docs/repository-hygiene/c2d78ba2ea23/03-exact-duplicates.tsv:2-3
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> 9fc3ded4c2802878c7292f08233a98e54def2c43ef016c3873b841bb1dfd7d8a	document-portal/ds/tokens/tokens.density.css | styles/dgo-design-system/tokens/tokens.density.css
> d94ae4a79888097afb71a4ffe5433a115b04b8d720ef0ecbeea76823fa327d35	document-portal/ds/tokens/tokens.component.css | styles/dgo-design-system/tokens/tokens.component.css

## 2. Near-duplicates and forks

Similarity is computed on normalized non-blank lines: Jaccard over the line sets as a
prefilter, then a `difflib` sequence ratio. Thresholds are fixed in advance —
`divergent-copy` at 0.90, `partial-fork` at 0.75, `shared-lineage` at 0.60.

| Relation | Pair count |
|---|---:|
| divergent-copy (>=0.90) | 8 |
| partial-fork (>=0.75) | 1 |
| shared-lineage (>=0.60) | 19 |

### Divergent copies and partial forks

| Similarity | Relation | File A | File B | Shared lines |
|---:|---|---|---|---:|
| 0.993 | divergent-copy | document-portal/ds/tokens/tokens.primitive.css | styles/dgo-design-system/tokens/tokens.primitive.css | 222 |
| 0.989 | divergent-copy | document-portal/ds/styles/layout.css | styles/dgo-design-system/layout.css | 68 |
| 0.986 | divergent-copy | document-portal/ds/styles/reset.css | styles/dgo-design-system/reset.css | 32 |
| 0.971 | divergent-copy | document-portal/ds/tokens/tokens.theme-light.css | styles/dgo-design-system/tokens/tokens.theme-light.css | 17 |
| 0.953 | divergent-copy | document-portal/ds/styles/components.css | styles/dgo-design-system/components.css | 599 |
| 0.941 | divergent-copy | document-portal/ds/tokens/tokens.semantic.css | styles/dgo-design-system/tokens/tokens.semantic.css | 119 |
| 0.929 | divergent-copy | document-portal/ds/styles/base.css | styles/dgo-design-system/base.css | 97 |
| 0.908 | divergent-copy | document-portal/ds/tokens/tokens.theme-hc.css | styles/dgo-design-system/tokens/tokens.theme-hc.css | 63 |
| 0.838 | partial-fork | document-portal/ds/tokens/tokens.theme-dark.css | styles/dgo-design-system/tokens/tokens.theme-dark.css | 67 |

Every one of these pairs is the same relation: the root design system under
`styles/dgo-design-system/` and the portal design system under `document-portal/ds/`
are a single design system maintained as two copies that have drifted apart. Combined
with the 4 byte-identical token sheets in section 1, 22 files across the two trees
are copies of one another at 0.75 similarity or better.

document-portal/ds/tokens/tokens.primitive.css:2-2
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> DGO Design System v2.0 — Primitive Tokens

### Shared lineage

19 pairs score between 0.60 and 0.75. All but one are
`ECM_ActivityHub_Portal/js/views/pages/*.js` list-page views that share a common render
skeleton; the remaining pair is `document-portal/submit.html` against
`document-portal/track.html`. This band is reported as a template pattern, **not** as
duplication to remove — a shared page skeleton across sibling views is a normal outcome
of a single UI convention.
Full pair list: `docs/repository-hygiene/c2d78ba2ea23/03-near-duplicates.tsv`.

## 3. Tracked archive redundancy

| Measure | Value |
|---|---:|
| Archive | `ECM_DOCS_DEV.zip` |
| Size (bytes) | 16,783,981 |
| Members | 837 |
| Members byte-identical to a tracked file | 228 |
| Member-to-tracked-path rows | 240 |
| Distinct tracked paths covered | 189 |
| Members at a tracked path but with different bytes | 58 |
| Members with no counterpart in the tree | 551 |
| Unreadable members | 0 |

### Reconciliation with the Phase 0 count

Phase 0 recorded 240 duplicate hits; Phase 2 counts
228 distinct members. The difference is not a
disagreement: 12 members hash to a sha256 that two tracked paths share (the two exact
duplicate groups in section 1), so Phase 0's member-to-path table emits two rows for each. 228 + 12 = 240.

So 189 of the 294 tracked files (64%) exist a second time,
byte for byte, inside the archive.

### The archive is not a stale snapshot only

58 members sit at a path that also exists in the tree but
carry different bytes — the archive is a *fork* of the working tree, not merely a copy of
it. Divergence by tree:

| Tracked path root | Divergent members |
|---|---:|
| `modules` | 17 |
| `document-portal` | 14 |
| `ECM_ActivityHub_Portal` | 7 |
| `core` | 5 |
| `newack` | 3 |
| `shared` | 3 |
| `styles` | 2 |
| `AUDIT.md` | 1 |
| `CONTRIBUTING.md` | 1 |
| `README.md` | 1 |
| `index.html` | 1 |
| `package.json` | 1 |
| `playwright.config.js` | 1 |
| `scripts` | 1 |

Per-member sha256 pairs: `docs/repository-hygiene/c2d78ba2ea23/03-archive-divergent-members.tsv`.

### Correction to a Phase 0 negative claim

Phase 0 recorded the archive as having
"no direct build/deploy reference found in package/scripts/proxy/config search". Phase 2 re-ran that question over every tracked text file and
**CORRECTED** it: the archive is named 52 times
across 18 tracked files, and one of those references is a
runtime read, not a mention.

scripts/setup-local.mjs:26-26
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> const ARCHIVE = path.join(ROOT, 'ECM_DOCS_DEV.zip');

`scripts/setup-local.mjs` unzips a member of the archive to generate local runtime
configuration, and that member is one of the
551 that exist nowhere else in the tree. The archive is therefore
classified `load-bearing-archive`, not `redundant-archive`: nothing can be concluded about
removing it without first addressing the setup path that depends on it.

scripts/setup-local.mjs:27-27
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> const MANIFEST = 'DGO_Targets_References/NITDA_operations_manifest_ai_ready_UNREDACTED-1.json';

Every mention with its classification: `docs/repository-hygiene/c2d78ba2ea23/03-archive-references.tsv`.

## 4. Obsolescence

### Self-declared supersession

8 marker hits were found. 2 of them sit in a
file's own leading header and so declare that file stale; they belong to
1 file, a `README` — and a `README` that declares itself
superseded supersedes its whole directory.

docs/forensic/177d992/README.md:1-1
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> # SUPERSEDED — prior audit target

docs/forensic/177d992/README.md:10-10
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> changes and its central conclusions were re-verified at `18e9f4d`. It must not be cited as

| Directory declared superseded | Declaring evidence | Files affected |
|---|---|---:|
| `docs/forensic/177d992/` | `docs/forensic/177d992/README.md:1-1` | 4 |

All 4 files under
that directory carry the `obsolete-superseded` verdict at high confidence. This is the only
verdict in Phase 2 grounded in the repository's own explicit statement rather than in
inference.

### Assertions about other artifacts

Markers found anywhere other than a file's own header are treated as claims *about*
something else, and only change a verdict when the subject resolves to a tracked path.

| Path | Line | Kind | Direction | Drives verdict | Subject |
|---|---:|---|---|---|---|
| FORENSIC_REPOSITORY_AUDIT.md | 243 | explicit-supersession | asserted-about-other | yes | ECM_DOCS_DEV.zip |
| docs/forensic/177d992/00-provenance.md | 90 | explicit-deletion-note | asserted-about-other | no | (none) |
| docs/forensic/177d992/01-architecture.md | 266 | explicit-deletion-note | asserted-about-other | no | (none) |
| docs/forensic/177d992/README.md | 1 | explicit-supersession | self-declared | yes | (none) |
| docs/forensic/177d992/README.md | 10 | explicit-stale | self-declared | yes | (none) |
| document-portal/js/submit.js | 262 | explicit-deletion-note | asserted-about-other | no | (none) |
| document-portal/js/track.js | 259 | explicit-supersession | asserted-about-other | no | (none) |
| styles/dgo-design-system/tokens/tokens.legacy-bridge.css | 3 | explicit-deletion-note | asserted-about-other | no | (none) |

The hits that drive nothing are recorded deliberately: two are user-interface copy
(`document-portal/js/track.js`, `document-portal/js/submit.js`) and two are historical
notes inside the already-superseded forensic directory. Reporting them and marking them
inert is more honest than filtering them out of the table.

A `legacy-bridge` marker was evaluated and **rejected**: every hit named the tracked, live
file `styles/dgo-design-system/tokens/tokens.legacy-bridge.css`, so the pattern measured
a filename, not staleness.

## 5. Stale outbound references

590 path-like tokens in tracked text do not resolve as written.
Resolution is deliberately generous, so that whatever survives as `stale-reference` is a
strong negative rather than an artifact of how the path was written:

| Classification | Hits | Meaning |
|---|---:|---|
| resolves-under-ancestor | 458 | resolves against a parent directory of the referring file |
| resolves-under-another-tree | 47 | unique path suffix of exactly one tracked file |
| ambiguous-suffix-match | 0 | suffix of more than one tracked file |
| git-ignored-by-design | 32 | matched a `.gitignore` pattern, so absence is intended |
| resolves-inside-tracked-archive | 14 | exists only inside `ECM_DOCS_DEV.zip` |
| **stale-reference** | **39** | **no counterpart anywhere in scope** |

39 stale references remain, spread over 13 files.

| Referring file | Stale references |
|---|---:|
| AUDIT.md | 15 |
| CAPABILITY_ASSESSMENT_R11.6.md | 5 |
| FORENSIC_REPOSITORY_AUDIT.md | 4 |
| styles/index.css | 3 |
| REPOSITORY_AUDIT.md | 2 |
| docs/forensic/177d992/00-provenance.md | 2 |
| docs/forensic/177d992/01-architecture.md | 2 |
| config/activity-parity.config.js | 1 |
| core/endpoint-registry.js | 1 |
| docs/forensic/177d992/diagrams/01-architecture.mmd | 1 |
| docs/forensic/18e9f4d/00-provenance.md | 1 |
| styles/app.css | 1 |
| styles/dgo-design-system/colors_and_type.css | 1 |

They fall into two groups. The first is a pre-consolidation directory layout that the
documentation still describes — `ECM_ActivityHub_Portal/htdocs/`,
`document-portal_Central_NITDA_/`, `reference-portal/`, `experience/` and dated audit
output directories. The second is test and evidence tooling referenced from live source
comments that was never committed.

AUDIT.md:87-87
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> | F-001 | Client-side asserted identity/role used for backend action envelope | Critical | `ECM_ActivityHub_Portal/htdocs/js/core/store.js` | 5-6 | Production identity (`dgceo@nitda.gov.ng`, role `DGC

config/activity-parity.config.js:50-50
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> // Proven by tests/activity-source-view-alignment-contract.mjs.

core/endpoint-registry.js:101-101
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> message: `${packaged.length} endpoint(s) still resolve to packaged signed URLs. Inject ${MANIFEST_GLOBAL} at deployment time or move to the endpoint broker; see evidence/ENDPOINT_CONTRACT_AUDIT.json f

styles/app.css:503-503
$ python3 Phase 2 duplicate/obsolescence analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json and reference-graph.json using sha256 grouping, normalized-line Jaccard plus difflib similarity, ZIP member hashing, and supersession/dangling-reference scans
> evidence/SELECTOR_OWNERSHIP_REGISTRY.json and asserted by typography-floor-contract. */

The second group matters more than the first: a comment in shipped source that cites a
test which does not exist asserts a guarantee the repository cannot honour. Both groups
are enumerated in `docs/repository-hygiene/c2d78ba2ea23/03-stale-references.tsv`.

## 6. Unreferenced files carried forward from Phase 1

10 of the 13 files Phase 1 could not reach still have no incoming tracked
reference and no duplicate or supersession signal. The other three moved to
`obsolete-superseded` because they sit inside the superseded forensic directory.

| Path | Phase 1 reachability |
|---|---|
| docs/forensic/18e9f4d/00-provenance.md | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/01-architecture.md | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/03-build-deploy.md | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/04-report.md | unreferenced-obsolete-candidate |
| docs/forensic/18e9f4d/diagrams/01-architecture.mmd | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/diagrams/02-trust-boundaries.mmd | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/diagrams/03-build-deploy.mmd | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/diagrams/04-fork-comparison.mmd | unreferenced-but-plausibly-current |
| docs/forensic/18e9f4d/findings.json | unreferenced-but-plausibly-current |
| document-portal/README.md | unreferenced-but-plausibly-current |

Phase 2 adds no removal claim for these. Being unreferenced is not the same as being
unnecessary, and nothing in the duplicate or obsolescence evidence resolves the
difference for this set.

## Notes and limits

- `duplicate-obsolescence.json` carries every group, pair, marker, reference anomaly and
  per-file verdict for all 294 scoped files.
- Similarity thresholds are fixed constants, not tuned to the result; the raw ratios are
  published so any threshold can be re-applied.
- Negative claims stay conservative. A file is only called obsolete where the repository
  says so itself, or where a tracked file names it as such.
- Binary members inside the archive are compared by sha256 only; no attempt is made to
  judge whether two differing binaries are semantically equivalent.
- Path extraction is lexical, so a compound label can look like a path. One of the
  39 stale hits is a Mermaid node label
  (`docs/forensic/177d992/diagrams/01-architecture.mmd:73`) that enumerates six pages in
  one string rather than naming a single file. It is left in the table rather than
  silently dropped, and it is the only hit of that shape.
- `sig=` values are redacted in every generated artifact. Phase 2 introduced no new
  signature-bearing file; `node tests/check-secrets.mjs` fails only on the two
  pre-existing `docs/forensic/*/00-provenance.md` files, exactly as it did before Phase 2.
- Phase 3 findings and cleanup recommendations remain out of scope until the Phase 2 gate
  is accepted. Nothing here should be read as an instruction to delete anything.
