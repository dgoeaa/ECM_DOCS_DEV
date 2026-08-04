# ECM_DOCS_DEV — DGO Digital Operations

Client-side web applications powering NITDA's Digital Operations platform, plus the reference material and flow exports that document it.

> **Read this first.** This README was previously written for a different repository (`dgoeaa/DGO_Targets`) and described a test suite, CI workflows and a bundle manifest that do not exist here. It has been rewritten to describe **this** repository as it actually is. Where something is genuinely undecided it says so rather than guessing. See [`CAPABILITY_ASSESSMENT_R11.6.md`](CAPABILITY_ASSESSMENT_R11.6.md) for the full gap analysis behind these corrections.

---

## ⚠️ Security status — read before publishing this repository

**This repository must not be made public in its current state.**

1. **4 live Power Automate SAS signatures remain in 2 tracked files** — `document-portal/js/data.js` (3) and `newack/config.js` (1) — both client-delivered. A SAS-signed URL is a bearer credential: possession alone authorizes invoking the flow.

   **22 distinct signatures were public before the structural cleanup.** Removing the files did not revoke them. **All 22 must be rotated**, not only the 4 still present.

   **Rotate every one of them in Power Automate.** Deleting the files revokes nothing, and neither does rewriting history. Rotation must come first. `npm run test:secrets` lists the affected files; `tests/secrets-baseline.txt` tracks them.

2. **Authentication is provisioned but INERT.** The platform is in development; the auth layer is complete on the client side and switched off so the pilot loop stays frictionless. While inert, caller identity travels as a client-asserted `userEmail` from `localStorage` and RBAC is advisory only — editing one storage key escalates a viewer to `systemAdmin`.

   Activation is a configuration event, not a development one: set `auth.enabled: true`, supply tenant configuration, and implement the server obligations. See **[`AUTHENTICATION_CONTRACT.md`](AUTHENTICATION_CONTRACT.md)**. Diagnostics shows the live posture.

Both items are open. See G-03 and G-04 of the capability assessment.

---

## What's in this repo

### Applications

| App | Entry point | Description |
|-----|------------|-------------|
| **DGO R11.6 Runtime** | `index.html` | Obsidian Harmonized Design System runtime — platform shell with routing, client-side RBAC, state, module boundaries, accessibility and theming. 25 routes. |
| **Document Portal** | `document-portal/index.html` | Public document submission and tracking portal (PWA — service worker, manifest, offline). |
| **Acknowledgement flow** | `newack/index.html` | Acknowledgement / unified hub prototype. |

All are zero-build: no bundler, no transpilation, no server-side rendering. They need a real HTTP server (not `file://`) because browsers block ES-module imports across origins.

### Supporting material

| Path | Contents |
|---|---|
| `docs/visual/` | **The Platform Atlas — start here.** Complete interactive visual documentation of the platform: architecture, trust zones, the document's journey, front-end layering, all 29 workspaces, the core service catalogue, the design system, the authenticating proxy, the public portal, the data model, security and RBAC, the governed lifecycle, quality and deployment. Every figure is derived from the source tree by `scripts/visual-docs-data.mjs` and asserted against the live configuration by `tests/visual-docs.test.mjs`, so it cannot quietly go stale. Has an audience lens (executive / architect / developer / operations), full-text search, and a print stylesheet that produces a real handout. See [`docs/visual/README.md`](docs/visual/README.md). |
| `docs/reference/` | **Reference material of record.** The BRD/FRD hybrid, the platform architecture pack, the DGCEO data model, the SharePoint provisioning specification (10 lists, 97 fields), the flow trigger contracts, and the operations manifest with its signed URLs redacted. Extracted from `ECM_DOCS_DEV.zip`, which was removed from the tree — it carried signed Power Automate trigger URLs for 25 workflows and its irreplaceable content is now readable and diffable. The archive remains in git history. |

---

## Run it

### Option A — in the browser, nothing installed (recommended)

On GitHub: **Code → Codespaces → Create codespace on main**.

