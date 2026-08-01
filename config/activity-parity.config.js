// Canvas Activities parity constants.
//
// Scope note (governance): this file carries *Canvas formulas and vocabulary only* —
// reference-ID suffixes, queue category labels, the FastTrack queue tag, the status tabs
// and the default filter set. It deliberately declares no route table and no action list:
// routing stays in config/action-routing.config.js + config/routes.config.js and action
// ownership stays in config/action-ownership.config.js, which remain authoritative.
export const ActivityParityConfig = Object.freeze({
  schema: 'dgo-activity-parity-config/v1',
  // Canvas queue tag written on every FastTrack lifecycle record.
  queueTag: 'DGOFASTTRACK',
  // Canvas assignment constants for the lifecycle queue record.
  queueAssignedBy: 'DGS OFFICE',
  queueAssignedTo: 'dgs@NITDA.gov.ng',
  queueStatus: 'Completed',
  queuePriority: 'low',
  // Reference_ID suffix + queue Category per lifecycle action, and the Canvas toast prefix.
  lifecycle: Object.freeze({
    archive: Object.freeze({ suffix: 'UNC', category: 'Archived', messagePrefix: 'Archiving' }),
    siwes: Object.freeze({ suffix: 'INT-SIWES', category: 'Internships (SIWES)', messagePrefix: 'SIWES' }),
    nysc: Object.freeze({ suffix: 'INT-NYSC', category: 'Internships (NYSC)', messagePrefix: 'Archiving' })
  }),
  // Canvas DGO DIGITAL OPS update semantics applied to the source activity after the queue write.
  dgoUpdate: Object.freeze({ status: 'Treated', assignmentStatus: 'Assigned' }),
  statusTabs: Object.freeze(['All', 'Treated', 'Not Treated']),
  // Only absolute http(s) targets may ever reach an href or a preview frame.
  allowedAttachmentProtocols: Object.freeze(['http:', 'https:'])
});

export const DefaultActivityFilters = Object.freeze({
  statusTab: 'All',
  assignedTo: '',
  category: '',
  status: '',
  assignmentStatus: '',
  dateFrom: '',
  dateTo: '',
  search: ''
});

// Source-view scoping (Option A, deliberate): `sourceView` is *not* a Canvas
// DefaultActivityFilters key and must not become one. Source-view filtering (ingestion source)
// is owned by core/source-views.js (inferSourceId/filterItemsBySource) with the selection held
// in UIState,
// and modules/activities.js applies it separately from — and alongside —
// ActivityParity.filterActivities, which stays a faithful port of the Canvas gallery filter
// chain and is deliberately source-agnostic. Merging the two would put a
// platform ingestion concept inside the Canvas parity contract and would make a source-view
// regression indistinguishable from a Canvas filter regression.
// Proven by tests/activity-source-view-alignment-contract.mjs.

export const lifecycleSpec = type => ActivityParityConfig.lifecycle[type] || null;
export const lifecycleTypes = () => Object.keys(ActivityParityConfig.lifecycle);
