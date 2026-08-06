# Repository Audit — `dgoeaa/ECM_DOCS_DEV`

**Scope:** every tracked file, folder and subfolder — 399 files across 11 top-level areas, plus full git history.
**Date:** 2026-08-01
**Repository visibility at time of audit:** **PUBLIC**
**Method:** complete file inventory, content classification, PII/secret scanning across the working tree *and* every blob in history, byte-level duplicate comparison, module-graph reachability, and execution of the test gate.

> This audit is repository-wide. It complements [`docs/audits/CAPABILITY_ASSESSMENT_R11.6.md`](./CAPABILITY_ASSESSMENT_R11.6.md), which covers the R11.6 runtime application specifically. Findings there are numbered `G-nn`; findings here are numbered `R-nn`.

---

## 1. Executive summary

The repository is **not primarily a codebase**. Only about a third of it is application source. The majority — by size, overwhelmingly — is **operational data exported from live government systems**: Power Automate flow run records, a SharePoint provisioning extraction, and reference-data dumps.

That distinction drives the single most important finding of this audit. The credential exposure already recorded as G-03 is real, but it is **not the largest problem in this repository.**

**The largest problem is that this public repository contains the personal data of roughly 785 named individuals** — full name, work email, department and job title — together with the **personal (non-corporate) email addresses of 50 department heads.** This is a near-complete staff directory of a Nigerian federal agency, published to the open internet, and it is present in git history as well as the working tree.

Correspondents from external bodies appear in the same dumps, including **`ndpc.gov.ng` — the Nigeria Data Protection Commission**, the regulator for exactly this class of disclosure.

| # | Finding | Severity |
|---|---|---|
| **R-01** | Personal data of ~785 individuals in a public repo, incl. personal email addresses of 50 department heads | **Critical** |
| **R-02** | 22 live Power Automate SAS signatures across 16 files (= G-03) | **Critical** |
| **R-03** | 30 MB of live operational correspondence/task data, one captured OTP, tenant URL disclosed | **High** |
| **R-04** | Two forked copies of the document portal, diverged, both carrying credentials | **Medium** |
| **R-05** | Repository hygiene: 40 MB of redundant archives, licence contradiction, 54 fragile filenames, a build-dependent sub-app in a zero-build repo | **Medium** |
| **R-06** | Positives — no orphaned modules, clean import graph, green test gate | — |

---

## 2. Complete inventory

### 2.1 By area

| Area | Files | Disk | Classification |
|---|---:|---:|---|
| `ECM_ActivityHub_Portal/` | 63 | 412 K | Application (SPA) + OTP forensic exports |
| `core/` | 56 | 336 K | Application — R11.6 runtime services |
| `document-portal_Central_NITDA_/` | 41 | 820 K | Application — portal fork B |
| `Flows_Sample/` | 41 | **30 M** | **Operational data export** |
| `document-portal/` | 40 | 644 K | Application — portal fork A |
| `config/` | 30 | 184 K | Application — configuration |
| `Bespoke platform welcome experience/` | 29 | 1.1 M | Prototypes + design system + forensic export |
| `modules/` | 25 | 308 K | Application — route modules |
| `styles/` | 18 | 236 K | Application — design tokens/CSS |
| *(root files)* | 11 | 17 M | Docs, config, **two archives** |
| `CLient_Proxy_App_Backend/` | 9 | 44 K | **Vite + TypeScript app (build-dependent)** |
| `shared/` | 8 | 68 K | Application — shell/adapters |
| `docs/policies/universal-filename-policy/` | 6 | 72 K | Policy documents |
| `newack/` | 6 | 76 K | Prototype |
| `tests/` | 5 | 36 K | Quality gate (added this branch) |
| `Consolidate_Merged_Folder_Files_Embed/` | 4 | 568 K | **Requirements + system extractions** |
| `tools/` | 3 | 32 K | Python bundle tooling (**non-functional**) |
| `assets/` | 2 | — | SVG |
| `scripts/` | 1 | — | Link checker |
| `.github/` | 1 | — | CI |

### 2.2 By type

