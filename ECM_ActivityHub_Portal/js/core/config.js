// Central configuration (wire your environment here).
// Values can be overridden at runtime by setting window.DGO_CONFIG before this
// module loads — see config.example.js for the documented structure.
const _override = (typeof window !== 'undefined' && window.DGO_CONFIG) || {};

export const CONFIG = {
  APP_NAME: "NITDA DG/CEO Digital Operations Hub — Executive SPA",
  ENV: "PROD", // DEV | PROD
  DEBUG_MODE: true,

  // Primary backend endpoint. If empty, the SPA falls back to DEMO mode.
  //
  // This MUST default to empty. It previously defaulted to a personal Cloudflare Workers
  // subdomain, so any deployment without config.local.js — which is git-ignored, and so
  // absent on every fresh clone — sent correspondence payloads to a third-party origin
  // under an individual's account while ENV read "PROD". Falling back to DEMO mode is the
  // safe failure: it is visible, local, and sends nothing anywhere.
  //
  // Supply the real gateway at deploy time via window.DGO_CONFIG.API_URL. Prefer the
  // authenticating proxy (AuthConfig.proxyBaseUrl) over a signed flow URL.
  API_URL: _override.API_URL || "",

  // Logical actions expected by backend (Power Automate / API gateway). Keep stable for workflow integrations.
  ACTIONS: {
    GET_BOOTSTRAP: "GET_BOOTSTRAP",
    INBOX_LIST: "INBOX_LIST",
    INBOX_TRIAGE: "INBOX_TRIAGE",
    CORR_INWARD_LIST: "CORR_INWARD_LIST",
    CORR_OUTWARD_LIST: "CORR_OUTWARD_LIST",
    CORR_REGISTER_INWARD: "CORR_REGISTER_INWARD",
    CORR_CREATE_OUTWARD: "CORR_CREATE_OUTWARD",
    CORR_DELETE: "CORR_DELETE",

    MINUTE_CREATE: "MINUTE_CREATE",
    MINUTE_ROUTE: "MINUTE_ROUTE",
    MINUTE_CLOSE: "MINUTE_CLOSE",
    MINUTE_LIST: "MINUTE_LIST",

    APPROVAL_LIST: "APPROVAL_LIST",
    APPROVAL_DECIDE: "APPROVAL_DECIDE",

    BRIEF_LIST: "BRIEF_LIST",
    BRIEF_CREATE: "BRIEF_CREATE",
    BRIEF_SUBMIT: "BRIEF_SUBMIT",
    BRIEF_DECIDE: "BRIEF_DECIDE",

    DECISION_LIST: "DECISION_LIST",
    DECISION_RECORD: "DECISION_RECORD",

    MEETING_LIST: "MEETING_LIST",
    MEETING_REQUEST: "MEETING_REQUEST",
    MEETING_APPROVE: "MEETING_APPROVE",
    MEETING_MINUTE_TO_TASKS: "MEETING_MINUTE_TO_TASKS",

    TASK_LIST: "TASK_LIST",
    TASK_CREATE: "TASK_CREATE",
    TASK_UPDATE: "TASK_UPDATE",
    TASK_DELETE: "TASK_DELETE",
    TASK_COMPLETE: "TASK_COMPLETE",

    PROJECT_LIST: "PROJECT_LIST",
    PROJECT_UPDATE: "PROJECT_UPDATE",

    KPI_SNAPSHOT: "KPI_SNAPSHOT",

    REPORT_GENERATE: "REPORT_GENERATE",
    NOTIFICATIONS_LIST: "NOTIFICATIONS_LIST",
    NOTIFICATIONS_ACK: "NOTIFICATIONS_ACK",
    AUDIT_LIST: "AUDIT_LIST",
    SLA_METRICS: "SLA_METRICS",

    DIRECTORY_LIST: "DIRECTORY_LIST",

    AI_CHAT: "AI_CHAT"
  },

  // UI settings
  PAGE_SIZE: 20,
  DEMO_FALLBACK: false
    
};
