import { normalizePriority } from '../config/priority.config.js';
const now=()=>new Date().toISOString();
const uid=p=>`${p}-${crypto.randomUUID()}`;
const val=(...x)=>x.find(v=>v!==undefined&&v!==null&&v!=='')??'';
export const CorrespondenceStates=Object.freeze(['Received','Logged','Reviewed','Classified','Assigned','In Treatment','Completed','Closed','Archived','On Hold','Rejected','Duplicate']);
export const OperationStates=Object.freeze(['Not Started','In Progress','Awaiting Response','Pending Approval','Escalated','Blocked','Completed','Closed']);
export const RegistryStates=Object.freeze(['Unregistered','Registered','In Registry','Routed','Received','Awaiting Collection','Dispatched','Closed','Archived']);
export function enrichCorrespondence(a,old={}){const treated=['Treated','Processed'].includes(a.status);return{...old,id:String(a.id),sourceId:a.sourceId,referenceId:a.referenceId||old.referenceId||'',subject:a.title,sender:old.sender||'',senderEmail:old.senderEmail||'',receivedAt:a.created,correspondenceType:old.correspondenceType||'Incoming',channel:old.channel||'Document',category:a.category||old.category||'',subcategory:old.subcategory||'',assignedTo:a.assignedTo||old.assignedTo||'',assignedDsu:old.assignedDsu||'',status:old.status||(treated?'In Treatment':'Received'),priority:normalizePriority(old.priority),confidentiality:old.confidentiality||'Official',attachmentLink:a.attachmentLink||'',description:a.description||'',duplicateOf:old.duplicateOf||'',holdReason:old.holdReason||'',closedAt:old.closedAt||'',createdAt:old.createdAt||a.created,updatedAt:now()}}
export function enrichOperation(t,old={}){return{...old,id:String(t.id),sourceId:t.sourceId,referenceId:t.referenceId||'',title:t.title,description:t.description||'',owner:t.assignedTo||'',dsu:t.assignedToDsu||'',supportingDsu:t.supportingDsu||'',status:old.status||mapTaskStatus(t.status),priority:normalizePriority(t.priority),startDate:t.startDate||t.created,dueDate:t.due||'',progress:Number(old.progress??parseProgress(t.progress)),blockedReason:old.blockedReason||'',dependencies:old.dependencies||[],milestones:old.milestones||[],escalationLevel:Number(old.escalationLevel||0),createdAt:old.createdAt||t.created,updatedAt:now()}}
function mapTaskStatus(s){const x=String(s||'').toLowerCase();if(x.includes('complete'))return'Completed';if(x.includes('progress'))return'In Progress';if(x.includes('await'))return'Awaiting Response';return'Not Started'}
function parseProgress(x){const n=parseInt(x,10);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):0}
export function registryNumber(sourceId,date=new Date()){const y=new Date(date).getFullYear()||new Date().getFullYear();return `DGO/${y}/${String(sourceId||Date.now()).padStart(6,'0')}`}
export function reconcileEnterprise(state){const corrMap=new Map((state.correspondence||[]).map(x=>[String(x.id),x])),opsMap=new Map((state.operations||[]).map(x=>[String(x.id),x]));const correspondence=(state.activities||[]).map(a=>enrichCorrespondence(a,corrMap.get(String(a.id))));const operations=(state.tracking||[]).map(t=>enrichOperation(t,opsMap.get(String(t.id))));return{correspondence,operations}}
export function createMovement(file,{from,to,action='FOR_ACTION',priority='MEDIUM',minute='',by='',status='Routed'}){return{id:uid('MOV'),registryFileId:file.id,registryNumber:file.registryNumber,referenceId:file.referenceId,from:from||file.currentHolder||'Central Registry',to,action,priority,minute,status,releasedAt:now(),receivedAt:'',receivedBy:'',createdBy:by,createdAt:now()}}
export function createRegistryFile(corr,by){return{id:uid('REG'),correspondenceId:corr.id,referenceId:corr.referenceId||'',registryNumber:registryNumber(corr.sourceId||corr.id,corr.receivedAt),subject:corr.subject,sender:corr.sender,status:'Registered',currentHolder:'Central Registry',currentDsu:'Registry',registeredAt:now(),registeredBy:by,closedAt:'',archivedAt:'',retentionClass:'Official correspondence',securityClass:corr.confidentiality||'Official'}}
export function audit(action,entityType,entityId,details={},actor=''){return{id:uid('AUD'),at:now(),action,entityType,entityId,actor,details}}

// ---------------------------------------------------------------------------
// Canonical shared transitions (R11.6.3 consolidation). Every surface that
// acknowledges, updates, dispositions or creates work calls these, so the two
// historical acknowledgment data models stay in lockstep and audit vocabulary,
// priority scale and record shapes are identical regardless of entry module.
const TERMINAL_TASK=['Completed','Closed','Cancelled'];
export function acknowledgeTask(state,taskId,actorEmail,{surface='acknowledgment'}={}){
  const t=(state.tracking||[]).find(x=>String(x.id)===String(taskId));
  if(!t) return null;
  const at=now();
  const tracking=state.tracking.map(x=>String(x.id)===String(taskId)?{...x,acknowledged:true,ackedAt:at,acknowledgedAt:at,status:TERMINAL_TASK.includes(x.status)?x.status:'Acknowledged'}:x);
  return { task:t, patch:{ tracking, audit:[audit('Task Acknowledged','task',String(taskId),{referenceId:t.referenceId||'',surface},actorEmail),...(state.audit||[])] } };
}
export function updateTaskState(state,taskId,changes,actorEmail,{surface='orchestrator'}={}){
  const t=(state.tracking||[]).find(x=>String(x.id)===String(taskId));
  if(!t) return null;
  const next={...t,...changes,...(changes.priority!==undefined?{priority:normalizePriority(changes.priority)}:{}),updatedAt:now()};
  const tracking=state.tracking.map(x=>String(x.id)===String(taskId)?next:x);
  return { task:next, before:t, patch:{ tracking, audit:[audit('Task Updated','task',String(taskId),{referenceId:t.referenceId||'',surface,from:t.status,to:next.status},actorEmail),...(state.audit||[])] } };
}
export function setCorrespondenceStatus(state,id,status,actorEmail,{surface='correspondence',extra={}}={}){
  const r=(state.correspondence||[]).find(x=>String(x.id)===String(id)||String(x.referenceId)===String(id));
  if(!r) return null;
  const next={...r,...extra,status,updatedAt:now()};
  const correspondence=state.correspondence.map(x=>x===r?next:x);
  return { record:next, before:r, patch:{ correspondence, audit:[audit('Correspondence Status Set','correspondence',String(r.id),{from:r.status,to:status,surface},actorEmail),...(state.audit||[])] } };
}
export function createTask(state,fields,actorEmail,{surface='single-assignment'}={}){
  const task={ id:crypto.randomUUID(), title:fields.title||'Untitled task', status:fields.status||'In progress',
    referenceId:fields.referenceId||'', assignedTo:fields.assignedTo||'', assignedToDsu:fields.assignedToDsu||fields.dsu||'',
    supportingDsu:fields.supportingDsu||'', priority:normalizePriority(fields.priority), ack:fields.ack||'', due:fields.due||'',
    description:fields.description||'', sourceEmailId:fields.sourceEmailId||'', created:now() };
  return { task, patch:{ tracking:[task,...(state.tracking||[])], audit:[audit('Task Created','task',task.id,{referenceId:task.referenceId,assignedTo:task.assignedTo,surface},actorEmail),...(state.audit||[])] } };
}
