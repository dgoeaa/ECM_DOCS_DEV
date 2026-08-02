import { State } from './state.js';
import { DataClient } from './data-client.js';
import { Idempotency } from './idempotency.js';
import { ReceiptLedger } from './receipt-ledger.js';
import { OfflineActionQueue } from './offline-action-queue.js';
import { acknowledgeTask } from './enterprise-domain.js';
import { AcknowledgementFlowConfig } from '../config/acknowledgement-flow.config.js';

const now = () => new Date().toISOString();
const text = v => String(v ?? '').trim();
/** HTML-escape. `text()` normalises whitespace only and is also used for non-HTML fields
 *  (recipient address, subject), so escaping belongs at the HTML interpolation site. */
const h = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const lower = v => text(v).toLowerCase();
function taskKey(t){ return [t?.id,t?.taskId,t?.referenceId,t?.RefIDD,t?.Reference_ID,t?.AssignmentID,t?.DGOPID].map(text).filter(Boolean); }
export function findAcknowledgementTask(state=State.get(), key=''){
  const v=lower(key); if(!v) return null;
  return (state.tracking||[]).find(t=>taskKey(t).some(k=>lower(k)===v)) || null;
}
export function activeAcknowledgementKey(state=State.get()){
  const ctx=state.deepLinkContext||{}; return text(ctx.taskId||ctx.referenceId||state.selectedId||'');
}
export function selectTaskForAcknowledgement(state=State.get(), uiSelected=''){
  return findAcknowledgementTask(state, uiSelected) || findAcknowledgementTask(state, activeAcknowledgementKey(state)) || (state.tracking||[])[0] || null;
}

export function resolveAcknowledgementActor({profile=State.get().profile||{}, context=State.get().deepLinkContext||{}, form={}}={}){
  const email = text(form.actorEmail || form.email || context.actorEmail || context.userEmail || context.staffEmail || context.email || profile.email);
  const name = text(form.actorName || form.name || context.actorName || context.userName || context.displayName || context.name || profile.name || email);
  const persona = text(form.persona || form.role || context.persona || context.role || profile.persona || 'operator');
  const department = text(form.department || context.department || context.unit || profile.department || '');
  const phone = text(form.phone || context.phone || profile.phone || '');
  const source = form.actorEmail || form.email ? 'form' : (context.actorEmail || context.userEmail || context.staffEmail || context.email || context.name ? 'deeplink' : 'state-profile');
  return Object.freeze({ name, email, persona, department, phone, source });
}


