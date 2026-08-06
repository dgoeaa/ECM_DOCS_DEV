# Phase 0 tracked-file inventory

Tracked files inventoried: **294**
Total tracked bytes: **19080145**
Text files: **286**; Binary files: **8**
Archives: **1**; Documents: **28**
Largest tracked file: **ECM_DOCS_DEV.zip** (16783981 bytes)

Metadata-only Phase 0 note: `referenced_by` is intentionally `[]` and `classification` is intentionally empty for every inventory record.

## Evidence for inventory commands
docs/repository-hygiene/c2d78ba2ea23/01-git-ls-files-wc.tsv:1-5
$ git ls-files -z | xargs -0 -I{} sh -c 'printf "%s\t" "$1"; wc -c < "$1";' sh {}
> .devcontainer/devcontainer.json	738
> .github/workflows/ci.yml	3026
> .gitignore	525
> AUDIT.md	10046
> AUTHENTICATION_CONTRACT.md	7041

docs/repository-hygiene/c2d78ba2ea23/01-git-ls-files-sha256.txt:1-5
$ git ls-files -z | xargs -0 sha256sum
> ac311a40f70004ac2607822244964d59f5a2aaf74b3ea8d51d7f998c2b9c83fe  .devcontainer/devcontainer.json
> 4617b9c86cfea3312db307ba9204aecb8a06aaf3f3650c23ff7f219c5119f7d4  .github/workflows/ci.yml
> 217c7931324ed8c33267be222c1d10b9bc6ac92df2d325536ada75d3633072a7  .gitignore
> 7d7473d82a5b19d97096db1ac7a02f788709cf69d233bd66b41886ad8fd6b07b  AUDIT.md
> 8c8da5c2f149f3db0c40af52438504533dfb7989e4190c4884c9f624117ab4b3  AUTHENTICATION_CONTRACT.md

## Per-tree summary

| Tree | File count | Total bytes | Text files | Binary files | Archives | Documents | Largest file | Initial concern |
|---|---:|---:|---:|---:|---:|---:|---|---|
| .devcontainer | 1 | 738 | 1 | 0 | 0 | 0 | .devcontainer/devcontainer.json (738 bytes) | No Phase 0 concern beyond metadata inventory. |
| .github | 1 | 3026 | 1 | 0 | 0 | 0 | .github/workflows/ci.yml (3026 bytes) | No Phase 0 concern beyond metadata inventory. |
| ECM_ActivityHub_Portal | 53 | 125881 | 53 | 0 | 0 | 1 | ECM_ActivityHub_Portal/js/views/components/modals.js (19736 bytes) | No Phase 0 concern beyond metadata inventory. |
| assets | 1 | 329 | 1 | 0 | 0 | 0 | assets/dgo-mark.svg (329 bytes) | No Phase 0 concern beyond metadata inventory. |
| config | 31 | 122514 | 31 | 0 | 0 | 0 | config/action-routing.config.js (20851 bytes) | No Phase 0 concern beyond metadata inventory. |
| core | 57 | 232322 | 57 | 0 | 0 | 0 | core/welcome-experience.js (24370 bytes) | No Phase 0 concern beyond metadata inventory. |
| docs | 14 | 171937 | 14 | 0 | 0 | 8 | docs/forensic/18e9f4d/04-report.md (28848 bytes) | No Phase 0 concern beyond metadata inventory. |
| document-portal | 42 | 732345 | 38 | 4 | 0 | 2 | document-portal/ds/fonts/CascadiaMono-Regular.woff2 (143932 bytes) | Binary artifacts present. |
| modules | 25 | 258499 | 25 | 0 | 0 | 0 | modules/activities.js (24852 bytes) | No Phase 0 concern beyond metadata inventory. |
| newack | 5 | 31589 | 5 | 0 | 0 | 0 | newack/index.html (7893 bytes) | No Phase 0 concern beyond metadata inventory. |
| proxy | 7 | 44452 | 7 | 0 | 0 | 1 | proxy/test/proxy.test.mjs (13830 bytes) | Proxy implementation present; runtime coupling deferred to Phase 1. |
| root runtime | 16 | 16986288 | 15 | 1 | 1 | 9 | ECM_DOCS_DEV.zip (16783981 bytes) | Root mixes runtime files, archive, and audit/documentation markdown. |
| scripts | 2 | 7860 | 2 | 0 | 0 | 0 | scripts/setup-local.mjs (5809 bytes) | No Phase 0 concern beyond metadata inventory. |
| shared | 8 | 51602 | 8 | 0 | 0 | 0 | shared/shell.js (14000 bytes) | No Phase 0 concern beyond metadata inventory. |
| styles | 18 | 200927 | 18 | 0 | 0 | 0 | styles/app.css (81442 bytes) | No Phase 0 concern beyond metadata inventory. |
| tests | 7 | 52775 | 7 | 0 | 0 | 2 | tests/governance.test.mjs (14290 bytes) | Test suite present; reachability and coverage deferred to Phase 1. |
| universal_filename_policy_deliverables | 6 | 57061 | 3 | 3 | 0 | 5 | universal_filename_policy_deliverables/universal_filename_policy_word_version.docx (38946 bytes) | Deliverable-oriented tree; generated/current status deferred. |

