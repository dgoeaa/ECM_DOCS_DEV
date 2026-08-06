# Forensic Repository Audit — `dgoeaa/ECM_DOCS_DEV`

**Scope:** every tracked file, folder, subfolder and content item. No exceptions.
**Date:** 2026-08-01 · **Branch audited:** `claude/quirky-babbage-1nomt5` · **Tracked files:** 400
**Method:** content-hash duplicate detection across all files; per-application dependency-graph traversal from each HTML entry point through HTML `src`/`href`, ES-module static and dynamic imports, and CSS `@import`/`url()`; orphan detection by set difference; manifest-dependency verification; package and provenance inspection.

**This audit classifies. It does not review security** — that is covered separately in `docs/audits/REPOSITORY_AUDIT.md` and `docs/audits/CAPABILITY_ASSESSMENT_R11.6.md`.

---

## 1. Classification scheme

Every item in this repository receives exactly one disposition.

| Code | Meaning | Action |
|---|---|---|
| **CORE** | Required for an application to run | Keep. Protect. |
| **SUPPORT** | Required for development, testing, CI or documentation | Keep. |
| **REFERENCE** | Legitimate input material; not shipped, not executable | Keep, but relocate out of the app repo |
| **DUPLICATE** | Byte-identical copy of another tracked file | Deduplicate to a single source |
| **MISPLACED** | Real content, wrong repository or wrong directory | Move |
| **OBSOLETE** | Dead, superseded, or non-functional | Delete |
| **MISSING** | Referenced but absent | Create or remove the reference |

---

## 2. Verdict summary

| Disposition | Files | % of repo |
|---|---:|---:|
| CORE | 213 | 53% |
| SUPPORT | 22 | 6% |
| REFERENCE | 66 | 17% |
| DUPLICATE | 87 | 22% |
| MISPLACED | 21 | 5% |
| OBSOLETE | 14 | 4% |
| **MISSING** | **4** | — |

*(Percentages exceed 100% because DUPLICATE and MISPLACED overlap other categories — a duplicated design-system file is both CORE to one app and DUPLICATE of another copy.)*

**Headline structural findings**

1. **One genuine broken link:** `newack/dashboard.html` is referenced from three files and does not exist.
2. **The design system exists in four independent copies** — 19 files quadruplicated across `styles/`, two portals, and the Bespoke bundle.
3. **`CLient_Proxy_App_Backend/` is not a NITDA application.** It is Google's `react-example` AI Studio template, unmodified in structure, foreign to this repository.
4. **`tools/` cannot run.** All three Python scripts require two files that do not exist.
5. **`Flows_Sample/` (30 MB, 41 files) is operational data, not sample data**, sitting at repository root as though it were source.
6. **The repository contains three distinct architectures** — zero-build ES modules, a Vite/TypeScript React app, and static prototypes — with only the first documented.

---

## 3. Application inventory — dependency-graph verified

Six independently bootable applications. Each traversed from its entry point.

| # | Application | Entry | Tracked | Reachable | Orphaned | Missing | Status |
|---|---|---|---:|---:|---:|---:|---|
| 1 | **DGO R11.6 Runtime** | `index.html` | 139 | **137** | 3 | 0¹ | ✅ Complete |
| 2 | **ECM ActivityHub Portal** | `ECM_ActivityHub_Portal/index.html` | 63 | 50 | 13 | 0¹ | ✅ Complete |
| 3 | **document-portal** | `document-portal/index.html` | 40 | 34 | 6 | 0² | ✅ Complete |
| 4 | **document-portal_Central_NITDA_** | `document-portal_Central_NITDA_/index.html` | 41 | 34 | 7 | 0² | ✅ Complete |
| 5 | **newack** | `newack/index.html` | 6 | 5 | 1 | **1** | ❌ **Broken** |
| 6 | **Bespoke reference-portal** | `…/reference-portal/index.html` | 4 | 4 | 0 | 0 | ✅ Complete |

¹ `config.local.js` is git-ignored by design — absence is correct, not a defect.
² `tel:+2347000006483` was flagged by the traversal; it is a telephone link, not a file. Not a defect.

### 3.1 Application 1 — DGO R11.6 Runtime (CORE)

The primary platform. 137 of 139 in-scope files participate in the running application.

