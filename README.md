# ECM_DOCS_DEV — DGO Digital Operations

Client-side web applications powering NITDA's Digital Operations platform, plus the reference material and flow exports that document it.

> **Read this first.** This README was previously written for a different repository (`dgoeaa/DGO_Targets`) and described a test suite, CI workflows and a bundle manifest that do not exist here. It has been rewritten to describe **this** repository as it actually is. Where something is genuinely undecided it says so rather than guessing. See [`docs/audits/CAPABILITY_ASSESSMENT_R11.6.md`](docs/audits/CAPABILITY_ASSESSMENT_R11.6.md) for the full gap analysis behind these corrections.

---

## ⚠️ Security status — read before publishing this repository

**This repository must not be made public in its current state.**

1. **59 signed Power Automate trigger URLs are committed here**, across 39 tracked files — almost entirely the reference corpus under `docs/reference/foundational/`, which documents the deployed flow estate verbatim by explicit decision (D5). A SAS-signed URL is a bearer credential: possession alone authorizes invoking the flow, so anyone who can read this repository holds all 59.

   > *Corrected 5 August 2026.* This item previously read "4 live signatures in 2 tracked files — `document-portal/js/data.js` and `newack/config.js`". Both statements are now wrong: `data.js` carries no signature and `newack/` no longer exists. The application tree is clean, which is what `npm run test:secrets` guards; the exposure moved to the reference corpus, which that ratchet deliberately does not scan. The count went **up**, not down, because the corpus was committed after the earlier figure was written.

   **Rotate every one of them in Power Automate.** Deleting a file revokes nothing, and neither does rewriting history. `npm run commission` blocks go-live if you wire an endpoint to a signature that is still published here — that is the check that catches an unrotated credential.

2. **Authentication is provisioned but INERT.** The auth layer is complete on the client side and switched off so the pilot loop stays frictionless. While inert, caller identity travels as a client-asserted `userEmail` from `localStorage` and RBAC is advisory only — editing one storage key escalates a viewer to `systemAdmin`.

   Activation is a configuration event, not a development one: set `auth.enabled: true`, supply tenant configuration, and implement the server obligations. See **[`docs/architecture/AUTHENTICATION_CONTRACT.md`](docs/architecture/AUTHENTICATION_CONTRACT.md)**. Diagnostics shows the live posture.

Both items are open. See G-03 and G-04 of the capability assessment.

**Going live?** Read **[`docs/deployment/COMMISSIONING.md`](docs/deployment/COMMISSIONING.md)** first, and run `npm run commission` — it reports exactly which obligations stand between this repository and a live deployment, and which of them only you can discharge.

**Running it for development?** `npm run recover` wires 22 of the 24 endpoints from the documented flow estate in `docs/reference/foundational/`, so development runs against flows that already exist instead of throwaway ones built by hand each cycle. `npm run verify:endpoints` then proves that wiring against the live flows. The signatures it uses are the published ones above — the commissioning gate accepts them for development and refuses them for pilot and production.

---

## What's in this repo

### Applications

| App | Entry point | Description |
|-----|------------|-------------|
| **DGO R11.6 Runtime** | `index.html` | Obsidian Harmonized Design System runtime — platform shell with routing, client-side RBAC, state, module boundaries, accessibility and theming. 25 routes. |
| **Document Portal** | `document-portal/index.html` | Public document submission and tracking portal (PWA — service worker, manifest, offline). |

All are zero-build: no bundler, no transpilation, no server-side rendering. They need a real HTTP server (not `file://`) because browsers block ES-module imports across origins.

### Supporting material

| Path | Contents |
|---|---|
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

`npm run go` scaffolds the config files and starts the server. Nothing else to configure.

With no endpoint URLs supplied the platform runs in **demo mode**: it boots, renders and
transmits nothing. That is the intended state for a fresh clone — the platform is not
inert because something is broken, but because nothing has been wired to a flow yet.

