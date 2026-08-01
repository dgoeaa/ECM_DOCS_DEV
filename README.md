# DGO Targets

Two pure client-side ES-module web applications powering NITDA's Digital Operations platform.

---

## What's in this repo

| App | Entry point | Description |
|-----|------------|-------------|
| **DGO R11.6 Runtime** | `index.html` | Obsidian Harmonized Design System runtime — full platform shell with routing, RBAC, state, module boundaries, accessibility, and theming. |
| **ECM Activity Hub Portal** | `ECM_ActivityHub_Portal/htdocs/index.html` | Executive SPA — correspondence, approvals, meetings, briefs, decisions, tasks, and AI-assisted operations. |

Both apps are zero-build: no bundler, no transpilation, no server-side rendering. They require a real HTTP server (not `file://`) because browsers block ES-module imports across origins.

---

## Run locally

```bash
git clone https://github.com/dgoeaa/DGO_Targets.git
cd DGO_Targets
npm install
npm start
```

Then open:
- Root runtime: <http://localhost:8080/>
- ECM portal: <http://localhost:8080/ECM_ActivityHub_Portal/htdocs/>

To serve only the portal on port 8080:

```bash
npm run serve:portal
```

---

## Run in Codespaces

1. On GitHub, click **Code → Codespaces → Create codespace on main**.
2. Codespaces will automatically run `npm install` and start the server on port 8080.
3. GitHub forwards port 8080 and opens a preview — no manual steps needed.

Both apps are accessible at the forwarded URL with the same subpaths as local.

---

## Run tests

There are **two independent suites**. Requires Node >= 20.

```bash
npm test            # UI contract suite (tests/run.mjs) — the default gate
npm run test:smoke  # Playwright smoke suite
npm run test:links  # HTML link / asset checker
```

| Command | Runner | What it is |
|---------|--------|------------|
| `npm test` | `node tests/run.mjs` | UI contract suite — static CSS/asset contracts plus browser contracts driven by `puppeteer-core`. Accepted debt is recorded in `tests/baseline.json` and may only shrink. |
| `npm run test:static` | `node tests/run.mjs --suite=static` | Contract suite, static checks only (no browser). |
| `npm run test:browser` | `node tests/run.mjs --suite=browser` | Contract suite, browser checks only. |
| `npm run test:full` | `node tests/run.mjs --full` | Contract suite across every theme / density / viewport combination. |
| `npm run test:smoke` | `playwright test` | Playwright smoke suite (`tests/smoke.spec.js`) — boots the static server automatically. |
| `npm run test:links` | `node scripts/check-links.mjs` | `linkinator` crawl of both apps' entry points. |

The contract suite drives a Chrome/Chromium **you already have** through `puppeteer-core`. It searches `DGO_CHROME_PATH`, `PUPPETEER_EXECUTABLE_PATH`, `CHROME_PATH` and then the usual system paths; if none resolves, the browser half is skipped with a warning and the static half still runs, so `npm test` never fails merely because a browser is absent. CI always provides one. The Playwright suite is separate and downloads its own Chromium on first run:

```bash
npx playwright install --with-deps chromium
```

See [`tests/README.md`](tests/README.md) for the contract suite's design, the baseline ratchet, and the cascade-measurement tooling.

### What the smoke suite checks

For each app:
- HTTP 200 on page load
- Zero uncaught JS errors (catches broken ES-module imports)
- Zero same-origin 4xx/5xx responses (the optional, git-ignored `config.local.js` files are allowed to 404)
- Zero console errors (external CDN / API failures are allow-listed)
- `#app` is mounted with content after `networkidle`
- Critical same-origin assets resolve with 200
- Accessibility: skip-to-main link exists and `#main` is a valid target (root app)

---

## Deploy to GitHub Pages

> **Private repository caveat**: GitHub Pages on a *private* repo requires GitHub Pro, Team, or Enterprise. On a Free plan you must either make the repository public, or push the built output to a separate public repository.

Deployment is **opt-in**, because `actions/configure-pages` fails the whole workflow on every push while Pages is not configured for the repository. To turn it on:

1. **Settings → Pages → Build and deployment → Source: “GitHub Actions”.**
2. **Settings → Secrets and variables → Actions → Variables**: add a repository variable `ENABLE_PAGES` with the value `true`.

Until `ENABLE_PAGES` is set, the jobs in `.github/workflows/pages.yml` are skipped on pushes to `main` instead of failing. A manual **Run workflow** always deploys, and `configure-pages` runs with `enablement: true` so it creates the Pages site itself when the plan allows it.

Once enabled, the workflow deploys on every push to `main`, after the `UI contracts (deploy gate)` job passes. Both apps are served from the same artifact:

| URL | App |
|-----|-----|
| `https://dgoeaa.github.io/DGO_Targets/` | Root runtime |
| `https://dgoeaa.github.io/DGO_Targets/ECM_ActivityHub_Portal/htdocs/` | ECM portal |

The artifact is **not** the whole repository. A staging step copies only what the two apps need to run — `index.html`, `.nojekyll`, `assets/`, `config/`, `core/`, `modules/`, `shared/`, `styles/` and `ECM_ActivityHub_Portal/htdocs/` — so the audit documents, the test harness, the tooling and the embedded bundle are never published. If you add a new top-level runtime directory, add it to that step in `.github/workflows/pages.yml` or it will 404 in production while working locally.

All asset paths use explicit relative (`./`) references so both apps work at `/` (local / Codespaces) and at `/DGO_Targets/` (Pages) without a hardcoded `<base href>`.

---

## Configuration

