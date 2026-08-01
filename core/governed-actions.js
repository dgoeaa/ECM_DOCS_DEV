import { State } from './state.js';
import { Entities } from './entity-store.js';
import { AuditLog } from './audit-log.js';
export const actor=()=>State.get().profile||{persona:'registry'};
export async function governedTransition(ref, fromStatus, toStatus, meta={}){ try{return await Entities.transitionStatus(ref,fromStatus,toStatus,actor(),meta);}catch(e){ AuditLog.record({ref,actor:actor(),event:'audit:transition-fallback',meta:{fromStatus,toStatus,error:e.message}}); return null; } }
export function hydrateGovernance(){ try{return Entities.hydrateFromState(State.get());}catch(e){ console.warn('[OBSIDIAN governance hydration]',e); return null;} }

export { executeOwnedAction, auditAction, boundaryNotice } from './action-authority.js';
