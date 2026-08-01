import { Router } from '../core/router.js';
import { State } from '../core/state.js';
import { confirmAction, toast } from '../core/ui.js';
import { actionRoute } from '../config/action-routing.config.js';
import { NavigationRelationships } from '../config/navigation-relationships.config.js';
import { LegacyScreenRouteMap } from '../config/source-routing.config.js';

const MUTATING = new Set(['governed-action','endpoint-action','local-state']);
const IN_PLACE_OPEN = new Set(['detail-pane','modal','drawer']);
// Honor openAs: only a full-route (or a same-page workflow progression to a different
// module) changes the current route. In-place surfaces (detail-pane/modal/drawer) must
// stay on the current route — otherwise every routed action becomes a full page jump.
export function resolveRoutedDestination(spec){
  if(!spec) return null;
  const openAs = spec.openAs || 'same-page';
  if(openAs === 'full-route') return spec.navigateTo || spec.postSuccess || null;
  if(IN_PLACE_OPEN.has(openAs)) return null;
  if(spec.postSuccess && spec.postSuccess !== spec.sourceModule) return spec.postSuccess;
  return null;
}
export function normalizeRoute(route){ return LegacyScreenRouteMap[route] || route || ''; }
export function routeWithContext(route, ctx={}){
  const target = normalizeRoute(route);
  if(ctx.referenceId || ctx.ref || ctx.id) State.patch({ selectedId: ctx.referenceId || ctx.ref || ctx.id }, {silent:true});
  if(ctx.sourceId) State.patch({ sourceId: ctx.sourceId }, {silent:true});
  if(target) Router.go(target);
  return target;
}
export async function runRoutedAction(actionId, ctx={}){
  const spec = actionRoute(actionId);
  if(!spec){ toast(`Unknown action: ${actionId}`,'error'); return false; }
  if(spec.requiresReference && !(ctx.referenceId || ctx.ref || ctx.id || State.get().selectedId)){
    toast(`${spec.label} requires a selected reference`, 'error'); return false;
  }
  if(spec.requiresConfirmation){ const ok = await confirmAction({title:spec.label, body:`Continue with ${spec.label}?`}); if(!ok) return false; }
  const meta={module:spec.ownerModule, action:spec.id, event:spec.auditEvent || `audit:${spec.id}`, ref:ctx.referenceId||ctx.ref||ctx.id||State.get().selectedId||''};
  if(MUTATING.has(spec.actionType)) State.patch({runtime:{...State.get().runtime,lastAction:spec.id,lastActionAt:new Date().toISOString()}}, meta);
  const dest = resolveRoutedDestination(spec);
  if(dest) routeWithContext(dest, ctx);
  toast(dest ? `${spec.label} → ${dest}` : `${spec.label} completed`, 'success');
  return true;
}
export function installRelationshipInterceptors(root=document){
  root.addEventListener('click', evt=>{
    const actionEl = evt.target.closest?.('[data-action],[data-route],[data-go],[data-open-route]');
    if(!actionEl) return;
    const action = actionEl.dataset.action;
    if(action && actionRoute(action)){ evt.preventDefault(); runRoutedAction(action, extractContext(actionEl)); return; }
    const route = actionEl.dataset.route || actionEl.dataset.go || actionEl.dataset.openRoute;
    if(route){ const target=normalizeRoute(route); if(target && target!==route){ evt.preventDefault(); routeWithContext(target, extractContext(actionEl)); } }
  }, true);
}
function extractContext(el){ return { referenceId: el.dataset.referenceId || el.dataset.ref || el.dataset.id || '', sourceId: el.dataset.sourceId || '' }; }
export function commandsFromRelationships(){
  const groups = NavigationRelationships.primarySidebar || {};
  return Object.entries(groups).flatMap(([group,routes])=>(routes||[]).map(route=>({group,route,label:route.replace(/-/g,' ')})));
}
