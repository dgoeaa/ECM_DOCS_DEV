export const SupportRoutingConfig = Object.freeze({
  schema: 'dgo-support-routing/v1',
  endpointAlias: 'SUBSIDIARY_ACTIONS',
  operation: 'CREATESUPPORTREQUEST',
  categories: Object.freeze([
    { id:'access-error', label:'Access Error', route:'assistant', severity:'high' },
    { id:'reassignment', label:'Reassignment Request', route:'single-assignment', severity:'medium' },
    { id:'timeline', label:'Timeline / Due Date Issue', route:'orchestrator', severity:'medium' },
    { id:'clarification', label:'Clarification Required', route:'comments', severity:'normal' },
    { id:'offline-queue', label:'Offline / Queue Issue', route:'diagnostics', severity:'high' },
    { id:'wrong-task', label:'Wrong Task or Reference', route:'lookup', severity:'high' },
    { id:'already-acknowledged', label:'Already Acknowledged', route:'acknowledgment', severity:'normal' }
  ]),
  includeContext: Object.freeze(['route','selectedId','profile','lastAction','lastError','pendingStats','receiptStats','userAgent','online']),
  supportEmail: 'dgs@nitda.gov.ng'
});
