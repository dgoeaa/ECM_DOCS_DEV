import { Selectors } from './data-selectors.js';
import { CacheManager } from './cache-manager.js';
export const QueryStore=Object.freeze({query,lookup,dashboard,reference});
export async function query(name,params={},runner){ const cache=await CacheManager.get('LOOKUP',{name,params}); if(cache) return cache; const value=runner?await runner(params):Selectors.search(params.q||'',params.scope||'all'); await CacheManager.set('LOOKUP',{name,params},value); return value; }
export function lookup(q,scope='all'){ return query('lookup',{q,scope}); }
export async function dashboard(){ const value={openTasks:Selectors.openTasks().length,overdue:Selectors.overdueTasks().length,dueSoon:Selectors.dueSoonTasks().length,activities:Selectors.activities().length}; await CacheManager.set('DASHBOARD',{},value); return value; }
export async function reference(ref){ const cached=await CacheManager.get('REFERENCE_DETAIL',{ref}); if(cached) return cached; const value=Selectors.byReference(ref); await CacheManager.set('REFERENCE_DETAIL',{ref},value); return value; }
