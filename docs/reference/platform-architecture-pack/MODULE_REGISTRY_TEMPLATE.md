# Module Registry Template

Use this file to document every module in the platform.

## Module Entry Template

```text
Module id:
Module name:
Version:
Status: planned/active/disabled/deprecated
Source: new/migrated-SPA
Original SPA file if migrated:
Route base:
Primary users:
Required roles:
Major features:
Submodules:
Flows used:
Shared components used:
Shared validators used:
Shared transformers used:
Storage used:
Known risks:
Owner:
Last tested date:
Notes:
```

## Example

```text
Module id: example-module
Module name: Example Module
Version: 1.0.0
Status: active
Source: new
Original SPA file if migrated: n/a
Route base: /example
Primary users: admin, user
Required roles: example.read, example.write
Major features: create record, list records
Submodules: none
Flows used: exampleCreate, exampleSearch
Shared components used: button, table, toast
Shared validators used: required
Shared transformers used: flow-payloads
Storage used: sessionStorage for filters
Known risks: none
Owner: platform owner
Last tested date: YYYY-MM-DD
Notes: Reference module
```
