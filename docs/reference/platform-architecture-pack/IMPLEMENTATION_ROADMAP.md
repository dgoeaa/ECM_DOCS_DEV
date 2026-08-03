# Implementation Roadmap

## Phase 0: Preparation

Deliverables:

- Confirm root path.
- Create folder structure.
- Save architecture documentation pack.
- Inventory existing SPAs.
- Inventory existing Power Automate flows.

Exit criteria:

- Documentation pack exists.
- SPA inventory started.
- Flow registry started.

## Phase 1: Platform Skeleton

Build:

```text
index.html
config/app.config.js
config/modules.config.js
config/flows.config.js
shell/shell.js
shell/layout.js
shell/navigation.js
shell/module-loader.js
```

Exit criteria:

- App opens.
- Shell renders layout.
- Config loads.

## Phase 2: Core Services

Build:

```text
core/api/flow-client.js
core/api/request-builder.js
core/api/response-normalizer.js
core/events/event-bus.js
core/router/router.js
core/state/store.js
core/utils/logger.js
core/utils/errors.js
```

Exit criteria:

- Routes register.
- Events emit/subscribe.
- State updates.
- Mock flow call normalizes response.

## Phase 3: Shared Foundation

Build:

```text
shared/styles/reset.css
shared/styles/tokens.css
shared/styles/layout.css
shared/styles/components.css
shared/components/button.js
shared/components/modal.js
shared/components/table.js
shared/components/toast.js
shared/components/loading.js
shared/validators/required.js
shared/validators/schema.js
shared/transformers/flow-payloads.js
```

Exit criteria:

- Shared styles apply.
- Shared components render.
- Validators return standard results.

## Phase 4: Module Template

Build:

```text
modules/_template/module.manifest.js
modules/_template/index.js
modules/_template/routes.js
modules/_template/state.js
modules/_template/api.js
modules/_template/styles.css
```

Exit criteria:

- Template module loads.
- Template route mounts.
- Template unmounts cleanly.

## Phase 5: Pilot SPA Migration

Select one existing SPA with moderate complexity.

Tasks:

- Inventory current behavior.
- Extract styles.
- Extract views/components.
- Extract state.
- Extract flow calls.
- Wrap as module.
- Register in config.
- Test against original.

Exit criteria:

- Pilot works inside shell.
- Flow integration works.
- Migration pattern confirmed.

## Phase 6: Standardization After Pilot

Refactor:

- Move repeated components to shared.
- Move repeated validators to shared.
- Move repeated transformers to shared.
- Update module template based on lessons.

Exit criteria:

- Template reflects real migration needs.

## Phase 7: Remaining SPA Migration

Migrate SPAs by priority:

```text
High business value + low risk first
High business value + high risk second
Low business value last
```

Exit criteria:

- All target SPAs exist as modules.

## Phase 8: Hardening

Perform:

- Security review.
- Flow endpoint review.
- Error handling review.
- Accessibility review.
- Performance review.
- Offline/cache review if enabled.

Exit criteria:

- Release checklist passes.

## Phase 9: Release

Deliver:

- Production config.
- Final flow registry.
- Final module registry.
- Release notes.
- Rollback plan.

Exit criteria:

- Platform ready for use.

## Phase 10: Continuous Expansion

For future features:

- Add module or submodule.
- Register config.
- Add flow contract.
- Test.
- Release through checklist.
