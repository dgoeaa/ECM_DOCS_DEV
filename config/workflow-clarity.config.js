// Workflow Clarity Layer.
// Locked information architecture (Figma "Application Shell" page, nav-ia table): 24 routes are
// primary sidebar destinations, grouped START HERE / OPERATIONS / CONTROL / CLOSURE / SYSTEM.
// The remaining 5 are a genuine sub-view of one primary workspace (a mode of assignment, a
// deposit channel, a closure step, a user-management panel) and are reached from that parent
// screen's "Continue in" strip and the command palette rather than the sidebar — see
// HiddenTechnicalRoutes below. This is the fix for audit finding I-01: every one of the 29
// declared routes is reachable, 24 of them directly from navigation.
export const VisibleWorkspaces = Object.freeze([
  {
    "id": "command-center",
    "route": "home",
    "label": "Command Center",
    "group": "START HERE",
    "purpose": "Shows what needs attention now and routes users to the correct governed workspace.",
    "owns": ["work summary", "attention queues", "guided handoff"],
    "handoffs": ["correspondence", "orchestrator", "approvals", "dispatch", "response-tracking", "activities", "fasttrack", "assistant"]
  },
  {
    "id": "erp-ecm-charter",
    "route": "ecm-erp-charter",
    "label": "ERP–ECM Charter",
    "group": "START HERE",
    "purpose": "Defines the authoritative boundary, ownership model, and integration rules between ERP and ECM.",
    "owns": ["scope-boundary-charter", "ownership-matrix", "shared-terminology", "integration-rules"],
    "handoffs": ["correspondence", "orchestrator", "approvals", "dispatch", "reports"]
  },
  {
    "id": "activities",
    "route": "activities",
    "label": "Activities",
    "group": "OPERATIONS",
    "purpose": "Cross-workspace queue of items awaiting action, filterable by stage and owner.",
    "owns": ["attention queue", "queue filters"],
    "handoffs": ["correspondence", "orchestrator"]
  },
  {
    "id": "intake",
    "route": "correspondence",
    "label": "Intake & Assignment",
    "group": "OPERATIONS",
    "purpose": "Capture, triage and classify correspondence, then assign it into a governed task — all in one place.",
    "owns": ["create correspondence", "classify", "triage", "assign one", "payload preview", "confirmation"],
    "handoffs": ["single-assignment", "bulk-assignment", "registry"]
  },
  {
    "id": "my-work",
    "route": "orchestrator",
    "label": "My Work",
    "group": "OPERATIONS",
    "purpose": "Acknowledge, start, update, comment on and complete assigned work.",
    "owns": ["acknowledge", "start work", "progress", "complete action", "submit review"],
    "handoffs": ["acknowledgment", "comments", "lookup"]
  },
  {
    "id": "acknowledgment-queue",
    "route": "acknowledgment",
    "label": "Acknowledgment Queue",
    "group": "OPERATIONS",
    "purpose": "Confirm receipt of assigned work before it starts, with the SLA clock in view.",
    "owns": ["acknowledgment queue", "receipt confirmation"],
    "handoffs": ["orchestrator"]
  },
  {
    "id": "registry",
    "route": "registry",
    "label": "Registry",
    "group": "OPERATIONS",
    "purpose": "Official file control and registry search across every intake channel.",
    "owns": ["registry search", "official file control"],
    "handoffs": ["scan-intake", "correspondence"]
  },
  {
    "id": "comments",
    "route": "comments",
    "label": "Comments",
    "group": "OPERATIONS",
    "purpose": "Threaded collaboration on correspondence and tasks, visible to everyone on the record.",
    "owns": ["threaded comments"],
    "handoffs": ["orchestrator"]
  },
  {
    "id": "lookup",
    "route": "lookup",
    "label": "Lookup & Direct Action",
    "group": "OPERATIONS",
    "purpose": "Search and retrieve any record by reference, sender or subject, and act on it directly.",
    "owns": ["record search", "direct action"],
    "handoffs": ["dispatch", "response-tracking"]
  },
  {
    "id": "tracking",
    "route": "response-tracking",
    "label": "Tracking & Monitoring",
    "group": "CONTROL",
    "purpose": "Monitor responses, SLA ageing, matched document/email tracking and exports.",
    "owns": ["monitor response", "ageing", "matched pairs", "tracking export"],
    "handoffs": ["reports", "statistics", "projects"]
  },
  {
    "id": "fasttrack",
    "route": "fasttrack",
    "label": "FastTrack SLA",
    "group": "CONTROL",
    "purpose": "Track items at risk of breaching their service-level target before they do.",
    "owns": ["SLA risk queue", "escalation"],
    "handoffs": ["response-tracking"]
  },
  {
    "id": "review-approval",
    "route": "approvals",
    "label": "Review & Approval",
    "group": "CONTROL",
    "purpose": "Review, return, reject or approve work with audit trail and executive escalation.",
    "owns": ["approve", "return", "reject", "minute", "executive handoff"],
    "handoffs": ["executive", "briefs", "meetings", "dispatch"]
  },
  {
    "id": "briefs",
    "route": "briefs",
    "label": "Briefs & Submissions",
    "group": "CONTROL",
    "purpose": "Prepare and track brief packs raised for an executive decision.",
    "owns": ["brief pack", "submission tracking"],
    "handoffs": ["approvals", "meetings"]
  },
  {
    "id": "meetings",
    "route": "meetings",
    "label": "Meetings",
    "group": "CONTROL",
    "purpose": "Request, schedule and record the outcomes of meetings; agreed actions become tasks.",
    "owns": ["meeting requests", "outcomes"],
    "handoffs": ["orchestrator", "approvals"]
  },
  {
    "id": "projects",
    "route": "projects",
    "label": "Projects",
    "group": "CONTROL",
    "purpose": "A register of projects and the measures they are tracked against.",
    "owns": ["project register", "tracked measures"],
    "handoffs": ["response-tracking", "reports"]
  },
  {
    "id": "reports",
    "route": "reports",
    "label": "Reports",
    "group": "CONTROL",
    "purpose": "Generate and export operational reports drawn from tracking and management views.",
    "owns": ["report generation", "export"],
    "handoffs": ["statistics"]
  },
  {
    "id": "statistics",
    "route": "statistics",
    "label": "Statistics",
    "group": "CONTROL",
    "purpose": "Analytics and trend views across the correspondence lifecycle.",
    "owns": ["analytics", "trend views"],
    "handoffs": ["reports"]
  },
  {
    "id": "executive",
    "route": "executive",
    "label": "DGCEO Correspondence & Decision Hub",
    "group": "CONTROL",
    "purpose": "Executive review and decision surface for DG/CEO correspondence and exceptions.",
    "owns": ["executive decision queue"],
    "handoffs": ["approvals", "briefs"]
  },
  {
    "id": "dispatch-archive",
    "route": "dispatch",
    "label": "Dispatch",
    "group": "CLOSURE",
    "purpose": "Prepare dispatch, send/no-dispatch, capture receipt, close and hand off to archive.",
    "owns": ["send dispatch", "capture receipt", "closure check", "archive handoff"],
    "handoffs": ["archive", "lookup"]
  },
  {
    "id": "correspondence-email",
    "route": "correspondence-email",
    "label": "Correspondence Email Desk",
    "group": "CLOSURE",
    "purpose": "Manage outward official correspondence sent by email, including drafting, branded templates, dispatch evidence and the sent register.",
    "owns": ["outgoing correspondence email drafts", "official template rendering", "email dispatch register", "queued email retry evidence"],
    "handoffs": ["dispatch", "archive"]
  },
  {
    "id": "assistant",
    "route": "assistant",
    "label": "Assistant",
    "group": "SYSTEM",
    "purpose": "Contextual guidance for the DGO operating model — not a module of record.",
    "owns": ["contextual guidance"],
    "handoffs": ["home"]
  },
  {
    "id": "operator-hud",
    "route": "operator-hud",
    "label": "Operator HUD",
    "group": "SYSTEM",
    "purpose": "Runtime and integration health at a glance while operating the platform.",
    "owns": ["runtime health readout"],
    "handoffs": ["diagnostics"]
  },
  {
    "id": "administration",
    "route": "settings",
    "label": "Administration",
    "group": "SYSTEM",
    "purpose": "Manage profile, settings and users. Restricted to IT — see the System · Restricted group.",
    "owns": ["settings", "users"],
    "handoffs": ["user-admin", "diagnostics"]
  },
  {
    "id": "diagnostics",
    "route": "diagnostics",
    "label": "System Health",
    "group": "SYSTEM",
    "purpose": "System health, connectivity and configuration checks. Restricted to IT.",
    "owns": ["diagnostics", "operator health"],
    "handoffs": ["operator-hud", "settings"]
  }
]);
export const HiddenTechnicalRoutes = Object.freeze({
  "single-assignment": {
    "visibleThrough": "Intake & Assignment",
    "reason": "Single assignment is merged into the Intake & Assignment workspace (assign-in-place); the route remains for reassignment and deep links."
  },
  "bulk-assignment": {
    "visibleThrough": "Intake & Assignment",
    "reason": "Bulk assignment is a mode of assignment, not a separate visible workspace."
  },
  "scan-intake": {
    "visibleThrough": "Registry",
    "reason": "Counter deposit of physically-received documents (channel C). It produces registry-controlled files, so it is reached from Registry rather than standing alone."
  },
  "archive": {
    "visibleThrough": "Dispatch",
    "reason": "Archive is a closure step reached from Dispatch, not a primary daily action desk."
  },
  "user-admin": {
    "visibleThrough": "Administration",
    "reason": "User administration belongs under administration."
  }
});
export function visibleWorkspaceForRoute(route){ return VisibleWorkspaces.find(w=>w.route===route) || null; }
export function routeVisibility(route){ return visibleWorkspaceForRoute(route) ? 'visible-workspace' : HiddenTechnicalRoutes[route] ? 'guided-internal-route' : 'unknown'; }
export function workspaceGuide(route){
  const v=visibleWorkspaceForRoute(route);
  if (v) return v;
  const h=HiddenTechnicalRoutes[route];
  return h ? { route, label: route, group:'INTERNAL', purpose:h.reason, owns:[], handoffs:[], visibleThrough:h.visibleThrough } : null;
}

export const ProductCharterReference = Object.freeze({ sources:['physical-scanned-documents','customer-service-emails','public-portal-correspondence','dgceo-outgoing-correspondence'], charter:'PRODUCT_CHARTER.md', operatingModel:'PRODUCT_OPERATING_MODEL.md' });