`js` 194 · `css` 65 · `json` 58 · `html` 25 · `md` 13 · `txt` 9 · `svg` 8 · `png` 4 · `woff2` 3 · `py` 3 · `mjs` 3 · `zip` 2 · `xml` 2 · `webmanifest` 2 · `tsx` 2 · `pdf` 2 · `yml` 1 · `ts` 1 · `docx` 1

---

## 3. R-01 — Personal data exposure (CRITICAL)

### What is exposed

Scanning every tracked file for address-shaped strings yields **891 distinct email addresses**:

| Domain | Distinct addresses | Note |
|---|---:|---|
| `nitda.gov.ng` | **654** | Agency staff |
| `paxp193mb1310.eurp193.prod.outlook.com` | 49 | Exchange routing artefacts |
| `gmail.com` | 26 | **Personal addresses** |
| `deloitte.com.ng` | 16 | External consultancy |
| `qnamarcom.com` | 7 | External vendor |
| **`ndpc.gov.ng`** | 7 | **Nigeria Data Protection Commission** |
| `sec.gov.ng` | 4 | Securities & Exchange Commission |
| `nsa.gov.ng` | 4 | National Security Adviser's office |
| `galaxybackbone.com.ng` | 4 | Government infrastructure provider |
| `bazeuniversity.edu.ng` | 4 | External |
| others (`yahoo.com`, `nccc.gov.ng`, `microsoft.com`, `knewrow.com`, `kasicloud.com`, …) | ~16 | Mixed |

### Structured records, not incidental mentions

The reference-data dump is a directory export with defined schemas:

```
data.users[]       :  785 records — fields: name, email, department, jobTitle
data.departments[] :   50 records — fields: DSU_Email, DSU_HeadEmail,
                                            DSU_HeadPersonalEmail, DSU_HeadTitle, …
data.categories[]  :   45 records — workflow routing and SLA configuration
```

Two points make this materially worse than a stray address in a config file:

1. **785 complete personal profiles.** Name + work email + department + job title, for what appears to be the agency's entire staff roll. That is a ready-made target list for phishing, social engineering and org-chart reconstruction.
2. **`DSU_HeadPersonalEmail` — a dedicated field for the *personal* email addresses of department heads.** Corporate addresses are arguably public-facing; personal ones are not, and 26 `gmail.com` and 3 `yahoo.com` addresses appear in the corpus.

### Concentration

| File | Distinct addresses |
|---|---:|
| `Flows_Sample/Copy of - Fetch_All_Data_&_References_Matrix-POST…flow_run_record.json` | 815 |
| `Flows_Sample/Fetch_References_and_Lookups_Data - POST…varResponse.json` | 807 |
| `Flows_Sample/Fetch_References_and_Lookups_Data - POST…flow_run_record.json` | 807 |
| `Flows_Sample/Compose_Standard_Respons_Fetch_References_and_Lookups_Data_Response.txt` | 807 |
| `Flows_Sample/Fetch_Emails_POST…` (2 files) | 54 each |
| `Flows_Sample/Fetch_Tasks_POST…` (4 files) | 26–27 each |
| `document-portal/js/data.js`, `document-portal_Central_NITDA_/js/data.js` | 18 each |
| `config/assignment-cascade.config.js` | 6 |

The bulk sits in four `Flows_Sample` files that are essentially the same export in different serialisations — so **deleting a small number of files removes most of the exposure.**

### In history too

**654 distinct `@nitda.gov.ng` addresses are reachable from git history**, not only the working tree. Deleting the files from `HEAD` does not remove them from a public repository — every clone and every GitHub API consumer retains them.

### Regulatory dimension

Nigeria's Data Protection Act 2023 governs processing of personal data of Nigerian data subjects, and is enforced by the NDPC — **whose own staff addresses appear in the exposed corpus.** I am not offering a legal opinion, but an agency publishing its full staff directory plus department heads' personal addresses is a disclosure that warrants your data-protection officer's immediate involvement, independent of anything technical.

---

## 4. R-02 — Credential exposure (CRITICAL)

