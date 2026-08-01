const array = value => Array.isArray(value) ? value : [];
export function assertEnvelope(response, expectedAction='') {
  if (!response || typeof response !== 'object') throw new Error('Flow returned a non-object response');
  if (response.ok === false || Number(response.status?.http||200) >= 400) {
    const detail=array(response.errors).map(e=>e?.message||e?.code||String(e)).join('; ');
    throw new Error(detail || response.status?.message || 'Flow reported failure');
  }
  // A differing action LABEL must not discard an otherwise-successful response (ok:true, http<400):
  // flows legitimately label their action (e.g. 'lookups', 'fetchAll', 'getAll'). Downgraded from a
  // hard throw to a diagnostic warning so valid data is processed by shape rather than rejected.
  if (expectedAction && response.request?.action && String(response.request.action).toLowerCase()!==String(expectedAction).toLowerCase()) {
    try { console.warn(`[contracts] Flow action label '${response.request.action}' differs from expected '${expectedAction}'; processing response by shape.`); } catch {}
  }
  return response.data ?? response;
}
export const responseMeta = response => ({requestId:response?.request?.requestId||'',trackingId:response?.request?.trackingId||'',action:response?.request?.action||'',receivedAt:response?.timing?.receivedAtUtc||'',completedAt:response?.timing?.completedAtUtc||'',durationMs:Number(response?.timing?.durationMs||0),runId:response?.meta?.runId||'',flowName:response?.meta?.flowName||'',contractVersion:response?.meta?.contractVersion||''});
export function collection(data, ...aliases){for(const key of aliases)if(Array.isArray(data?.[key]))return data[key];return []}
export function unwrapActionResponse(key,response){
 const data=assertEnvelope(response);
 if(['AI_CHAT','AI_EMAIL_ANALYSIS','AI_DOC_ANALYSIS'].includes(key)) return data.result??data.analysis??data.message??data;
 if(['OTP_GENERATE','OTP_VERIFY'].includes(key)) return data.result??data;
 return data;
}
