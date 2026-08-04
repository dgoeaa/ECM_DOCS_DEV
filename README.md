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
| `docs/reference/` | **Reference material of record.** The BRD/FRD hybrid, the platform architecture pack, the DGCEO data model, the SharePoint provisioning specification (10 lists, 97 fields), the flow trigger contracts, and the operations manifest with its signed URLs redacted. Extracted from `ECM_DOCS_DEV.zip`, which was removed from the tree — it carried signed Power Automate trigger URLs for 25 workflows and its irreplaceable content is now readable and diffable. The archive remains in git history. |

---

## Run it

Needs Node 20 or newer. Nothing else — no account, no cloud tenant, no install step.

```bash
npm run dev
```

Then open <http://localhost:8080/>.

Or with nothing installed at all: on GitHub, **Code → Codespaces → Create codespace**. It
runs the same command on attach and forwards port 8080, so the platform opens by itself —
no terminal, no Node, no local clone.

That starts one zero-dependency Node process that serves both applications and answers
every endpoint they call, from a seeded registry that persists to `.devdata/`. No Entra, no
Power Automate, no SharePoint, no Cloudflare, and no signed URLs anywhere.

| | |
|---|---|
| Operations platform | <http://localhost:8080/> |
| Document portal | <http://localhost:8080/portal/> |
| Health and endpoint status | <http://localhost:8080/healthz> |
| What the platform "sent" | <http://localhost:8080/api/dev/outbox> |

A letter submitted on the portal is minted a reference, lands in the registry, and shows up
in Correspondence in the operations app — the two halves are wired to each other, not run as
separate demos.

Useful while you are in there: the step-up OTP is `000000`, the portal's email verification
code is `123456`, `?skipWelcome=1` skips the welcome splash, and `npm run dev:reset` puts
the data back.

**The dev server is not the authenticating proxy and does not replace it.** It validates no
token and authorizes no action, which is why it binds loopback only and refuses to start
under `NODE_ENV=production`. Governance is enforced by [`proxy/`](proxy/README.md), in front
of real flows. Full detail, including what it does and does not reproduce:
**[`docs/deployment/LOCAL-DEV.md`](docs/deployment/LOCAL-DEV.md)**.

### Running against real endpoints instead

Copy `config/config.example.js` to `config/config.local.js` and fill in your endpoints —
or, once the proxy is deployed, set `auth.enabled: true` and `proxyBaseUrl` and leave
`endpoints` empty, so the browser holds no credential at all. See
[`docs/deployment/MINIMAL-PILOT.md`](docs/deployment/MINIMAL-PILOT.md).

`npm run setup:dev` never overwrites a config it did not generate; pass `--force` to
replace one.

```bash
npm run setup:dev             # write the local config only, don't start
npm run setup:dev -- --force  # replace a config the script did not write
npm start                     # static host only, no backend
npm run start:proxy           # the real authenticating proxy (needs a tenant)
```

---

## Run tests

Requires Node >= 20. See [`tests/README.md`](tests/README.md) for the design.

```bash
npm test                # everything, cheapest first
npm run test:imports    # static ES-module graph check (no browser, ~1s)
npm run test:secrets    # fails on a NEW SAS signature in a tracked file
npm run test:auth       # asserts both authentication postures
npm run test:proxy      # the authenticating proxy, against real RSA tokens
npm run test:devserver  # the local dev backend answers in the real shapes
npm run test:smoke      # Playwright smoke suite
npm run test:links      # linkinator crawl of both entry points
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
| `imports` | `node tests/check-imports.mjs` — fails fast, gates the rest, then the no-browser suites: governance, encoding, hardening, auth postures, proxy, intake, uploads and the local dev server |
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
├── newack/                             Acknowledgement flow prototype
├── tests/
│   ├── README.md                       Suite design and the secrets ratchet
│   ├── auth-posture.test.mjs           Inert + enforced posture assertions
│   ├── check-imports.mjs               Static module-graph check
│   ├── check-secrets.mjs               SAS signature ratchet
│   ├── secrets-baseline.txt            Known-affected files (may only shrink)
│   ├── smoke.spec.js                   Playwright smoke suite
│   └── dev-server.test.mjs             Dev-server contract shapes (33 assertions)
├── scripts/
│   ├── check-links.mjs                 Link / asset checker
│   ├── dev-server.mjs                  Local dev backend — both apps + every endpoint
│   ├── dev-setup.mjs                   Writes the two git-ignored local configs
│   └── dev/                            Seed dataset, store, endpoint and intake handlers
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
npm run dev                # both apps + every endpoint, on port 8080
# or, static files only, no backend
npm start
```

### The platform loads but every list is empty

Nothing is answering the endpoints. `npm run dev` wires and starts the local backend;
check <http://localhost:8080/healthz> and confirm `config/config.local.js` exists. If you
are pointing at real flows instead, Diagnostics lists which contract keys resolve.

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
