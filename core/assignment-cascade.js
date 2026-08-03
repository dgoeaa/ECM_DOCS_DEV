import { State } from './state.js';
import { AssignmentCascadeConfig as C } from '../config/assignment-cascade.config.js';
import { normalizePriority } from '../config/priority.config.js';
import { routingCategoryFor, DEFAULT_ROUTING_CATEGORY } from '../config/correspondence-categories.config.js';
const DAY=86400000;
const clone=v=>structuredClone(v);
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();
const uniq=xs=>[...new Set(xs.filter(Boolean))];
function first(row, keys=[]){ for(const k of keys){ if(row?.[k]!==undefined && row[k]!==null && row[k]!== '') return row[k]; } return ''; }
function addDays(n){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+Number(n||0)); return d.toISOString().slice(0,10); }
function parseRecipients(v){ return Array.isArray(v)?v.map(clean).filter(Boolean):String(v||'').split(/[;,\s]+/).map(clean).filter(Boolean); }
function normRule(row={}, source='runtime'){
  const A=C.categoryFieldAliases;
  const priority=normalizePriority(first(row,A.priority) || 'normal');
  const dueDays=Number(first(row,A.dueDays) || C.dueByPriority[priority] || C.defaultDueDays);
  const ackDays=Number(first(row,A.ackDays) || Math.min(C.defaultAckDays,dueDays));
  const category=clean(first(row,A.category));
  const subcategory=clean(first(row,A.subcategory));
  // INFORMDSU1/2/3 are three discrete columns — collect every one that is present (reference cascade).
  const infoDsuKeys=uniq(['INFORMDSU1','INFORMDSU2','INFORMDSU3','InformDSU1','InformDSU2','InformDSU3','infoDsu','InformDSU']
    .map(k=>clean(row[k])).filter(Boolean));
  return {
    id: clean(row.id||row.ID||`${category}|${subcategory}|${first(row,A.dsuKey)}`), source,
    category, categoryCode: clean(first(row,A.categoryCode)) || category.slice(0,3).toUpperCase() || 'GEN',
    subcategory, subcategoryCode: clean(first(row,A.subcategoryCode)) || subcategory.slice(0,3).toUpperCase() || '',
    dsuKey: clean(first(row,A.dsuKey)), supportDsuKey: clean(first(row,A.supportDsuKey)),
    infoDsuKeys,
    assignedTo: clean(first(row,A.assignedTo)), supportingAssignee: clean(first(row,A.supportingAssignee)),
    copyTo: parseRecipients(first(row,A.copyTo)), priority, ackDays, dueDays,
    instruction: clean(first(row,A.instruction))
  };
}
function fallbackRules(){ return C.fallbackMatrix.map(r=>normRule(r,'fallback')); }
export const AssignmentCascade=Object.freeze({matrix,categories,subcategories,departments,usersForDsu,cascade,validateDraft,saveDraft,loadDraft,clearDraft,buildPreviewSummary,seedFallbackIfEmpty});
export function matrix(state=State.get()){
  const rows=[...(state.categories||[]).map(r=>normRule(r,'categories')),...fallbackRules()]
    .filter(r=>r.category || r.categoryCode);
  const seen=new Set(), out=[];
  for(const r of rows){ const key=[lower(r.category),lower(r.subcategory),lower(r.dsuKey)].join('|'); if(seen.has(key)) continue; seen.add(key); out.push(r); }
  return out;
}
export function categories(state=State.get()){ const rows=matrix(state); return uniq(rows.map(r=>r.category)).map(category=>{ const r=rows.find(x=>x.category===category); return {category, categoryCode:r?.categoryCode||''}; }); }
export function subcategories(category,state=State.get()){ const rows=matrix(state).filter(r=>!category||r.category===category); return uniq(rows.map(r=>r.subcategory).filter(Boolean)).map(subcategory=>{ const r=rows.find(x=>x.subcategory===subcategory); return {subcategory, subcategoryCode:r?.subcategoryCode||''}; }); }
export function departments(state=State.get()){
  const raw=state.departments||[];
  const fromState=raw.map(d=>{ const headEmail=clean(d.headEmail||d.DSU_HeadEmail||d.email||d.Email); const personalEmail=clean(d.personalEmail||d.DSU_HeadPersonalEmail||d.HeadPersonalEmail); return { dsuKey:clean(d.dsuKey||d.DSU_KEY||d.key||d.Title||d.title), title:clean(d.title||d.Title||d.name||d.DSU_KEY||d.dsuKey), email:clean(d.email||d.Email||d.DSU_HeadEmail||d.HeadEmail), headEmail, personalEmail, headTitle:clean(d.headTitle||d.DSU_HeadTitle||d.HeadTitle||d.role||d.Role), supportEmail:clean(d.supportEmail||d.SupportEmail) }; }).filter(d=>d.dsuKey||d.title);
  const fromMatrix=matrix(state).flatMap(r=>[r.dsuKey,r.supportDsuKey]).filter(Boolean).map(k=>({dsuKey:k,title:k,email:'',headEmail:'',personalEmail:'',headTitle:'',supportEmail:''}));
  const seen=new Set(), out=[]; for(const d of [...fromState,...fromMatrix]){ const k=lower(d.dsuKey||d.title); if(seen.has(k)) continue; seen.add(k); out.push(d); } return out;
}
export function usersForDsu(dsuKey,state=State.get()){
  const k=lower(dsuKey); return (state.users||[]).filter(u=>!k || lower(u.department||u.Department||u.directorate||u.dsuKey||u.DSU_KEY).includes(k)).map(u=>({email:clean(u.email||u.Email), name:clean(u.fullName||u.name||u.Title||u.email||u.Email), dsuKey:clean(u.dsuKey||u.DSU_KEY||u.department||u.Department)})).filter(u=>u.email);
}
/* F-032. Two vocabularies write the `category` field — document kind ("Event Invitation")
   from the intake forms, routing domain ("Policy / Regulation") from reference data — and
   only the second matches a rule here. Every kind the manual form and the portal offered
   therefore fell through to `rows[0]`, which is whatever sorts first in the matrix: in the
   shipped fallback that is "Executive Correspondence → ODG → urgent, 2 days". The
   Director-General's office was the default destination for substantially all
   correspondence.

   Two changes, and they are different in kind:
     1. A document kind is resolved to a routing domain before matching. The mapping is
        PROVISIONAL and owner-confirmable; runtime reference data always wins, because the
        resolution only runs when the raw value matches no rule.
     2. The last resort is a NAMED default rather than `rows[0]`. Falling through to
        whatever sorts first is indefensible however the mapping is decided. */
