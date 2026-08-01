export const ReceiptLedgerConfig = Object.freeze({
  schema: 'dgo-receipt-ledger/v1',
  storageKeys: Object.freeze({ receipts:'DGO_ACK_RECEIPTS_V4_EXPORT', queue:'DGO_ACK_QUEUE_V4_EXPORT' }),
  limit: 500,
  receiptTypes: Object.freeze(['acknowledgement','support','assignment','offline-queue']),
  csvHeader: ['receiptId','type','ref','taskId','status','actorEmail','actorName','actorCapturedFrom','createdAt','sentAt','attempts','source']
});
