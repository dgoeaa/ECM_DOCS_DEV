import { State } from './state.js';
import { AuditLog } from './audit-log.js';
import { toast, esc } from './ui.js';
import { boundaryFor, ownsAction } from '../config/module-boundaries.config.js';
import { actionSpec } from '../config/action-ownership.config.js';
import { ensureCurrentUserActive, getCurrentUser } from './current-user.js';
export function assertModuleAction(moduleName, action){
  const spec=actionSpec(action); const boundary=boundaryFor(moduleName);
  if(!boundary) throw new Error(`Unknown module boundary: ${moduleName}`);
  if(spec && spec.owner && spec.owner!==moduleName){
    const invokers=Array.isArray(spec.allowedInvokers)?spec.allowedInvokers:[];
    if(!invokers.includes(moduleName)) throw new Error(`Action ${action} is owned by ${spec.owner}, not ${moduleName}`);
  }
  if(!spec && !ownsAction(moduleName, action)) throw new Error(`Action ${action} is not registered for ${moduleName}`);
  return {spec,boundary};
}
export function auditAction(moduleName, action, meta={}){
  const actor=getCurrentUser(State.get()) || State.get().profile || {};
  const spec=actionSpec(action) || {};
  const event=meta.event || spec.audit || `audit:${moduleName}:${action}`;
  return AuditLog.record({ref:meta.ref||'', actor, event, entityType:meta.entityType||'', entityId:meta.entityId||'', meta:{module:moduleName, action, owner:spec.owner||moduleName, service:spec.service||'', backend:spec.backend||'', ...(meta.meta||{})}});
}
export async function executeOwnedAction(moduleName, action, runner, meta={}){
  ensureCurrentUserActive(`${moduleName}:${action}`);
  assertModuleAction(moduleName, action);
  auditAction(moduleName, action, {ref:meta.ref, meta:{stage:'started', ...(meta.meta||{})}});
  try { const result=await runner(); auditAction(moduleName, action, {ref:meta.ref, meta:{stage:'completed'}}); return result; }
  catch(error){ auditAction(moduleName, action, {ref:meta.ref, meta:{stage:'failed', error:error.message}}); toast?.(error.message || 'Action failed','error'); throw error; }
}
// The values come from config/module-boundaries.config.js and are trusted today, so this
// is hardening rather than a live bug — but it was the one HTML builder in the tree that
// interpolated without escaping, and core/ui.js authorityCard() renders the same content
// escaped. An unescaped sink that "happens to" receive safe input is a trap for whoever
// later makes boundaries editable; matching the escaping discipline everywhere else costs
// nothing and removes the trap.
export function boundaryNotice(moduleName){ const b=boundaryFor(moduleName); if(!b) return ''; return `<section class="panel boundary-note"><div class="eyebrow">Module Authority</div><p><b>${esc(b.role)}</b></p><p class="meta">Owns: ${esc((b.owns||[]).join(', '))}</p><p class="meta">Does not own: ${esc((b.mustNotOwn||[]).join(', '))}</p></section>`; }
