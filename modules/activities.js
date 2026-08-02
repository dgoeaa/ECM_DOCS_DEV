import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import{State}from'../core/state.js';import {head,kpis,esc,safeHref,badge,toast,confirmAction,mdBack,mdSwitch,resetDetailScroll,fmtDate} from '../core/ui.js';import{UIState,pageSlice,pager}from'../core/ui-state.js';import{OperationStates,enrichOperation,audit}from'../core/enterprise-domain.js';import{invoke}from'../core/api.js';import{memoizeBySignature,capRows,RenderBudget}from'../core/render-budget.js';import{priorityOptions,priorityLabel,priorityTone}from'../config/priority.config.js';import{debouncedInput}from'../core/ui-interactions.js';import { filterItemsBySource, sourceFilterChips, sourceBadge } from '../core/source-views.js';
import { ActivityParity } from '../core/activity-parity.js';
import { ActivityParityConfig } from '../config/activity-parity.config.js';
import { WriteManager } from '../core/write-manager.js';
import { actionPreview, fmtDateTime, emptyState } from '../core/ui.js';
const memoOps=memoizeBySignature(rows=>rows.map(x=>enrichOperation(x)));
export async function mount(el){hydrateGovernance();route(el)}
// Two lenses share this workspace: the long-standing cross-domain work queue, and the Canvas
// Activities parity record queue (Treated/Not Treated, Canvas filter set, attachments, PDF
// preview and the DGOFASTTRACK lifecycle actions).
function route(el){ return currentLens()==='records'?renderRecords(el):render(el); }
function currentLens(){ return UIState.get('operations',{lens:'work'}).lens||'work'; }
function lensBar(active){ return `<div class="toolbar"><button type="button" class="btn ${active==='work'?'':'ghost'}" data-lens="work">Work queue</button><button type="button" class="btn ${active==='records'?'':'ghost'}" data-lens="records">Activity records</button></div>`; }
function bindLens(el){ el.querySelectorAll('[data-lens]').forEach(b=>b.onclick=()=>{UIState.set('operations',{lens:b.dataset.lens});route(el)}); }
function render(el){const s=State.get(),u=UIState.get('operations',{q:'',status:'All',scope:'All',page:1,size:25,selected:null,md:'list',editing:false,source:'all'}),ops=s.operations?.length?s.operations:memoOps(s.tracking),sourceRows=filterItemsBySource(ops,u.source||'all'),me=s.profile.email,now=Date.now(),rows=sourceRows.filter(o=>(u["status"] ==='All'||o["status"] ===u.status)&&(u.scope==='All'||u.scope==='My Work'&&o.owner.toLowerCase()===me.toLowerCase()||u.scope==='Overdue'&&o.dueDate&&new Date(o.dueDate)<now&&o.status!=='Completed'||u.scope==='Escalated'&&o.escalationLevel>0)&&(!u.q||[o.title,o.referenceId,o.owner,o.dsu,o.status].some(v=>String(v||'').toLowerCase().includes(u.q.toLowerCase())))),p=pageSlice(rows,u.page,u.size),sel=ops.find(x=>x.id===u.selected),over=ops.filter(o=>o.dueDate&&new Date(o.dueDate)<now&&!['Completed','Closed'].includes(o.status));el.innerHTML=`<div class="workspace">${head('Activities','A cross-domain work lens over correspondence, tasks and registry — review lifecycle, SLA and escalation, then open the owning workspace to act.')}${lensBar('work')}${kpis([['Open',sourceRows.filter(x=>!['Completed','Closed'].includes(x.status)).length],['My work',sourceRows.filter(x=>x.owner.toLowerCase()===me.toLowerCase()).length],['Overdue',over.length],['Escalated',sourceRows.filter(x=>x.escalationLevel>0).length]])}${sourceFilterChips(u.source||'all','data-source-view',ops)}<div class="toolbar"><input data-q aria-label="Search work, reference or owner" value="${esc(u.q)}" placeholder="Search work, reference or owner"><select data-scope aria-label="Filter by work scope">${['All','My Work','Overdue','Escalated'].map(x=>`<option>${x}</option>`).join('')}</select><select data-status aria-label="Filter by task status"><option>All</option>${OperationStates.map(x=>`<option>${x}</option>`).join('')}</select><a class="btn" href="#/single-assignment">Open Assignment Desk</a><a class="btn ghost" href="#/bulk-assignment">Open Bulk Assignment</a></div><div class="split" ${mdSwitch(sel?u.md:'list')}><div><div class="list-col">${p.rows.map(o=>`<article class="list-item ${o.id===u.selected?'active':''}" data-select="${esc(o.id)}"><div class="status-strip">${sourceBadge(o)} ${badge(o.status,o["status"] ==='Escalated'?'danger':'')} ${badge(priorityLabel(o.priority),priorityTone(o.priority))}</div><h4>${esc(o.title)}</h4><div class="meta">${esc(o.referenceId||'No reference')} · ${esc(o.owner||'Unassigned')} · ${esc(o.dueDate?fmtDate(o.dueDate):'No due date')}</div><div class="progress"><i style="width:${o.progress}%"></i></div></article>`).join('')||'<div class="empty">No work matches this queue.</div>'}</div>${pager(p)}</div><div class="detail-col panel-stack">${sel?detail(sel,s,u):'<section class="panel"><div class="empty"><h2>Select work</h2><p>Manage the complete operational lifecycle and linked records.</p></div></section>'}</div></div></div>`;bind(el,s,u,ops,sel)}
function detail(o,s,u){const corr=s.correspondence.find(x=>x.referenceId&&x.referenceId===o.referenceId),file=s.registryFiles.find(x=>x.referenceId&&x.referenceId===o.referenceId),comments=s.comments.filter(x=>x.referenceId===o.referenceId),approvals=s.approvals.filter(x=>x.ref===o.referenceId);return`${mdBack('Back to work queue')}<section class="panel"><div class="eyebrow panel-eyebrow">Work Record</div><div class="status-strip">${badge(o.status)} ${o.escalationLevel?badge('Escalation L'+o.escalationLevel,'danger'):''}</div><h2>${esc(o.title)}</h2><dl class="detail-grid"><dt>Reference</dt><dd>${esc(o.referenceId||'—')}</dd><dt>Owner</dt><dd>${esc(o.owner||'Unassigned')}</dd><dt>DSU</dt><dd>${esc(o.dsu||'—')}</dd><dt>Due</dt><dd>${esc(o.dueDate||'Not set')}</dd><dt>Progress</dt><dd>${o.progress}%</dd><dt>Registry</dt><dd>${esc(file?.registryNumber||'Not registered')}</dd></dl><p>${esc(o.description||'No instruction recorded.')}</p><div class="chips"><span class="chip">${corr?'Correspondence linked':'No correspondence link'}</span><span class="chip">${comments.length} comments</span><span class="chip">${approvals.length} approvals</span><span class="chip">${o.dependencies.length} dependencies</span></div><div class="form-row"><button type="button" class="btn ${u.editing?'ghost':''}" data-edit-toggle>${u.editing?'Close editor':'Update work state'}</button><button type="button" class="btn ghost" data-comments>Comments</button><button type="button" class="btn ghost" data-approval>Request approval</button><button type="button" class="btn ghost" data-registry>Open in Registry</button></div></section>${u.editing?`<section class="panel"><div class="eyebrow panel-eyebrow">Update Work State</div><form class="grid" data-update><label>Status<select name="status">${OperationStates.map(x=>`<option ${x===o.status?'selected':''}>${x}</option>`).join('')}</select></label><label>Progress<input name="progress" type="number" min="0" max="100" value="${o.progress}"></label><label>Owner<input name="owner" type="email" list="ops-users" value="${esc(o.owner)}"><datalist id="ops-users">${capRows(s.users,RenderBudget.tableRows).map(x=>`<option value="${esc(x.email)}">${esc(x.fullName)}</option>`).join('')}</datalist></label><label>Due date<input name="dueDate" type="date" value="${esc(fmtDate(o.dueDate||''))}"></label><label>Priority<select name="priority">${priorityOptions(o.priority)}</select></label><label>Escalation level<select name="escalationLevel">${[0,1,2,3].map(x=>`<option ${x===o.escalationLevel?'selected':''}>${x}</option>`).join('')}</select></label><label class="wide">Blocked reason<input name="blockedReason" value="${esc(o.blockedReason)}"></label><label class="wide">Dependencies (comma-separated refs)<input name="dependencies" value="${esc(o.dependencies.join(', '))}"></label><div class="wide form-row"><button class="btn">Save work state</button><button type="button" class="btn ghost" data-edit-cancel>Cancel</button></div></form></section>`:''}<section class="panel"><div class="eyebrow panel-eyebrow">Work Journal</div><ul class="timeline">${capRows(s.audit.filter(a=>a.entityId===o.id||a.details?.referenceId===o.referenceId),RenderBudget.timelineItems).map(a=>`<li><div class="when">${esc(a.at)}</div><b>${esc(a.action)}</b><p>${esc(a.actor||'System')}</p></li>`).join('')||'<li>No journal entries.</li>'}</ul></section>`}
function bind(el,s,u,ops,sel){bindLens(el);el.querySelectorAll('[data-source-view]').forEach(b=>b.onclick=()=>{UIState.set('operations',{source:b.dataset.sourceView,page:1});render(el)});el.querySelector('[data-scope]').value=u.scope;el.querySelector('[data-status]').value=u.status;el.querySelector('[data-scope]').onchange=e=>{UIState.set('operations',{scope:e.target.value,page:1});render(el)};el.querySelector('[data-status]').onchange=e=>{UIState.set('operations',{status:e.target.value,page:1});render(el)};debouncedInput(el.querySelector('[data-q]'),v=>{UIState.set('operations',{q:v,page:1});render(el)},{refind:()=>el.querySelector('[data-q]')});el.querySelectorAll('[data-select]').forEach(x=>x.onclick=()=>{UIState.set('operations',{selected:x.dataset.select,md:'detail'});render(el);resetDetailScroll(el)});el.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>{UIState.set('operations',{page:+x.dataset.page});render(el)});el.querySelector('[data-md-back]')?.addEventListener('click',()=>{UIState.set('operations',{md:'list'});render(el)});el.querySelector('[data-edit-toggle]')?.addEventListener('click',()=>{UIState.set('operations',{editing:!u.editing});render(el)});el.querySelector('[data-edit-cancel]')?.addEventListener('click',()=>{UIState.set('operations',{editing:false});render(el)});el.querySelector('[data-comments]')?.addEventListener('click',()=>{State.patch({selectedId:sel.id});location.hash='#/comments'});el.querySelector('[data-approval]')?.addEventListener('click',()=>{State.patch({selectedId:sel.id});location.hash='#/approvals'});el.querySelector('[data-registry]')?.addEventListener('click',()=>{State.patch({selectedId:sel.referenceId||sel.id});location.hash='#/registry'});el.querySelector('[data-update]')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),progress=Math.max(0,Math.min(100,+d.progress||0)),level=+d.escalationLevel||0;if(d["status"] ==='Completed'&&progress<100)return toast('Completed work must be 100% progressed','error');if(d["status"] ==='Blocked'&&!d.blockedReason.trim())return toast('A blocked reason is required','error');if(!await confirmAction({title:'Update operational state',body:`<p>${esc(sel.title)}</p><p>${esc(sel.status)} → ${esc(d.status)}</p>`}))return;await executeOwnedAction('activities','update-operation',()=>{const updated={...sel,...d,progress,escalationLevel:level,dependencies:d.dependencies.split(',').map(x=>x.trim()).filter(Boolean),updatedAt:new Date().toISOString()};const event=audit('Operation Updated','operation',sel.id,{referenceId:sel.referenceId,from:sel.status,to:d.status,progress},s.profile.email);State.patch({operations:ops.map(x=>x.id===sel.id?updated:x),tracking:s.tracking.map(x=>String(x.id)===sel.id?{...x,status:d.status,progress:String(progress),assignedTo:d.owner,due:d.dueDate,priority:d.priority}:x),escalations:level?[{id:crypto.randomUUID(),operationId:sel.id,referenceId:sel.referenceId,level,reason:d.blockedReason,status:'Open',createdAt:new Date().toISOString()},...s.escalations]:s.escalations,audit:[event,...s.audit]});invoke('DYNAMIC_ACTIONS',{action:'transition',ref:sel.referenceId||sel.id,status:d.status,progress,owner:d.owner}).catch(()=>toast('Saved locally; synchronization queued','error'));},{ref:sel.referenceId||sel.id});toast('Work state saved','success');UIState.set('operations',{editing:false});render(el)})}

