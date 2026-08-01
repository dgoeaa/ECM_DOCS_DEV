# Contributing to DGO Targets

Thank you for contributing! This document explains the branch → PR → CI → merge → auto-deploy workflow.

---

## Development workflow

### 1. Clone and set up

```bash
git clone https://github.com/dgoeaa/DGO_Targets.git
cd DGO_Targets
npm install
npx playwright install --with-deps chromium
```

### 2. Create a feature branch

```bash
git checkout -b your-username/short-description
```

### 3. Run the dev server locally

```bash
npm start
# Root runtime:  http://localhost:8080/
# ECM portal:    http://localhost:8080/ECM_ActivityHub_Portal/htdocs/
```

### 4. Make your changes

Both apps are zero-build. Edit HTML/CSS/JS files and refresh the browser — no rebuild step.

### 5. Run tests before pushing

```bash
npm test            # UI contract suite (tests/run.mjs) — must pass
npm run test:smoke  # Playwright smoke tests — must pass
npm run test:links  # Link / asset check
```

`npm test` is the **UI contract suite**, not Playwright. It compares the rendered result against the accepted debt recorded in `tests/baseline.json`; that number may only fall. Never run `npm run baseline:update` to make a red build green — see [`tests/README.md`](tests/README.md).

If your change touched any file matched by `retainedRules` in `CLEAN_PACKAGE_MANIFEST.json` — `index.html`, `README.md`, `assets/**`, `config/**`, `core/**`, `modules/**`, `shared/**`, `styles/**` — regenerate the embedded bundle **in the same commit**. Editing a file counts, not just adding or deleting one:

```bash
python3 tools/rebuild_bundle.py
python3 tools/rebuild_bundle.py --check   # what CI's `bundle` job runs
```

### 6. Open a pull request

- Push your branch and open a PR against `main`.
- Two workflows run automatically:

  | Workflow | Job | What it does |
  |----------|-----|--------------|
  | `.github/workflows/ci.yml` | `smoke` | Playwright smoke tests (`npm run test:smoke`) |
  | | `link-check` | HTML link / asset checker (`npm run test:links`) |
  | `.github/workflows/ui-contracts.yml` | `bundle` | `tools/rebuild_bundle.py --check` — fails if the embedded bundle has drifted from the tree |
  | | `static` | Static CSS / asset contracts (`npm run test:static`) |
  | | `browser` | Browser contracts against the baseline (`npm run test:browser`) |

- All checks must be green before merge.
- A failing test upload is available as a GitHub Actions artifact.

### 7. Merge and deploy

- After approval and green CI, merge to `main`.
- The Pages workflow (`.github/workflows/pages.yml`) runs automatically:
  1. Runs the UI contract suite as a deploy gate (`contracts` job).
  2. Stages only the runtime files into `_site` and deploys them to GitHub Pages.

  The staging step is an allow-list. A new top-level runtime directory must be added to it or it will 404 in production while working locally.

---

## Code style

- No build step, no bundler, no transpilation.
- Keep ES-module imports relative (`./` or `../`). Do not use absolute paths (`/`).
- Do not add dependencies without discussion — the goal is zero runtime dependencies.
- All JS/CSS changes must leave both `npm test` and `npm run test:smoke` green.

---

## Adding tests

There are two suites, and they are for different things.

**Smoke tests** — `tests/smoke.spec.js`, run by `npm run test:smoke`. Use these for "does the app boot and load its assets" assertions. Add to the relevant `test.describe` block:

```js
test('my new assertion', async ({ page }) => {
  await page.goto('/?skipWelcome=1', { waitUntil: 'networkidle' });
  // ... your assertions
});
```

Use `?skipWelcome=1` when the root app's welcome overlay would block the shell from rendering.

**UI contracts** — `tests/`, run by `npm test`. Use these for anything about rendered appearance, the CSS cascade, design tokens, theming, density or accessibility. They are baseline-ratcheted and have their own conventions; read [`tests/README.md`](tests/README.md) before adding one. That document also covers the cascade-measurement tooling (`tests/tools/cascade-snapshot.mjs`), which is the instrument to use before claiming a CSS change is render-neutral.

---

## Secrets and configuration

**Never commit real Power Automate SAS URLs or API keys.** See `config/config.example.js` and `ECM_ActivityHub_Portal/htdocs/config.example.js` for the configuration pattern.

Local configuration goes in `config/config.local.js` and `ECM_ActivityHub_Portal/htdocs/config.local.js`. Both are **git-ignored and untracked** — you create them yourself by copying the matching `config.example.js`. They are absent in CI and on a fresh clone, which is why a 404 for them is expected and allow-listed by the test suites. Because they are ignored, real URLs placed there stay local; do not `git add -f` them.

---

## Reporting issues

Open a GitHub Issue describing:
1. What you expected to happen.
2. What actually happened.
3. Steps to reproduce (including browser, OS, and `node --version`).
