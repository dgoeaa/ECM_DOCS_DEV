# Test suite

Three checks, ordered cheapest-first. `npm test` runs all of them.

| Command | Runner | Needs a browser? | What it asserts |
|---|---|---|---|
| `npm run test:imports` | `tests/check-imports.mjs` | No | Every relative ES-module import reachable from either app's entry points resolves on disk |
| `npm run test:secrets` | `tests/check-secrets.mjs` | No | No *new* Power Automate SAS signature has entered a tracked file |
| `npm run test:smoke` | `tests/smoke.spec.js` (Playwright) | Yes | Each app boots, every route mounts, themes repaint, no same-origin 4xx/5xx |
| `npm run test:links` | `scripts/check-links.mjs` | No | Same-origin links and assets on both entry pages resolve |

## Why these three

This suite was written after an assessment found that **12 config modules the runtime imports had never been committed**. The app did not crash — it hung on its boot spinner indefinitely, because static module resolution fails *before* `core/boot.js` can run its `try/catch`, so nothing threw and nothing logged a stack.

Each check closes part of that hole:

- **`check-imports.mjs`** catches it statically, in under a second, with no browser. This is the check that would have caught the original failure. Run it first.
- **`smoke.spec.js`** catches it dynamically via `window.__DGO_BOOTED__`, which is only set once the graph resolved, every route module registered and the shell replaced the spinner. Asserting "the page returned 200" would *not* have caught it.
- **`check-secrets.mjs`** guards the credential exposure recorded as gap G-03.

## The secrets ratchet

`tests/secrets-baseline.txt` lists the files already known to carry SAS signatures. The check:

- **fails** if a file *not* in the baseline gains a signature — a new leak;
- **fails** if a baselined file no longer has one, so the list cannot drift out of date;
- **reports but does not fail** on the baselined files themselves.

That last point is deliberate. A SAS-signed Power Automate URL is a bearer credential, and **deleting the file revokes nothing** — each signature must be rotated in Power Automate first. Failing the build on already-known exposure would make CI permanently red without making anything safer. When a signature is rotated and scrubbed, remove its file from the baseline; the list may only shrink.

Placeholders such as `sig=ROTATE_ME` are shorter than the 20-character threshold and are ignored, so `config/config.example.js` stays clean.

## Running the browser suite locally

CI installs Playwright's pinned Chromium (`npx playwright install --with-deps chromium`). If you are in a sandbox that already ships a browser and cannot download that build, point the suite at the one you have:

```bash
export DGO_CHROME_PATH=/path/to/chrome
export DGO_CHROME_NO_SANDBOX=1   # only if your environment needs --no-sandbox
npm run test:smoke
```

`playwright.config.js` also honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `CHROME_PATH`. With none set it uses the pinned browser, which is what CI does.

## Adding a test

Put boot/asset/route-level assertions in `tests/smoke.spec.js`. Use `?skipWelcome=1` so the welcome overlay does not block the shell — both welcome layers honour it.

Prefer a static check over a browser test where the property can be checked without rendering. The import checker runs in a second and never flakes; the browser suite takes ~25s and depends on a working Chromium.

## Known gaps

This suite is not the CSS-contract-and-baseline harness the README once described; that tooling is absent from the repository and from the archived platform copy, so there was nothing to restore. There is currently **no rendered-appearance regression coverage** beyond the theme check in the smoke suite — CSS cascade changes are not measured. `styles/index.css` documents unresolved, measured cascade debt in its `overrides` layer that a future contract suite should ratchet down.
