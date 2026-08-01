export const PlatformProvisioning = Object.freeze({
  "home": {
    "purpose": "Operational command landing",
    "features": [
      "dashboard-kpi",
      "quick-open",
      "workload-summary",
      "attention-panel"
    ],
    "functions": [
      "computeMetrics",
      "openQueue",
      "refreshRuntime"
    ],
    "actions": [
      "open-intake",
      "open-my-work",
      "open-overdue",
      "open-reports"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "correspondence",
      "dispatches",
      "approvals",
      "emails",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "activities": {
    "purpose": "Phase-aware activity lens with the Canvas activity record queue",
    "features": [
      "activity-queue",
      "phase-filter",
      "record-cards",
      "open-handoff",
      "canvas-parity-record-queue",
      "treated-not-treated-tabs",
      "activity-filter-panel",
      "attachment-preview",
      "pdf-preview",
      "activity-lifecycle-routing"
    ],
    "functions": [
      "listActivities",
      "filterByPhase",
      "openRecord",
      "ActivityParity.filterActivities",
      "ActivityParity.filterOptions",
      "ActivityParity.getAttachments",
      "ActivityParity.getAttachmentPreviewModel",
      "ActivityParity.planLifecycleAction",
      "ActivityParity.commitLifecycleAction"
    ],
    "actions": [
      "open-activity",
      "filter",
      "handoff-to-owner",
      "activity-archive",
      "activity-siwes",
      "activity-nysc"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "correspondence",
      "operations",
      "registryFiles",
      "escalations",
      "comments",
      "approvals",
      "users",
      "audit",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "correspondence": {
    "purpose": "Correspondence intake master",
    "features": [
      "create-form",
      "metadata-panel",
      "triage-bar",
      "duplicate-check",
      "hold-reject",
      "routing-handoff"
    ],
    "functions": [
      "createCorrespondence",
      "classify",
      "setPriority",
      "markDuplicate",
      "hold",
      "reject",
      "completeTriage"
    ],
    "actions": [
      "create",
      "classify",
      "mark-duplicate",
      "hold",
      "reject",
      "send-routing"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "correspondence",
      "emails",
      "audit",
      "pending",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "registry": {
    "purpose": "Official file control",
    "features": [
      "file-jacket",
      "registry-number",
      "custody",
      "movements",
      "minutes",
      "registry-archive-readiness"
    ],
    "functions": [
      "registerFile",
      "moveFile",
      "receiveFile",
      "addMinute",
      "closeRegistryFile"
    ],
    "actions": [
      "register",
      "move",
      "receive",
      "minute",
      "close-file"
    ],
    "enabled": true,
    "stateKeys": [
      "correspondence",
      "operations",
      "registryFiles",
      "fileMovements",
      "registryMinutes",
      "comments",
      "users",
      "departments",
      "audit",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "single-assignment": {
    "purpose": "Single assignment authority",
    "features": [
      "reference-picker",
      "assignee-picker",
      "due-date",
      "priority",
      "validation"
    ],
    "functions": [
      "validateReference",
      "validateAssignee",
      "createTask",
      "submitAssignment"
    ],
    "actions": [
      "select-ref",
      "select-assignee",
      "submit-assignment"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "correspondence",
      "comments",
      "users",
      "categories",
      "departments",
      "emails",
      "audit",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "bulk-assignment": {
    "purpose": "Bulk assignment authority",
    "features": [
      "bulk-parser",
      "batch-validation",
      "otp-modal",
      "partial-results",
      "retry"
    ],
    "functions": [
      "parseRefs",
      "validateBatch",
      "requestOtp",
      "verifyOtp",
      "submitBatch"
    ],
    "actions": [
      "paste-refs",
      "validate",
      "request-otp",
      "verify-otp",
      "submit-bulk",
      "retry-failed"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "audit",
      "runtime",
      "settings",
      "profile",
      "comments"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "fasttrack": {
    "purpose": "Priority intervention",
    "features": [
      "sla-risk-table",
      "breach-list",
      "due-soon",
      "unassigned",
      "notify"
    ],
    "functions": [
      "detectRisk",
      "fastTrack",
      "escalatePriority",
      "notifyOwner"
    ],
    "actions": [
      "fasttrack",
      "escalate",
      "notify-owner"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "escalations",
      "notifications",
      "emails",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "acknowledgment": {
    "purpose": "Assignment receipt gate",
    "features": [
      "ack-queue",
      "ageing",
      "reminder",
      "receipt-action"
    ],
    "functions": [
      "listPendingAck",
      "acknowledge",
      "remind",
      "escalateNonAck"
    ],
    "actions": [
      "acknowledge",
      "remind",
      "escalate"
    ],
    "enabled": true,
    "stateKeys": [
      "tracking",
      "notifications",
      "pending",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "orchestrator": {
    "purpose": "Task execution workbench",
    "features": [
      "my-work",
      "task-detail",
      "progress",
      "block-resume",
      "complete-action",
      "submit-review"
    ],
    "functions": [
      "startWork",
      "updateProgress",
      "block",
      "resume",
      "complete",
      "submitReview"
    ],
    "actions": [
      "start",
      "progress",
      "block",
      "resume",
      "complete",
      "submit-review"
    ],
    "enabled": true,
    "stateKeys": [
      "tracking",
      "notifications",
      "comments",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "response-tracking": {
    "purpose": "Response monitoring lens",
    "features": [
      "response-queue",
      "ageing",
      "status-tabs",
      "export"
    ],
    "functions": [
      "monitorResponse",
      "filterStatus",
      "computeAgeing",
      "exportTracking"
    ],
    "actions": [
      "filter",
      "open",
      "export",
      "route-to-workbench"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "comments",
      "pending",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "comments": {
    "purpose": "Collaboration thread",
    "features": [
      "thread",
      "comment-types",
      "return-reason",
      "dispatch-note",
      "archive-note"
    ],
    "functions": [
      "addComment",
      "filterThread",
      "lockAfterArchive"
    ],
    "actions": [
      "add-comment",
      "review-note",
      "return-reason",
      "refresh"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "comments",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "approvals": {
    "purpose": "Standard review authority",
    "features": [
      "review-queue",
      "source-pane",
      "draft-pane",
      "decision-buttons",
      "minute",
      "edit-diff"
    ],
    "functions": [
      "approve",
      "approveWithEdit",
      "returnForRevision",
      "reject",
      "recordMinute"
    ],
    "actions": [
      "approve",
      "approve-edit",
      "return",
      "reject",
      "minute"
    ],
    "enabled": true,
    "stateKeys": [
      "approvals",
      "pending",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "executive": {
    "purpose": "Executive exception authority",
    "features": [
      "exception-queue",
      "sensitive-view",
      "executive-actions",
      "decision-export"
    ],
    "functions": [
      "executiveApprove",
      "executiveReturn",
      "executiveEscalate",
      "exportDecision"
    ],
    "actions": [
      "executive-approve",
      "executive-return",
      "executive-escalate",
      "export-decision"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "correspondence",
      "comments",
      "approvals",
      "users",
      "departments",
      "emails",
      "audit",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "dispatch": {
    "purpose": "Dispatch execution",
    "features": [
      "dispatch-queue",
      "recipient-confirm",
      "channel-selector",
      "receipt",
      "retry",
      "no-dispatch",
      "closure-check"
    ],
    "functions": [
      "prepareDispatch",
      "sendDispatch",
      "captureReceipt",
      "retry",
      "markNoDispatch",
      "runClosureGate"
    ],
    "actions": [
      "prepare",
      "send-dispatch",
      "retry",
      "no-dispatch",
      "close"
    ],
    "enabled": true,
    "stateKeys": [
      "tracking",
      "dispatches",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "archive": {
    "purpose": "Immutable archive execution",
    "features": [
      "readiness",
      "archive-form",
      "hash",
      "bundle-view",
      "access-log",
      "export"
    ],
    "functions": [
      "canArchive",
      "archiveReference",
      "viewBundle",
      "exportArchive",
      "reopenAsNew"
    ],
    "actions": [
      "archive-reference",
      "view-archive",
      "export-evidence",
      "reopen"
    ],
    "enabled": true,
    "stateKeys": [
      "audit",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "lookup": {
    "purpose": "Search and retrieval",
    "features": [
      "global-search",
      "active-archive-scope",
      "filters",
      "result-actions"
    ],
    "functions": [
      "search",
      "filter",
      "openActive",
      "openArchive"
    ],
    "actions": [
      "search",
      "filter",
      "open",
      "open-archive"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "comments",
      "approvals",
      "emails",
      "pending",
      "profile",
      "selectedId"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "reports": {
    "purpose": "Report/export authority",
    "features": [
      "report-selector",
      "filters",
      "html-export",
      "json-export",
      "print",
      "email"
    ],
    "functions": [
      "generateReport",
      "exportReport",
      "printReport",
      "emailReport"
    ],
    "actions": [
      "generate",
      "export",
      "print",
      "email"
    ],
    "enabled": true,
    "stateKeys": [
      "comments",
      "pending",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "statistics": {
    "purpose": "Analytics and KPIs",
    "features": [
      "phase-distribution",
      "sla-trends",
      "directorate-workload",
      "completion-rate"
    ],
    "functions": [
      "calculateKpi",
      "trend",
      "filterPeriod",
      "exportMetrics"
    ],
    "actions": [
      "refresh",
      "filter",
      "export"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "dispatches",
      "users",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "assistant": {
    "purpose": "Governed AI assist",
    "features": [
      "prompt",
      "scoped-context",
      "loading",
      "error-feedback",
      "suggestions"
    ],
    "functions": [
      "ask",
      "summarize",
      "suggestNextAction"
    ],
    "actions": [
      "ask",
      "summarize",
      "suggest"
    ],
    "enabled": true,
    "stateKeys": [
      "correspondence"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "operator-hud": {
    "purpose": "Runtime monitor",
    "features": [
      "sync-status",
      "pending-queue",
      "live-load",
      "runtime-alerts"
    ],
    "functions": [
      "monitorRuntime",
      "retrySync",
      "inspectPending"
    ],
    "actions": [
      "sync",
      "inspect-pending",
      "open-diagnostics"
    ],
    "enabled": true,
    "stateKeys": [
      "operations",
      "audit",
      "pending",
      "runtime"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "settings": {
    "purpose": "Configuration surface",
    "features": [
      "profile",
      "theme",
      "density",
      "endpoint-restore",
      "import-export"
    ],
    "functions": [
      "updateProfile",
      "setTheme",
      "setDensity",
      "restoreEndpoints",
      "exportState",
      "importState"
    ],
    "actions": [
      "save-profile",
      "theme",
      "density",
      "restore-endpoints",
      "export",
      "import"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "audit",
      "pending",
      "runtime",
      "settings",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "correspondence-email": {
    "purpose": "Official outward correspondence email dispatch",
    "features": [
      "draft-compose",
      "template-rendering",
      "dispatch-evidence",
      "sent-register"
    ],
    "functions": [
      "createDraft",
      "sendDraft",
      "duplicateDraft",
      "archiveEmailRecord"
    ],
    "actions": [
      "create-correspondence-email-draft",
      "send-correspondence-email",
      "duplicate-correspondence-email",
      "archive-correspondence-email"
    ],
    "enabled": true,
    "stateKeys": [
      "correspondenceEmails",
      "correspondence",
      "dispatches",
      "registryFiles",
      "profile"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "diagnostics": {
    "purpose": "Certification health centre",
    "features": [
      "runtime-health",
      "endpoint-health",
      "route-health",
      "governance-health",
      "archive-health",
      "ui-certification"
    ],
    "functions": [
      "runDiagnostics",
      "testEndpoint",
      "validateRoutes",
      "exportDiagnostics"
    ],
    "actions": [
      "run-checks",
      "test-endpoint",
      "export-diagnostics"
    ],
    "enabled": true,
    "stateKeys": [
      "activities",
      "tracking",
      "comments",
      "users",
      "categories",
      "departments",
      "emails",
      "pending",
      "runtime",
      "settings"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  },
  "user-admin": {
    "purpose": "User/access administration",
    "features": [
      "user-form",
      "role-selector",
      "directorate",
      "status",
      "role-matrix"
    ],
    "functions": [
      "createUser",
      "editUser",
      "disableUser",
      "assignRole"
    ],
    "actions": [
      "create-user",
      "edit-user",
      "disable-user",
      "assign-role"
    ],
    "enabled": true,
    "stateKeys": [
      "users"
    ],
    "behaviours": [
      "load",
      "render",
      "validate",
      "act",
      "audit",
      "feedback"
    ]
  }
});
export const ProvisioningVersion = "ACTIVATION-1.0.0";
