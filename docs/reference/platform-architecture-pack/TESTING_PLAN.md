# Testing Plan

## 1. Testing Objectives

Testing must prove that:

- Shell loads correctly.
- Modules register correctly.
- Routes work.
- Modules mount and unmount safely.
- Power Automate requests follow contract.
- Power Automate responses normalize correctly.
- Migrated SPAs preserve original behavior.
- Security checks are enforced.
- No external dependency is introduced.

## 2. Test Levels

### 2.1 Static Review

Check:

- Folder structure.
- File naming.
- Import paths.
- Module manifest validity.
- Config validity.
- No external CDN/script references.

### 2.2 Unit-Level Manual Tests

Test pure functions:

- Validators.
- Transformers.
- Request builder.
- Response normalizer.
- Route matcher.
- Permission checks.

### 2.3 Shell Integration Tests

Verify:

- Shell renders.
- Navigation renders enabled modules.
- Disabled modules do not appear.
- Unknown routes show not-found UI.
- Route changes mount correct module.
- Previous module unmounts.

### 2.4 Module Tests

For each module:

- Manifest loads.
- Routes register.
- Main view renders.
- Forms validate.
- Buttons trigger expected handlers.
- Module state updates.
- Module unmount clears DOM/listeners.

### 2.5 Flow Integration Tests

For each flow:

- Valid request succeeds.
- Missing required field fails cleanly.
- Unknown action fails.
- Unknown module fails.
- Response has standard envelope.
- Client displays success/error correctly.
- requestId is returned or traceable.

### 2.6 Migration Regression Tests

For each migrated SPA:

- Compare original and migrated behavior.
- Confirm all original workflows still exist.
- Confirm all original calculations match.
- Confirm all original Power Automate actions still work.
- Confirm UI is acceptable after extraction.

### 2.7 Security Tests

Verify:

- Unauthorized routes blocked.
- Unauthorized module actions hidden/blocked.
- Flow rejects malformed payload.
- Sensitive data is not persisted unexpectedly.
- Production config has no test endpoints.

### 2.8 Performance Checks

Verify:

- Initial shell loads acceptably.
- Modules are lazy-loaded.
- Large views do not block unnecessarily.
- Repeated navigation does not leak memory obviously.

## 3. Acceptance Criteria

A release is acceptable only when:

- All registered modules mount successfully.
- All required flows pass integration tests.
- No known critical regression exists.
- Release checklist passes.
- Documentation is updated.