Tree summary evidence:
- `.devcontainer` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:2-2`
- `.github` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:3-3`
- `ECM_ActivityHub_Portal` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:4-4`
- `assets` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:5-5`
- `config` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:6-6`
- `core` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:7-7`
- `docs` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:8-8`
- `document-portal` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:9-9`
- `modules` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:10-10`
- `newack` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:11-11`
- `proxy` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:12-12`
- `root runtime` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:13-13`
- `scripts` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:14-14`
- `shared` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:15-15`
- `styles` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:16-16`
- `tests` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:17-17`
- `universal_filename_policy_deliverables` — `docs/repository-hygiene/c2d78ba2ea23/01-tree-summary.tsv:18-18`

## Explicit verification of requested trees and items

| Item | Status | Example tracked paths |
|---|---|---|
| root runtime | present | .gitignore, AUDIT.md, AUTHENTICATION_CONTRACT.md |
| core | present | core/acknowledgement-service.js, core/action-authority.js, core/action-runtime.js |
| config | present | config/acknowledgement-flow.config.js, config/action-ownership.config.js, config/action-routing.config.js |
| modules | present | modules/acknowledgment.js, modules/activities.js, modules/approvals.js |
| shared | present | shared/accessibility.js, shared/components.js, shared/design-system-adapter.js |
| styles | present | styles/app.css, styles/dgo-design-system/base.css, styles/dgo-design-system/brand-type.css |
| ECM_ActivityHub_Portal | present | ECM_ActivityHub_Portal/README.md, ECM_ActivityHub_Portal/config.example.js, ECM_ActivityHub_Portal/index.html |
| document-portal | present | document-portal/404.html, document-portal/README.md, document-portal/admin.html |
| newack | present | newack/ack.html, newack/config.js, newack/email.html |
| proxy | present | proxy/README.md, proxy/src/authorize.js, proxy/src/config.js |
| tests | present | tests/README.md, tests/auth-posture.test.mjs, tests/check-imports.mjs |
| scripts | present | scripts/check-links.mjs, scripts/setup-local.mjs |
| assets | present | assets/dgo-mark.svg |
| universal_filename_policy_deliverables | present | universal_filename_policy_deliverables/universal_filename_policy_ai_machine_usage.json, universal_filename_policy_deliverables/universal_filename_policy_one_page_memo.pdf, universal_filename_policy_deliverables/universal_filename_policy_sop.md |
| ECM_DOCS_DEV.zip | present | ECM_DOCS_DEV.zip |
| root-level audit/documentation markdown files | present | AUDIT.md, AUTHENTICATION_CONTRACT.md, CAPABILITY_ASSESSMENT_R11.6.md, CONTRIBUTING.md, FORENSIC_REPOSITORY_AUDIT.md, PLATFORM_DOCUMENTATION.md, README.md, REPOSITORY_AUDIT.md, STATUS_REPORT.md |
| proxy implementation | present | proxy/README.md, proxy/src/authorize.js, proxy/src/config.js, proxy/src/handler.js, proxy/src/jwt.js |
| test suite | present | tests/README.md, tests/auth-posture.test.mjs, tests/check-imports.mjs, tests/check-secrets.mjs, tests/governance.test.mjs |

