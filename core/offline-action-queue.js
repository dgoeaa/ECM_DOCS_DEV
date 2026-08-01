import { State } from './state.js';
import { PendingQueue } from './pending-queue.js';
import { ReceiptLedger } from './receipt-ledger.js';
import { WriteManager } from './write-manager.js';
export const OfflineActionQueue=Object.freeze({enqueueAck, retryAckQueue, installOnlineRetry, summary});
export function enqueueAck(payload,error='Offline acknowledgement queued'){
  const row=PendingQueue.enqueue({key:'SUBSIDIARY_ACTIONS',operation:'ACKNOWLEDGE',payload,ref:payload.referenceId||payload.taskId,error,retryable:true,queueType:'acknowledgement'});
  ReceiptLedger.record({type:'acknowledgement',taskId:payload.taskId,ref:payload.referenceId,status:'queued',source:payload.source||'acknowledgment',attempts:0,idempotencyKey:payload.idempotencyKey,payload,response:{error}});
  return row;
}
export async function retryAckQueue(){
  const items=PendingQueue.list({queueType:'acknowledgement'}); let ok=0, fail=0;
  for(const item of items){
    try{ await PendingQueue.retry(item.id, async q=>WriteManager.backend({module:'acknowledgment',action:'acknowledge-retry',endpoint:q.key,payload:{...q.payload,__confirmedByUI:true},ref:q.ref,message:''})); ok++; ReceiptLedger.record({type:'acknowledgement',taskId:item.payload?.taskId,ref:item.ref,status:'sent',attempts:(item.retryCount||0)+1,payload:item.payload,sentAt:new Date().toISOString(),response:{retried:true}}); }
    catch(e){ fail++; ReceiptLedger.record({type:'acknowledgement',taskId:item.payload?.taskId,ref:item.ref,status:'failed',attempts:(item.retryCount||0)+1,payload:item.payload,response:{error:e.message}}); }
  }
  return {ok,fail,total:items.length};
}
export function installOnlineRetry(){ if(typeof window==='undefined') return; window.addEventListener('online',()=>retryAckQueue().catch(()=>{})); }
export function summary(){ const p=State.get().pending||[]; const ack=p.filter(x=>x.queueType==='acknowledgement'); return Object.freeze({count:ack.length,retryable:ack.filter(x=>x.retryable!==false).length,failed:ack.filter(x=>x.status==='failed').length,oldest:ack[ack.length-1]?.at||''}); }