/* ── Canvas Activities parity lens ─────────────────────────────────────────────────────────
   Record queue with the Canvas filter/sort contract, an attachments panel backed by the
   FETCH_EMAIL_ATTACHMENTS contract, a PDF/non-PDF preview, and the three DGOFASTTRACK
   lifecycle actions. Every lifecycle action is confirmed first, executed through
   executeOwnedAction() (which applies ownership checks and writes the audit trail) and
   committed through WriteManager.backend() (which applies the idempotency key). No new
   endpoint, RBAC rule, state key or CSS selector is introduced.                            */
const RECORD_STATE = {tab:'All',assignedTo:'',category:'',status:'',assignmentStatus:'',dateFrom:'',dateTo:'',search:'',page:1,size:25,selected:null,mode:'gallery',attachment:null,attachments:null,attachmentsRef:'',busy:false,error:''};
const recordUi = () => UIState.get('activity-records', RECORD_STATE);
const filtersOf = u => ({statusTab:u.tab,assignedTo:u.assignedTo,category:u.category,status:u.status,assignmentStatus:u.assignmentStatus,dateFrom:u.dateFrom,dateTo:u.dateTo,search:u.search});
const selectOptions = (values,active) => ['<option value="">All</option>'].concat(values.map(v=>`<option value="${esc(v)}"${v===active?' selected':''}>${esc(v)}</option>`)).join('');