Already documented as G-03; re-verified repository-wide and **extended to git history**:

```
working tree : 22 distinct SAS signatures across 16 files
git history  : 22 distinct  (no additional signatures in historical blobs)
```

**This is good news in one specific respect:** history contains no signatures beyond those already in the tree. Once the 22 are rotated in Power Automate, scrubbing the tree is sufficient — there is no hidden set lurking in old blobs requiring a separate sweep.

Rotation remains the only action that revokes anything. `npm run test:secrets` enumerates the affected files and fails on any newly introduced signature.

---

## 5. R-03 — Operational data exposure (HIGH)

`Flows_Sample/` is 30 MB of **Power Automate run records from a live tenant** — not synthetic samples, despite the folder name.

- A single 23 MB record, `Copy of - Fetch_All_Data_&_References_Matrix-POST…`, carries the full reference-data payload including the 785-record directory.
- `Fetch_Emails_POST…` records contain real email routing metadata (hence the 49 Exchange `*.prod.outlook.com` artefacts).
- `Fetch_Tasks_POST…` records contain real task/assignment payloads.
- **One OTP verification record contains a captured numeric code** alongside two addresses. A single expired code is low-impact on its own, but it demonstrates that authentication material was captured into these exports at all.
- **Tenant URL disclosed:** `https://nitdanigeria.sharepoint.com/sites/NITDADGO-EAAACTIVITYTRACKING`, together with a complete SharePoint provisioning extraction (`sheets`, `tables`, `lists`, `fields`, `seedItems`) — an internal data-model blueprint.

`Consolidate_Merged_Folder_Files_Embed/` compounds this: it holds the BRD/FRD requirements document, the DGCEO data-model architecture, the SharePoint extraction, and a file whose name is itself the warning — `Extract_NITDA_operations_manifest_ai_ready_UNREDACTED-1.json`, containing an endpoint registry with `full_url_inclusion` and 7 of the 22 SAS signatures.

---

## 6. R-04 — Portal fork drift (MEDIUM)

`document-portal/` and `document-portal_Central_NITDA_/` are two copies of the same application:

```
26 files byte-identical
12 files differ   (404.html, README.md, admin.html, index.html, portal.css,
                   submit.html, support.html, track.html, sw.js,
                   js/submit.js, js/support.js, js/track.js)
 2 assets only in fork A   ·   3 assets only in fork B
```

The divergence is branding plus behaviour in three JS files. **Both forks independently carry 3 SAS signatures each in `js/data.js`**, so a fix applied to one silently leaves the other exposed — which is precisely the failure mode a fork of this kind produces.

Decide which is canonical and reduce to one, with branding driven by configuration rather than duplication.

---

## 7. R-05 — Repository hygiene (MEDIUM)

| Issue | Detail | Impact |
|---|---|---|
| **Redundant archives** | `ECM_DOCS_DEV.zip` (17 MB, 838 entries) duplicates the platform tree; `HTML_OPS_Templates.zip` (244 K, 115 entries) | ~40 % of repo size; the zip is *also* a second copy of the credentials |
| **Oversized JSON** | One 23 MB tracked file; six more over 400 K | Slow clones; unreviewable diffs |
| **Licence contradiction** | No `LICENSE` file; `package.json` declares `UNLICENSED` — yet the repo is **public** | Public with no grant of rights is legally ambiguous |
| **Fragile filenames** | 54 tracked paths contain spaces, `&`, or parentheses | Breaks naive scripts, some CI runners, and Windows tooling |
| **Directory typo** | `CLient_Proxy_App_Backend` (capital L) | Cosmetic but permanent in URLs |
| **Build-dependent sub-app** | `CLient_Proxy_App_Backend/` is a **Vite + TypeScript + React** app (`App.tsx`, `main.tsx`, `vite.config.ts`, `tsconfig.json`) | Contradicts the documented zero-build architecture; has no build wired into CI and is not served by `npm start` |
| **Non-functional tooling** | `tools/rebuild_bundle.py`, `expand_bundle.py`, `test_payload_contract.py` depend on `CLEAN_PACKAGE_MANIFEST.json`, which does not exist | Dead code inviting misuse |

