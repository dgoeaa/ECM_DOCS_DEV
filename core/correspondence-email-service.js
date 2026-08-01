import { State } from './state.js';
import { WriteManager } from './write-manager.js';
import { PendingQueue } from './pending-queue.js';
import { AuditLog } from './audit-log.js';
import { correspondenceEmailTemplate, CorrespondenceEmailTemplates, CorrespondenceEmailTemplateConfig as C } from '../config/correspondence-email-templates.config.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=v=>String(v??'').trim();
const uid=p=>`${p}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
const split=v=>String(v||'').split(/[;,]+/).map(x=>x.trim()).filter(Boolean);
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(v||'').trim());
export const CorrespondenceEmailService=Object.freeze({templates:()=>CorrespondenceEmailTemplates,templateOptions,sourceCorrespondences,buildContext,render,plainText,validate,saveDraft,sendDraft,markSent,duplicate,archive,stats});
export function templateOptions(selected='official-correspondence'){
  return CorrespondenceEmailTemplates.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.label)}</option>`).join('');
}
export function sourceCorrespondences(state=State.get()){
  const corr=(state.correspondence||[]).map(c=>({kind:'correspondence',id:c.id,referenceId:c.referenceId||c.RefIDD||c.Reference_ID||'',subject:c.subject||c.title||'',recipientName:c.sender||c.recipientName||'',recipientEmail:c.senderEmail||c.recipientEmail||'',classification:c.confidentiality||'Official',status:c.status||'',channel:c.channel||'',attachmentLinks:[c.attachmentLink].filter(Boolean),source:c}));
  const reg=(state.registryFiles||[]).map(f=>({kind:'registry-file',id:f.id,referenceId:f.referenceId||'',subject:f.subject||'',recipientName:f.sender||'',recipientEmail:f.senderEmail||'',classification:f.securityClass||'Official',status:f.status||'',channel:'Registry',attachmentLinks:[],source:f}));
  const dis=(state.dispatches||[]).filter(d=>d.channel!=='Email').map(d=>({kind:'dispatch-record',id:d.id,referenceId:d.referenceId||'',subject:d.title||'',recipientName:d.recipient||'',recipientEmail:'',classification:'Official',status:d.status||'',channel:d.channel||'Dispatch',attachmentLinks:[],source:d}));
  return [...corr,...reg,...dis];
}
function conditions(ctx){ return {hasDueDate:!!ctx.dueDate,hasAttachments:!!ctx.attachmentSummary,hasActionRequired:!!ctx.actionRequired,isConfidential:['confidential','restricted','secret'].includes(String(ctx.classification||'').toLowerCase())}; }
function tokens(html,ctx){ return String(html||'').replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,k)=>esc(ctx[k]??'')); }
function pill(ctx){ return `${esc(ctx.classification)} · ${esc(ctx.priority||'normal')}`; }
export function buildContext(draft={}, src={}){
  const s=State.get(), r=src.source||src||{};
  return {...C.defaults,
    id:draft.id||'', templateId:draft.templateId||'official-correspondence', sourceKind:draft.sourceKind||src.kind||'', sourceId:draft.sourceId||src.id||'',
    referenceId:clean(draft.referenceId||src.referenceId||r.referenceId||r.ref||''), subject:clean(draft.subject||src.subject||r.subject||r.title||''),
    recipientName:clean(draft.recipientName||src.recipientName||r.sender||r.recipientName||'Sir/Ma'), recipientEmail:clean(draft.recipientEmail||src.recipientEmail||r.senderEmail||r.recipientEmail||''),
    cc:clean(draft.cc||''), bcc:clean(draft.bcc||''), body:clean(draft.body||''), priority:clean(draft.priority||r.priority||'normal'), classification:clean(draft.classification||src.classification||r.confidentiality||C.defaults.classification),
    dueDate:clean(draft.dueDate||r.dueDate||r.due||''), actionRequired:clean(draft.actionRequired||''), attachmentSummary:clean(draft.attachmentSummary||((src.attachmentLinks||[]).join('; '))),
    signatoryName:clean(draft.signatoryName||C.defaults.signatoryName), signatoryTitle:clean(draft.signatoryTitle||C.defaults.signatoryTitle), actorEmail:s.profile?.email||'', actorName:s.profile?.name||'', preparedAt:new Date().toISOString() };
}
export function render(draft={}, source={}){
  const template=correspondenceEmailTemplate(draft.templateId), ctx=buildContext(draft,source), cond=conditions(ctx);
  const subject=tokens(draft.subjectLine||template.subject,ctx);
  const sections=template.sections.filter(x=>!x.when||cond[x.when]).map(x=>`<p>${tokens(x.html,ctx).replace(/\n/g,'<br>')}</p>`).join('\n');
  const html=`<!doctype html><html><body style="margin:0;background:${C.brand.paper};font-family:Arial,Segoe UI,sans-serif;color:${C.brand.ink}">
  <div style="max-width:760px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid ${C.brand.line};border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.08)">
      <div style="background:${C.brand.deepGreen};color:#fff;padding:18px 22px"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase">${esc(C.brand.ministry)}</div><h1 style="margin:6px 0 0;font-size:22px">${esc(C.brand.platform)}</h1><div>${esc(C.brand.agency)}</div></div>
      <div style="padding:22px"><div style="display:inline-block;background:${C.brand.smartGreen};color:#fff;border-radius:999px;padding:5px 10px;font-size:12px">${pill(ctx)}</div><h2 style="margin:14px 0 4px;color:${C.brand.deepGreen}">${esc(ctx.subject||subject)}</h2><p style="color:#66736C">Reference: <b>${esc(ctx.referenceId||'N/A')}</b> · Date: ${esc(new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}))}</p>${sections}<p>Yours faithfully,</p><p><b>${esc(ctx.signatoryName)}</b><br>${esc(ctx.signatoryTitle)}</p></div>
      <div style="border-top:1px solid ${C.brand.line};padding:14px 22px;color:#66736C;font-size:12px">Confidentiality Notice: This correspondence and any attachment(s) are intended solely for the addressed recipient(s). If received in error, please notify the sender and delete the message.<br>${esc(C.brand.platform)} · ${esc(C.brand.agency)}</div>
    </div>
  </div></body></html>`;
  return {subject,html,plain:plainText(html),ctx,template};
}
export function plainText(html){ return String(html||'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
export function validate(draft={}){
  const ctx=buildContext(draft,{}), t=correspondenceEmailTemplate(draft.templateId), e=[];
  if(!ctx.recipientEmail || !emailOk(ctx.recipientEmail)) e.push('A valid recipient email is required');
  if(!ctx.subject) e.push('subject is required');
  if(!ctx.body) e.push('message body is required');
  for(const k of t.required||[]) if(!ctx[k]) e.push(`${k} is required`);
  return [...new Set(e)];
}
export function saveDraft(draft={}, source={}){
  const s=State.get(), rendered=render(draft,source), row={id:draft.id||uid('CMAIL'),status:draft.status||'draft',templateId:rendered.ctx.templateId,sourceKind:rendered.ctx.sourceKind,sourceId:rendered.ctx.sourceId,referenceId:rendered.ctx.referenceId,subject:rendered.ctx.subject,subjectLine:rendered.subject,recipientName:rendered.ctx.recipientName,recipientEmail:rendered.ctx.recipientEmail,cc:rendered.ctx.cc,bcc:rendered.ctx.bcc,body:rendered.ctx.body,actionRequired:rendered.ctx.actionRequired,attachmentSummary:rendered.ctx.attachmentSummary,classification:rendered.ctx.classification,priority:rendered.ctx.priority,dueDate:rendered.ctx.dueDate,signatoryName:rendered.ctx.signatoryName,signatoryTitle:rendered.ctx.signatoryTitle,html:rendered.html,plain:rendered.plain,createdAt:draft.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:draft.createdBy||s.profile?.email||''};
  const current=s.correspondenceEmails||[], exists=current.some(x=>x.id===row.id);
  State.patch({correspondenceEmails:exists?current.map(x=>x.id===row.id?row:x):[row,...current]},{module:'correspondence-email',action:exists?'correspondence-email:update-draft':'correspondence-email:create-draft',ref:row.referenceId});
  AuditLog.record({event:'audit:correspondence-email-draft-saved',actor:s.profile||{},ref:row.referenceId,meta:{id:row.id,templateId:row.templateId}});
  return row;
}
export async function sendDraft(row){
  const errors=validate(row); if(errors.length) throw new Error(errors.join('; '));
  const payload={operation:'sendCorrespondenceEmail',mode:'single',referenceId:row.referenceId,correspondenceEmailId:row.id,__confirmedByUI:true,email:{to:row.recipientEmail,cc:row.cc,bcc:row.bcc,subject:row.subjectLine,html:row.html,text:row.plain,classification:row.classification,templateId:row.templateId,attachments:split(row.attachmentSummary)}};
  try{ const res=await WriteManager.backend({module:'correspondence-email',action:'send-correspondence-email',endpoint:'EMAIL',payload,ref:row.referenceId,message:''}); return markSent(row,res); }
  catch(e){ State.patch({correspondenceEmails:(State.get().correspondenceEmails||[]).map(x=>x.id===row.id?{...x,status:'queued',sync:'queued',lastError:e.message,queuedAt:new Date().toISOString()}:x)},{module:'correspondence-email',action:'correspondence-email:queued',ref:row.referenceId}); PendingQueue.enqueue({key:'EMAIL',operation:'sendCorrespondenceEmail',payload,ref:row.referenceId,error:e.message,retryable:true,queueType:'correspondence-email',correspondenceEmailId:row.id}); throw e; }
}
export function markSent(row,res={}){
  const s=State.get(), at=new Date().toISOString(), updated={...row,status:'sent',sync:'confirmed',sentAt:at,sentBy:s.profile?.email||'',requestId:res.requestId||''};
  State.patch({correspondenceEmails:(s.correspondenceEmails||[]).map(x=>x.id===row.id?updated:x),dispatches:[{id:uid('EMAILDISP'),referenceId:row.referenceId,title:row.subjectLine||row.subject,channel:'Email',recipient:row.recipientEmail,status:'dispatched',at,by:s.profile?.email||'',correspondenceEmailId:row.id},...(s.dispatches||[])]},{module:'correspondence-email',action:'correspondence-email:sent',ref:row.referenceId});
  return updated;
}
export function duplicate(row){ return saveDraft({...row,id:'',status:'draft',subject:`${row.subject} (Copy)`,subjectLine:'',createdAt:'',createdBy:''},{}); }
export function archive(row){ State.patch({correspondenceEmails:(State.get().correspondenceEmails||[]).map(x=>x.id===row.id?{...x,status:'archived',archivedAt:new Date().toISOString(),archivedBy:State.get().profile?.email||''}:x)},{module:'correspondence-email',action:'correspondence-email:archive',ref:row.referenceId}); }
export function stats(state=State.get()){ const r=state.correspondenceEmails||[]; return {draft:r.filter(x=>x.status==='draft').length,queued:r.filter(x=>x.status==='queued').length,sent:r.filter(x=>x.status==='sent').length,archived:r.filter(x=>x.status==='archived').length,total:r.length}; }