function renderRecords(el){
  const s=State.get(), u=recordUi(), all=s.activities||[];
  const rows=ActivityParity.filterActivities(all,filtersOf(u));
  const opts=ActivityParity.filterOptions(all);
  const p=pageSlice(rows,u.page,u.size);
  const sel=u.selected?all.find(x=>String(x.id)===String(u.selected)):null;
  const tabs=ActivityParityConfig.statusTabs.map(x=>`<button type="button" class="btn ${x===u.tab?'':'ghost'}" data-tab="${esc(x)}" aria-pressed="${x===u.tab}">${esc(x)}</button>`).join('');
  el.innerHTML=`<div class="workspace">${head('Activities','Canvas activity record queue.')}${lensBar('records')}${kpis([['Records',all.length],['In view',rows.length],['Treated',all.filter(x=>String(x.status||'').toLowerCase()==='treated').length],['Not treated',all.filter(x=>String(x.status||'').toLowerCase()!=='treated').length]])}<div class="toolbar">${tabs}</div><div class="toolbar"><input data-search value="${esc(u.search)}" placeholder="Title starts with…" aria-label="Search activity titles by leading characters"><select data-filter="assignedTo" aria-label="Assigned to">${selectOptions(opts.assignedTo,u.assignedTo)}</select><select data-filter="category" aria-label="Category">${selectOptions(opts.category,u.category)}</select><select data-filter="status" aria-label="Status">${selectOptions(opts.status,u.status)}</select><select data-filter="assignmentStatus" aria-label="Assignment status">${selectOptions(opts.assignmentStatus,u.assignmentStatus)}</select><input type="date" data-filter="dateFrom" value="${esc(u.dateFrom)}" aria-label="Created from"><input type="date" data-filter="dateTo" value="${esc(u.dateTo)}" aria-label="Created to"><button type="button" class="btn ghost" data-reset-filters>Reset filters</button></div><div class="split" ${mdSwitch(sel?'detail':'list')}><div><div class="list-col">${p.rows.map(recordCard).join('')||emptyState('No activity records','No record matches the current Canvas filter set.')}</div>${pager(p)}</div><div class="detail-col panel-stack">${sel?recordDetail(sel,u):'<section class="panel">'+emptyState('Select an activity record','Open a record to review it, inspect attachments and route it to the FastTrack queue.')+'</section>'}</div></div></div>`;
  bindRecords(el,u,sel);
}