| Directory | Files | Disposition | Purpose |
|---|---:|---|---|
| `core/` | 56 | **CORE** | Boot, router, state, endpoint registry, audit, idempotency, offline queue, receipts, OTP, write manager |
| `config/` | 30 | **CORE** | RBAC, routes, workflow clarity, endpoints, module boundaries, action ownership, priority scale |
| `modules/` | 25 | **CORE** | 25 lazy-loaded route modules |
| `styles/` | 18 | **CORE** | `@layer` cascade + self-hosted design tokens |
| `shared/` | 8 | **CORE** | Shell web component, design-system adapter, welcome runtime |
| `assets/` | 2 | 1 CORE, 1 orphan | `dgo-mark.svg` used; `dgo-logo.svg` unreferenced |
| `index.html` | 1 | **CORE** | Entry point + boot watchdog |

**Orphans — all three are correct as-is, none are dead:**

| File | Disposition | Reasoning |
|---|---|---|
| `config/config.example.js` | **SUPPORT** | Template to be copied to `config.local.js`. Unreferenced by design. |
| `config/product-definition.config.json` | **REFERENCE** | Platform metadata; not imported by the graph. Retain — it documents product scope. |
| `assets/dgo-logo.svg` | **OBSOLETE** | Genuinely unreferenced. The shell uses `dgo-mark.svg`. **Delete or wire in.** |

### 3.2 Application 2 — ECM ActivityHub Portal (CORE)

50 reachable files form the SPA: `js/core/`, `js/services/` (13), `js/views/pages/` (18), `js/api/`, `js/events/`, `js/data/`.

**13 orphans, of which 11 are misplaced forensic data:**

| Item | Files | Disposition |
|---|---:|---|
| `Otp/aud_forensic_otp_20260715_110909/**` | 7 | **MISPLACED** — an audit-run export nested inside a live application directory |
| `Otp/Web - OTP {Generate,Verify}__*.json` | 4 | **MISPLACED + DUPLICATE** — 1 is byte-identical to a `Flows_Sample` file |
| `README.md` | 1 | **SUPPORT** — correct |
| `config.example.js` | 1 | **SUPPORT** — correct |

**Disposition: move `ECM_ActivityHub_Portal/Otp/` out of the application directory entirely.** Shipping-code directories must not contain audit exports; they are served to browsers by any static host pointed at the app root.

### 3.3 Applications 3 & 4 — the document-portal fork (CORE + DUPLICATE)

Two copies of one application.

```
26 files byte-identical
12 files diverged   404.html · README.md · admin.html · index.html · portal.css
                    submit.html · support.html · track.html · sw.js
                    js/submit.js · js/support.js · js/track.js
 2 assets only in fork A   (ds/logo/mark.svg, ds/logo/nitda-endorsed.svg)
 3 assets only in fork B   (ds/logo/nitda-lockup{,-white}.png, nitda-symbol.png)
```

The divergence is branding (SVG vs PNG logo sets) plus behaviour in three JavaScript files. **This is a copy-paste fork, not a deliberate variant architecture.**

**Six "orphans" per fork are false positives — all are required:**

| File | Verdict | Why the traversal missed it |
|---|---|---|
| `sw.js` | **CORE** | Registered at `js/core.js:654` via a runtime string literal, not a static import |
| `robots.txt`, `sitemap.xml` | **CORE** | Served by convention at fixed URLs; never linked from HTML |
| `404.html` | **CORE** | Served by the host on error; never linked |
| `ds/icons/sprite.svg` | **CORE** | Referenced by fragment (`#icon-id`) from CSS/JS |
| `ds/logo/nitda-lockup.png` (fork B only) | **OBSOLETE** | Genuinely unreferenced in either fork |

**Disposition: consolidate to one portal.** Retain `document-portal_Central_NITDA_` if the NITDA lockup is the required brand; drive the other brand from configuration. Consolidation removes 38 files.

### 3.4 Application 5 — newack (BROKEN)

| File | Disposition |
|---|---|
| `index.html`, `ack.html`, `email.html`, `styles.css`, `config.js` | **CORE** |
| `unified-hub-ackflow.html` | **OBSOLETE** — superseded standalone variant, unreferenced |
| **`dashboard.html`** | **MISSING** ❌ |

`dashboard.html` is linked as *"Daily Operations"* — the primary navigation target — from **three files**:

```
newack/index.html:23   <a href="dashboard.html" class="nav-item active">Daily Operations</a>
newack/ack.html:73     <a href="dashboard.html" class="btn btn-primary btn-sm">Return to Ops Console</a>
newack/email.html:23   <a href="dashboard.html" class="nav-item">Daily Operations</a>
```

The link is marked `active` on the index page, meaning the application presents itself as *being* on a page that does not exist. **This is the only genuine broken internal reference in the repository.**