To wire real endpoints, follow `docs/deployment/MINIMAL-PILOT.md` to regenerate each
trigger, then pass them in. The browser calls each Power Automate flow directly, so those
URLs *are* the credential: both target files are git-ignored, and every flow behind them
must authenticate and authorise its own callers.

```bash
npm run setup                                    # scaffold config only
npm run recover                                  # wire the documented estate (development)
npm run setup -- --values ~/dgo-values.txt       # wire your own endpoints
npm run setup -- --force                         # rewrite after rotating signatures
npm run verify:endpoints                         # call each flow and report what came back
npm run commission                               # readiness gate for live usage
npm start                                        # serve
```

`npm run setup` never overwrites an existing config unless you pass `--force`.

Authentication stays **inert** for local testing: no sign-in, no token, identity from the
local profile. Exactly as the pilot has always behaved. Turning it on is a deploy-time
decision — see [`docs/deployment/COMMISSIONING.md`](docs/deployment/COMMISSIONING.md).

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
npm run test:smoke    # Playwright smoke suite
npm run test:links    # linkinator crawl of both entry points
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
├── config/                             Platform configuration modules (31 files)
│   ├── auth.config.js                  Auth switch — inert until release
│   ├── config.example.js               Documents the endpoint key structure
│   ├── endpoints.config.js             Reads from window.DGO_CONFIG.endpoints
│   ├── rbac.config.js                  Roles, permissions, route access
│   ├── routes.config.js                The 25 declared routes
│   └── workflow-clarity.config.js      Visible workspaces vs guided internal routes
├── core/                               Boot, router, state, services (57 files)
│   └── auth.js                         Token acquisition, identity, request gating
├── modules/                            Route modules, lazy-loaded (25 files)
├── shared/                             Shell, components, design-system adapter
├── styles/                             CSS @layer cascade
│   └── dgo-design-system/              Self-hosted design tokens + fonts
├── document-portal/                    Public document portal (PWA)
├── tests/
│   ├── README.md                       Suite design and the secrets ratchet
│   ├── auth-posture.test.mjs           Inert + enforced posture assertions
│   ├── check-imports.mjs               Static module-graph check
│   ├── check-secrets.mjs               SAS signature ratchet
│   ├── commissioning.test.mjs          setup + readiness gate, and that the
│   │                                   documented npm scripts actually exist
│   ├── secrets-baseline.txt            Known-affected files (may only shrink)
│   └── smoke.spec.js                   Playwright smoke suite
├── scripts/
│   ├── setup.mjs                       Writes both config.local.js files
│   ├── lib/endpoint-recovery.mjs       Resolves the documented estate onto contract keys
│   ├── verify-endpoints.mjs            Calls each live flow and reports the response
│   ├── commission-check.mjs            Live-usage readiness gate
│   └── check-links.mjs                 Link / asset checker
├── .github/workflows/ci.yml            CI
├── docs/                               Everything written down — see docs/README.md
│   ├── architecture/                   Target architecture + AUTHENTICATION_CONTRACT.md
│   ├── deployment/                     COMMISSIONING.md, MINIMAL-PILOT.md, LOCAL-DEV.md
│   ├── audits/                         The audit record — start at INDEX.md
│   ├── reference/                      Flow contracts + the raw estate harvest
│   ├── cutover/, forensic/, visual/    Disposition, evidence, generated console
│   ├── policies/                       Universal Filename Policy deliverables
│   └── STATUS_REPORT.md                Position and finding register
├── README.md                           This file
├── CONTRIBUTING.md                     How to work in this repository
├── PLATFORM_DOCUMENTATION.md           What the platform is and how it fits together
├── LICENSE                             Proprietary — NITDA, all rights reserved
├── package.json
└── playwright.config.js
```

Those four markdown files are the whole of the repository root. Everything else
written down lives under `docs/`, indexed by [`docs/README.md`](docs/README.md).

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