function bestRule({category='',subcategory='',dsuKey='',activity={}}, state){
  const rows=matrix(state); const raw=category||activity.category||activity.Category;
  const cat=lower(raw), sub=lower(subcategory||activity.subcategory||activity.Subcategory), dsu=lower(dsuKey||activity.dsuKey||activity.assignedDsu);
  const direct=rows.find(r=>lower(r.category)===cat && lower(r.subcategory)===sub) || rows.find(r=>lower(r.category)===cat && (!dsu || lower(r.dsuKey)===dsu)) || rows.find(r=>lower(r.category)===cat);
  if(direct) return direct;
  const resolved=lower(routingCategoryFor(raw, rows.map(r=>r.category)));
  return rows.find(r=>lower(r.category)===resolved && lower(r.subcategory)===sub) || rows.find(r=>lower(r.category)===resolved)
    || rows.find(r=>dsu && lower(r.dsuKey)===dsu)
    || rows.find(r=>lower(r.category)===lower(DEFAULT_ROUTING_CATEGORY))
    || rows[0] || normRule({},'empty');
}
const CASCADE_DOWNSTREAM={category:['subcategory','categoryCode','subcategoryCode','dsu','supportDsu','assignedTo','supportingAssignee','copy'],subcategory:['subcategoryCode','dsu','supportDsu','assignedTo','supportingAssignee','copy'],dsu:['assignedTo','copy'],supportDsu:['supportingAssignee','copy']};
export function cascade({activity={},draft={},state=State.get(),changed='category'}={}){
  const down=CASCADE_DOWNSTREAM[changed]||[];
  const eff=changed==='manual'?draft:(()=>{const c={...draft};for(const k of down)if(k!=='copy')c[k]='';return c;})();
  const r=bestRule({category:eff.category,subcategory:eff.subcategory,dsuKey:eff.dsu,activity}, state);
  const deps=departments(state);
  const chosenDsu=eff.dsu||r.dsuKey; const dsuOverridesRule=!!eff.dsu&&lower(eff.dsu)!==lower(r.dsuKey||'');
  const findDept=key=>deps.find(d=>lower(d.dsuKey)===lower(key)||lower(d.title)===lower(key)) || null;
  const deptEmail=d=>d?(d.headEmail||d.email||d.personalEmail||''):'';
  const primaryDept=findDept(chosenDsu) || {};
  const supportDept=findDept(r.supportDsuKey) || {};
  // Reference cascade: CC = each INFORMDSU key resolved to that department head's (personal) email.
  const infoDsuEmails=(r.infoDsuKeys||[]).map(k=>{ const d=findDept(k); return d?(d.personalEmail||d.headEmail||d.email||''):''; }).filter(Boolean);
  const priority=normalizePriority(draft.priority || r.priority || activity.priority || 'normal');
  const dueDays=Number(r.dueDays || C.dueByPriority[priority] || C.defaultDueDays);
  const ackDays=Number(r.ackDays || Math.min(C.defaultAckDays,dueDays));
  const keep=(key,val)=> changed==='manual' ? (draft[key]??val) : (down.includes(key) ? val : (eff[key]||val));
  const next={
    type:draft.type||'newassignment', referenceId:draft.referenceId||activity.referenceId||'',
    category: keep('category', r.category||activity.category||''), categoryCode: keep('categoryCode', r.categoryCode||''),
    subcategory: keep('subcategory', r.subcategory||''), subcategoryCode: keep('subcategoryCode', r.subcategoryCode||''),
    dsu: keep('dsu', r.dsuKey||primaryDept.dsuKey||''), supportDsu: keep('supportDsu', r.supportDsuKey||supportDept.dsuKey||''),
    assignedTo: keep('assignedTo', dsuOverridesRule ? deptEmail(primaryDept) : (r.assignedTo||deptEmail(primaryDept))),
    supportingAssignee: keep('supportingAssignee', r.supportingAssignee||supportDept.supportEmail||deptEmail(supportDept)),
    copy: keep('copy', uniq([...(r.copyTo||[]), ...infoDsuEmails].filter(Boolean)).join('; ')),
    assigneeTitle: primaryDept.headTitle||'', supportingAssigneeTitle: supportDept.headTitle||'',
    dsuTitle: primaryDept.title||chosenDsu||'', supportDsuTitle: supportDept.title||r.supportDsuKey||'',
    priority, startDate: draft.startDate || addDays(0), ack: draft.ack || addDays(ackDays), due: draft.due || addDays(dueDays),
    comments: draft.comments || r.instruction || '', ruleId:r.id, cascadeSource:r.source,
    cascadeSnapshot:{rule:r,generatedAt:new Date().toISOString(),changed}
  };
  return next;
}
export function validateDraft(d={}){
  const e=[]; if(C.validation.requireCategory&&!d.category) e.push('category is required'); if(C.validation.requireSubcategory&&!d.subcategory) e.push('subcategory is required'); if(C.validation.requireAssignedTo&&!d.assignedTo) e.push('assignedTo is required'); if(C.validation.requireDue&&!d.due) e.push('due date is required'); if(C.validation.requireInstruction&&!d.comments) e.push('instruction is required'); if(d.startDate&&d.due&&new Date(d.startDate)>new Date(d.due)) e.push('start date cannot follow task due date'); if(d.ack&&d.due&&new Date(d.ack)>new Date(d.due)) e.push('acknowledgement due date cannot follow task due date'); return e;
}
function allDrafts(){ try{return JSON.parse(localStorage.getItem(C.storageKey)||'{}')}catch{return {}} }
function persistDrafts(x){ try{localStorage.setItem(C.storageKey,JSON.stringify(x));}catch{} }
export function saveDraft(id,draft){ const all=allDrafts(); all[String(id||'global')]={...draft,savedAt:new Date().toISOString()}; persistDrafts(all); return clone(all[String(id||'global')]); }
export function loadDraft(id){ return clone(allDrafts()[String(id||'global')]||null); }
export function clearDraft(id){ const all=allDrafts(); delete all[String(id||'global')]; persistDrafts(all); }
export function buildPreviewSummary(payload={}){ return {mode:payload.assignmentType||payload.source, referenceId:payload.referenceId||'', category:payload.category, subcategory:payload.subcategory, dsu:payload.assignedToDsu, assignedTo:payload.assignedTo, supportDsu:payload.supportingDsu, supportingAssignee:payload.supportingAssignee, priority:payload.priority, ack:payload.ack, due:payload.due, ccCount:(payload.ccRecipients||[]).length}; }
export function seedFallbackIfEmpty(state=State.get()){ if((state.categories||[]).length) return false; State.patch({categories:fallbackRules().map((r,i)=>({...r,id:'FALLBACK-CAT-'+i,title:r.category}))},{module:'assignment-cascade',action:'seed-fallback-categories',silent:true}); return true; }
