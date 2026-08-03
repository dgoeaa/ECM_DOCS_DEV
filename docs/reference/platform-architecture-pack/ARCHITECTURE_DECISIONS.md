# Architecture Decisions

## ADR-001: Use Vanilla JavaScript ES Modules

**Decision:** Use browser-native ES modules with no framework.

**Rationale:** Meets zero-dependency requirement, reduces deployment complexity, improves portability, and allows static hosting.

**Implications:** Developers must follow strict coding standards because no framework enforces structure.

## ADR-002: Use a Platform Shell

**Decision:** A central shell handles layout, routing, navigation, module loading, and error boundaries.

**Rationale:** Prevents each migrated SPA from reinventing app structure.

**Implications:** Shell must remain generic and must not contain business logic.

## ADR-003: Use a Fixed Module Contract

**Decision:** Every module exports `init`, `mount`, and `unmount` functions plus manifest metadata.

**Rationale:** Enables plug-in style expansion and safe migration of monolithic SPAs.

**Implications:** Non-conforming modules cannot be registered.

## ADR-004: Use Power Automate as Backend Automation Layer

**Decision:** Existing Power Automate HTTP-triggered flows are called directly by the platform via a shared flow client.

**Rationale:** Preserves current automation investments and avoids introducing an external backend dependency.

**Implications:** Flow endpoints must follow a strict request/response contract.

## ADR-005: Use Standard Request and Response Envelopes

**Decision:** All flow calls use a standard JSON envelope.

**Rationale:** Enables uniform validation, logging, error handling, and tracing.

**Implications:** Existing flows may need wrapper logic or response normalization.

## ADR-006: Use Config-Driven Registration

**Decision:** Modules, routes, and flows are registered in config files.

**Rationale:** Avoids modifying core code for expansion.

**Implications:** Config validation is required.

## ADR-007: Isolate Module State by Default

**Decision:** Each module owns its local state unless data is intentionally shared.

**Rationale:** Prevents unintended breakage across modules.

**Implications:** Shared state must be justified.

## ADR-008: Use Event Bus for Cross-Module Communication

**Decision:** Modules communicate through events, not direct imports into each other's internals.

**Rationale:** Reduces coupling and supports module replacement.

**Implications:** Event names must be documented.

## ADR-009: Prefer Progressive Migration

**Decision:** Migrate one SPA first as a pilot before converting all others.

**Rationale:** Validates the architecture with real code and reduces large-scale migration risk.

**Implications:** First module becomes the reference implementation.

## ADR-010: No Secrets in Client Code

**Decision:** Do not place private credentials or secrets in browser JavaScript.

**Rationale:** Browser code is inspectable.

**Implications:** Flow security must rely on Power Automate trigger restrictions, flow-side validation, environment governance, and minimal exposure.
