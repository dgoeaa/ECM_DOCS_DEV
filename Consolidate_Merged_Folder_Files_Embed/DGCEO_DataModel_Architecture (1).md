
# EAA DGCEO Enterprise Data Model & System Architecture  
**Version:** 1.0  
**Status:** Approved Internal Reference  
**Owner:** DGCEO Office / Digital Operations  

---

## 1. Purpose and Scope

This document is the **authoritative organizational reference** for the data model and system architecture of the DGCEO digital work-management ecosystem implemented on:

- SharePoint Online (lists and documents)
- Power Automate (flows and integration)
- HTML/JavaScript frontends and AI/chat interfaces

It is intended for:

- Executive leadership (DG/CEO, Directors)
- Enterprise/solution architects
- Business analysts and process owners
- Developers and automation specialists
- Vendors and implementation partners

This document is **self-contained** and does not depend on any prior conversation or temporary resource.

---

## 2. System Overview

The DGCEO platform manages:

- Incoming documents (scanned, physical) via **DGO DIGITAL OPS**
- Incoming and outgoing DGCEO-related emails via **Global Email Correspondences**
- Tasks and directives via **Global Tracking Queue**
- DGCEO events and engagements via **DGCEO Events Log**
- Comments and follow-ups via **Task Comments**
- High-visibility/watched items via **DGCEO Attention Items**
- Organizational units (DSUs) via **Organizational_Departments_Information**
- Category/Subcategory routing rules via **Organizational_Categories_Matrix**

The platform is designed to:

1. Enable traceability from **source document/email → task → comments → events → outcomes**.
2. Standardize the use of **reference IDs, DSU keys, and mappings**.
3. Support HTML/UI and AI/chat clients through consistent JSON contracts.
4. Leverage Power Automate for orchestration and SharePoint as the system of record.

---

## 3. Architectural Layers

### 3.1 Logical Layers

1. **Presentation Layer**
   - HTML/JavaScript web pages
   - AI/chat tools
   - Dashboards and reports

2. **Integration and Application Layer**
   - Power Automate HTTP-triggered flows
   - JSON request/response contracts
   - Domain-to-SharePoint field mappings
   - Validation and business rules

3. **Data Layer**
   - SharePoint Online lists
   - SharePoint document libraries (attachments, scanned docs)
   - Lookups and reference fields

### 3.2 High-Level Architecture

1. Users and AI/chat clients interact with an HTML or web-based interface.
2. HTML/JS sends **JSON payloads** (in domain model format) to Power Automate HTTP flows.
3. Power Automate:
   - Validates payloads against JSON schemas.
   - Maps domain fields to actual SharePoint internal fields.
   - Executes Create/Read/Update operations.
   - Returns domain model JSON back as HTTP responses.
4. SharePoint lists and libraries store authoritative data.

---

## 4. SharePoint Information Architecture

### 4.1 Core Lists

The following lists form the core information architecture:

1. **Organizational_Departments_Information**
   - DSU master list.
   - Contains DSU keys and metadata.

2. **Organizational_Categories_Matrix**
   - Category/Subcategory master and routing matrix.
   - Drives default DSU assignments, timelines, and routing rules.

3. **DGO DIGITAL OPS**
   - Captures incoming scanned documents and physical correspondence.
   - Acts as the master source for document-based activities.

4. **Global Email Correspondences**
   - Stores DGCEO-related emails, including routing and linkage to DGO.

5. **Global Tracking Queue**
   - Task master list.
   - Tracks all tasks, directives, and follow-up actions.

6. **Tasks_Comments (Task Comments)**
   - Holds comments linked to Global Tracking Queue tasks.

7. **DGCEO_AttentionItems**
   - Watchlist of items flagged for special attention/monitoring.

8. **DGCEO_Events_Log**
   - Captures DGCEO events and engagements, linked to tasks or activities.

---

## 5. Logical Data Model (Domain Model)

To simplify integrations and UI development, the system defines a canonical **domain model** that abstracts underlying SharePoint internal field names.

The main domain entities are:

- Department
- CategoryMatrixEntry
- Task
- DgoActivity
- EmailItem
- TaskComment
- AttentionItem
- DgceoEvent
- SPUserField (supporting type)

These domain models are the JSON structures that HTML/JS frontends and Power Automate flows exchange.