Note the archive point is not merely about size: `ECM_DOCS_DEV.zip` contains its own copy of the credential-bearing files, so any scrub that ignores the zip leaves the secrets in place.

---

## 8. R-06 — What is in good order

Not everything here is a finding, and the application code is the strongest part of the repository.

- **Module graph is clean.** 165 modules reachable across both apps, **0 broken import edges**.
- **No orphaned modules.** Every file in `core/`, `modules/` and `shared/` is referenced by something — no dead runtime code.
- **Test gate green.** `npm test` passes: import checker ✅, secret ratchet ✅, smoke suite 6/6 ✅.
- **Governance layer is genuinely well built** — action ownership, audit log, idempotency keys, offline queue with receipts, OTP step-up, and an endpoint registry that redacts signature material before logging. See §2.2 of the capability assessment.
- **`.gitignore` now covers** `node_modules/`, both `config.local.js` paths, `*.state.json` and all test output.
- **Configuration is properly externalised** — `config/endpoints.config.js` holds no URLs and reads from `window.DGO_CONFIG`.

---

## 9. Prioritised remediation

**Immediate — today, in this order**

1. **Make the repository private.** Settings → General → Danger Zone → Change visibility. This is the single highest-leverage action: it stops ongoing exposure of both the credentials *and* the personal data while everything else is worked through. It does not undo prior exposure.
2. **Rotate all 22 SAS signatures** in Power Automate. Nothing else revokes them.
3. **Notify your data protection officer** about R-01. The scale (785 individuals, plus department heads' personal addresses) and the public exposure window are facts they need, and the assessment of notification duties is theirs, not mine.

**Short term**

4. **Purge the personal-data corpus.** Four `Flows_Sample` files account for the overwhelming majority. Replace the run records with redacted fixtures, or remove `Flows_Sample/` entirely and keep it in internal storage.
5. **Scrub the credential-bearing files** — including inside `ECM_DOCS_DEV.zip`, which holds its own copy.
6. **Then, and only then, consider history rewrite.** Sequence matters: rewriting before rotation invalidates every clone while revoking nothing. After rotation and scrub, a rewrite removes the historical blobs — but treat prior public exposure as permanent regardless.
7. **Add a `LICENSE`** or keep the repository private permanently. `UNLICENSED` plus public visibility is a contradiction.

**Medium term**

8. Consolidate the two document-portal forks into one configuration-driven app (R-04).
9. Remove both tracked archives and the 23 MB JSON; move large artefacts to internal storage (R-05).
10. Decide the fate of `CLient_Proxy_App_Backend/` — wire its build into CI or remove it — and either restore `CLEAN_PACKAGE_MANIFEST.json` or retire `tools/`.
11. Close **G-04** — the runtime still has no authentication. In a private repo this is a serious weakness; it was an acute one while public.

---

## 10. Method

- **Inventory:** `git ls-files` grouped by path and extension; `du` per area for on-disk size.
- **PII:** RFC-shaped address extraction across all tracked files, deduplicated and grouped by domain; structured-record schemas read via JSON parse, reporting **field names and counts only** — no personal data is reproduced in this document.
- **Secrets:** `sig=` followed by ≥20 URL-safe base64 characters (placeholders such as `sig=ROTATE_ME` fall below the threshold), applied to the working tree and to **every blob reachable from every ref** in history.
- **Duplication:** per-file `cmp` between the two portal trees.
- **Reachability:** recursive relative-import resolution from both apps' HTML entry points; orphan detection by basename reference search across all JS/MJS/HTML.
- **Health:** `npm test` — import checker, secret ratchet, and Playwright smoke suite.

**Limits of this audit, stated plainly.** Address-shaped and signature-shaped pattern matching finds what matches those patterns; personal data in free-text correspondence bodies, names without an accompanying address, or credentials in an unrecognised format would not be caught. The 785-record figure is what the structured export declares — the true count of identifiable individuals across all 30 MB of correspondence data may be higher. Treat these numbers as a floor, not a ceiling.
