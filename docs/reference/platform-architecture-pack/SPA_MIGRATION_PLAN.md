# Existing SPA Migration Plan

## 1. Purpose

This document defines how existing single-file monolithic SPAs are converted into platform modules without losing current functionality.

## 2. Migration Inventory Template

For each SPA, document:

```text
SPA name:
Current file name:
Current owner:
Current purpose:
Main users:
Major features:
Forms:
Tables/lists:
Charts/reports:
Power Automate calls:
Storage usage:
Global variables:
Inline CSS blocks:
External links/assets:
Known bugs:
Migration priority:
Risk level:
Target module name:
Required submodules:
```

## 3. Migration Phases

### Phase 1: Preserve

- Save original SPA unchanged.
- Record current behavior.
- Identify all user flows.
- Identify all Power Automate URLs/calls.
- Identify all localStorage/sessionStorage usage.

### Phase 2: Extract Styles

Move:

```text
<style>...</style>
```

Into:

```text
modules/module-name/styles.css
```

Repeated global style patterns should later move into `shared/styles`.

### Phase 3: Extract Views

Each large page section becomes a view:

```text
modules/module-name/views/list.view.js
modules/module-name/views/detail.view.js
modules/module-name/views/form.view.js
modules/module-name/views/report.view.js
```

### Phase 4: Extract Components

Repeated UI blocks become components:

```text
modules/module-name/components/search-panel.js
modules/module-name/components/result-table.js
modules/module-name/components/action-toolbar.js
```

If reused by other modules, move to:

```text
shared/components/
```

### Phase 5: Extract State

Global variables become module state:

```text
modules/module-name/state.js
```

### Phase 6: Extract Flow/API Calls

All direct Power Automate calls move to:

```text
modules/module-name/api.js
```

They must call:

```text
core/api/flow-client.js
```

### Phase 7: Extract Validators

Form validation becomes:

```text
modules/module-name/validators/
```

Reusable validation becomes:

```text
shared/validators/
```

### Phase 8: Extract Transformers

Payload and view conversion becomes:

```text
modules/module-name/transformers/
```

Reusable transformations become:

```text
shared/transformers/
```

### Phase 9: Wrap in Module Contract

Create:

```text
module.manifest.js
index.js
routes.js
```

### Phase 10: Regression Test

Confirm migrated module matches original SPA behavior before enhancement.

## 4. Submodule Criteria

Create submodules if a migrated SPA has:

- More than five major views.
- Multiple independent workflows.
- Distinct user roles.
- Separate Power Automate flow groups.
- Large reporting/admin sections.

Example:

```text
modules/procurement/
├── submodules/
│   ├── requests/
│   ├── approvals/
│   ├── vendors/
│   └── reports/
```

## 5. Migration Output Standard

Every migrated SPA must produce:

```text
modules/converted-spa-name/
├── module.manifest.js
├── index.js
├── routes.js
├── state.js
├── api.js
├── components/
├── views/
├── validators/
├── transformers/
├── compatibility-layer.js
└── styles.css
```

## 6. Completion Criteria

A migration is complete when:

- Original feature behavior is preserved.
- Module loads through shell.
- Routes work.
- Power Automate calls use flow client.
- Styles are isolated or shared properly.
- Validators are separated.
- No unnecessary global variables remain.
- Module unmounts safely.
- Regression checklist passes.