function recordCard(a){
  return `<article class="list-item ${''}" data-record="${esc(a.id)}"><div class="status-strip">${badge(a.status||'Unknown')} ${badge(a.assignmentStatus||'Not Assigned')}</div><h4>${esc(a.title||'Untitled')}</h4><div class="meta">${esc(a.referenceId||'No reference')} · ${esc(a.assignedTo||'Unassigned')} · ${esc(a.category||'Unclassified')} · ${esc(fmtDateTime(a.created||''))}</div></article>`;
}

function recordDetail(a,u){
  const attachments=u.attachments&&String(u.attachmentsRef)===String(a.id)?u.attachments:ActivityParity.getAttachments(a);
  const preview=u.attachment?ActivityParity.getAttachmentPreviewModel(attachments.find(x=>x.id===u.attachment)):null;
  return `${mdBack('Back to activity records')}<section class="panel"><div class="eyebrow panel-eyebrow">Activity Record</div><div class="status-strip">${badge(a.status||'Unknown')} ${badge(a.assignmentStatus||'Not Assigned')}</div><h2>${esc(a.title||'Untitled')}</h2><dl class="detail-grid"><dt>ID</dt><dd>${esc(a.id)}</dd><dt>Reference</dt><dd>${esc(a.referenceId||'—')}</dd><dt>Assigned to</dt><dd>${esc(a.assignedTo||'Unassigned')}</dd><dt>Category</dt><dd>${esc(a.category||'—')}</dd><dt>Created</dt><dd>${esc(fmtDateTime(a.created||''))}</dd></dl><p>${esc(a.description||'No instruction recorded.')}</p>${u.error?`<p class="meta" role="alert">${esc(u.error)}</p>`:''}<div class="form-row"><button type="button" class="btn" data-lifecycle="archive"${u.busy?' disabled':''}>Archive (UNC)</button><button type="button" class="btn ghost" data-lifecycle="siwes"${u.busy?' disabled':''}>Route to SIWES</button><button type="button" class="btn ghost" data-lifecycle="nysc"${u.busy?' disabled':''}>Route to NYSC</button><button type="button" class="btn ghost" data-load-attachments${u.busy?' disabled':''}>Refresh attachments</button></div></section>${attachmentsPanel(attachments)}${previewPanel(preview)}`;
}