export function assignedToForTask(task={}){
  return text(task.assignedTo || task.AssignedTo || task.assigneeEmail || task.assigned || '');
}
export function acknowledgementStatusForTask(task={}){
  return text(task.assignedToAcknowledgementStatus?.Value || task.AssignedToAcknowledgementStatus?.Value || task.acknowledgementStatus || task.ackStatus || (task.acknowledged ? 'Acknowledged' : 'Assigned')) || 'Assigned';
}
export function canActorAcknowledge(task, actor){
  const assignedTo = lower(assignedToForTask(task));
  const actorEmail = lower(actor?.email || actor?.actorEmail || '');
  return Object.freeze({ allowed: !!assignedTo && !!actorEmail && assignedTo === actorEmail, assignedTo, actorEmail, reason: !assignedTo ? 'task has no assignedTo email' : !actorEmail ? 'acknowledging user email is required' : assignedTo !== actorEmail ? `only assigned user ${assignedTo} may acknowledge` : '' });
}
export function buildAcknowledgementNotification(task, payload){
  const title = text(task.title || task.Title || 'Task');
  const assignedTo = assignedToForTask(task);
  const due = text(task.due || task.DueDate || task.dueDate || '');
  const priority = text(task.priority || task.Priority?.Value || task.Priority || '');
  const category = text(task.category || task.Category || '');
  // HTML-escape every interpolation. `text()` only trims, and several of these fields
  // originate in deep-link query parameters (config/deeplink.config.js preserveQueryParams
  // -> State.deepLinkContext -> resolveAcknowledgementActor), so raw interpolation let a
  // crafted link inject markup into an official acknowledgement email that the platform
  // itself sends to the assignee and CCs to the registry.
  const body = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:18px"><div style="max-width:640px;margin:auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden"><div style="background:#05583B;color:#fff;padding:14px 18px;text-align:center"><h2 style="margin:0">Task Acknowledgment Confirmation</h2></div><div style="padding:16px"><p>Your task <b>${h(title)}</b> has been acknowledged by <b>${h(payload.actorName)}</b>.</p><table style="width:100%;border-collapse:collapse"><tr><th align="left">Reference</th><td>${h(payload.referenceId)}</td></tr><tr><th align="left">Category</th><td>${h(category)}</td></tr><tr><th align="left">Assigned To</th><td>${h(assignedTo)}</td></tr><tr><th align="left">Priority</th><td>${h(priority)}</td></tr><tr><th align="left">Due Date</th><td>${h(due)}</td></tr><tr><th align="left">Acknowledged Time</th><td>${h(payload.acknowledgedTime)}</td></tr><tr><th align="left">Acknowledged By</th><td>${h(payload.actorName)} &lt;${h(payload.actorEmail)}&gt;</td></tr></table></div><div style="padding:12px 16px;background:#f9fafb;color:#6b7280;font-size:12px">DGO Digital OPS acknowledgement evidence</div></div></body></html>`;
  return Object.freeze({ to: assignedTo, cc: 'dgsregistry@nitda.gov.ng', subject: `Task Acknowledged: ${title} (${payload.taskId})`, body, format:'html' });
}

