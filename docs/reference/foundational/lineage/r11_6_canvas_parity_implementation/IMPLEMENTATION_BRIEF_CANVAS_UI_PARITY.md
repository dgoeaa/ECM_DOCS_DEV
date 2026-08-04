# Implementation Brief — Canvas UI Logic Parity for DGO R11.6 HTML Platform

## Objective

Implement full Canvas UI Logic Parity into the DGO R11.6 HTML platform using the existing HTML platform as the replacement foundation and the Canvas forensic atlas as the authoritative source for Activities UI logic.

## Evidence

Use the following files:

```text
evidence/Download Performance Hardening Sprint Report.json
evidence/canvas_control_lay_state.forensic.json
```

## Required execution

The implementation must reconstruct or use the embedded HTML platform source from the sprint report package, preserve the platform architecture, then implement Activities parity.

The implementation must not be partial.

The implementation must not be a demo.

The implementation must not be a sample.

The implementation must not use placeholders.

The implementation must not bypass governance.

## Required output

The final pull request must include:

```text
config/activity-parity.config.js
Activities parity state/controller/service implementation
Activities parity UI components or equivalent updates
Action ownership/routing registrations
Archive/SIWES/NYSC implementation
Attachment/PDF implementation
Filter/search implementation
Responsive and accessibility implementation
Tests for all parity behaviours
IMPLEMENTATION_REPORT_CANVAS_UI_PARITY.md
```

## Required acceptance

Completion is accepted only when:

```text
All Activities parity tests pass.
All existing platform tests pass.
Archive, SIWES, and NYSC Reference_ID generation matches Canvas formulas.
DGO DIGITAL OPS update semantics match Canvas formulas.
Attachment/PDF behaviour matches Canvas formulas.
Filter/search behaviour matches Canvas formulas.
Responsive behaviour passes certified viewport checks.
Accessibility behaviour passes dialog/focus/keyboard checks.
No endpoint/RBAC/state/action-ownership governance has been weakened.
```
