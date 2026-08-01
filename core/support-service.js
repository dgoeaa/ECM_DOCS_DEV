import { State } from './state.js';
import { WriteManager } from './write-manager.js';
import { ReceiptLedger } from './receipt-ledger.js';
import { SupportRoutingConfig } from '../config/support-routing.config.js';
function pendingStats(){ const p=State.get().pending||[]; return {count:p.length, ack:p.filter(x=>x.queueType==='acknowledgement').length}; }
export const SupportService=Object.freeze({buildContext, submit});
export function buildContext(extra={}){ const s=State.get(); return {route: location.hash.replace(/^#\/?/, '')||'home', selectedId:s.selectedId||'', profile:s.profile||{}, lastAction:s.runtime?.lastAction||'', lastError:s.runtime?.lastError||'', pendingStats:pendingStats(), receipts: (s.receipts||[]).slice(0,5), userAgent:navigator.userAgent, online:navigator.onLine, at:new Date().toISOString(), ...extra}; }
export async function submit({category='clarification', message='', ref='', taskId=''}={}){ const context=buildContext({ref,taskId}); const payload={operation:SupportRoutingConfig.operation, category, message, context}; const res=await WriteManager.backend({module:'assistant',action:'support-request',endpoint:SupportRoutingConfig.endpointAlias,payload,ref:ref||taskId,message:'Support request submitted'}); ReceiptLedger.record({type:'support',ref,taskId,status:'sent',sentAt:new Date().toISOString(),payload,response:res}); return res; }