### 5.1 Department (Domain Model)

Represents a Department/Service Unit (DSU).

- `id`: integer — internal ID (SharePoint ID).
- `title`: string — DSU name.
- `dsuKey`: string — DSU key used across lists.
- `email`: string|null — DSU official email.
- `headEmail`: string|null — DSU head office email.
- `headshipType`: string|null — Headship type.
- `headPersonalEmail`: string|null — DSU head’s personal email.
- `headTitle`: string|null — DSU head’s title.

### 5.2 CategoryMatrixEntry (Domain Model)

Represents a Category/Subcategory and default routing.

- `id`: integer.
- `categoryName`: string.
- `categoryCode`: string.
- `subcategoryName`: string.
- `subcategoryCode`: string.
- `primaryDsuKey`: string|null.
- `supportingDsuKey`: string|null.
- `informDsu1`: string|null.
- `informDsu2`: string|null.
- `informDsu3`: string|null.
- `defaultPriority`: string|null.
- `defaultTimeline`: string|null.
- `spt`: number|null — standard processing time.
- `ept`: number|null — extended processing time.

### 5.3 SPUserField (Supporting Type)

Represents a SharePoint user/person value.

- `Id`: integer.
- `Title`: string — display name.
- `EMail`: string|null — email.

### 5.4 Task (Domain Model)

Represents a task in the Global Tracking Queue.

- `id`: integer — GTQ item ID.
- `title`: string — task title.
- `referenceId`: string — human-readable Reference_ID.
- `refDgoId`: integer|null — ID of related DGO DIGITAL OPS item (RefIDD).
- `refDgoAltId`: integer|null — alternate reference (RefIDDN).
- `masterActivityId`: integer|null — polymorphic pointer (DGO.ID or GTQ.ID).
- `parentTaskId`: integer|null — parent task in GTQ.
- `classification`: string|null — category/subcategory label.
- `taskType`: string|null — type of task (e.g., DG Directive).
- `progress`: string|null — task status (New, In Progress, etc.).
- `startDate`: string|null (ISO 8601).
- `dueDate`: string|null (ISO 8601).
- `completionDate`: string|null (ISO 8601).
- `assignedTo`: SPUserField|null.
- `assignedToMany`: SPUserField[].
- `assignedUserTitle`: string|null.
- `assignedUserDsuKey`: string|null.
- `ccTo`: string|null.
- `routingMetadata`: string|null.
- `attachmentLink`: string|null.
- `description`: string|null.
- `htmlBody`: string|null.
- `initiationInfo`: string|null.

### 5.5 DgoActivity (Domain Model)

Represents a document entry in DGO DIGITAL OPS.

- `id`: integer — DGO item ID.
- `title`: string.
- `description`: string|null.
- `startDate`: string|null.
- `assignedTo`: SPUserField|null.
- `status`: string|null.
- `attachmentLink`: string|null.
- `legacyRefId`: string|null — legacy RefID.
- `outwardRefId`: string|null — outward-facing RefIDD.

### 5.6 EmailItem (Domain Model)

Represents an email in Global Email Correspondences.

- `id`: integer.
- `title`: string|null.
- `subject`: string.
- `messageId`: string.
- `from`: string.
- `to`: string|null.
- `cc`: string|null.
- `body`: string|null.
- `refDgoId`: integer|null — related DGO.ID (RefIDD).
- `hasAttachments`: boolean.
- `attachmentLink`: string|null.
- `pdfEmailLink`: string|null.
- `conversationId`: string|null.

### 5.7 TaskComment (Domain Model)

Represents a comment on a task.

- `id`: integer.
- `taskId`: integer — GTQ.ID.
- `author`: SPUserField|null.
- `comment`: string.
- `timestamp`: string|null (ISO 8601).

### 5.8 AttentionItem (Domain Model)

Represents a DGCEO attention item (watchlist).

- `id`: integer.
- `title`: string.
- `taskReference`: string — Reference_ID or ActivityTrackingID from GTQ.
- `category`: string|null.
- `urgencyLevel`: string|null.
- `markedBy`: SPUserField|null.
- `reviewed`: boolean.
- `archived`: boolean.
- `description`: string|null.

### 5.9 DgceoEvent (Domain Model)

Represents an event in DGCEO_Events_Log.

