import { State } from './state.js';
import { DataClient } from './data-client.js';
import { PendingQueue } from './pending-queue.js';
import { Idempotency } from './idempotency.js';
import { auditAction } from './action-authority.js';
import { toast } from './ui.js';
const clone=v=>structuredClone(v);
export const WriteManager=Object.freeze({local,backend,optimistic,commit:(args)=>backend(args)});
export async function local({module,action,patch,ref='',message=''}){ State.patch(patch,{module,action,ref}); auditAction(module,action,{ref,meta:{local:true}}); if(message) toast?.(message,'success'); return {ok:true,source:'local',patch}; }
export async function backend({module,action,endpoint='DYNAMIC_ACTIONS',payload={},ref='',message=''}){ const actor=State.get().profile||{}; const idempotencyKey=await Idempotency.key({operation:action,ref,actor,payload}); const res=await DataClient.request(endpoint,{operation:action,ref,idempotencyKey,...payload}); auditAction(module,action,{ref,meta:{backend:endpoint,idempotencyKey}}); if(message) toast?.(message,'success'); return res; }
export async function optimistic({module,action,patch,endpoint='DYNAMIC_ACTIONS',payload={},ref='',rollbackOnFailure=true,message=''}){ const before=clone(State.get()); State.patch(patch,{module,action,ref}); try{return await backend({module,action,endpoint,payload,ref,message});}catch(e){ if(rollbackOnFailure) State.patch(before,{module:'write-manager',action:'rollback',ref,silent:true}); else PendingQueue.enqueue({key:endpoint,payload,ref,error:e.message,operation:action}); throw e;} }