It installs dependencies, wires the pilot endpoints and starts the server by itself.
When port 8080 forwards, the platform opens. No terminal, no Node, no local clone —
works from a tablet or phone.

### Option B — on your own machine

Needs Node 20 or newer.

**One command:**

```bash
npm install && npm run go
```

`npm run go` wires the pilot endpoints and starts the server. Nothing else to configure.

Copy `config/config.example.js` to `config/config.local.js` and fill in your endpoints —
or, once the proxy is deployed, set `auth.enabled: true` and `proxyBaseUrl` and leave
`endpoints` empty, so the browser holds no credential at all. See
`docs/deployment/MINIMAL-PILOT.md`.
It never overwrites an existing config unless you pass `--force`.

Authentication stays **inert** for local testing: no sign-in, no token, identity from the
local profile. Exactly as the pilot has always behaved.

```bash
npm run setup            # wire config only
npm run setup -- --force # rewrite after rotating signatures
npm start                # serve
```

Then open:

- Root runtime — <http://localhost:8080/>
- Document portal — <http://localhost:8080/document-portal/>

To serve only the ECM portal on port 8080:

```bash
npm run serve:portal
```

---

## Run tests

Requires Node >= 20. See [`tests/README.md`](tests/README.md) for the design.

```bash
npm test              # import checker + secret ratchet + smoke suite
npm run test:imports  # static ES-module graph check (no browser, ~1s)
npm run test:secrets  # fails on a NEW SAS signature in a tracked file
npm run test:auth     # asserts both authentication postures
npm run test:visual   # asserts the Platform Atlas against the live configuration
npm run test:smoke    # Playwright smoke suite
npm run test:links    # linkinator crawl of both entry points
```

Documentation that is generated rather than written is regenerated with one command each:

```bash
npm run visual        # re-derive docs/visual/platform-data.js from the source tree
npm run architecture  # re-derive docs/architecture/architecture-data.json
```

`npm run test:imports` is the cheapest and the most load-bearing: it verifies every relative import resolves on disk. The runtime once shipped with 12 config modules that were imported but never committed, and because those are *static* imports the failure happened before `core/boot.js` could run its `try/catch` — nothing threw, nothing logged, and the app simply hung on its boot spinner. `index.html` now also carries a 15-second boot watchdog that surfaces the failing URLs instead of hanging.

If your environment ships a browser but cannot download Playwright's pinned Chromium:

```bash
export DGO_CHROME_PATH=/path/to/chrome
export DGO_CHROME_NO_SANDBOX=1   # only if needed
npm run test:smoke
```

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | What it does |
|---|---|
| `imports` | `node tests/check-imports.mjs` — fails fast, gates the rest |
| `smoke` | Playwright smoke suite, uploads the report on failure |
| `links` | Link/asset crawl (`continue-on-error` — depends on external hosts) |
| `secrets` | `node tests/check-secrets.mjs` — fails on a *new* SAS signature |

---

## Configuration

### Root runtime

The runtime reads endpoint URLs from `window.DGO_CONFIG.endpoints`, set before the ES-module graph loads.

1. Copy `config/config.example.js` → `config/config.local.js`.
2. Fill in your **rotated** Power Automate URLs. See `config/config.example.js` for the full key list.

`config/config.local.js` is git-ignored, so it is absent in CI and on a fresh clone. `index.html` loads it with `onerror="void 0"`, so a 404 for it is expected and harmless — the smoke suite and link checker both allow it.

`config/endpoints.config.js` contains **no** hardcoded URLs; it reads from `window.DGO_CONFIG.endpoints` and resolves through `core/endpoint-registry.js`, which redacts `sig`/`sv`/`sp`/`code` before any URL is logged or exported.

## Repo structure