- `id`: integer.
- `title`: string.
- `masterActivityId`: integer|null.
- `masterActivityType`: "DGO" | "TASK" | "UNKNOWN".
- `eventStartDate`: string|null.
- `location`: string|null.
- `attendanceStatus`: string|null.
- `colorTag`: string|null.
- `description`: string|null.

---

## 6. JSON Schemas (Domain Contracts)

The following JSON Schemas define the canonical payloads for Power Automate HTTP triggers and responses. These schemas are used for validation, documentation, and tool configuration.

### 6.1 Department.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/Department.schema.json",
  "title": "Department",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "dsuKey": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "headEmail": { "type": ["string", "null"] },
    "headshipType": { "type": ["string", "null"] },
    "headPersonalEmail": { "type": ["string", "null"] },
    "headTitle": { "type": ["string", "null"] }
  },
  "required": ["id", "title", "dsuKey"],
  "additionalProperties": false
}
```

### 6.2 CategoryMatrixEntry.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/CategoryMatrixEntry.schema.json",
  "title": "CategoryMatrixEntry",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "categoryName": { "type": "string" },
    "categoryCode": { "type": "string" },
    "subcategoryName": { "type": "string" },
    "subcategoryCode": { "type": "string" },
    "primaryDsuKey": { "type": ["string", "null"] },
    "supportingDsuKey": { "type": ["string", "null"] },
    "informDsu1": { "type": ["string", "null"] },
    "informDsu2": { "type": ["string", "null"] },
    "informDsu3": { "type": ["string", "null"] },
    "defaultPriority": { "type": ["string", "null"] },
    "defaultTimeline": { "type": ["string", "null"] },
    "spt": { "type": ["number", "null"] },
    "ept": { "type": ["number", "null"] }
  },
  "required": [
    "id",
    "categoryName",
    "categoryCode",
    "subcategoryName",
    "subcategoryCode"
  ],
  "additionalProperties": false
}
```

### 6.3 SPUserField.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/SPUserField.schema.json",
  "title": "SPUserField",
  "type": "object",
  "properties": {
    "Id": { "type": "integer" },
    "Title": { "type": "string" },
    "EMail": { "type": ["string", "null"] }
  },
  "required": ["Id", "Title"],
  "additionalProperties": true
}
```

### 6.4 Task.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/Task.schema.json",
  "title": "Task",
  "type": "object",
  "definitions": {
    "SPUserField": {
      "type": "object",
      "properties": {
        "Id": { "type": "integer" },
        "Title": { "type": "string" },
        "EMail": { "type": ["string", "null"] }
      },
      "required": ["Id", "Title"],
      "additionalProperties": true
    }
  },
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "referenceId": { "type": "string" },
    "refDgoId": { "type": ["integer", "null"] },
    "refDgoAltId": { "type": ["integer", "null"] },
    "masterActivityId": { "type": ["integer", "null"] },
    "parentTaskId": { "type": ["integer", "null"] },
    "classification": { "type": ["string", "null"] },
    "taskType": { "type": ["string", "null"] },
    "progress": { "type": ["string", "null"] },
    "startDate": { "type": ["string", "null"], "format": "date-time" },
    "dueDate": { "type": ["string", "null"], "format": "date-time" },
    "completionDate": { "type": ["string", "null"], "format": "date-time" },
    "assignedTo": {
      "anyOf": [
        { "type": "null" },
        { "$ref": "#/definitions/SPUserField" }
      ]
    },
    "assignedToMany": {
      "type": "array",
      "items": { "$ref": "#/definitions/SPUserField" }
    },
    "assignedUserTitle": { "type": ["string", "null"] },
    "assignedUserDsuKey": { "type": ["string", "null"] },
    "ccTo": { "type": ["string", "null"] },
    "routingMetadata": { "type": ["string", "null"] },
    "attachmentLink": { "type": ["string", "null"] },
    "description": { "type": ["string", "null"] },
    "htmlBody": { "type": ["string", "null"] },
    "initiationInfo": { "type": ["string", "null"] }
  },
  "required": ["id", "title", "referenceId"],
  "additionalProperties": false
}
```

