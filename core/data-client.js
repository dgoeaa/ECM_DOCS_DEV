import { State } from './state.js';
import { EndpointContracts } from '../config/endpoints.config.js';
import { EndpointRegistry } from './endpoint-registry.js';
import { fetchPolicyFor } from '../config/fetch-policy.config.js';
import { normalizeError } from './errors.js';
import { LoadingState } from './loading-state.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { PendingQueue } from './pending-queue.js';
import { confirmFlowExecution } from './flow-confirmation.js';
import { authHeaders, clientMayAssertIdentity, ensureAuthenticated } from './auth.js';
import { AuthConfig, isAuthEnforced } from '../config/auth.config.js';
import { AuditLog } from './audit-log.js';
import { getIdentity } from './auth.js';
export const DataClient=Object.freeze({request,resolveUrl});
/**
 * Resolve the runtime target for a contract key.
 *
 * When authentication is enforced and a proxy is configured, governed traffic is routed
 * through the authenticating proxy rather than at a signed flow URL directly. Power
 * Automate HTTP triggers cannot validate a bearer token themselves, so the proxy is what
 * makes enforcement real. Provisioned now so activation is configuration, not re-plumbing.
 */
export function resolveUrl(key){
  const st=State.get();
  if(isAuthEnforced() && AuthConfig.proxyBaseUrl){
    return `${String(AuthConfig.proxyBaseUrl).replace(/\/+$/,'')}/${encodeURIComponent(key)}`;
  }
  return EndpointRegistry.url(key,{overrides:st.settings?.endpoints||{}});
}
export async function request(key,payload={},options={}){ const contract=EndpointContracts[key]; if(!contract) throw new Error('Unknown endpoint '+key); /* Enforced posture: no governed request leaves unauthenticated. No-op while inert. */ await ensureAuthenticated(`endpoint:${key}`); const url=resolveUrl(key); if(!url) throw new Error('Endpoint '+key+' is not configured'); const policy={...fetchPolicyFor(key),...options}; if(!(await confirmFlowExecution({key,contract,payload,options}))) throw new Error('Endpoint execution cancelled by user'); const id=crypto.randomUUID(); const started=Date.now(); LoadingState.start(contract.write?'action':'data',key,{source:'network'}); return PerformanceMonitor.measure('fetch',key,async()=>{ let attempt=0,lastError; while(attempt<=policy.retry){ const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),policy.timeoutMs||contract.timeoutMs||45000); try{ /* Identity. While auth is inert the client asserts `userEmail` from local state, exactly
   as before. Once auth is enforced that field is DROPPED entirely and identity travels
   only in the bearer token, so a tampered local profile cannot influence the backend. */
const asserted=clientMayAssertIdentity()?{userEmail:State.get().profile?.email||''}:{};
const body=options.flatPayload?{action:contract.action,...payload,...asserted,correlationId:id}:{action:contract.action,payload,...asserted,requestId:id,timestamp:new Date().toISOString()}; const r=await fetch(url,{method:contract.method,headers:{'Content-Type':'application/json','X-Correlation-Id':id,...(await authHeaders())},body:JSON.stringify(body),signal:ctl.signal}); const raw=await r.text(); let data; try{data=raw?JSON.parse(raw):{}}catch{throw new Error('Invalid JSON response from '+key)} if(!r.ok) throw new Error(data?.status?.message||data?.message||('HTTP '+r.status)); LoadingState.success(contract.write?'action':'data',key,{source:'network'}); recordCorrelation({key,contract,id,attempt,started,ok:true,status:r.status}); return {ok:true,key,data,requestId:id,durationMs:Date.now()-started,attempts:attempt+1}; } catch(e){ lastError=e; attempt++; if(attempt>policy.retry){ const norm=normalizeError(e,{key,requestId:id}); recordCorrelation({key,contract,id,attempt,started,ok:false,error:norm.message}); LoadingState.error(contract.write?'action':'data',key,e,{retryable:!!contract.write}); if(contract.write){ PendingQueue.enqueue({key,url,payload,error:norm.message,requestId:id,operation:contract.action,retryable:true}); } throw Object.assign(e,{normalized:norm}); } } finally{clearTimeout(timer);} } throw lastError; },{write:!!contract.write}); }

/**
 * Correlation record — the join key between this client and the backend.
 *
 * Every request already carried `X-Correlation-Id: <uuid>` and echoed it in the body as
 * `correlationId`/`requestId`, but that id was never written to the audit log. The result
 * was that an incident could not be reconstructed end to end: the client trail said WHO
 * did WHAT, the Power Automate run history said WHICH CALL ran, and nothing joined the
 * two. Recording the id at the transport boundary — with the effective principal, the
 * contract, the outcome and the wall-clock duration — closes that gap without changing
 * the wire format.
 *
 * `identity.source` is what distinguishes "the browser claimed to be this person"
 * (client-asserted, development posture) from "the token proved it" (enforced posture).
 * An audit line that does not say which one it was is not evidence.
 */
function recordCorrelation({ key, contract, id, attempt, started, ok, status, error }) {
  let principal = {};
  try { principal = getIdentity(); } catch { principal = {}; }
  AuditLog.record({
    ref: '',
    actor: { email: principal.email || State.get()?.profile?.email || '', name: principal.name || '' },
    event: ok ? 'audit:endpoint-call' : 'audit:endpoint-failed',
    entityType: 'endpoint',
    entityId: key,
    meta: {
      correlationId: id,
      operation: contract?.action || '',
      write: !!contract?.write,
      attempts: attempt + 1,
      durationMs: Date.now() - started,
      httpStatus: status ?? null,
      identitySource: principal.source || 'unknown',
      identityVerified: principal.verified === true,
      error: error || '',
    },
  });
}
