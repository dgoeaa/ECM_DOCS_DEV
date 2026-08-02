# Phase 1 reference graph and reachability

Scope commit short SHA: **c2d78ba2ea23**
Tracked files analyzed: **294**
Reference edges detected: **2050**

## Evidence for Phase 1 analysis command
docs/repository-hygiene/c2d78ba2ea23/02-reference-analysis.log:1-3
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> $ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> > scope_commit=c2d78ba2ea23 tracked_files=294 text_files=286 edges=2050
> > runtime_roots=12 test_roots=5 script_roots=5

## Reachability summary

| Reachability class | File count |
|---|---:|
| standalone-entrypoint | 17 |
| runtime-reachable | 182 |
| asset-referenced | 40 |
| test-reachable | 5 |
| script-reachable | 7 |
| documentation-referenced | 18 |
| archive-contained | 7 |
| config-template | 4 |
| legal-or-license | 1 |
| unreferenced-but-plausibly-current | 12 |
| unreferenced-obsolete-candidate | 1 |
| unreferenced-unnecessary-candidate | 0 |

## Entry point analysis

| Entry point | Tree | Runtime type | Referenced files | External calls | Notes |
|---|---|---|---|---|---|
| index.html | root runtime | runtime-html | assets/dgo-mark.svg<br>core/boot.js<br>shared/figma-uiux-runtime.js<br>styles/index.css | https://*.api.powerplatform.com<br>https://*.logic.azure.com; | INDETERMINATE - external network behavior not executed in Phase 1. |
| ECM_ActivityHub_Portal/index.html | ECM_ActivityHub_Portal | runtime-html | ECM_ActivityHub_Portal/js/main.js<br>ECM_ActivityHub_Portal/powerAutomateClient.js | https://cdn.tailwindcss.com<br>https://fonts.googleapis.com<br>https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap<br>https://fonts.gstatic.com<br>https://unpkg.com/lucide@latest | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/index.html | document-portal | runtime-html | document-portal/admin.html<br>document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-lockup-white.png<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/home.js<br>document-portal/js/icons.js<br>document-portal/manifest.webmanifest | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/admin.html | document-portal | runtime-html | document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/index.html<br>document-portal/js/admin-panels.js<br>document-portal/js/admin.js<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/icons.js<br>document-portal/manifest.webmanifest | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/track.html | document-portal | runtime-html | document-portal/admin.html<br>document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-lockup-white.png<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/index.html<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/icons.js<br>document-portal/js/track.js | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/submit.html | document-portal | runtime-html | document-portal/admin.html<br>document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-lockup-white.png<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/index.html<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/icons.js<br>document-portal/js/submit.js | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/support.html | document-portal | runtime-html | document-portal/admin.html<br>document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-lockup-white.png<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/index.html<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/icons.js<br>document-portal/js/support.js | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| document-portal/404.html | document-portal | runtime-html | document-portal/ds/ds.css<br>document-portal/ds/logo/nitda-symbol.png<br>document-portal/favicon.svg<br>document-portal/index.html<br>document-portal/js/core.js<br>document-portal/js/data.js<br>document-portal/js/icons.js<br>document-portal/portal.css<br>document-portal/submit.html<br>document-portal/support.html | https://*.api.powerplatform.com<br>https://*.logic.azure.com;<br>https://nitda.gov.ng | INDETERMINATE - external network behavior not executed in Phase 1. |
| newack/index.html | newack | runtime-html | newack/ack.html<br>newack/config.js<br>newack/email.html<br>newack/styles.css | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |
| newack/ack.html | newack | runtime-html | newack/config.js<br>newack/index.html<br>newack/styles.css | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |
| newack/email.html | newack | runtime-html | newack/config.js<br>newack/index.html<br>newack/styles.css | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |
| proxy/src/server.js | proxy | proxy-server | proxy/src/config.js<br>proxy/src/handler.js<br>proxy/src/jwt.js | http://x | INDETERMINATE - external network behavior not executed in Phase 1. |
| tests/auth-posture.test.mjs | tests | test-entry | AUDIT.md<br>ECM_ActivityHub_Portal/js/core/auth.js<br>ECM_ActivityHub_Portal/js/core/store.js<br>config/auth.config.js<br>core/auth.js | https://proxy.example/dgo | INDETERMINATE - external network behavior not executed in Phase 1. |
| tests/check-imports.mjs | tests | test-entry | ECM_ActivityHub_Portal/index.html<br>core/boot.js<br>index.html | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |
| tests/check-secrets.mjs | tests | test-entry | CAPABILITY_ASSESSMENT_R11.6.md<br>ECM_DOCS_DEV.zip<br>tests/secrets-baseline.txt | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |
| tests/governance.test.mjs | tests | test-entry | config/action-ownership.config.js<br>config/module-boundaries.config.js<br>config/rbac.config.js<br>config/routes.config.js<br>config/workflow-clarity.config.js<br>core/action-authority.js<br>core/audit-log.js<br>core/endpoint-registry.js<br>core/idempotency.js<br>core/ui.js | http://x/y<br>https://nitda.gov.ng/doc.pdf<br>https://x.powerplatform.com/flow/abc?api-version=1&sp=%2Ftriggers&sv=1.0&sig=REDACTED | INDETERMINATE - external network behavior not executed in Phase 1. |
| proxy/test/proxy.test.mjs | proxy | test-entry | AUTHENTICATION_CONTRACT.md<br>proxy/src/authorize.js<br>proxy/src/config.js<br>proxy/src/handler.js<br>proxy/src/jwt.js | https://evil.example/v2.0<br>https://example/keys<br>https://flow.example/fetch?sig=REDACTED<br>https://flow.example/signed?sig=REDACTED<br>https://flow/x | INDETERMINATE - external network behavior not executed in Phase 1. |
| scripts/setup-local.mjs | scripts | setup-script | .gitignore<br>AUTHENTICATION_CONTRACT.md<br>ECM_DOCS_DEV.zip<br>config/config.example.js<br>config/endpoints.config.js | http://localhost:8080/<br>http://localhost:8080/#/diagnostics<br>http://localhost:8080/ECM_ActivityHub_Portal/<br>http://localhost:8080/document-portal/ | INDETERMINATE - external network behavior not executed in Phase 1. |
| scripts/check-links.mjs | scripts | script-entry | ECM_ActivityHub_Portal/index.html<br>index.html | http://localhost:${PORT}/ECM_ActivityHub_Portal/index.html`,<br>http://localhost:${PORT}/index.html`, | INDETERMINATE - external network behavior not executed in Phase 1. |
| playwright.config.js | root runtime | test-config | tests/README.md<br>tests/auth-posture.test.mjs | http://localhost:8080 | INDETERMINATE - external network behavior not executed in Phase 1. |
| ECM_DOCS_DEV.zip | root runtime | archive-root | INDETERMINATE - no tracked-file edges detected | INDETERMINATE - none detected statically | INDETERMINATE - external network behavior not executed in Phase 1. |

