import { Router } from './router.js';
import { State } from './state.js';
import { loadRuntimeData } from './data-loader.js';
import { PlatformProvisioner } from './platform-provisioner.js';
import { CacheManager } from './cache-manager.js';
import { LoadingState } from './loading-state.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { PendingQueue } from './pending-queue.js';
import './nitda-module-adapter.js';
const modules = {'home':()=>import('../modules/home.js'),'ecm-erp-charter':()=>import('../modules/ecm-erp-charter.js'),'activities':()=>import('../modules/activities.js'),'correspondence':()=>import('../modules/correspondence.js'),'response-tracking':()=>import('../modules/response-tracking.js'),'orchestrator':()=>import('../modules/orchestrator.js'),'single-assignment':()=>import('../modules/single-assignment.js'),'bulk-assignment':()=>import('../modules/bulk-assignment.js'),'fasttrack':()=>import('../modules/fasttrack.js'),'approvals':()=>import('../modules/approvals.js'),'acknowledgment':()=>import('../modules/acknowledgment.js'),'dispatch':()=>import('../modules/dispatch.js'),'correspondence-email':()=>import('../modules/correspondence-email.js'),'scan-intake':()=>import('../modules/scan-intake.js'),'registry':()=>import('../modules/registry.js'),'briefs':()=>import('../modules/briefs.js'),'meetings':()=>import('../modules/meetings.js'),'projects':()=>import('../modules/projects.js'),'comments':()=>import('../modules/comments.js'),'reports':()=>import('../modules/reports.js'),'statistics':()=>import('../modules/statistics.js'),'executive':()=>import('../modules/executive.js'),'assistant':()=>import('../modules/assistant.js'),'lookup':()=>import('../modules/lookup.js'),'archive':()=>import('../modules/archive.js'),'operator-hud':()=>import('../modules/operator-hud.js'),'settings':()=>import('../modules/settings.js'),'diagnostics':()=>import('../modules/diagnostics.js'),'user-admin':()=>import('../modules/user-admin.js')};
async function boot(){
  const host=document.getElementById('app');
  try{
    PlatformProvisioner.ensure();
    window.__DGO_PROVISIONING__ = PlatformProvisioner.validate();
    window.__DGO_DATA_OPS__ = { cache:CacheManager, loading:LoadingState, performance:PerformanceMonitor, pending:PendingQueue };
    for(const [id,load] of Object.entries(modules)) Router.register(id, async el => (await load()).mount(el));
    const s=State.get(); document.documentElement.dataset.theme=s.settings.theme; document.documentElement.dataset.density=s.settings.density; const wel=await import('./welcome-experience.js'); await wel.WelcomeExperience.run();
    await import('../shared/shell.js'); const rel=await import('../shared/relationship-runtime.js'); const welcome=await import('../shared/welcome-runtime.js'); rel.installRelationshipInterceptors(document); host.replaceChildren(document.createElement('dgo-shell')); const dl=await import('./deeplink-resolver.js'); const oq=await import('./offline-action-queue.js'); oq.OfflineActionQueue.installOnlineRetry(); requestAnimationFrame(()=>{dl.DeepLinkResolver.resolveInitial(); welcome.launchWelcome();}); window.__DGO_BOOTED__=true; loadRuntimeData().catch(e=>{ const message=String(e?.message||e||''); console.warn('[DGO DATA]', message); const s=State.get(); State.patch({runtime:{...s.runtime,lastLoad:{ok:false,offline:true,at:new Date().toISOString(),message},lastWarnings:[...(s.runtime?.lastWarnings||[]),message].slice(-10)}},{module:'boot',action:'data-load-deferred',event:'audit:data-load-deferred'}); });
  }catch(e){ console.error('[DGO BOOT]',e);
    // Escape before display. core/router.js already does this for the equivalent value;
    // boot did not, leaving an unescaped path into innerHTML for any error whose message
    // embeds caller-influenced text.
    const safe=String(e.stack||e).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    host.innerHTML=`<div class="fatal"><h1>DGO could not start</h1><pre>${safe}</pre></div>`; }
}
// Only auto-boot in a browser; keeps the entrypoint importable in non-browser diagnostic contexts.
if (typeof document !== 'undefined' && typeof window !== 'undefined') boot();