**Disposition: create `newack/dashboard.html`, or remove all three references and re-point navigation.**

### 3.5 Application 6 — Bespoke platform welcome experience (REFERENCE)

| Item | Files | Disposition | Purpose |
|---|---:|---|---|
| `reference-portal/` | 4 | **REFERENCE** | Complete, self-consistent, zero defects — a working reference implementation |
| `_ds/nitda-design-system-019ddcd9…/` | 19 | **DUPLICATE** | A packaged copy of the design system; 12 files byte-identical to other copies |
| `Boot Experience.dc.html`, `Boot Experience v2.dc.html`, `NITDA Portal.dc.html` | 3 | **REFERENCE** | Self-contained design-tool exports (34–54 KB, inlined) — v1/v2 pair indicates iteration |
| `uploads/nitda_intelligent_state.forensic.json` | 1 | **MISPLACED** | Forensic export; belongs with audit artefacts |
| `support.js`, `assets/symbol-infoweb-on-green.png` | 2 | **REFERENCE** | Prototype support |

---

## 4. Duplicate analysis — 34 groups, 87 files

### 4.1 The design system exists four times

This is the single largest structural inefficiency in the repository.

| Copy | Location | Role |
|---|---|---|
| 1 | `styles/dgo-design-system/` | Used by R11.6 Runtime |
| 2 | `document-portal/ds/` | Used by portal fork A |
| 3 | `document-portal_Central_NITDA_/ds/` | Used by portal fork B |
| 4 | `Bespoke platform welcome experience/_ds/…/dgo-design-system/` | Packaged snapshot |

Files confirmed byte-identical across three or four copies include `tokens.primitive.css`, `tokens.density.css`, `tokens.theme-hc.css`, `styles/reset.css`, `styles/layout.css`, and `fonts/CascadiaMono-Regular.woff2`.

**Consequence:** a token change must be applied four times by hand. Nothing enforces consistency, and the copies have already begun to drift (only *some* token files are identical across all four).

**Disposition: promote one copy to canonical.** `styles/dgo-design-system/` is the natural source — it is the most complete and carries the `@layer` cascade documentation. Portals should reference it by relative path.

### 4.2 `Flows_Sample/` internal duplication

| Duplicate pair/set | Files | Note |
|---|---:|---|
| `Compose_Standard_Respons_*.txt` ≡ `*__varResponse.json` | 2 pairs | Same payload, two serialisations |
| `*__flow_run_record_schema.json` identical across 6 flows | 6 | One shared schema, copied per flow |
| `*__trigger_input_schema.json` identical across 3 flows | 3 | Same |
| `Deployed - Create Task…` ≡ `Deployed Bulk Task Assignment…` trigger schemas | 2 | Same |
| `Fetch_Tasks_POST` full definitions (two run IDs) | 2 | Same flow, two runs |

**≈15 of 41 files in `Flows_Sample/` are redundant serialisations of other files in the same folder.**

### 4.3 Cross-area duplication

`ECM_ActivityHub_Portal/Otp/Web - OTP Generate__…__trigger_input_schema.json` is byte-identical to its counterpart in `Flows_Sample/OTP_FLOWS/OTP_GENERATE/`. The same artefact is stored in two unrelated locations under different run IDs.

---

## 5. Misplaced content — 21 files

| Item | Files | Currently | Belongs |
|---|---:|---|---|
| `CLient_Proxy_App_Backend/` | 9 | Repository root | **Another repository entirely** — see §6 |
| `ECM_ActivityHub_Portal/Otp/` | 11 | Inside a shipping app | An audit-artefact store outside app roots |
| `Bespoke …/uploads/nitda_intelligent_state.forensic.json` | 1 | Inside a prototype | Same |

Additionally, though not counted above: **`Flows_Sample/` and `Consolidate_Merged_Folder_Files_Embed/` are reference data at repository root**, structurally indistinguishable from source directories. They are 30 MB and 568 KB respectively and belong in a documentation or data store, not in an application repository.

---

## 6. `CLient_Proxy_App_Backend/` — foreign content

Definitive provenance from its own `package.json` and `README.md`:

```
name        : "react-example"
scripts     : dev (vite --port=3000) · build · preview · clean · lint (tsc --noEmit)
dependencies: react, react-dom, vite, express, dotenv, motion, lucide-react,
              @google/genai, @tailwindcss/vite, @vitejs/plugin-react
devDeps     : typescript, tailwindcss, esbuild, tsx, autoprefixer, @types/*
README      : banner image served from ai.google.dev
```

