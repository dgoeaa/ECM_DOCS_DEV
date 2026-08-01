export const SourceRouting = Object.freeze({
  "documentsActivities": {
    "targetModules": [
      "activities",
      "correspondence",
      "registry",
      "single-assignment",
      "response-tracking"
    ],
    "actions": [
      "fetch-docs",
      "filter-documents",
      "select-document",
      "select-all-filtered",
      "open-document-detail",
      "flag-document",
      "single-assign-document",
      "bulk-assign-documents",
      "export-selection"
    ]
  },
  "assignment": {
    "targetModules": [
      "single-assignment",
      "bulk-assignment"
    ],
    "actions": [
      "draft-assignment",
      "cascade-category-subcategory",
      "select-assignee",
      "select-supporting-assignee",
      "manage-cc",
      "set-priority",
      "set-due-dates",
      "preview-payload",
      "submit-assignment",
      "reset-draft"
    ]
  },
  "emails": {
    "targetModules": [
      "correspondence",
      "lookup",
      "single-assignment"
    ],
    "actions": [
      "fetch-emails",
      "filter-emails",
      "open-email-detail",
      "create-task-from-email",
      "view-attachments",
      "open-outlook",
      "safe-preview-as-text"
    ]
  },
  "tasks": {
    "targetModules": [
      "orchestrator",
      "response-tracking",
      "single-assignment"
    ],
    "actions": [
      "fetch-tasks",
      "filter-tasks",
      "open-task-detail",
      "update-task",
      "set-reminder",
      "reassign-task"
    ]
  },
  "responseTracking": {
    "targetModules": [
      "response-tracking",
      "reports",
      "statistics",
      "lookup"
    ],
    "actions": [
      "tab-docs",
      "tab-tasks",
      "tab-emails",
      "match-doc-email-pairs",
      "refresh-active-tab",
      "refresh-all-and-match",
      "export-csv",
      "search-current-tab"
    ]
  },
  "settingsTelemetry": {
    "targetModules": [
      "settings",
      "diagnostics",
      "operator-hud"
    ],
    "actions": [
      "view-endpoints",
      "override-endpoints-json",
      "copy-endpoints",
      "clear-local-data",
      "storage-health",
      "diagnostics-log",
      "copy-log",
      "clear-log"
    ]
  }
});
export const LegacyScreenRouteMap = Object.freeze({
  "screen-home": "home",
  "home": "home",
  "screen-docs": "activities",
  "docs": "activities",
  "documents": "activities",
  "screenActivities": "activities",
  "Activities": "activities",
  "screen-assign": "single-assignment",
  "screenAssign": "single-assignment",
  "assign": "single-assignment",
  "screen-bulk-assign": "bulk-assignment",
  "bulkAssign": "bulk-assignment",
  "bulk-assignment": "bulk-assignment",
  "screen-tasks": "orchestrator",
  "tasks": "orchestrator",
  "screenTasks": "orchestrator",
  "screen-emails": "correspondence",
  "emails": "correspondence",
  "screenEmails": "correspondence",
  "screen-response-track": "response-tracking",
  "response-track": "response-tracking",
  "responseTrack": "response-tracking",
  "screenSettings": "settings",
  "screen-settings": "settings",
  "settings": "settings",
  "telemetry": "operator-hud",
  "diagnostics": "diagnostics"
});
export const LegacyEndpointMap = Object.freeze({
  "E01": "REFERENCE_DATA",
  "LOOKUPS": "REFERENCE_DATA",
  "GET_REFERENCES": "REFERENCE_DATA",
  "E02": "GET_DOCS",
  "BULK_OPS_GET_DOCS": "GET_DOCS",
  "GET_DOCS": "GET_DOCS",
  "E03": "FETCH_ACTIVITIES",
  "GET_TASKS": "FETCH_ACTIVITIES",
  "E04": "SUBSIDIARY_ACTIONS",
  "GET_EMAILS": "SUBSIDIARY_ACTIONS",
  "FETCH_EMAIL_ATTACHMENTS": "FETCH_EMAIL_ATTACHMENTS",
  "E05": "DYNAMIC_ACTIONS",
  "DYNAMIC_GLOBAL": "DYNAMIC_ACTIONS",
  "SUBSIDIARY_ACTIONS": "SUBSIDIARY_ACTIONS",
  "E06": "BULK_ASSIGNMENT",
  "BULK_ASSIGN": "BULK_ASSIGNMENT",
  "E07": "BULK_ASSIGNMENT_DIRECT",
  "BULK_OPS_ASSIGN": "BULK_ASSIGNMENT_DIRECT",
  "SINGLE_ASSIGN": "SINGLE_ASSIGNMENT",
  "SINGLE_ASSIGNMENT": "SINGLE_ASSIGNMENT",
  "CREATE_TASK_FOR_EMAIL": "EMAIL_RELATED_TASK",
  "EMAIL_RELATED_TASK": "EMAIL_RELATED_TASK",
  "AI_EMAIL_ANALYSIS": "AI_EMAIL_ANALYSIS",
  "AI_DOC_ANALYSIS": "AI_DOC_ANALYSIS",
  "AI_CHAT": "AI_CHAT"
});
