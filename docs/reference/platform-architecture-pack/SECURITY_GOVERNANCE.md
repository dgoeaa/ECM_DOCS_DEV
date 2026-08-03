# Security and Governance Plan

## 1. Security Principles

- Treat Power Automate endpoint URLs as sensitive.
- Never place private credentials in frontend files.
- Validate all inputs inside Power Automate, not only in the browser.
- Restrict flows to known module/action combinations.
- Use role-based access in the platform.
- Use Power Automate trigger authentication restrictions where available.
- Log request IDs for traceability.

## 2. Client-Side Security

Client-side checks improve user experience but are not sufficient for enforcement.

Required client-side controls:

- Route permission check.
- Module permission check.
- Form validation.
- Sanitized DOM insertion.
- Normalized error display.
- No secrets in JS.

## 3. Flow-Side Security

Every flow must validate:

```text
meta.requestId
meta.moduleId
meta.action
required data fields
authorized caller or expected user context
allowed operation
```

Reject requests with:

- Missing request IDs.
- Unknown module IDs.
- Unknown actions.
- Invalid payloads.
- Unauthorized roles.

## 4. Endpoint Governance

Flow endpoints must be documented in the flow registry.

Allowed storage locations:

```text
config/flows.config.js
config/flows.dev.config.js
config/flows.prod.config.js
```

Disallowed:

```text
Hardcoded URLs inside views
Hardcoded URLs inside components
Flow endpoints duplicated across modules
```

## 5. Role Model

Recommended baseline roles:

```text
admin       Full module and configuration visibility
manager     Approval/review capabilities
user        Standard business operations
viewer      Read-only access
```

Roles should be declared in:

```text
config/security.config.js
modules/*/module.manifest.js
modules/*/routes.js
```

## 6. Data Handling

Sensitive data rules:

- Do not persist sensitive records in localStorage unless explicitly approved.
- Prefer sessionStorage for temporary UI context.
- Clear temporary state on logout/session reset.
- Avoid exposing raw flow errors to end users.
- Show friendly messages and keep technical details in debug logs.

## 7. Auditability

Every flow request must have:

- requestId.
- timestamp.
- moduleId.
- action.
- user context where available.

Every Power Automate response should return the same requestId.

## 8. Environment Separation

Use separate configs for:

```text
dev
test
prod
```

No test flow URL should remain in production config.

## 9. Change Approval

Changes requiring review:

- New module.
- New flow endpoint.
- New role.
- New shared component used across modules.
- Change to request/response envelope.
- Any introduction of external dependency.

## 10. Incident Response

If a flow URL is exposed incorrectly:

1. Disable or regenerate the flow endpoint if necessary.
2. Review flow run history.
3. Check request IDs and payloads.
4. Update config.
5. Release patched platform files.
6. Record incident and mitigation.
