import { State } from './state.js';
import { AuditLog } from './audit-log.js';
import { ReceiptLedgerConfig } from '../config/receipt-ledger.config.js';
const uid=()=>crypto.randomUUID?.()||('r_'+Date.now()+'_'+Math.random().toString(36).slice(2));
const clone=v=>structuredClone(v);
function current(){ return State.get().receipts || []; }
function persist(receipts){ State.patch({receipts: receipts.slice(0, ReceiptLedgerConfig.limit)}, {module:'receipt-ledger', action:'persist', silent:true}); }
export const ReceiptLedger=Object.freeze({record, list, stats, exportJSON, exportCSV, clear, byRef});
export function record(input={}){
  const s=State.get();
  const row={ receiptId: input.receiptId||uid(), type: input.type||'acknowledgement', ref: input.ref||input.referenceId||'', taskId: input.taskId||'', status: input.status||'recorded', actorEmail: input.actorEmail||input.payload?.actorEmail||input.payload?.actor?.email||s.profile?.email||'',actorName: input.actorName||input.payload?.actorName||input.payload?.actor?.name||s.profile?.name||'',actorCapturedFrom: input.actorCapturedFrom||input.payload?.actorCapturedFrom||input.payload?.actor?.capturedFrom||'', actorName: input.actorName||s.profile?.name||'', createdAt: input.createdAt||new Date().toISOString(), sentAt: input.sentAt||'', attempts: input.attempts||0, source: input.source||'dgo-runtime', idempotencyKey: input.idempotencyKey||'', payload: input.payload||null, response: input.response||null };
  persist([row,...current()]);
  AuditLog.record({event:'audit:receipt-recorded',actor:s.profile||{},ref:row.ref||row.taskId,meta:{receiptId:row.receiptId,type:row.type,status:row.status}});
  return clone(row);
}
export function list(filter={}){ return clone(current().filter(r=>Object.entries(filter).every(([k,v])=>!v||r[k]===v))); }
export function byRef(ref){ return list().filter(r=>r.ref===ref||r.taskId===ref); }
export function stats(){ const r=current(); return Object.freeze({count:r.length, acknowledged:r.filter(x=>['acknowledged','sent','already-acknowledged'].includes(x.status)).length, queued:r.filter(x=>x.status==='queued').length, failed:r.filter(x=>x.status==='failed').length, latest:r[0]?.createdAt||''}); }
export function exportJSON(){ return JSON.stringify({schema:ReceiptLedgerConfig.schema, exportedAt:new Date().toISOString(), receipts:list()}, null, 2); }
export function exportCSV(){ const H=ReceiptLedgerConfig.csvHeader; const rows=[H.join(',')].concat(list().map(r=>H.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))); return rows.join('\n'); }
export function clear(){ persist([]); AuditLog.record({event:'audit:receipt-ledger-cleared',actor:State.get().profile||{},meta:{}}); }