function attachmentsPanel(attachments){
  if(!attachments.length) return `<section class="panel"><div class="eyebrow panel-eyebrow">Attachments</div>${emptyState('No attachments','This activity record carries no attachment.')}</section>`;
  return `<section class="panel"><div class="eyebrow panel-eyebrow">Attachments</div><div class="list-col">${attachments.map(x=>`<article class="list-item"><h4>${esc(x.name)}</h4><div class="meta">${esc(x.contentType||'Unknown type')}</div><div class="form-row"><button type="button" class="btn ghost compact" data-preview="${esc(x.id)}">Preview</button>${x.url?`<a class="btn ghost compact" href="${safeHref(x.url)}" target="_blank" rel="noopener noreferrer" download>Download</a>`:'<span class="meta">Unsafe or missing link — download blocked</span>'}</div></article>`).join('')}</div></section>`;
}

function previewPanel(preview){
  if(!preview) return '';
  const body=preview.previewable
    ?`<div class="email-frame"><iframe title="Attachment preview: ${esc(preview.name)}" src="${safeHref(preview.url)}" sandbox referrerpolicy="no-referrer"></iframe></div>`
    :`<p class="meta">${esc(preview.fallbackMessage)}</p>`;
  return `<section class="panel"><div class="eyebrow panel-eyebrow">Attachment Preview</div><h2>${esc(preview.name)}</h2>${body}</section>`;
}

function bindRecords(el,u,sel){
  bindLens(el);
  const rerender=patch=>{UIState.set('activity-records',patch);renderRecords(el)};
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>rerender({tab:b.dataset.tab,page:1}));
  el.querySelectorAll('[data-filter]').forEach(x=>x.onchange=()=>rerender({[x.dataset.filter]:x.value,page:1}));
  el.querySelector('[data-reset-filters]').onclick=()=>rerender({...ActivityParity.defaultFilters(),tab:'All',page:1});
  debouncedInput(el.querySelector('[data-search]'),v=>rerender({search:v,page:1}),{refind:()=>el.querySelector('[data-search]')});
  el.querySelectorAll('[data-record]').forEach(x=>x.onclick=()=>{rerender({selected:x.dataset.record,mode:'details',attachment:null,attachments:null,attachmentsRef:'',error:''});resetDetailScroll(el)});
  el.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>rerender({page:+x.dataset.page}));
  el.querySelector('[data-md-back]')?.addEventListener('click',()=>rerender({selected:null,mode:'gallery',attachment:null}));
  el.querySelectorAll('[data-preview]').forEach(x=>x.onclick=()=>rerender({attachment:x.dataset.preview,mode:'attachment-preview'}));
  el.querySelector('[data-load-attachments]')?.addEventListener('click',()=>loadAttachments(el,sel));
  el.querySelectorAll('[data-lifecycle]').forEach(x=>x.onclick=()=>runLifecycle(el,x.dataset.lifecycle,sel));
}

