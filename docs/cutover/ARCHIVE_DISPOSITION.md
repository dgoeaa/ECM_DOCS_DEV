# `ECM_DOCS_DEV.zip` — disposition

**Status: SETTLED — option B carried out.** The archive was removed from the working tree
after its irreplaceable content was extracted. What follows is the analysis that led there,
kept because the reasoning matters more than the outcome.

## What was done

Extracted to `docs/reference/`, all verified secret-free before committing:

| Now at | Was |
|---|---|
| `business_requirements_functional_requirements_hybrid.txt` | the BRD/FRD baseline |
| `platform-architecture-pack/` (18 documents) | the governance baseline |
| `sharepoint-provisioning-spec.json` | 10 lists, 97 fields, with SchemaXml |
| `data-model-architecture.md` | the DGCEO data model |
| `flow-contracts/` (14 files) | trigger schemas and full definitions |
| `operations-manifest.json` | the manifest, with 36 signed URLs redacted |

Discarded rather than extracted, with reasons:

- `DGO_Targets_Platform/` — an older copy of this repository, including the retired ECM
  Activity Hub. Superseded in full.
- `Consolidated_Design_System_References/` (14 MB) — already implemented in `styles/`.
- `HTML_OPS_Standard_Email_Templates/` — already implemented in
  `config/correspondence-email-templates.config.js`.
- Flow **run records** — these were where the signed URLs lived. The flow *contracts* were
  kept; the recorded executions were not.

Tracked size went from 20 MB to 3.9 MB. `tests/secret-exposure.test.mjs` and
`tests/check-secrets.mjs` now both assert zero, and both caught the change themselves rather
than needing to be told.

**This revoked nothing.** The blob is still in git history and every signed trigger URL still
works. Rotation is `docs/deployment/MINIMAL-PILOT.md` §3a and remains outstanding.

---

## The original analysis

**Status when written:** open, awaiting an owner decision
**Subject:** one tracked file, 16.7 MB, 838 entries, 76 MB expanded

## What was assumed, and what is actually true

This archive was carried on the outstanding list as an orphan — a stale snapshot to be
deleted once someone confirmed it was redundant. That assumption was wrong in both
directions, and both corrections matter.

**It is not redundant.** Its `DGO_Targets_References/` tree is the *sole* copy of material
that exists nowhere else in this repository and nowhere in its git history:

| Content | Why it matters |
|---|---|
| Business Requirements Document / Functional Requirements Document hybrid (29 KB) | The requirements baseline this platform implements. Nothing else in the repository states what was asked for. |
| `platform-architecture-pack/` — 18 documents | `ARCHITECTURE_DECISIONS`, `FLOW_CONTRACT`, `MODULE_CONTRACT`, `SECURITY_GOVERNANCE`, `TESTING_PLAN`, `RISK_REGISTER`, `RELEASE_CHECKLIST`, `OPERATIONS_RUNBOOK` and more — the governance baseline. |
| `Flows/Flow/…` full definitions, trigger input schemas, run records | The actual contract of the flows task #9 must decommission and replace. |
| `NITDA_operations_manifest_ai_ready_UNREDACTED-1.json` (187 KB) | Endpoint registry, function registry, call sites, app state, API contract. |
| `HTML_OPS_Standard_Email_Templates/` | The template library the correspondence email desk was derived from. |
| `Consolidated_Design_System_References/` state files | Design-token provenance. |

The other reference trees that were removed from the working tree in earlier steps
(`newack/`, `Flows_Sample/`, `CLient_Proxy_App_Backend/`, `Bespoke platform welcome
experience/`, `Consolidate_Merged_Folder_Files_Embed/`, `document-portal_Central_NITDA_/`,
`ECM_ActivityHub_Portal/`) **are** recoverable from git history. The material listed above is
not. Deleting this archive would destroy the requirements baseline.

