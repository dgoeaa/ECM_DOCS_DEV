# Flow Registry Template

Use this file to document every Power Automate HTTP-triggered flow used by the platform.

## Flow Entry Template

```text
Flow key:
Flow display name:
Environment: dev/test/prod
Owning module:
Action:
HTTP method: POST
Endpoint location: config/flows.config.js
Endpoint value: [DO NOT PASTE SECRETS IN PUBLIC DOCS]
Trigger authentication mode:
Required request fields:
Optional request fields:
Response data shape:
Error conditions:
Timeout expectation:
Retry allowed: yes/no
Last tested date:
Owner:
Notes:
```

## Example

```text
Flow key: exampleCreate
Flow display name: PA_IntegratedPlatform_Example_Create_Prod
Environment: prod
Owning module: example-module
Action: createRecord
HTTP method: POST
Endpoint location: config/flows.config.js
Endpoint value: stored in environment-specific config
Trigger authentication mode: tenant/specific user/URL-only
Required request fields: data.name, data.description
Optional request fields: data.tags
Response data shape: data.id, data.createdAt
Error conditions: validation failed, duplicate record, unauthorized
Timeout expectation: 30 seconds
Retry allowed: no
Last tested date: YYYY-MM-DD
Owner: platform owner
Notes: Uses standard response envelope
```
