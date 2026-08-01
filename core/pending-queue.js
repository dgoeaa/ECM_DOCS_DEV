import { State } from './state.js';
import { AuditLog } from './audit-log.js';
const clone=v=>structuredClone(v); const uid=()=>crypto.randomUUID?.() || Math.random().toString(36).slice(2);
export const PendingQueue=Object.freeze({enqueue,list,retry,clear,remove,stats});
export function enqueue(item){ const s=State.get(); const row={id:item.id||uid(),at:new Date().toISOString(),retryCount:item.retryCount||0,retryable:item.retryable!==false,status:'pending',...item}; State.patch({pending:[row,...(s.pending||[])].slice(0,250)},{module:'pending-queue',action:'enqueue',ref:item.ref||''}); AuditLog.record({event:'audit:pending-write-queued',actor:s.profile||{},ref:item.ref||'',meta:{key:item.key,error:item.error}}); return clone(row); }
export function list(filter={}){ return clone((State.get().pending||[]).filter(x=>Object.entries(filter).every(([k,v])=>!v||x[k]===v))); }
export function remove(id){ const s=State.get(); State.patch({pending:(s.pending||[]).filter(x=>x.id!==id)},{module:'pending-queue',action:'remove'}); }
export function clear(){ State.patch({pending:[]},{module:'pending-queue',action:'clear'}); }
export async function retry(id,runner){ const s=State.get(); const item=(s.pending||[]).find(x=>x.id===id); if(!item) throw new Error('Pending item not found'); try{ const res=await runner(item); remove(id); AuditLog.record({event:'audit:pending-write-retried',actor:s.profile||{},ref:item.ref||'',meta:{id,key:item.key}}); return res; }catch(e){ const pending=(State.get().pending||[]).map(x=>x.id===id?{...x,retryCount:(x.retryCount||0)+1,lastError:e.message,lastRetryAt:new Date().toISOString()}:x); State.patch({pending},{module:'pending-queue',action:'retry-failed'}); throw e; } }
export function stats(){ const p=State.get().pending||[]; return Object.freeze({count:p.length,retryable:p.filter(x=>x.retryable!==false).length,failed:p.filter(x=>x.status==='failed').length,oldest:p[p.length-1]?.at||''}); }