export async function buildAcknowledgementPayload(task, {source='acknowledgment', actor=State.get().profile||{}, context=State.get().deepLinkContext||{}, form={}, at=now()}={}){
  if(!task) throw new Error('Acknowledgement task is required');
  const resolvedActor = resolveAcknowledgementActor({profile:actor, context, form});
  const taskId=text(task.id||task.taskId||context.taskId);
  const referenceId=text(task.referenceId||task.RefIDD||task.Reference_ID||context.referenceId||taskId);
  const base={
    operation: AcknowledgementFlowConfig.operation,
    mode: 'single',
    taskId,
    referenceId,
    acknowledgedTime: at,
    source,
    actor: { name: resolvedActor.name, email: resolvedActor.email, persona: resolvedActor.persona, department: resolvedActor.department, phone: resolvedActor.phone, capturedFrom: resolvedActor.source },
    actorName: resolvedActor.name,
    actorEmail: resolvedActor.email,
    actorPersona: resolvedActor.persona,
    actorDepartment: resolvedActor.department,
    actorPhone: resolvedActor.phone,
    actorCapturedFrom: resolvedActor.source,
    assignedTo: assignedToForTask(task),
    assignedToAcknowledgementStatus: acknowledgementStatusForTask(task),
    taskTitle: text(task.title||task.Title||''),
    category: text(task.category||task.Category||''),
    priority: text(task.priority||task.Priority?.Value||task.Priority||''),
    dueDate: text(task.due||task.DueDate||task.dueDate||''),
    route: 'acknowledgment',
    matchedParam: context.matchedParam||'',
    deepLinkSource: context.source||'',
    returnTo: context.returnTo||'',
    batchId: context.batchId||'',
    trackingId: context.trackingId||'',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    notification: null,
    __confirmedByUI: true
  };
  const idempotencyKey = await Idempotency.key({operation: AcknowledgementFlowConfig.operation, ref: referenceId||taskId, actor:resolvedActor, payload:{taskId,referenceId,acknowledgedTime:at,source,actorEmail:resolvedActor.email}});
  const payload = {...base, idempotencyKey};
  payload.notification = buildAcknowledgementNotification(task, payload);
  return Object.freeze(payload);
}
export function validateAcknowledgementPayload(payload={}){
  const missing=AcknowledgementFlowConfig.requiredPayloadFields.filter(k=>!payload[k]);
  const errors=[];
  if(missing.length) errors.push('Missing acknowledgement payload field(s): '+missing.join(', '));
  if(!payload.actor?.email && !payload.actorEmail) errors.push('acknowledging user email is required');
  if(!payload.actor?.name && !payload.actorName) errors.push('acknowledging user name is required');
  if(payload.assignedTo && lower(payload.assignedTo) !== lower(payload.actorEmail)) errors.push('User Not Allowed: only the assigned user '+payload.assignedTo+' may acknowledge this task');
  return Object.freeze(errors);
}
export async function submitAcknowledgement(task, {source='acknowledgment', sync=true, context=State.get().deepLinkContext||{}, form={}}={}){
  const state=State.get(); const profile=state.profile||{};
  const payload=await buildAcknowledgementPayload(task,{source,actor:profile,context,form});
  const actorGate=canActorAcknowledge(task,payload.actor);
  if(!actorGate.allowed){ ReceiptLedger.record({type:'acknowledgement',taskId:payload.taskId,ref:payload.referenceId,status:'unauthorized',actorEmail:payload.actorEmail,actorName:payload.actorName,actorCapturedFrom:payload.actorCapturedFrom,source,payload,response:{reason:actorGate.reason}}); throw new Error('User Not Allowed: '+actorGate.reason); }
  const errors=validateAcknowledgementPayload(payload); if(errors.length) throw new Error(errors.join('; '));
  const already=lower(payload.assignedToAcknowledgementStatus)==='acknowledged' || !!task.acknowledged;
  if(!already){ const r=acknowledgeTask(State.get(), payload.taskId, payload.actorEmail, {surface:source}); if(r) State.patch(r.patch,{module:'acknowledgment',action:'ack:local',event:'audit:acknowledged-local',ref:payload.referenceId||payload.taskId}); }
  if(already){
    const receipt=ReceiptLedger.record({type:'acknowledgement',taskId:payload.taskId,ref:payload.referenceId,status:'already-acknowledged',actorEmail:payload.actorEmail,source,payload,attempts:0});
    return Object.freeze({ok:true,status:'already-acknowledged',payload,receipt,backend:null});
  }
  let backend=null, status='acknowledged';
  if(sync){
    try{
      backend=await DataClient.request(AcknowledgementFlowConfig.endpointAlias,payload,{retry:0,skipConfirmation:true});
      status='sent';
    }catch(error){
      OfflineActionQueue.enqueueAck(payload,error.message||'Acknowledgement backend sync failed');
      status='queued';
      backend={ok:false,error:error.message||String(error),queued:true};
    }
  }
  const receipt=ReceiptLedger.record({type:'acknowledgement',taskId:payload.taskId,ref:payload.referenceId,status,actorEmail:payload.actorEmail,source,payload,response:backend,attempts:status==='queued'?0:1,sentAt:status==='sent'?now():''});
  State.patch({runtime:{...(State.get().runtime||{}),lastAcknowledgement:{at:now(),status,taskId:payload.taskId,referenceId:payload.referenceId,actorEmail:payload.actorEmail,actorName:payload.actorName,actorCapturedFrom:payload.actorCapturedFrom,receiptId:receipt.receiptId}}},{module:'acknowledgment',action:'ack:receipt',event:'audit:acknowledgement-receipt',ref:payload.referenceId||payload.taskId});
  return Object.freeze({ok:true,status,payload,receipt,backend});
}
export async function retryQueuedAcknowledgements(){ return OfflineActionQueue.retryAckQueue(); }
export function acknowledgementHealth(){ const r=ReceiptLedger.stats(), q=OfflineActionQueue.summary(); return Object.freeze({receipts:r, queue:q, ready:true, endpoint:AcknowledgementFlowConfig.endpointAlias, operation:AcknowledgementFlowConfig.operation}); }
export function exportAcknowledgementReceipts(kind='json'){
  return kind==='csv' ? ReceiptLedger.exportCSV() : ReceiptLedger.exportJSON();
}