```
.
├── index.html                          Root runtime entry (+ boot watchdog)
├── assets/                             Shared SVG assets
├── config/                             Platform configuration modules (32 files)
│   ├── auth.config.js                  Auth switch — inert until release
│   ├── config.example.js               Documents the endpoint key structure
│   ├── endpoints.config.js             Reads from window.DGO_CONFIG.endpoints
│   ├── module-boundaries.config.js     What each workspace owns, views and must not own
│   ├── rbac.config.js                  Roles, permissions, route access
│   ├── routes.config.js                The 29 declared routes
│   └── workflow-clarity.config.js      Visible workspaces vs guided internal routes
├── core/                               Boot, router, state, services (60 files)
│   ├── auth.js                         Token acquisition, identity, request gating
│   └── lifecycle.js                     The governed state machine and its gates
├── modules/                            Route modules, lazy-loaded (29 files)
├── shared/                             Shell, components, design-system adapter (8 files)
├── styles/                             CSS @layer cascade
│   └── dgo-design-system/              Self-hosted design tokens + fonts
├── document-portal/                    Public document portal (PWA)
├── proxy/                              The authenticating proxy — Worker and node:http hosts
├── docs/
│   ├── visual/                         The Platform Atlas — generated visual documentation
│   ├── architecture/                   Drift-tested architecture sheets and the target design
│   ├── deployment/                     Cloudflare walkthrough and the minimal pilot path
│   └── reference/                      BRD/FRD, data model, provisioning spec, flow contracts
├── tests/
│   ├── README.md                       Suite design and the secrets ratchet
│   ├── auth-posture.test.mjs           Inert + enforced posture assertions
│   ├── check-imports.mjs               Static module-graph check
│   ├── check-secrets.mjs               SAS signature ratchet
│   ├── secrets-baseline.txt            Known-affected files (may only shrink)
│   ├── visual-docs.test.mjs            Asserts the Platform Atlas against the live config
│   └── smoke.spec.js                   Playwright smoke suite
├── scripts/
│   ├── visual-docs-data.mjs            Derives the atlas dataset from the source tree
│   ├── architecture-data.mjs           Derives the architecture dataset
│   └── check-links.mjs                 Link / asset checker
├── .github/workflows/ci.yml            CI
├── LICENSE                             Proprietary — NITDA, all rights reserved
├── AUTHENTICATION_CONTRACT.md          Activation spec + server obligations
├── AUDIT.md                            Repository audit record (see its correction note)
├── CAPABILITY_ASSESSMENT_R11.6.md      Runtime capability assessment and gap analysis
├── REPOSITORY_AUDIT.md                 Repository-wide security/data audit
├── FORENSIC_REPOSITORY_AUDIT.md        Forensic structural audit and disposition register
├── CONTRIBUTING.md
├── package.json
└── playwright.config.js
```

---

## Troubleshooting

### "Failed to load module" / CORS error when opening `index.html` directly

ES modules are blocked by CORS on `file://` URLs. Serve over HTTP:

```bash
npm start                  # http-server on port 8080
# or
python3 -m http.server 8080
```

### The app shows "DGO could not start" after 15 seconds

The boot watchdog fired: the module graph did not resolve. Run `npm run test:imports` — it names the missing file and every module that imports it.

### Fonts / Tailwind / Lucide icons missing

These load from external CDNs (Google Fonts, `cdn.tailwindcss.com`, `unpkg.com`) and are absent offline or behind strict firewalls. The apps degrade gracefully: fallback fonts are defined, icon placeholders shown, no JS error thrown.

---

## Not yet decided

These are open questions, recorded here rather than guessed at:

- **Deployment.** There is no Pages workflow, `.nojekyll`, or staging allow-list in this repository. If GitHub Pages is adopted, decide which of the five apps are published and add a staging step — a new top-level runtime directory will 404 in production while working locally otherwise. Note the security status above: publishing before rotation would expose live credentials.
- **Codespaces.** No `.devcontainer/` exists; the previous one-click setup instructions did not apply here.
- **The ECM Activity Hub is gone.** Retired at decision D6(b); its briefs, meetings and projects capabilities are root modules. Earlier documentation describes it as a live second application — that is historical. See `docs/architecture/CONSOLIDATION_ANALYSIS.md`.
- **Rendered-appearance regression coverage.** None exists beyond the smoke suite's theme check. `styles/index.css` documents unresolved, measured cascade debt in its `overrides` layer.