This is **Google's AI Studio React starter template**, named `react-example`, depending on `@google/genai`. It is:

- **Architecturally incompatible** — Vite + TypeScript + React, in a repository whose documented architecture is zero-build ES modules
- **Not built or served** — absent from `npm start`, absent from CI, no `node_modules`, no `dist`
- **Not referenced** by any other file in the repository
- **Misnamed** — `CLient` (capital L); and it is a *frontend* template despite `_Backend` in the name
- **Contradicting its own name** — nothing in it proxies anything

**Disposition: remove from this repository.** If a client proxy is genuinely planned, it warrants its own repository with its own build and CI. Retaining an unbuilt Google template at the root of a government platform repository serves no purpose and misleads every reader.

---

## 7. Obsolete content — 14 files

| Item | Files | Evidence |
|---|---:|---|
| `tools/expand_bundle.py`, `rebuild_bundle.py`, `test_payload_contract.py` | 3 | **Cannot run.** All three require `CLEAN_PACKAGE_MANIFEST.json` and `DGO_Target_CLEAN_RUNTIME.state.json`; **neither exists** in the tree or in the archive |
| `ECM_DOCS_DEV.zip` | 1 | 17 MB, 838 entries — a snapshot of this platform, superseded by the tree it was used to repair |
| `HTML_OPS_Templates.zip` | 1 | 244 KB, 115 entries — unreferenced template archive |
| `newack/unified-hub-ackflow.html` | 1 | Superseded standalone variant |
| `assets/dgo-logo.svg` | 1 | Unreferenced |
| `document-portal_Central_NITDA_/ds/logo/nitda-lockup.png` | 1 | Unreferenced in either fork |
| `Flows_Sample/` redundant serialisations | ~6 | Byte-identical to siblings (§4.2) |

**On the archives:** `ECM_DOCS_DEV.zip` served a real purpose — it was the only source of the 13 config modules restored in commit `7204da7`. That purpose is now discharged. It should be retained *outside* the repository as a recovery artefact, not tracked inside it.

---

## 8. Missing content — 4 items

| Item | Referenced by | Severity | Disposition |
|---|---|---|---|
| **`newack/dashboard.html`** | `newack/index.html:23`, `ack.html:73`, `email.html:23` | **Breaking** | Create it, or re-point all three links |
| `CLEAN_PACKAGE_MANIFEST.json` | All 3 scripts in `tools/` | Blocking | Restore it, or delete `tools/` |
| `DGO_Target_CLEAN_RUNTIME.state.json` | `expand_bundle.py`, `rebuild_bundle.py` | Blocking | As above |
| `LICENSE` | Repository convention; `package.json` declares `UNLICENSED` | Governance | Add one, or keep the repository private permanently |

**Not missing, despite appearing absent:** `config/config.local.js` and `ECM_ActivityHub_Portal/config.local.js` are git-ignored by design and correctly 404 on a clean checkout.

---

## 9. Structural assessment

### 9.1 Three architectures, one documented

| Architecture | Applications | Build required | Documented |
|---|---|---|---|
| Zero-build ES modules | R11.6 Runtime, ECM Portal, both document-portals | No | ✅ Yes |
| Vite + TypeScript + React | `CLient_Proxy_App_Backend/` | **Yes** | ❌ No |
| Static self-contained HTML | `newack/`, Bespoke `.dc.html` exports | No | ❌ No |

### 9.2 Content composition

| Class | Files | Share |
|---|---:|---:|
| Application source | 213 | 53% |
| Reference data & documents | 66 | 17% |
| Duplicated content | 87 | 22% |
| Development support | 22 | 6% |
| Foreign / obsolete | 23 | 6% |

**Just over half of this repository is application source.** Roughly a fifth is duplication.

### 9.3 Naming and convention defects

| Defect | Count | Example |
|---|---:|---|
| Filenames containing spaces, `&` or parentheses | 54 | `Copy of - Fetch_All_Data_&_References_Matrix-POST__…json` |
| Directory typo | 1 | `CLient_Proxy_App_Backend` |
| `Copy of -` prefix retained in a tracked filename | 1 | 23 MB file, largest in repo |
| Trailing-underscore directory name | 1 | `document-portal_Central_NITDA_` |
| Non-standard extension | 3 | `*.dc.html` |
| Run-ID-embedded filenames | 41 | All of `Flows_Sample/` |

---

## 10. Disposition register — decisive actions