// Attachments panel source of truth: the FETCH_EMAIL_ATTACHMENTS contract already registered
// in config/endpoints.config.js. Failure degrades to the attachment metadata embedded on the
// record rather than blanking the panel.
async function loadAttachments(el,activity){
  if(!activity||recordUi().busy) return;
  UIState.set('activity-records',{busy:true,error:''});
  renderRecords(el);
  try{
    const res=await invoke('FETCH_EMAIL_ATTACHMENTS',{id:activity.id,referenceId:activity.referenceId||''});
    const rows=Array.isArray(res)?res:(res?.value||res?.attachments||res?.data||[]);
    UIState.set('activity-records',{attachments:ActivityParity.getAttachments({attachments:rows}),attachmentsRef:String(activity.id),busy:false});
  }catch(e){
    UIState.set('activity-records',{busy:false,error:`Attachments could not be refreshed (${e.message}); showing attachment metadata already on the record.`});
    toast('Attachment refresh failed; showing record metadata','error');
  }
  // Discard the result if the operator has since switched lens or selected another record,
  // so a stale response never overwrites the surface they are now looking at.
  const after=recordUi();
  if(currentLens()!=='records') return;
  if(String(after.selected)!==String(activity.id)){ UIState.set('activity-records',{attachments:null,attachmentsRef:'',error:''}); return; }
  renderRecords(el);
}

// DYNAMIC_ACTIONS backend recognition, recorded from real responses only. There is no safe
// dry-run for this contract (every call is a write), so an operation that has never been
// acknowledged by the backend stays "not verified" in Diagnostics rather than being assumed
// ready. The record lives in `runtime`, which is neither persisted nor audited.
function recordRecognition(operation,response){
  const cur=State.get();
  const record=ActivityParity.recogniseLifecycleResponse(operation,response);
  State.patch({runtime:{...(cur.runtime||{}),activityLifecycleRecognition:{...(cur.runtime?.activityLifecycleRecognition||{}),[operation]:record}}},{module:'activities',action:'lifecycle-backend-recognition',silent:true});
}

async function runLifecycle(el,type,activity){
  if(!activity||recordUi().busy) return;
  const plan=ActivityParity.planLifecycleAction(type,activity);
  const label=type==='archive'?'Archive (UNC)':`Route to ${type.toUpperCase()}`;
  const ok=await confirmAction({title:label,body:`<p>${esc(activity.title||'Untitled')}</p><p>${esc(activity.referenceId||'No reference')}</p>${actionPreview(plan.queuePayload)}`});
  if(!ok) return;
  const action=`activity-${type}`, ref=activity.referenceId||String(activity.id);
  UIState.set('activity-records',{busy:true,error:''});
  renderRecords(el);
  // Each step is a separate governed write, so WriteManager derives a distinct idempotency
  // key per operation and a replayed click cannot duplicate the queue record. The backend's
  // recognition of each operation discriminator is recorded (runtime-only, never persisted) so
  // Diagnostics can report DYNAMIC_ACTIONS readiness honestly instead of assuming it.
  const write=async(operation,payload,writeRef)=>{
    try{ const res=await WriteManager.backend({module:'activities',action,endpoint:'DYNAMIC_ACTIONS',payload:{operation,activityId:activity.id,...payload},ref:writeRef||ref}); recordRecognition(operation,res); return res; }
    catch(e){ if(/unrecognis|unrecogniz|unknown operation|unsupported operation/i.test(String(e?.message||''))) recordRecognition(operation,{data:{recognised:false,message:e.message}}); throw e; }
  };
  try{
    const result=await executeOwnedAction('activities',action,()=>ActivityParity.commitLifecycleAction(type,activity,{
      createQueueRecord:async queueRecord=>{ const res=await write(`${action}:create-queue-record`,{queueRecord}); return res?.data?.ID??res?.data?.id??res?.data?.result?.ID; },
      applyReferenceId:queueRecord=>write(`${action}:set-reference-id`,{queueRecordId:queueRecord.ID,Reference_ID:queueRecord.Reference_ID},queueRecord.Reference_ID),
      patchActivity:(patch,queueRecord)=>write(`${action}:update-activity`,{patch},queueRecord.Reference_ID)
    }),{ref});
    // Merge the lifecycle delta into the record as it stands now: the snapshot taken before
    // the confirmation/network awaits may already be stale.
    const cur=State.get();
    State.patch({activities:(cur.activities||[]).map(x=>String(x.id)===String(activity.id)?{...x,...result.dgoPatch}:x)});
    toast(result.successMessage,'success');
    UIState.set('activity-records',{busy:false,selected:null,mode:'gallery',attachment:null,attachments:null,attachmentsRef:'',error:''});
  }catch(e){
    UIState.set('activity-records',{busy:false,error:e.message||'Lifecycle routing failed.'});
  }
  // A late completion must not drag the operator back out of the lens they moved to.
  if(currentLens()==='records') renderRecords(el);
}
