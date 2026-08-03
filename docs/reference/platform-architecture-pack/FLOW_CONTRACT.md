# Power Automate Flow Contract

## 1. Purpose

This contract standardizes communication between the frontend platform and Power Automate HTTP-triggered flows.

## 2. Flow Trigger Standard

Each callable automation must begin with:

```text
When an HTTP request is received
```

Each flow should include:

```text
1. Trigger
2. Input validation
3. Authorization/permission checks where applicable
4. Business action
5. Normalized response
6. Error response path
```

## 3. Standard Request Envelope

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
    "email": "user@example.com",
    "roles": ["admin"]
  },
  "data": {}
}
```

## 4. Standard Response Envelope

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

## 5. Error Response Envelope

```json
{
  "success": false,
  "status": 400,
  "message": "Validation failed",
  "data": null,
  "errors": [
    {
      "code": "REQUIRED_FIELD",
      "field": "name",
      "message": "Name is required"
    }
  ],
  "meta": {
    "requestId": "REQ-000001",
    "flowName": "FlowName"
  }
}
```

## 6. Recommended Trigger JSON Schema

```json
{
  "type": "object",
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "requestId": { "type": "string" },
        "moduleId": { "type": "string" },
        "action": { "type": "string" },
        "timestamp": { "type": "string" },
        "appVersion": { "type": "string" }
      },
      "required": ["requestId", "moduleId", "action", "timestamp"]
    },
    "user": {
      "type": "object"
    },
    "data": {
      "type": "object"
    }
  },
  "required": ["meta", "data"]
}
```

## 7. Flow Validation Checklist

Every flow must validate:

- `meta.requestId` exists.
- `meta.moduleId` is allowed.
- `meta.action` is allowed.
- Required `data` fields exist.
- User/role is authorized where applicable.
- Request is not malformed.

## 8. Flow Naming Convention

```text
PA_<PlatformName>_<ModuleName>_<ActionName>_<Environment>
```

Examples:

```text
PA_IntegratedPlatform_Cases_Create_Prod
PA_IntegratedPlatform_Cases_Search_Prod
PA_IntegratedPlatform_Reports_Generate_Dev
```

## 9. Flow Registry Fields

Each flow must be documented with:

- Flow key.
- Flow display name.
- Environment.
- HTTP method.
- Endpoint placeholder.
- Owning module.
- Action.
- Required payload fields.
- Response data shape.
- Security mode.
- Last tested date.

## 10. Timeout and Retry

Default client timeout:

```text
30 seconds
```

Retry should be conservative:

- Retry only safe/idempotent operations.
- Do not blindly retry create/update operations unless request idempotency is implemented.

## 11. Endpoint Handling

Flow URLs should be placed in `config/flows.config.js` or an environment-specific config file.

Never place passwords, client secrets, or private credentials in frontend files.

## 12. Client Flow Call Standard

```js
import { callFlow } from "../../core/api/flow-client.js";

export function submitExample(data, context) {
  return callFlow("exampleSubmit", data, context);
}
```

## 13. Power Automate Response Action Requirement

Every HTTP-triggered flow that is expected to return data to the platform must end with a Response action using the standard response envelope.
