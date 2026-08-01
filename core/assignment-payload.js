// Shared assignment payload builder and redaction helpers.
import { AssignmentCascade } from './assignment-cascade.js';
import { normalizePriority } from '../config/priority.config.js';
import { State } from './state.js';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function splitRecipients(value){ return String(value||'').split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean); }
export function validEmail(value){ return !value || EMAIL_RE.test(String(value).trim()); }
export function validRecipients(values=[]){ return values.every(validEmail); }
function escJson(s){ return String(s).replace(/[&<>]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
export function redactAssignmentPayload(payload={}){
  const clone=JSON.parse(JSON.stringify(payload));
  const mask=v=>String(v||'').replace(/^(.{2}).*(@.*)?$/,(m,a,b)=>`${a}***${b||''}`);
  for (const key of ['assignedTo','supportingAssignee','createdBy','requestedBy']) if (clone[key]) clone[key]=mask(clone[key]);
  for (const key of ['ccRecipients','copyTo']) if (Array.isArray(clone[key])) clone[key]=clone[key].map(mask);
  if (clone.email?.fromAddress) clone.email.fromAddress=mask(clone.email.fromAddress);
  return clone;
}
const PREVIEW_LABELS={mode:'Assignment type',referenceId:'Reference',category:'Category',subcategory:'Sub-category',dsu:'Primary DSU',assignedTo:'Assigned to',supportDsu:'Support DSU',supportingAssignee:'Co-assignee',priority:'Priority',ack:'Acknowledgement due',due:'Task due',ccCount:'CC recipients'};
export function assignmentPreviewHtml(payload={}){
  const summary=AssignmentCascade.buildPreviewSummary(payload);
  const rows=Object.entries(summary).filter(([,v])=>v!==undefined&&v!==null&&v!=='')
    .map(([k,v])=>`<div class="preview-row"><span class="preview-k">${escJson(PREVIEW_LABELS[k]||k)}</span><span class="preview-v">${escJson(String(v))}</span></div>`).join('');
  return `<div class="assignment-preview"><div class="preview-list">${rows}</div><details class="preview-details"><summary>Technical payload</summary><pre class="preview-box">${escJson(JSON.stringify(redactAssignmentPayload(payload), null, 2))}</pre></details></div>`;
}
function datesValid(p,errors){ if(p.startDate&&p.due&&new Date(p.startDate)>new Date(p.due)) errors.push('start date cannot follow task due date'); if(p.ack&&p.due&&new Date(p.ack)>new Date(p.due)) errors.push('acknowledgement due date cannot follow task due date'); }
export function validateSingleAssignmentPayload(p={}){
  const errors=[]; if (!p.referenceId) errors.push('referenceId is required'); if (!p.category) errors.push('category is required'); if (!p.assignedTo) errors.push('assignedTo is required'); if (p.assignedTo && !validEmail(p.assignedTo)) errors.push('assignedTo must be a valid email'); if (p.supportingAssignee && !validEmail(p.supportingAssignee)) errors.push('supportingAssignee must be a valid email'); if (!validRecipients(p.ccRecipients||[])) errors.push('ccRecipients contains an invalid email'); if (!p.due) errors.push('due date is required'); if (!p.instruction) errors.push('instruction is required'); datesValid(p,errors); return errors;
}
export function buildSingleAssignmentPayload({activity, form, actor}){
  const priority=normalizePriority(form.priority||'normal');
  const priorityCap=priority.charAt(0).toUpperCase()+priority.slice(1);
  const ccList=splitRecipients(form.copy);
  const copyTo=ccList.join(';');
  const startDate=form.startDate||new Date().toISOString().slice(0,10);
  const ackDate=form.ack||'';
  const dueDate=form.due||'';
  const activityId=Number(activity.id||activity.sourceId)||0;
  const datePart=startDate.replace(/-/g,'');
  const preRefId=`${datePart}-${activityId}-${form.categoryCode||'UNC'}-${form.subcategoryCode||'GEN'}-`;
  const categorization=[form.category,form.subcategory].filter(Boolean).join('-');
  const depts=AssignmentCascade.departments(State.get());
  const primaryDept=depts.find(d=>d.dsuKey===form.dsu)||{};
  const supportDept=depts.find(d=>d.dsuKey===form.supportDsu)||{};
  const assignedToTitle=primaryDept.headTitle||'';
  const supportingAssigneeTitle=supportDept.headTitle||'';
  const device={id:'standalone-html',platform:(typeof navigator!=='undefined'?navigator.platform:'')||'',ua:(typeof navigator!=='undefined'?navigator.userAgent:'')||''};
  const supportingTo=String(form.supportingAssignee||'').trim();
  const task={StartDate:startDate,ActivityID:activityId,Title:activity.title||activity.subject||String(activity.id||''),Description:activity.description||activity.body||'',Status:'New',Category:form.category||'',CategoryCode:form.categoryCode||'',SubCategory:form.subcategory||'',SubCategoryCode:form.subcategoryCode||'',PrimaryDSU:form.dsu||'',AssignedTo:String(form.assignedTo||'').trim(),AssignedToTitle:assignedToTitle,AssignedDSU:form.dsu||'',supportingAssignedTo:supportingTo,SupportAssignedTo:supportingTo,SupportAssignedToTitle:supportingAssigneeTitle,SupportDSU:form.supportDsu||'',SupportDSUKey:form.supportDsu||'',AckDue:ackDate,AcknowledgementDueBy:ackDate,AcknolwedgementDueBy:ackDate,TaskDue:dueDate,TaskDueDate:dueDate,Timeline:'No dependencies',CopyTo:copyTo,Priority:priorityCap,PreReferenceID:preRefId,Categorization:categorization,AttachmentLink:activity.attachmentLink||activity.AttachmentLink||activity.Link||'',Comments:form.comments||'',ActionRequired:'',CreatedBy:actor?.email||''};
  const selected={ID:activityId,RefIDD:String(activity.id||''),Title:task.Title};
  return {
    operation:'create',mode:'single',source:'DGO_FAST_Track_WEB_OPS',method:'POST',
    device,AssignmentType:form.type||'newassignment',
    NewActivityTask:task,Selected:selected,
    payload:{task:{StartDate:startDate,ActivityID:activityId,Title:task.Title,Category:form.category||'',CategoryCode:form.categoryCode||'',SubCategory:form.subcategory||'',SubCategoryCode:form.subcategoryCode||'',AssignedTo:task.AssignedTo,AssignedToTitle:assignedToTitle,AssignedDSU:form.dsu||'',PrimaryDSU:form.dsu||'',supportingAssignedTo:supportingTo,SupportDSU:form.supportDsu||'',Priority:priorityCap,AcknowledgementDueBy:ackDate,TaskDueDate:dueDate,CopyTo:copyTo,PreReferenceID:preRefId,Comments:form.comments||'',ActionRequired:'',CreatedBy:actor?.email||''},selection:{single:selected,items:[]},assignment:{type:form.type||'newassignment'}}
  };
}
export function validateBulkAssignmentPayload(p={}){
  const errors=[]; if (!Array.isArray(p.ids) || !p.ids.length) errors.push('at least one activity id is required'); if (!p.category) errors.push('category is required'); if (p.assignedTo && !validEmail(p.assignedTo)) errors.push('assignedTo must be a valid email'); if (p.supportingAssignee && !validEmail(p.supportingAssignee)) errors.push('supportingAssignee must be a valid email'); if (!validRecipients(p.ccRecipients||[])) errors.push('ccRecipients contains an invalid email'); datesValid(p,errors); return errors;
}
export function buildBulkAssignmentPayload({ids, form, actor, otpVerified=false}){
  return { schema:'dgo-bulk-assignment-payload/v2', source:'bulk-assignment', ids, category:form.category||'', categoryCode:form.categoryCode||'', subcategory:form.subcategory||'', subcategoryCode:form.subcategoryCode||'', assignedTo:String(form.assignedTo||form.assigned||'').trim(), assignedToDsu:form.dsu||'', supportingAssignee:String(form.supportingAssignee||form.support||'').trim(), supportingDsu:form.supportDsu||'', ccRecipients:splitRecipients(form.copy), priority:normalizePriority(form.priority||'normal'), startDate:form.startDate||'', ack:form.ack||'', due:form.due||'', instruction:form.comments||'', otpVerified:!!otpVerified, cascadeSnapshot:form.cascadeSnapshot||null, requestedBy:actor?.email||'', requestedAt:new Date().toISOString() };
}
export function buildEmailTaskPayload({email, form, actor, referenceId}){
  return { schema:'dgo-email-task-payload/v2', source:'email-to-task', referenceId, title:form.title||email.subject||'Email task', assignedTo:String(form.assignedTo||actor?.email||'').trim(), category:form.category||'', categoryCode:form.categoryCode||'', subcategory:form.subcategory||'', subcategoryCode:form.subcategoryCode||'', assignedToDsu:form.dsu||'', supportingAssignee:String(form.supportingAssignee||'').trim(), supportingDsu:form.supportDsu||'', priority:normalizePriority(form.priority||'normal'), startDate:form.startDate||'', ack:form.ack||'', due:form.due||'', instruction:form.comments||email.bodyPreview||'', ccRecipients:splitRecipients(form.copy), sourceEmailId:email.id||'', cascadeSnapshot:form.cascadeSnapshot||null, email:{ id:email.id||'', subject:email.subject||'', fromAddress:email.fromAddress||email.from||'', receivedDateTime:email.receivedDateTime||email.received||'', webLink:email.webLink||'' }, createdBy:actor?.email||'', createdAt:new Date().toISOString() };
}
export function validateEmailTaskPayload(p={}){
  const errors=[]; if (!p.referenceId) errors.push('referenceId is required'); if (!p.title) errors.push('title is required'); if (!p.assignedTo) errors.push('assignedTo is required'); if (p.assignedTo && !validEmail(p.assignedTo)) errors.push('assignedTo must be a valid email'); if (p.supportingAssignee && !validEmail(p.supportingAssignee)) errors.push('supportingAssignee must be a valid email'); if (!validRecipients(p.ccRecipients||[])) errors.push('ccRecipients contains an invalid email'); datesValid(p,errors); return errors;
}