### Root runtime (Power Automate endpoints)

The root runtime reads endpoint URLs from `window.DGO_CONFIG.endpoints` (set before the ES-module graph loads). To supply real URLs:

1. Copy `config/config.example.js` to `config/config.local.js` and populate the `endpoints` object.
2. See `config/config.example.js` for the full key list and documentation.

`config/config.local.js` is git-ignored and therefore absent in CI and on a fresh clone. `index.html` loads it with `onerror="void 0"`, so a 404 for it is expected and harmless — the smoke suite and the link checker both allow it.

> **Security notice — action outstanding**: The Power Automate SAS-signed URLs that were previously hardcoded in `config/endpoints.config.js` have been removed from the working tree, but **15 distinct SAS signatures remain in 5 git blobs that are still reachable from `main`**. Deleting files or branches does not remove them. A SAS signature *is* a credential, so the only fix is to **rotate / regenerate every one of them in Power Automate**. Do this before making this repository public, and before any history rewrite (a rewrite invalidates every existing clone and should only follow rotation, not replace it).

### ECM Activity Hub Portal

The portal reads its backend URL from `window.DGO_CONFIG.API_URL`. Copy `ECM_ActivityHub_Portal/htdocs/config.example.js` to `ECM_ActivityHub_Portal/htdocs/config.local.js` and set the value there; see the example file for documentation. Like the root runtime's copy, `config.local.js` is git-ignored and optional, so a 404 for it is expected on a fresh clone.

The `powerAutomateClient.js` file contains **no hardcoded secrets** — it is a generic fetch wrapper. All URL configuration flows through `js/core/config.js` and the `DGO_CONFIG` override.

---

## Troubleshooting

### "Failed to load module" / CORS error when opening `index.html` directly

ES modules (`<script type="module">`) are blocked by CORS when opened as `file://` URLs. You must serve the files over HTTP:

```bash
npm start          # uses http-server on port 8080
# or
python3 -m http.server 8080
```

### Fonts / Tailwind / Lucide icons missing

These assets load from external CDNs (Google Fonts, `cdn.tailwindcss.com`, `unpkg.com`). They will be absent in offline environments or behind strict firewalls. The apps degrade gracefully — fallback system fonts are defined, icon placeholders are shown, and no JS error is thrown.

### The large JSON file in the repo root

`DGO_Target_CLEAN_RUNTIME.state.json` is a **live** artifact, not historical baggage: it is a `dgo-embedded-state/v1` bundle of every file matched by `retainedRules` in `CLEAN_PACKAGE_MANIFEST.json`. CI verifies on every push that it matches the working tree.

- Expand it with `python3 tools/expand_bundle.py`.
- **Rebuild it with `python3 tools/rebuild_bundle.py` in the same commit whenever you change any file matched by `retainedRules`** — `index.html`, `README.md`, `assets/**`, `config/**`, `core/**`, `modules/**`, `shared/**`, `styles/**`. Editing a file counts, not just adding or deleting one. Otherwise the `bundle` job in `.github/workflows/ui-contracts.yml` fails its drift check.
- It is marked `-diff linguist-generated=true` in `.gitattributes` so it does not swamp pull-request diffs.

Future ad-hoc `*.state.json` exports are git-ignored (see `.gitignore`). The four unreferenced historical exports that used to sit alongside it have been deleted.

---

## Repo structure

```
.
├── index.html                          Root runtime entry
├── assets/                             Shared SVG assets
├── config/                             Platform configuration modules
│   ├── config.example.js               Documents the endpoint key structure
│   ├── endpoints.config.js             Reads from window.DGO_CONFIG.endpoints
│   └── …                               (config.local.js is git-ignored — create it yourself)
├── core/                               Boot, router, state, services
├── modules/                            Route modules (lazy-loaded)
├── shared/                             Shell, components, design-system adapter
├── styles/                             CSS @layer cascade
│   └── dgo-design-system/              Self-hosted design tokens + fonts
├── ECM_ActivityHub_Portal/
│   ├── htdocs/                         ECM portal (separate app — the only part published)
│   │   ├── index.html
│   │   ├── config.example.js
│   │   ├── powerAutomateClient.js
│   │   └── js/
│   ├── aud_activityhubp_.../           Audit snapshot + manifest for rehydrate.py
│   ├── precision_auditor_v3.py
│   └── REVIEW.md                       Portal security review
├── tests/
│   ├── README.md                       Contract-suite design and baseline rules
│   ├── run.mjs                         UI contract runner (`npm test`)
│   ├── baseline.json                   Accepted debt — may only shrink
│   ├── static/ browser/ lib/ tools/    Contract suites and instrumentation
│   └── smoke.spec.js                   Playwright smoke tests (`npm run test:smoke`)
├── scripts/check-links.mjs             Link / asset checker (`npm run test:links`)
├── tools/                              Bundle expand / rebuild / payload contract
├── CLEAN_PACKAGE_MANIFEST.json         retainedRules driving the bundle
├── DGO_Target_CLEAN_RUNTIME.state.json Embedded state bundle (live — see Troubleshooting)
├── rehydrate.py                        Restores the portal audit snapshot
├── AUDIT.md                            Repository audit record
├── CONTRIBUTING.md
├── .devcontainer/devcontainer.json     Codespaces one-click setup
├── .github/
│   └── workflows/
│       ├── ci.yml                      Playwright smoke tests + link check
│       ├── ui-contracts.yml            Bundle drift + static + browser contracts
│       └── pages.yml                   GitHub Pages deployment
├── package.json
└── playwright.config.js
```
