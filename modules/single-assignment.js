import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { createTask } from '../core/enterprise-domain.js';
import { priorityOptions, normalizePriority } from '../config/priority.config.js';
import { State } from '../core/state.js';
import { makeRef } from '../core/domain.js';
import { head, esc, toast, confirmAction } from '../core/ui.js';
import { Router } from '../core/router.js';
import { invoke } from '../core/api.js';
import { buildSingleAssignmentPayload, validEmail, splitRecipients } from '../core/assignment-payload.js';
import { SourceViews } from '../config/source-views.config.js';
import { sourceBadge } from '../core/source-views.js';
import { AssignmentCascade } from '../core/assignment-cascade.js';

export async function mount(el){ hydrateGovernance(); AssignmentCascade.seedFallbackIfEmpty(); render(el); }
const ob=(xs,sel,key='category',label='category')=>xs.map(x=>`<option value="${esc(x[key])}" ${x[key]===sel?'selected':''}>${esc(x[label]||x[key])}</option>`).join('');
const PRIOLABEL={urgent:'P1 · Urgent',high:'P2 · High',normal:'P3 · Normal',low:'P4 · Low'};
const fmtDate=v=>{ if(!v) return ''; const d=new Date(v); return isNaN(d)?String(v):d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
const ccList=v=>String(v||'').split(/[;,]+/).map(x=>x.trim()).filter(Boolean);
// Live "Assignment Summary" preview card — only shown once user has entered meaningful data.
// Returns a hidden placeholder when no category/assignee/due has been selected yet.
function summaryCard(a,draft){
  if(!draft.category&&!draft.assignedTo&&!draft.due) return `<aside class="panel assign-summary assign-summary--empty" hidden aria-hidden="true"></aside>`;
  const code=[draft.categoryCode,draft.subcategoryCode].filter(Boolean).join(' / ');
  const cc=ccList(draft.copy);
  const row=(label,val,extra='')=>`<tr><td class="k">${esc(label)}</td><td class="v${extra}">${val?esc(val):'<span class="muted">—</span>'}</td></tr>`;
  const ccCell=cc.length?`${esc(cc[0])}${cc.length>1?` <span class="pill">+${cc.length-1}</span>`:''}`:'<span class="muted">—</span>';
  return `<aside class="panel assign-summary" aria-label="Assignment summary">
    <div class="eyebrow panel-eyebrow">📋 Assignment Summary</div>
    <table class="preview-table"><tbody>
      ${row('Activity', a.title||a.subject||a.referenceId||('#'+a.id))}
      ${row('Category', draft.category)}
      ${row('Sub-Category', draft.subcategory)}
      ${row('Category Code', code)}
      <tr><td class="k">Assigned To</td><td class="v highlight">${draft.assignedTo?esc(draft.assignedTo):'<span class="muted">unassigned</span>'}</td></tr>
      ${row('Assignee Title', draft.assigneeTitle)}
      ${row('Primary DSU', draft.dsuTitle||draft.dsu)}
      ${row('Co-Assignee', draft.supportingAssignee)}
      ${row('Support DSU', draft.supportDsuTitle||draft.supportDsu)}
      <tr><td class="k">CC To</td><td class="v">${ccCell}</td></tr>
      ${row('Priority', PRIOLABEL[draft.priority]||draft.priority)}
      ${row('Start Date', fmtDate(draft.startDate))}
      ${row('Ack Due', fmtDate(draft.ack))}
      ${row('Task Due', fmtDate(draft.due))}
    </tbody></table>
  </aside>`;
}
function noSelection(el){ el.innerHTML=`<div class="workspace">${head('Assignment Desk','Select a source matter before creating an assignment.')}<section class="panel"><div class="eyebrow panel-eyebrow">Create task from source</div><div class="source-guidance-grid">${SourceViews.filter(x=>x.id!=='all').map(x=>`<a class="source-guidance-card" href="${x.id==='customer-service-emails'?'#/lookup':'#/activities'}"><b><svg class="dgo-icon" aria-hidden="true" focusable="false"><use href="#${x.icon}"></use></svg> ${x.label}</b><span class="meta">${x.purpose}</span></a>`).join('')}</div></section><div class="empty"><a class="btn" href="#/activities">Select correspondence</a></div></div>`; }

// Reusable governed single-assignment cascade form. Renders into `host` and operates on
// the source item `a` ({id,title,referenceId,...}). Used both by the standalone Assignment
// Desk route and inline inside Correspondence Intake (assign-in-place merge).
//   opts.guidance : include the cascade-info / cross-links panel (standalone route only)
//   opts.onDone   : called after a successful submit
//   opts.onCancel : called when the user cancels
export function mountAssignmentForm(host, a, opts={}){
  const { onDone, onCancel, guidance=false } = opts;
  AssignmentCascade.seedFallbackIfEmpty();
  const s=State.get(), users=s.users||[], departments=AssignmentCascade.departments(s), cats=AssignmentCascade.categories(s);
  // Only restore an explicitly user-saved draft. On fresh open (no draft), start completely
  // empty — cascade values populate only after the user makes their first selection.
  const loaded=AssignmentCascade.loadDraft(a.id);
  let draft;
  if(loaded){
    draft=AssignmentCascade.cascade({activity:a,draft:loaded,state:s,changed:'manual'});
  } else {
    draft={type:'newassignment',referenceId:'',category:'',categoryCode:'',subcategory:'',subcategoryCode:'',dsu:'',supportDsu:'',assignedTo:'',supportingAssignee:'',copy:'',startDate:new Date().toISOString().slice(0,10),ack:'',due:'',priority:'normal',comments:'',ruleId:'',cascadeSource:'',assigneeTitle:'',supportingAssigneeTitle:'',dsuTitle:'',supportDsuTitle:''};
  }
  const subs=AssignmentCascade.subcategories(draft.category,s);
  const userList=`<datalist id="user-emails">${users.map(u=>`<option value="${esc(u.email||u.Email)}">${esc(u.fullName||u.name||u.email||u.Email)}</option>`).join('')}</datalist>`;
  const guidancePanel = guidance?`<section class="panel"><div class="eyebrow panel-eyebrow">Assignment cascade</div><p>Category, subcategory and DSU selection cascade into assignee, support DSU, supporting assignee, CC recipients, priority, start date, acknowledgement due date, task due date and instruction template. Local draft autosave is active.</p><div class="chips"><span class="chip">Rule: ${esc(draft.ruleId||'fallback')}</span><span class="chip">Source: ${esc(draft.cascadeSource||'runtime')}</span><span class="chip">${cats.length} categories</span><span class="chip">${departments.length} DSU entries</span></div><div class="form-row"><a class="btn ghost" href="#/bulk-assignment">Bulk mode</a><a class="btn ghost" href="#/lookup">Find email / record</a><a class="btn ghost" href="#/activities">Select record</a></div></section>`:'';
  host.innerHTML=`${guidancePanel}<div class="assign-grid"><form class="panel grid assign-form" data-assignment-form><label>Assignment type<select name="type"><option value="newassignment" ${draft.type==='newassignment'?'selected':''}>New assignment</option><option value="reassignment" ${draft.type==='reassignment'?'selected':''}>Reassignment</option></select></label><label>Reference<input name="referenceId" value="${esc(draft.referenceId||a.referenceId||'')}" placeholder="Generated if blank"></label><label>Category<select name="category" required><option value="">Select category</option>${ob(cats,draft.category)}</select></label><label>Subcategory<select name="subcategory"><option value="">Select subcategory</option>${subs.map(x=>`<option value="${esc(x.subcategory)}" ${x.subcategory===draft.subcategory?'selected':''}>${esc(x.subcategory)}</option>`).join('')}</select></label><label>Category code<input name="categoryCode" value="${esc(draft.categoryCode||'')}"></label><label>Subcategory code<input name="subcategoryCode" value="${esc(draft.subcategoryCode||'')}"></label><label>Primary DSU<select name="dsu"><option value="">Select DSU</option>${departments.map(d=>`<option value="${esc(d.dsuKey)}" ${d.dsuKey===draft.dsu?'selected':''}>${esc(d.title||d.dsuKey)}${d.email?' · '+esc(d.email):''}</option>`).join('')}</select></label><label>Support DSU<select name="supportDsu"><option value="">Select support DSU</option>${departments.map(d=>`<option value="${esc(d.dsuKey)}" ${d.dsuKey===draft.supportDsu?'selected':''}>${esc(d.title||d.dsuKey)}${d.email?' · '+esc(d.email):''}</option>`).join('')}</select></label><label>Assigned to<input name="assignedTo" type="email" list="user-emails" value="${esc(draft.assignedTo||'')}" required></label><label>Supporting assignee<input name="supportingAssignee" type="email" list="user-emails" value="${esc(draft.supportingAssignee||'')}"></label><label class="wide">Copy to / CC recipients<input name="copy" type="text" value="${esc(draft.copy||'')}" placeholder="email1; email2"></label><label>Start date<input name="startDate" type="date" value="${esc(draft.startDate||'')}"></label><label>Acknowledgement due<input name="ack" type="date" value="${esc(draft.ack||'')}"></label><label>Task due<input name="due" type="date" value="${esc(draft.due||'')}" required></label><label>Priority<select name="priority">${priorityOptions(draft.priority||'normal')}</select></label><label class="wide">Instruction<textarea name="comments" rows="4" required>${esc(draft.comments||'')}</textarea></label>${userList}<input type="hidden" name="ruleId" value="${esc(draft.ruleId||'')}"><input type="hidden" name="cascadeSource" value="${esc(draft.cascadeSource||'')}"><div class="wide form-row"><button class="btn" data-submit-btn>Submit Assignment</button><button type="button" class="btn ghost" data-save-draft>Save Draft</button><button type="button" class="btn ghost" data-clear-draft>Clear Draft</button><button type="button" class="btn ghost" data-assign-cancel>Cancel</button></div></form>${summaryCard(a,draft)}</div>`;
  const f=host.querySelector('form');
  const collect=()=>Object.fromEntries(new FormData(f));
  // In-place cascade apply: update field values, rebuild only the subcategory options (they depend on
  // category) and refresh only the live summary card. Avoids a full re-mount on every dropdown change,
  // which previously rebuilt the entire form (incl. the full user datalist) and dropped keyboard focus.
  const renderSummary=(draft)=>{ const old=host.querySelector('.assign-summary'); if(old){ const tmp=document.createElement('div'); tmp.innerHTML=summaryCard(a,draft); const fresh=tmp.firstElementChild; if(fresh) old.replaceWith(fresh); } };
  const apply=(changed='manual')=>{ const next=AssignmentCascade.cascade({activity:a,draft:collect(),state:State.get(),changed}); Object.entries(next).forEach(([k,v])=>{ const field=f.elements[k]; if(field&&typeof v!=='object') field.value=v??''; }); f.elements.ruleId.value=next.ruleId||''; f.elements.cascadeSource.value=next.cascadeSource||''; const subSel=f.elements['subcategory']; if(subSel){ const subs=AssignmentCascade.subcategories(next.category,State.get()); subSel.innerHTML='<option value="">Select subcategory</option>'+subs.map(x=>`<option value="${esc(x.subcategory)}" ${x.subcategory===next.subcategory?'selected':''}>${esc(x.subcategory)}</option>`).join(''); subSel.value=next.subcategory||''; } renderSummary(next); AssignmentCascade.saveDraft(a.id,{...collect(),cascadeSnapshot:next.cascadeSnapshot}); };
  f.category.onchange=()=>apply('category'); f.subcategory.onchange=()=>apply('subcategory'); f.dsu.onchange=()=>apply('dsu'); f.supportDsu.onchange=()=>apply('supportDsu'); f.priority.onchange=()=>apply('priority');
  f.querySelectorAll('input,textarea,select').forEach(x=>x.addEventListener('input',()=>AssignmentCascade.saveDraft(a.id,collect())));
  host.querySelector('[data-save-draft]').onclick=()=>{AssignmentCascade.saveDraft(a.id,collect());toast('Assignment draft saved','success')};
  host.querySelector('[data-clear-draft]').onclick=()=>{AssignmentCascade.clearDraft(a.id);toast('Assignment draft cleared','success');mountAssignmentForm(host,a,opts)};
  host.querySelector('[data-assign-cancel]').onclick=()=>{ onCancel?onCancel():Router.go('activities'); };
  let inFlight=false;
  f.onsubmit=async ev=>{
    ev.preventDefault();
    if(inFlight) return;
    let d=collect();
    const preErrors=AssignmentCascade.validateDraft(d);
    if(preErrors.length) return toast(preErrors.join('; '),'error');
    if(d.assignedTo&&!validEmail(d.assignedTo)) return toast('assignedTo must be a valid email','error');
    if(d.supportingAssignee&&!validEmail(d.supportingAssignee)) return toast('supportingAssignee must be a valid email','error');
    const ref=d.referenceId||makeRef(a.id,d.categoryCode||'UNC',d.subcategoryCode||'GEN');
    d={...d,referenceId:ref};
    if(!await confirmAction({title:'Confirm assignment',body:`<p>Assign <b>${esc(a.title||a.subject||String(a.id))}</b> to <b>${esc(d.assignedTo)}</b>?</p>`,confirmText:'Submit assignment',cancelText:'Cancel'})) return;
    inFlight=true;
    const submitBtn=f.querySelector('[data-submit-btn]');
    if(submitBtn) submitBtn.disabled=true;
    try{
      const current=State.get();
      const outbound=buildSingleAssignmentPayload({activity:a,form:d,actor:current.profile});
      const ccRecipients=splitRecipients(d.copy);
      const priority=normalizePriority(d.priority||'normal');
      const updatedActivity={...a,status:'Treated',assignmentStatus:'Assigned',assignedTo:d.assignedTo,assignedDsu:d.dsu,supportingAssignee:d.supportingAssignee,supportingDsu:d.supportDsu,ccRecipients,category:d.category,subcategory:d.subcategory,categoryCode:d.categoryCode,subcategoryCode:d.subcategoryCode,priority,referenceId:ref};
      await executeOwnedAction('single-assignment','assign-one',()=>{
        const r=createTask(current,{title:a.title||a.subject||String(a.id),referenceId:ref,assignedTo:d.assignedTo,assignedToDsu:d.dsu,supportingDsu:d.supportDsu,priority,ack:d.ack,due:d.due,description:d.comments},current.profile.email,{surface:'single-assignment'});
        const task={...r.task,assignmentType:d.type||'newassignment',category:d.category,categoryCode:d.categoryCode,subcategory:d.subcategory,subcategoryCode:d.subcategoryCode,startDate:d.startDate,ack:d.ack,supportingAssignee:d.supportingAssignee,ccRecipients};
        const idMatch=x=>String(x.id)===String(a.id)||(a.referenceId&&String(x.referenceId)===String(a.referenceId));
        const patch={activities:(current.activities||[]).map(x=>x.id===a.id?updatedActivity:x),tracking:[task,...(current.tracking||[])],audit:r.patch.audit};
        if((current.correspondence||[]).some(idMatch)) patch.correspondence=current.correspondence.map(x=>idMatch(x)?{...x,status:'Delegated',assignmentStatus:'Assigned',assignedTo:d.assignedTo,referenceId:x.referenceId||ref}:x);
        State.patch(patch,{module:'single-assignment',action:'assignment:create-cascaded',ref});
        invoke('SINGLE_ASSIGNMENT',outbound,{flatPayload:true}).catch(()=>toast('Saved locally; synchronization queued','error'));
      },{ref,meta:{cc:ccRecipients.length,cascade:d.ruleId}});
      AssignmentCascade.clearDraft(a.id);
      toast('Assignment created','success');
      if(onDone) onDone({ref}); else Router.go('activities');
    } finally {
      inFlight=false;
      if(submitBtn) submitBtn.disabled=false;
    }
  };
}

function render(el){ const s=State.get(), a=s.activities.find(x=>String(x.id)===String(s.selectedId)); if(!a) return noSelection(el); el.innerHTML=`<div class="workspace">${head('Assignment Desk',a.title,'DGO DIGITAL OPS · CASCADING CONTROLLED WORKFLOW')}<div class="status-strip">${sourceBadge(a)}</div><div data-assign-host></div></div>`; mountAssignmentForm(el.querySelector('[data-assign-host]'), a, {guidance:true, onDone:()=>Router.go('activities'), onCancel:()=>Router.go('activities')}); }
