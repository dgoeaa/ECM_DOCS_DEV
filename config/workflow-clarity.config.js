// Workflow Clarity Layer — approved immediate implementation.
// Visible workspaces are the only primary navigation groups. Technical modules remain routable for contracts and guided handoffs.
export const VisibleWorkspaces = Object.freeze([
  {
    "id": "command-center",
    "route": "home",
    "label": "Command Center",
    "group": "START HERE",
    "purpose": "Shows what needs attention now and routes users to the correct governed workspace.",
    "owns": [
      "work summary",
      "attention queues",
      "guided handoff"
    ],
    "handoffs": [
      "correspondence",
      "orchestrator",
      "approvals",
      "dispatch",
      "response-tracking",
      "activities",
      "fasttrack",
      "assistant"
    ]
  },
  {
    "id": "erp-ecm-charter",
    "route": "ecm-erp-charter",
    "label": "ERP–ECM Charter",
    "group": "START HERE",
    "purpose": "Defines the authoritative boundary, ownership model, and integration rules between ERP and ECM.",
    "owns": [
      "scope-boundary-charter",
      "ownership-matrix",
      "shared-terminology",
      "integration-rules"
    ],
    "handoffs": [
      "correspondence",
      "orchestrator",
      "approvals",
      "dispatch",
      "reports"
    ]
  },
  {
    "id": "intake",
    "route": "correspondence",
    "label": "Intake & Assignment",
    "group": "OPERATIONS",
    "purpose": "Capture, triage and classify correspondence, then assign it into a governed task — all in one place.",
    "owns": [
      "create correspondence",
      "classify",
      "triage",
      "assign one",
      "payload preview",
      "confirmation"
    ],
    "handoffs": [
      "registry",
      "single-assignment",
      "bulk-assignment",
      "scan-intake"
    ]
  },
  {
    "id": "my-work",
    "route": "orchestrator",
    "label": "My Work",
    "group": "OPERATIONS",
    "purpose": "Acknowledge, start, update, comment on and complete assigned work.",
    "owns": [
      "acknowledge",
      "start work",
      "progress",
      "complete action",
      "submit review"
    ],
    "handoffs": [
      "acknowledgment",
      "comments",
      "lookup"
    ]
  },
  {
    "id": "tracking",
    "route": "response-tracking",
    "label": "Tracking & Monitoring",
    "group": "CONTROL",
    "purpose": "Monitor responses, SLA ageing, matched document/email tracking and exports.",
    "owns": [
      "monitor response",
      "ageing",
      "matched pairs",
      "tracking export"
    ],
    "handoffs": [
      "reports",
      "statistics",
      "projects"
    ]
  },
  {
    "id": "review-approval",
    "route": "approvals",
    "label": "Review & Approval",
    "group": "CONTROL",
    "purpose": "Review, return, reject or approve work with audit trail and executive escalation.",
    "owns": [
      "approve",
      "return",
      "reject",
      "minute",
      "executive handoff"
    ],
    "handoffs": [
      "executive",
      "briefs",
      "meetings",
      "dispatch"
    ]
  },
  {
    "id": "dispatch-archive",
    "route": "dispatch",
    "label": "Dispatch",
    "group": "CLOSURE",
    "purpose": "Prepare dispatch, send/no-dispatch, capture receipt, close and hand off to archive.",
    "owns": [
      "send dispatch",
      "capture receipt",
      "closure check",
      "archive handoff"
    ],
    "handoffs": [
      "archive",
      "lookup"
    ]
  },
  {
    "id": "administration",
    "route": "settings",
    "label": "Administration",
    "group": "SYSTEM",
    "purpose": "Manage profile, settings, users, diagnostics and endpoint configuration.",
    "owns": [
      "settings",
      "users",
      "diagnostics",
      "operator health"
    ],
    "handoffs": [
      "diagnostics",
      "user-admin",
      "operator-hud"
    ]
  },
  {
    "id": "correspondence-email",
    "route": "correspondence-email",
    "label": "Correspondence Email Desk",
    "group": "CLOSURE",
    "purpose": "Manage actual outward official correspondences sent via email, including drafting, branded templates, dispatch evidence and sent register.",
    "owns": ["outgoing correspondence email drafts", "official template rendering", "email dispatch register", "queued email retry evidence"],
    "handoffs": ["dispatch", "archive"]
  },
]);
export const HiddenTechnicalRoutes = Object.freeze({
  "activities": {
    "visibleThrough": "Command Center / Intake",
    "reason": "Queue lens, not a primary destination."
  },
  "registry": {
    "visibleThrough": "Intake",
    "reason": "Official file control is a sub-workflow of intake."
  },
  "briefs": {
    "visibleThrough": "Review & Approval",
    "reason": "A brief pack is raised for a decision, so it belongs to the review and approval journey. Ported from the ECM Activity Hub under decision D6(b)."
  },
  "meetings": {
    "visibleThrough": "Review & Approval",
    "reason": "A meeting request is approved or declined, and its agreed actions become tasks in My Work. Ported from the ECM Activity Hub under decision D6(b)."
  },
  "projects": {
    "visibleThrough": "Tracking & Monitoring",
    "reason": "A register of projects and the measures they are tracked against. Ported from the ECM Activity Hub under decision D6(b)."
  },
  "scan-intake": {
    "visibleThrough": "Intake & Assignment",
    "reason": "Counter deposit of physically-received documents (channel C). It produces correspondence, so it is reached from Intake & Assignment rather than standing alone."
  },
  "single-assignment": {
    "visibleThrough": "Intake & Assignment",
    "reason": "Single assignment is merged into the Intake & Assignment workspace (assign-in-place); the route remains for reassignment and deep links."
  },
  "bulk-assignment": {
    "visibleThrough": "Intake & Assignment",
    "reason": "Bulk assignment is a mode of assignment, not a separate visible workspace."
  },
  "lookup": {
    "visibleThrough": "Tracking / Dispatch & Archive / command search",
    "reason": "Lookup is read-only search/retrieval, not a mutation workspace."
  },
  "acknowledgment": {
    "visibleThrough": "My Work",
    "reason": "Acknowledgment is a work state, not a separate visible destination."
  },
  "comments": {
    "visibleThrough": "My Work",
    "reason": "Comments are contextual collaboration, not a standalone destination."
  },
  "fasttrack": {
    "visibleThrough": "Command Center / Tracking",
    "reason": "SLA escalation is surfaced as attention/risk, not a separate primary module."
  },
  "executive": {
    "visibleThrough": "Review & Approval",
    "reason": "Executive decisions are review exceptions."
  },
  "archive": {
    "visibleThrough": "Dispatch & Archive",
    "reason": "Archive is a closure step, not a primary daily action desk."
  },
  "reports": {
    "visibleThrough": "Tracking",
    "reason": "Reports are outputs of tracking and management views."
  },
  "statistics": {
    "visibleThrough": "Tracking",
    "reason": "Statistics are analytics output, not operator action space."
  },
  "assistant": {
    "visibleThrough": "Command Center",
    "reason": "Assistant is contextual help, not a module of record."
  },
  "operator-hud": {
    "visibleThrough": "Administration",
    "reason": "Runtime monitoring belongs under administration."
  },
  "diagnostics": {
    "visibleThrough": "Administration",
    "reason": "Diagnostics belongs under administration."
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
