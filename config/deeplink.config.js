export const DeepLinkConfig = Object.freeze({
  schema: 'dgo-deeplink-config/v1',
  acceptedParams: Object.freeze({
    TaskID: { contextKey:'taskId', route:'acknowledgment', action:'acknowledge-task' },
    taskId: { contextKey:'taskId', route:'acknowledgment', action:'acknowledge-task' },
    ACK: { contextKey:'taskId', route:'acknowledgment', action:'acknowledge-task' },
    AssnPID: { contextKey:'taskId', route:'acknowledgment', action:'acknowledge-task' },
    DGOPID: { contextKey:'referenceId', route:'lookup', action:'open-document' },
    ITEMID: { contextKey:'referenceId', route:'lookup', action:'open-document' },
    USERSUPPORT: { contextKey:'support', route:'assistant', action:'open-support' },
    support: { contextKey:'support', route:'assistant', action:'open-support' },
    ref: { contextKey:'referenceId', route:'lookup', action:'open-document' },
    referenceId: { contextKey:'referenceId', route:'lookup', action:'open-document' }
  }),
  routeFallback: 'home',
  preserveQueryParams: ['email','name','source','returnTo','batchId','trackingId','actorEmail','actorName','userEmail','userName','staffEmail','displayName','persona','role','department','unit','phone'],
  source: 'deeplink-html'
});
export function deeplinkParamEntries(){ return Object.entries(DeepLinkConfig.acceptedParams); }
