# `docs/` — index

Everything this repository writes down, other than the four markdown files at its
root ([`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md),
[`PLATFORM_DOCUMENTATION.md`](../PLATFORM_DOCUMENTATION.md), `LICENSE`).

Four kinds of document live here, and they are not interchangeable.

| | Kind | Read it as | Where |
|---|---|---|---|
| **Specification** | What the system must do | Binding. Change the code to match, or change this and say why | `architecture/`, `reference/flow-contracts/` |
| **Procedure** | What you must do | Binding while you are doing it | `deployment/`, `cutover/` |
| **Record** | What was true on a date | Historical. Never edit to make it agree with the present | `audits/`, `forensic/` |
| **Harvest** | Raw material, kept for evidence | Untrusted. Prefer the contract over the sample | `reference/foundational/` |

## Specifications

- [`architecture/TARGET_ARCHITECTURE.md`](./architecture/TARGET_ARCHITECTURE.md) — where the platform is going
- [`architecture/AUTHENTICATION_CONTRACT.md`](./architecture/AUTHENTICATION_CONTRACT.md) — the activation spec, and the seven server-side obligations that belong to the Power Automate flows. This is the open half of **G-04**
- [`reference/README.md`](./reference/README.md) — how `flow-contracts/` (contract of record) relates to `foundational/` (raw harvest). Read this before citing a file from either

## Procedures

- [`deployment/COMMISSIONING.md`](./deployment/COMMISSIONING.md) — what stands between this repository and a live deployment. `npm run commission` checks it mechanically
- [`deployment/MINIMAL-PILOT.md`](./deployment/MINIMAL-PILOT.md) — the smallest real deployment, including the **G-03** signature rotation
- [`deployment/FLOW-BUILD-PLAN.md`](./deployment/FLOW-BUILD-PLAN.md) — building the flows that discharge the authentication contract
- [`deployment/LOCAL-DEV.md`](./deployment/LOCAL-DEV.md) — `npm run dev`: a local server that stands in for the flow estate, so you can exercise both apps end to end without a tenant
- [`cutover/`](./cutover/) — migration sequencing and [`ARCHIVE_DISPOSITION.md`](./cutover/ARCHIVE_DISPOSITION.md), the rule that governs what this repository keeps: **contracts are kept, recorded executions are not**

## Records

- [`STATUS_REPORT.md`](./STATUS_REPORT.md) — position and finding register, written at a date
- [`audits/INDEX.md`](./audits/INDEX.md) — the eight audit documents, their supersession chain, and the two findings that remain open
- [`forensic/dd2e909/`](./forensic/) — a forensic snapshot of one commit. **Deliberately not rewritten** by later reorganisations; correcting its paths would falsify it
- [`visual/`](./visual/README.md) — generated architecture and status console, drift-tested by `npm run test:visual`. Where it and a written document disagree, it is right

## Harvest

- [`reference/foundational/`](./reference/foundational/) — the estate as harvested: flow definitions, trigger schemas, list and canvas exports, one response sample per flow as a shape exemplar. The multi-megabyte run records were removed; [`reference/foundational/flows/run-records/README.md`](./reference/foundational/flows/run-records/README.md) records what went and why
- [`policies/universal-filename-policy/`](./policies/universal-filename-policy/) — the policy deliverables. The policy itself is enforced by `tests/filename-policy.test.mjs`

## Two constraints on anything you add here

1. **Paths are length-limited.** `tests/package-portability.test.mjs` enforces the shortened, Windows-safe paths. If a path is too long, shorten it — do not restore the long form.
2. **No new signed URLs.** `tests/check-secrets.mjs` holds the count of files carrying live Power Automate SAS signatures at the baseline in `tests/secrets-baseline.txt`, which may only shrink. Adding one fails the build.
