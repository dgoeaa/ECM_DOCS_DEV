import { isoDate } from "../utils/fn.js";

/* AUDIT.md F-001. A named production identity was hardcoded here and shipped to every
   browser. It is now a neutral development placeholder, overridable for local work via
   window.DGO_CONFIG.devIdentity, and IGNORED ENTIRELY once authentication is enforced —
   at that point js/core/auth.js resolves identity from validated token claims and nothing
   in this object influences authorization. */
const _dev = (typeof window !== "undefined" && window.DGO_CONFIG?.devIdentity) || {};

export const Store = {
  auth: {
    user: {
      email: _dev.email || "operator@localhost",
      name: _dev.name || "Development Operator",
      role: _dev.role || "Officer"
    },
    roles: [_dev.role || "Officer"],
    delegations: []
  },
  ref: {
    departments: [],
    people: [],
    themes: ["Digital Public Infrastructure", "Cybersecurity", "Innovation", "Capacity Building", "Regulatory"],
    classifications: ["Public", "Internal", "Confidential", "Secret"],
    priorities: ["Low", "Normal", "High", "Urgent"]
  },
  entities: {
    inbox: [],
    inward: [],
    outward: [],
    minutes: [],
    approvals: [],
    briefs: [],
    decisions: [],
    meetings: [],
    tasks: [],
    projects: [],
    kpi: { snapshot: [], updatedAt: null },
    notifications: [],
    audit: [],
    sla: { metrics: [], updatedAt: null },
    directory: []
  },
  ui: {
    route: "/dashboard",
    sidebarOpen: true,
    busy: false,
    busyText: "Loading…",
    toast: null,
    modal: null,
    filters: {
      inbox: { q: "", status: "Open", priority: "" },
      approvals: { q: "", status: "Pending" },
      tasks: { q: "", status: "Open" }
    },
    forms: {
      inward: { refNo: "", sender: "", subject: "", classification: "Internal", priority: "Normal", receivedDate: isoDate(new Date()), notes: "" },
      outward: { refNo: "", recipient: "", subject: "", classification: "Internal", priority: "Normal", body: "", signMode: "DGCEO", dispatchMode: "Email" },
      minute: { itemId: "", directive: "", routeTo: "", dueDate: isoDate(new Date()), comments: "" },
      approvalDecision: { approvalId: "", decision: "Approve", comments: "" },
      brief: { title: "", theme: "Digital Public Infrastructure", summary: "", background: "", options: "", risks: "", recommendation: "", attachments: [] },
      decision: { title: "", text: "", relatedId: "", owner: "", dueDate: isoDate(new Date()) },
      meeting: { title: "", requestor: "", date: "", time: "", location: "Virtual", agenda: "", attendees: "", notes: "" },
      task: { title: "", owner: "", dueDate: isoDate(new Date()), priority: "Normal", description: "", relatedId: "" }
    }
  }
};

export function setDeepValue(obj, path, value) {
  const parts = String(path).split(".");
  let ref = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!(k in ref) || ref[k] === null) ref[k] = {};
    ref = ref[k];
  }
  ref[parts[parts.length - 1]] = value;
}

export function setRoute(route) {
  Store.ui.route = route;
}

export function setBusy(isBusy, text = "Loading…") {
  Store.ui.busy = !!isBusy;
  Store.ui.busyText = text;
}

export function setToast(type, message) {
  Store.ui.toast = { type, message, ts: Date.now() };
}

export function clearToast() {
  Store.ui.toast = null;
}

export function openModal(modal) {
  Store.ui.modal = modal;
}

export function closeModal() {
  Store.ui.modal = null;
}