Entry-point evidence:
- `index.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:2-2`
- `ECM_ActivityHub_Portal/index.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:3-3`
- `document-portal/index.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:4-4`
- `document-portal/admin.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:5-5`
- `document-portal/track.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:6-6`
- `document-portal/submit.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:7-7`
- `document-portal/support.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:8-8`
- `document-portal/404.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:9-9`
- `newack/index.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:10-10`
- `newack/ack.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:11-11`
- `newack/email.html` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:12-12`
- `proxy/src/server.js` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:13-13`
- `tests/auth-posture.test.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:14-14`
- `tests/check-imports.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:15-15`
- `tests/check-secrets.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:16-16`
- `tests/governance.test.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:17-17`
- `proxy/test/proxy.test.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:18-18`
- `scripts/setup-local.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:19-19`
- `scripts/check-links.mjs` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:20-20`
- `playwright.config.js` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:21-21`
- `ECM_DOCS_DEV.zip` — `docs/repository-hygiene/c2d78ba2ea23/02-entry-points.tsv:22-22`

## Representative reference evidence

index.html:31-31
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <script type="module" src="core/boot.js"></script>

index.html:21-21
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <link rel="stylesheet" href="styles/index.css">

ECM_ActivityHub_Portal/index.html:49-49
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <script type="module" src="./js/main.js"></script>

document-portal/404.html:72-72
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <script src="js/core.js"></script>

document-portal/404.html:24-24
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <link rel="stylesheet" href="portal.css">

newack/ack.html:8-8
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> <script src="config.js"></script>

proxy/src/server.js:11-11
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> import { handleRequest, createIdempotencyStore } from './handler.js';

core/activity-parity.js:14-14
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> import { EndpointContracts } from '../config/endpoints.config.js';

package.json:18-18
$ python3 Phase 1 reference analyzer over docs/repository-hygiene/c2d78ba2ea23/inventory.json using structural import/src/href/url parsing plus limited doc/test/script mention scans
> "test:auth": "node tests/auth-posture.test.mjs",

## Notes
- `reference-graph.json` contains per-file `referenced_by`, `references_to`, a single reachability class, and evidence entries for all 294 scoped files.
- Negative claims are conservative: files with no detected incoming tracked-file references remain candidates only, not final removal decisions.
- Phase 2+ duplicate, obsolescence, findings, and recommendation work remains intentionally out of scope until the Phase 1 gate is accepted.
