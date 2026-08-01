export const AcknowledgementFlowConfig = Object.freeze({
  schema: 'dgo-acknowledgement-flow/v1',
  endpointAlias: 'SUBSIDIARY_ACTIONS',
  operation: 'ACKNOWLEDGE',
  queueKey: 'acknowledgement',
  receiptLimit: 500,
  dedupeWindowMs: 10000,
  retry: Object.freeze({ maxAttempts: 3, initialDelayMs: 1200, factor: 2 }),
  requiredPayloadFields: ['taskId','acknowledgedTime','source','actor','idempotencyKey'],
  statuses: Object.freeze(['queued','sending','sent','acknowledged','already-acknowledged','unauthorized','failed']),
  receiptExportFields: ['receiptId','taskId','referenceId','actorEmail','status','queuedAt','sentAt','acknowledgedAt','attempts','source','idempotencyKey']
});
export const AcknowledgementEndpointAliases = Object.freeze({
  fetchItem: 'DYNAMIC_ACTIONS',
  fetchTask: 'DYNAMIC_ACTIONS',
  acknowledge: 'SUBSIDIARY_ACTIONS',
  assign: 'SINGLE_ASSIGNMENT',
  bulkAssign: 'BULK_ASSIGNMENT',
  support: 'SUBSIDIARY_ACTIONS',
  createTask: 'SINGLE_ASSIGNMENT',
  getReferenceData: 'REFERENCE_DATA'
});
