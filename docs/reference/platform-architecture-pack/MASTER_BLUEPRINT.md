# Master Platform Blueprint

## 1. Executive Summary

This platform converts multiple independently built, single-file monolithic SPAs into one integrated, modular, maintainable, zero-dependency platform. Each existing SPA becomes a platform module. Large migrated SPAs may be decomposed further into submodules, views, components, services, validators, transformers, and local state files.

The platform integrates directly with existing Microsoft Power Automate HTTP-triggered flows. Browser modules do not call unrelated backends. They call a central flow client that sends standardized request envelopes and receives standardized response envelopes.

## 2. Primary Objectives

- Integrate multiple existing SPAs into one platform.
- Break each monolithic SPA into maintainable files.
- Allow new modules, features, and functions to be added without rewriting the shell.
- Use shared assets, styles, validators, transformers, events, and state services.
- Use direct Power Automate HTTP-triggered flow integration.
- Maintain zero external dependencies.
- Remain deployable as static files.
- Keep modules isolated, replaceable, and independently testable.

## 3. Non-Goals

- No React, Vue, Angular, jQuery, Bootstrap, Axios, Lodash, npm, CDN dependency, bundler, or runtime package manager.
- No server-side framework is required for the base architecture.
- No direct coupling between modules.
- No hardcoded business process logic inside the shell.
- No platform redesign required when a new module is added.

## 4. Conceptual Architecture

```text
Browser
  |
  | index.html
  v
Platform Shell
  |
  |-- Router
  |-- Module Loader
  |-- Navigation
  |-- Layout
  |-- Error Boundary
  |
  v
Modules
  |
  |-- Converted SPA modules
  |-- New native modules
  |-- Submodules where needed
  |
  v
Core Services
  |
  |-- Flow Client
  |-- Event Bus
  |-- State Store
  |-- Auth/Identity Context
  |-- Validators
  |-- Transformers
  |
  v
Power Automate HTTP-triggered flows
```

## 5. Runtime Flow

```text
1. User opens index.html.
2. shell/shell.js loads app configuration.
3. Module loader reads enabled modules.
4. Router registers module routes.
5. Navigation renders available modules.
6. User opens a route.
7. Shell mounts the route's module.
8. Module calls its local api.js.
9. Module api.js calls core/api/flow-client.js.
10. Flow client sends standardized JSON to Power Automate.
11. Power Automate validates/processes/responds.
12. Flow client normalizes the response.
13. Module updates UI/state.
```

## 6. Core Layers

### 6.1 Shell Layer

Responsible for:

- Bootstrapping the application.
- Rendering layout.
- Loading modules.
- Registering routes.
- Mounting/unmounting modules.
- Rendering navigation.
- Enforcing top-level permissions.
- Catching fatal rendering errors.

Must not contain:

- Module-specific business logic.
- Flow-specific payload mapping.
- Hardcoded references to migrated SPA internals.

### 6.2 Core Layer

Responsible for reusable platform behavior:

- API/flow communication.
- Request building.
- Response normalization.
- Event bus.
- Router.
- State store.
- Session/identity context.
- Logging.
- Sanitization.
- Error normalization.

### 6.3 Shared Layer

Responsible for reusable UI and processing assets:

- Buttons, modals, tables, forms, loading indicators, toasts.
- Shared CSS tokens and layout rules.
- Validators.
- Transformers.
- Hooks/helpers.
- Assets.

### 6.4 Module Layer

Responsible for business capabilities:

- Own views.
- Own components.
- Own module routes.
- Own local state.
- Own flow call wrappers.
- Own validation rules if not shared.
- Own data transformation mapping if not shared.

## 7. Power Automate Integration Model

Each module may call one or more Power Automate flows through `core/api/flow-client.js`. Modules must not manually call flow URLs using raw `fetch()` unless explicitly justified in architecture decisions.

Standard request envelope:

```json
{
  "meta": {
    "requestId": "REQ-000001",
    "moduleId": "module-name",
    "action": "actionName",
    "timestamp": "2026-06-29T18:33:00Z",
    "appVersion": "1.0.0"
  },
  "user": {
    "id": "user-id",
    "name": "User Name",
    "roles": []
  },
  "data": {}
}
```

Standard response envelope:

```json
{
  "success": true,
  "status": 200,
  "message": "Completed",
  "data": {},
  "errors": [],
  "meta": {
    "requestId": "REQ-000001",
    "flowName": "FlowName",
    "durationMs": 1000
  }
}
```

## 8. Module Expansion Strategy

A new module is added by:

1. Copying `modules/_template`.
2. Renaming manifest values.
3. Adding routes.
4. Adding views/components.
5. Registering module in `config/modules.config.js`.
6. Registering flow endpoints in `config/flows.config.js` if needed.
7. Testing mount/unmount and flow calls.

No shell rewrite should be required.

## 9. Legacy SPA Migration Strategy

Each single-file SPA is migrated by extraction:

```text
Monolithic HTML file
  -> Extract CSS
  -> Extract reusable components
  -> Extract page views
  -> Extract global state
  -> Extract API/Power Automate calls
  -> Extract validators
  -> Extract transformers
  -> Wrap in module lifecycle contract
```

## 10. Deployment Model

The platform can run as static files from:

- Android/Termux-accessible storage.
- Static web hosting.
- SharePoint document library/static page context where permitted.
- Any HTTPS static host.

If service-worker caching is enabled, it must be tested carefully to avoid stale flow configuration.
