# Change Control

## 1. Purpose

This document controls how the platform changes after initial implementation.

## 2. Change Types

### Minor Change

Examples:

- Text update.
- CSS adjustment.
- Small validation message update.

Approval: module owner.

### Standard Change

Examples:

- New view.
- New module route.
- New shared component.
- New flow wrapper.

Approval: platform owner/module owner.

### Major Change

Examples:

- New module.
- New Power Automate endpoint.
- Contract change.
- Security model change.
- External dependency proposal.

Approval: architecture review required.

## 3. Required Change Record

```text
Change title:
Change type:
Reason:
Affected modules:
Affected flows:
Affected shared components:
Risk level:
Rollback plan:
Testing completed:
Approval:
Release date:
```

## 4. Contract Change Rule

Changing these requires versioning or backward compatibility:

- Module lifecycle contract.
- Flow request envelope.
- Flow response envelope.
- Security role model.
- Route registration shape.

## 5. External Dependency Rule

External dependencies are prohibited by default.

If one is proposed, document:

- Why native browser features are insufficient.
- Security implications.
- Offline/static hosting implications.
- Maintenance implications.
- Alternative considered.

Approval must be explicit.