Ordered. Each is independently executable. No further input required.

### Tier 1 — Correctness (repairs a defect)

| # | Action | Effect |
|---|---|---|
| 1 | Create `newack/dashboard.html`, **or** re-point the 3 links in `index.html`, `ack.html`, `email.html` | Fixes the only broken internal reference |
| 2 | Delete `tools/` (3 files) **or** restore `CLEAN_PACKAGE_MANIFEST.json` + `DGO_Target_CLEAN_RUNTIME.state.json` | Removes non-functional tooling |
| 3 | Add `LICENSE`, or keep the repository private permanently | Resolves the `UNLICENSED`-and-public contradiction |

### Tier 2 — Deduplication (−125 files)

| # | Action | Files removed |
|---|---|---:|
| 4 | Consolidate the two document-portals into one config-driven app | 38 |
| 5 | Promote `styles/dgo-design-system/` to canonical; reference it from portals; delete copies 2–4 | ~57 |
| 6 | Remove redundant serialisations within `Flows_Sample/` | ~15 |
| 7 | Delete `ECM_ActivityHub_Portal/Otp/…trigger_input_schema.json` duplicate of the `Flows_Sample` copy | 1 |
| 8 | Delete `assets/dgo-logo.svg`, `…/nitda-lockup.png`, `newack/unified-hub-ackflow.html` | 3 |

### Tier 3 — Relocation

| # | Action | Files moved |
|---|---|---:|
| 9 | Remove `CLient_Proxy_App_Backend/` — foreign Google template | 9 |
| 10 | Move `ECM_ActivityHub_Portal/Otp/` out of the shipping app directory | 11 |
| 11 | Move `Bespoke …/uploads/nitda_intelligent_state.forensic.json` to the same store | 1 |
| 12 | Move `Flows_Sample/` and `Consolidate_Merged_Folder_Files_Embed/` to a documentation/data store | 45 |
| 13 | Untrack `ECM_DOCS_DEV.zip` and `HTML_OPS_Templates.zip`; retain externally | 2 |

### Tier 4 — Hygiene

| # | Action |
|---|---|
| 14 | Rename `CLient_Proxy_App_Backend` → correct spelling (or delete per #9) |
| 15 | Normalise the 54 filenames containing spaces, `&`, parentheses and `Copy of -` |
| 16 | Rename `document-portal_Central_NITDA_` to drop the trailing underscore |
| 17 | Document the static-prototype architecture, or convert `newack/` and the `.dc.html` exports to reference material |

### Projected outcome

| Metric | Now | After Tiers 1–3 |
|---|---:|---:|
| Tracked files | 400 | **≈ 205** |
| Repository size | 51 MB | **≈ 3 MB** |
| Design-system copies | 4 | **1** |
| Document portals | 2 | **1** |
| Architectures | 3 | **2** (documented) |
| Broken references | 1 | **0** |
| Non-functional tooling | 3 files | **0** |

**A 49% reduction in file count and a 94% reduction in size, with no loss of application capability** — every removal above is a duplicate, a foreign artefact, a dead file, or reference material relocated rather than destroyed.

---

## 11. What is structurally sound

Stated because a forensic audit that reports only defects is not an honest one.

- **The R11.6 Runtime is structurally complete and clean.** 137 of 139 files reachable; every module in `core/`, `modules/` and `shared/` referenced; zero dead runtime code; zero broken imports across 165 modules and 2,059 edges.
- **The ECM Portal's application code is clean** — all 50 source files reachable. Every one of its orphans is misplaced data, not dead code.
- **Both document-portals are internally complete** — every apparent orphan is a convention-served file, correctly present.
- **The Bespoke reference-portal is flawless** — 4 files, 4 reachable, zero orphans, zero missing.
- **Configuration is properly externalised and layered** — 30 config modules, no hardcoded endpoints, `config.local.js` correctly ignored.
- **`.github/`, `tests/` and `scripts/` are complete and functional** — the quality gate passes.

## 12. Method and limits

Duplicates by SHA-256 over file content — exact matches only; near-identical files that differ by a byte are reported as distinct, so §4 is a **floor**. Reachability by static traversal of HTML `src`/`href`, ES-module static and dynamic imports, and CSS `@import`/`url()`; references constructed at runtime from variables are invisible to it — `sw.js` is a confirmed instance, caught by manual inspection, and others may exist, so the orphan lists are **upper bounds** and each entry in §3 was individually adjudicated rather than taken at face value. Provenance for §6 rests on the package manifest and README of the directory itself.