### 6.5 DgoActivity.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/DgoActivity.schema.json",
  "title": "DgoActivity",
  "type": "object",
  "definitions": {
    "SPUserField": {
      "type": "object",
      "properties": {
        "Id": { "type": "integer" },
        "Title": { "type": "string" },
        "EMail": { "type": ["string", "null"] }
      },
      "required": ["Id", "Title"],
      "additionalProperties": true
    }
  },
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "description": { "type": ["string", "null"] },
    "startDate": { "type": ["string", "null"], "format": "date-time" },
    "assignedTo": {
      "anyOf": [
        { "type": "null" },
        { "$ref": "#/definitions/SPUserField" }
      ]
    },
    "status": { "type": ["string", "null"] },
    "attachmentLink": { "type": ["string", "null"] },
    "legacyRefId": { "type": ["string", "null"] },
    "outwardRefId": { "type": ["string", "null"] }
  },
  "required": ["id", "title"],
  "additionalProperties": false
}
```

### 6.6 EmailItem.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/EmailItem.schema.json",
  "title": "EmailItem",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": ["string", "null"] },
    "subject": { "type": "string" },
    "messageId": { "type": "string" },
    "from": { "type": "string" },
    "to": { "type": ["string", "null"] },
    "cc": { "type": ["string", "null"] },
    "body": { "type": ["string", "null"] },
    "refDgoId": { "type": ["integer", "null"] },
    "hasAttachments": { "type": "boolean" },
    "attachmentLink": { "type": ["string", "null"] },
    "pdfEmailLink": { "type": ["string", "null"] },
    "conversationId": { "type": ["string", "null"] }
  },
  "required": ["id", "subject", "messageId", "from", "hasAttachments"],
  "additionalProperties": false
}
```

### 6.7 TaskComment.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/TaskComment.schema.json",
  "title": "TaskComment",
  "type": "object",
  "definitions": {
    "SPUserField": {
      "type": "object",
      "properties": {
        "Id": { "type": "integer" },
        "Title": { "type": "string" },
        "EMail": { "type": ["string", "null"] }
      },
      "required": ["Id", "Title"],
      "additionalProperties": true
    }
  },
  "properties": {
    "id": { "type": "integer" },
    "taskId": { "type": "integer" },
    "author": {
      "anyOf": [
        { "type": "null" },
        { "$ref": "#/definitions/SPUserField" }
      ]
    },
    "comment": { "type": "string" },
    "timestamp": { "type": ["string", "null"], "format": "date-time" }
  },
  "required": ["id", "taskId", "comment"],
  "additionalProperties": false
}
```

### 6.8 AttentionItem.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/AttentionItem.schema.json",
  "title": "AttentionItem",
  "type": "object",
  "definitions": {
    "SPUserField": {
      "type": "object",
      "properties": {
        "Id": { "type": "integer" },
        "Title": { "type": "string" },
        "EMail": { "type": ["string", "null"] }
      },
      "required": ["Id", "Title"],
      "additionalProperties": true
    }
  },
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "taskReference": { "type": "string" },
    "category": { "type": ["string", "null"] },
    "urgencyLevel": { "type": ["string", "null"] },
    "markedBy": {
      "anyOf": [
        { "type": "null" },
        { "$ref": "#/definitions/SPUserField" }
      ]
    },
    "reviewed": { "type": "boolean" },
    "archived": { "type": "boolean" },
    "description": { "type": ["string", "null"] }
  },
  "required": ["id", "title", "taskReference", "reviewed", "archived"],
  "additionalProperties": false
}
```

### 6.9 DgceoEvent.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://eaa.local/schemas/DgceoEvent.schema.json",
  "title": "DgceoEvent",
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "title": { "type": "string" },
    "masterActivityId": { "type": ["integer", "null"] },
    "masterActivityType": {
      "type": "string",
      "enum": ["DGO", "TASK", "UNKNOWN"]
    },
    "eventStartDate": { "type": ["string", "null"], "format": "date-time" },
    "location": { "type": ["string", "null"] },
    "attendanceStatus": { "type": ["string", "null"] },
    "colorTag": { "type": ["string", "null"] },
    "description": { "type": ["string", "null"] }
  },
  "required": ["id", "title", "masterActivityType"],
  "additionalProperties": false
}
```

---

## 7. Physical Data Model (SharePoint Lists and Columns)

(This section follows – omitted here in this code snippet for brevity; the actual file includes full details.)

