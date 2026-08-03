# Guiding Principles

## 1. Zero External Dependencies

The platform must use browser-native capabilities only:

- HTML
- CSS
- Vanilla JavaScript ES Modules
- `fetch()`
- `localStorage` / `sessionStorage`
- `CustomEvent` / `EventTarget`
- Web Components only where they simplify implementation

No dependency may be introduced without an architecture decision record.

## 2. Modular by Default

Every business capability belongs in a module. Every large module may be decomposed into submodules.

A module must be:

- Self-contained.
- Routable.
- Lazy-loadable.
- Permission-aware.
- Mount/unmount safe.
- Flow-aware where needed.
- Replaceable without breaking unrelated modules.

## 3. Shared Core, Isolated Modules

Core services are shared. Business logic is isolated.

Allowed shared items:

- UI primitives.
- Validators.
- Transformers.
- Event bus.
- Router.
- Flow client.
- State store.
- Error/log utilities.

Not allowed:

- Module A directly mutating Module B internals.
- Shell containing module-specific logic.
- Hardcoded route behavior outside module configuration.

## 4. Stable Contracts

The platform depends on stable contracts:

- Module contract.
- Flow request contract.
- Flow response contract.
- Route contract.
- Permission contract.
- Error contract.

If a contract must change, it must be backward-compatible or versioned.

## 5. Configuration-Driven Expansion

New modules and flows are registered through config files, not by editing core logic.

## 6. Flow Integration Consistency

All Power Automate calls must use the shared flow client unless formally exempted.

Every request must include:

- `requestId`
- `moduleId`
- `action`
- `timestamp`
- `data`

Every flow should respond with:

- `success`
- `status`
- `message`
- `data`
- `errors`
- `meta`

## 7. Security First

- Flow URLs are sensitive.
- No client-side secret is truly secret.
- Validate on the client for user experience.
- Validate inside Power Automate for enforcement.
- Reject unknown module/action pairs.
- Use role checks in the shell and module.
- Use Power Automate trigger restrictions where available.

## 8. Migration Without Regression

Existing SPA behavior must be preserved before enhancement.

Migration sequence:

1. Preserve current behavior.
2. Extract structure.
3. Normalize flow calls.
4. Replace duplicated components.
5. Improve maintainability.
6. Add new functionality only after baseline parity.

## 9. No Silent Failures

All errors must be handled visibly or logged:

- User-friendly message.
- Technical details in debug logs.
- Associated `requestId` where flow-related.

## 10. Future-Proofing

All new work must assume growth:

- More modules.
- More flows.
- More users.
- More roles.
- More views.
- More shared components.
- More migrated legacy SPAs.