**It is also the repository's entire remaining credential exposure.** `node
scripts/flow-inventory.mjs` reports 25 workflows with a full signed (`sig=`) Power Automate
trigger URL in tracked files, and every one of them is inside this archive. The rest of the
tracked tree is clean: `config/endpoints.config.js` holds no URLs, the real ones live in
git-ignored `config/config.local.js`, and the one `sig=` in a tracked document is a
ten-character elided fragment, not a token.

Only **8** of those 25 workflows are wired by the current working configuration. The other
17 are still deployed, still hold valid trigger URLs, and would be missed entirely by a
decommission checklist derived from the platform's configuration. See
[`FLOW_DECOMMISSION_INVENTORY.md`](./FLOW_DECOMMISSION_INVENTORY.md).

## The one thing none of the options below achieves

**Deleting the file does not revoke anything, and neither does rewriting history.** A signed
trigger URL is a bearer credential; it stays valid until the trigger is regenerated in Power
Automate. Any option chosen here is about limiting further distribution. Revocation is a
separate, owner-side action, and it is the only one that actually closes the exposure.

The standing position on this repository is that these endpoints are development and pilot
only and will be replaced wholesale before release. That position makes rotation *scheduled*
rather than *urgent* — but it does not make it optional, and it does not survive the flows
being forgotten, which is exactly what happens to the 17 that no configuration references.

## Options

### A — Extract the irreplaceable material, keep the archive tracked *(partially done)*

The secret-free, uniquely-held governance material has already been extracted to
`docs/reference/` in readable, diffable form: the 18-document architecture pack and the
BRD/FRD hybrid. The archive stays where it is; the guard test in
`tests/secret-exposure.test.mjs` pins its exposure at exactly 25 workflows so it cannot grow
or be forgotten.

- **Gains:** the requirements and governance baseline become reviewable instead of being
  locked in a binary. No history rewrite, no broken clones.
- **Costs:** 16.7 MB and 25 live credentials remain at `HEAD`. Anyone who can clone gets them.

### B — A, then extract the remaining reference material and remove the archive **(recommended)**

Continue: unpack the flow definitions and trigger schemas (redacting the `sig` values, which
are useless in a contract document anyway), the operations manifest, and the email template
library. Then `git rm ECM_DOCS_DEV.zip`.

- **Gains:** everything of value survives in reviewable form; `HEAD` stops publishing 25
  credentials; the checkout shrinks by 16.7 MB.
- **Costs:** a substantial extraction (≈150 files) with a redaction pass that must be
  verified file by file. The blob stays in history, so clone size is unchanged and the
  credentials remain retrievable by anyone who looks — which is why this must be paired with
  rotation, not treated as a substitute for it.

### C — B, then rewrite history to purge the blob

`git filter-repo` (or BFG) to strip the archive from every commit, then force-push.

- **Gains:** the only option that removes the blob and the credentials from the repository
  itself. Clone size drops by ~17 MB permanently.
- **Costs:** every existing clone breaks and must be re-cloned; open PR refs and any fork
  are invalidated; the commit hashes in `docs/forensic/dd2e909/` and every audit document
  that cites a SHA become wrong. **And it still does not revoke a single credential.**

### D — Leave it

- **Gains:** none.
- **Costs:** the requirements baseline stays locked in a binary nobody opens, and 25 live
  flow credentials stay published at `HEAD` with nothing recording that they are there.

## Recommendation

**B**, executed in that order, with rotation tracked as the real remediation.

The reasoning is that A alone leaves credentials at `HEAD` for no benefit once the content
has been extracted, and C spends a great deal of coordination cost — broken clones,
invalidated audit citations — to achieve something that does not change the security outcome,
because the credentials are revoked by rotation and by nothing else. C is worth doing only if
this repository is to be made public, in which case the calculus changes completely and it
should be done *before* publication, not after.

Whichever is chosen, the sequence that actually closes the exposure is:

1. Reconcile the 25 workflows against the Power Platform admin centre.
2. Regenerate or delete each trigger. **This is the step that revokes.**
3. Re-provision replacements that authenticate, authorise and validate their own callers.
   Putting them behind a proxy is no longer an option — that tree has been removed, and both
   clients call each flow directly — so a browser *does* hold each replacement credential and
   the flow is the only place a control can live. See `AUTHENTICATION_CONTRACT.md` §2, and
   put every replacement on a rotation schedule from the day it is created.
4. Re-run `node scripts/flow-inventory.mjs`; update or delete the allow-list entry in
   `tests/secret-exposure.test.mjs` to match.
