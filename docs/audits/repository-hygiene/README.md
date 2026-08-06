# Repository hygiene audit — `c2d78ba2ea23`, 2 August 2026

The narrative half of a machine-assisted hygiene audit that ran against commit
`c2d78ba2ea2380e6c2a0355c9322bf8e8c669e3e`. Five documents, in phase order:

| | |
|---|---|
| [`00-provenance.md`](./00-provenance.md) | The commit examined, and proof the tree was clean when it was |
| [`01-inventory.md`](./01-inventory.md) | Every tracked file, classified |
| [`02-reference-graph.md`](./02-reference-graph.md) | What refers to what, and what refers to nothing |
| [`03-duplicates-obsolescence.md`](./03-duplicates-obsolescence.md) | Exact and near duplicates, obsolescence markers |
| [`04-findings-recommendations.md`](./04-findings-recommendations.md) | The findings, with recommended dispositions |

## What is deliberately not here

The audit also produced about 63,000 lines of raw machine output — `.tsv` disposition
tables, `.log` run traces, a 460 KB `duplicate-obsolescence.json`, and a 1.2 MB
`reference-graph.json`. **None of it was brought across.** It is bulk evidence for
conclusions that are stated in full in the five documents above, it describes a tree
that no longer exists, and it would have added more weight to `docs/` than the entire
reference corpus retains after the trim.

It remains in git history on the `archive/repo-hygiene-audit` branch, at
`docs/repository-hygiene/c2d78ba2ea23/`. Recover it from there, or from the archive
tag, if a finding is ever disputed.

Nothing else from that branch was taken. Merging it wholesale would have restored the
retired `ECM_ActivityHub_Portal/` tree and pre-remediation credential blobs — the
branch is 72 commits behind and predates the secret remediation, so its idea of a
clean tree is not the current one.

## How to read it

As a **record**, not as instructions. It states what was true of one commit on one day.
Most of what it recommends has since been done — by this consolidation among other
work — and several of its largest findings, particularly around duplicate reference
material and root-directory sprawl, were the direct input to it.

Where it and the present tree disagree, the tree is right. Where a finding is still
open, it is listed in [`../INDEX.md`](../INDEX.md), which is the register that is
maintained. Only **G-03** and **G-04** remain open, and neither can be closed from
inside this repository.
