import { State } from './state.js';
import { Entities } from './entity-store.js';
import { reconcileEnterprise } from './enterprise-domain.js';
export const DataReconciler=Object.freeze({mergeById,apply,hydrate});
export function mergeById(current=[],incoming=[]){ const map=new Map(current.map(x=>[String(x.id||x.ID||x.__id),x])); for(const row of incoming) map.set(String(row.id||row.ID||row.__id),{...(map.get(String(row.id||row.ID||row.__id))||{}),...row}); return [...map.values()]; }
export function apply(patch,{replace=true,module='data-reconciler'}={}){ const current=State.get(); const next={}; for(const [k,v] of Object.entries(patch)) next[k]=Array.isArray(v)&&Array.isArray(current[k])&&!replace?mergeById(current[k],v):v; Object.assign(next,reconcileEnterprise({...current,...next})); State.patch(next,{module,action:'reconcile'}); return hydrate(); }
export function hydrate(){ Entities.hydrateFromState(State.get()); return State.get(); }
