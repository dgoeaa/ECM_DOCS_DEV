# DGO Digital Operations R11.1 — Viewport-Compliant Runtime

This is the complete updated runtime package.

## Run

```bash
python scripts/serve.py
```

Open `http://localhost:8080/`.

## Validate

```bash
node tests/static-validation.mjs
node tests/route-contract.mjs
node tests/viewport-containment-contract.mjs
node tests/content-governance-contract.mjs
```

## Implemented layout rules

- The browser page itself does not scroll.
- The footer is always visible inside the application frame.
- Navigation, main workspace, detail pane, modal and table wrappers are the only scrollable regions.
- No module or section is allowed to overshoot the viewport width or height.
- Non-dashboard modules do not render generic KPI blocks.
- Duplicate module titles are removed from content panels.