Requested-item evidence:
- `root runtime` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:2-2`
- `core` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:3-3`
- `config` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:4-4`
- `modules` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:5-5`
- `shared` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:6-6`
- `styles` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:7-7`
- `ECM_ActivityHub_Portal` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:8-8`
- `document-portal` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:9-9`
- `newack` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:10-10`
- `proxy` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:11-11`
- `tests` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:12-12`
- `scripts` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:13-13`
- `assets` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:14-14`
- `universal_filename_policy_deliverables` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:15-15`
- `ECM_DOCS_DEV.zip` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:16-16`
- `root-level audit/documentation markdown files` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:17-17`
- `proxy implementation` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:18-18`
- `test suite` — `docs/repository-hygiene/c2d78ba2ea23/01-requested-items.tsv:19-19`

## Archive inventory

| Archive | Size | SHA256 | File count inside | Total uncompressed size | Contains source? | Contains secrets? | Contains duplicate repo copy? | Referenced by build/deploy? | Classification |
|---|---:|---|---:|---:|---|---|---|---|---|
| ECM_DOCS_DEV.zip | 16783981 | `745eb2fd09a3b9eb8b48734de0603ddf988f096e5c73cebf3a45281f58794182` | 837 | 76424660 | yes | yes | yes | no direct build/deploy reference found in package/scripts/proxy/config search | REVIEW - archive with embedded source/secrets |

Archive evidence:
- `ECM_DOCS_DEV.zip` metadata — `docs/repository-hygiene/c2d78ba2ea23/01-archive-summary.tsv:2-2`
- `ECM_DOCS_DEV.zip` listing — `docs/repository-hygiene/c2d78ba2ea23/01-archive-ECM_DOCS_DEV.zip-unzip-l.txt:1-10`
- `ECM_DOCS_DEV.zip` secret hits — `docs/repository-hygiene/c2d78ba2ea23/01-archive-ECM_DOCS_DEV.zip-secrets.tsv:2-6`
- `ECM_DOCS_DEV.zip` duplicate matches — `docs/repository-hygiene/c2d78ba2ea23/01-archive-ECM_DOCS_DEV.zip-duplicates.tsv:2-6`
- `ECM_DOCS_DEV.zip` build/deploy negative search — `docs/repository-hygiene/c2d78ba2ea23/01-archive-reference-search.txt:1-2`

## Archive search command
docs/repository-hygiene/c2d78ba2ea23/01-archive-find.txt:1-5
$ find . -type f \( -iname '*.zip' -o -iname '*.tar' -o -iname '*.tar.gz' -o -iname '*.tgz' -o -iname '*.7z' \) -print
> ./ECM_DOCS_DEV.zip

## Notes
- `inventory.json` is the authoritative per-file Phase 0 record.
- Archive extraction was limited to `/tmp/repo-hygiene-archives/<archive-name>/` and did not modify source files.
- `Contains duplicate repo copy?` is based on byte-identical SHA256 matches between extracted archive members and tracked working-tree files; deeper duplicate analysis is intentionally deferred past the Phase 0 gate.
- `Contains secrets?` is based on regex hits for SAS signatures and related credential patterns in extracted text members; the evidence TSV redacts matched secret values, and non-text members remain `INDETERMINATE` unless metadata alone was sufficient.
