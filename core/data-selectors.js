import { State } from './state.js';
import { status } from './domain.js';
export const Selectors=Object.freeze({state,activities,tasks,openTasks,overdueTasks,dueSoonTasks,byReference,registryFiles,comments,approvals,dispatches,search,paginate,relatedTasks,relatedEmails});
export function state(){ return State.get(); }
export function activities(){ return state().activities||[]; }
export function tasks(){ return state().tracking||[]; }
export function registryFiles(){ return state().registryFiles||[]; }
export function comments(){ return state().comments||[]; }
export function approvals(){ return state().approvals||[]; }
export function dispatches(){ return state().dispatches||[]; }
export function openTasks(){ return tasks().filter(t=>!['Completed','Closed','Cancelled'].includes(t.status)); }
export function overdueTasks(now=new Date()){ return openTasks().filter(t=>t.due&&new Date(t.due)<now); }
export function dueSoonTasks(ms=86400000){ const now=Date.now(); return openTasks().filter(t=>t.due&&new Date(t.due)>=now&&new Date(t.due)-now<=ms); }
export function byReference(ref){ return {activities:activities().filter(x=>(x.referenceId||x.ref)===ref),tasks:tasks().filter(x=>(x.referenceId||x.ref)===ref),comments:comments().filter(x=>(x.referenceId||x.ref)===ref),approvals:approvals().filter(x=>(x.referenceId||x.ref)===ref),dispatches:dispatches().filter(x=>(x.referenceId||x.ref)===ref)}; }
export function search(q='',scope='all'){ const term=String(q).toLowerCase(); const pools={activities:activities(),tasks:tasks(),registryFiles:registryFiles(),comments:comments(),approvals:approvals(),dispatches:dispatches()}; return Object.fromEntries(Object.entries(pools).map(([k,rows])=>[k,rows.filter(r=>JSON.stringify(r).toLowerCase().includes(term))])); }
export function paginate(rows=[],page=1,pageSize=50){ const p=Math.max(1,+page||1), s=Math.max(1,+pageSize||50), total=rows.length; return {page:p,pageSize:s,total,pages:Math.ceil(total/s),rows:rows.slice((p-1)*s,p*s)}; }

// Canonical lineage selectors (R11.6.3): the single heuristic for "which tasks/emails
// belong to this record", replacing three divergent per-module implementations.
export function relatedTasks(record,s=state()){
  const ref=String(record.referenceId||record.id||''); const id=String(record.id||'');
  return (s.tracking||[]).filter(t=>String(t.referenceId||'')===ref||(id&&String(t.title||'').includes(id)));
}
export function relatedEmails(record,s=state()){
  const ref=String(record.referenceId||'').toLowerCase(), id=String(record.id||'').toLowerCase();
  const subject=String(record.subject||record.title||'').toLowerCase();
  return (s.emails||[]).filter(e=>{
    const hay=`${e.subject||''} ${e.bodyPreview||''} ${e.bodyContent||''}`.toLowerCase();
    return (ref&&hay.includes(ref))||(id&&hay.includes(id))||(subject.length>4&&hay.includes(subject));
  });
}
