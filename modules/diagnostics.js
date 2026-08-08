import {ReceiptLedger} from '../core/receipt-ledger.js';
import { authPosture, missingActivationConfig } from '../config/auth.config.js';
import {OfflineActionQueue} from '../core/offline-action-queue.js';
import {DeepLinkResolver} from '../core/deeplink-resolver.js';
import { CacheManager } from '../core/cache-manager.js';
import { LoadingState } from '../core/loading-state.js';
import { PerformanceMonitor } from '../core/performance-monitor.js';
import { PendingQueue } from '../core/pending-queue.js';
import { capRows, RenderBudget } from '../core/render-budget.js';
import { PlatformProvisioner } from '../core/platform-provisioner.js';
import { hydrateGovernance } from '../core/governed-actions.js';
import {State} from '../core/state.js';import {Router} from '../core/router.js';import {BrowserCertification} from '../config/browser-certification.config.js';import {AppConfig} from '../config/app.config.js';import {ActivityParity} from '../core/activity-parity.js';import {EndpointKeys} from '../config/endpoints.config.js';import {EndpointRegistry} from '../core/endpoint-registry.js';import {head,kpis,esc,badge,toast} from '../core/ui.js';
/* Authentication posture. Surfaced in-product so an INERT auth layer is visible to
   operators and reviewers, rather than being discoverable only in documentation. */
function authPanel(){
  const p = authPosture();
  const missing = missingActivationConfig();
  const tone = p.enforced ? 'success' : 'warn';
  const label = p.enforced ? 'ENFORCED' : 'PROVISIONED — INERT';
  return `<section class="panel">
    <div class="eyebrow">Authentication</div>
    <p><b>Posture:</b> <span class="pill ${tone}">${label}</span></p>
    <p class="meta">Identity: ${p.identity} &middot; Role source: ${p.roleSource}</p>
    ${p.warning?`<p class="meta"><b>${p.warning}</b></p>`:''}
    <p class="meta">Ready to activate: <b>${p.readyToActivate?'yes':'no'}</b>${missing.length?` &middot; missing configuration: <code>${missing.join('</code>, <code>')}</code>`:''}</p>
    <p class="meta">This panel is for IT support. Activation is carried out by the platform team following the authentication runbook; contact IT support to request it.</p>
  </section>`;
}

/* I-16 — one plain consequence per check. A failing check that does not say what it costs
   is a number nobody can act on, which is what "CHECKS PASSING 6/9" was. */
const CHECK_CONSEQUENCE=Object.freeze({
  'Application boot':'The runtime did not finish starting. Nothing on this platform can be relied on.',
  'Routes registered':'Some workspaces did not register and cannot be opened.',
  'Endpoints configured':'One or more registry connections are missing, so the features that use them cannot reach the registry.',
  'Endpoint targets injected at deployment (no packaged signatures)':'Connection addresses were shipped inside the package instead of supplied at deployment. Rotate them and re-deploy.',
  'Backend load':'The last attempt to load records from the registry did not succeed. Lists may be empty or stale.',
  'Schema current':'Locally stored data is from an older version. Clear local data from Administration if lists look wrong.',
  'Viewport API':'This browser lacks a layout feature the platform uses. Some screens may size incorrectly.',
  'Ack endpoint configured':'Acknowledgements cannot be sent to the registry and will queue on this device.',
  'Ack deeplink route':'Acknowledgement links sent by email will not open the right screen.'
});

export async function mount(el){hydrateGovernance();render(el)}function render(el){const s=State.get(),viewportsAligned=String(AppConfig.certifiedViewports)===String(BrowserCertification.viewports),endpointAudit=EndpointRegistry.describeAll(s.settings.endpoints||{}),configured=endpointAudit.entries.filter(e=>e.configured).length,load=s.runtime?.lastLoad,checks=[['Application boot',!!window.__DGO_BOOTED__],['Routes registered',Router.known().length>=22],['Endpoints configured',configured===EndpointKeys.length],['Endpoint targets injected at deployment (no packaged signatures)',!endpointAudit.warnings.some(w=>w.code==='endpoint.packaged-signature')],['Backend load',!!load?.ok],['Schema current',s.schemaVersion===3],['Viewport API',typeof CSS!=='undefined' && typeof CSS.supports==='function' ? CSS.supports('height','100dvh') : true],['Ack endpoint configured',!!s.settings.endpoints?.SUBSIDIARY_ACTIONS],['Ack deeplink route',Router.known().includes('acknowledgment')]];el.innerHTML=`<div class="workspace">${head('System Health','Actionable runtime, backend, browser, queue and collection diagnostics. Restricted to IT.')}${authPanel()}${kpis([['Checks passing',checks.filter(x=>x[1]).length+'/'+checks.length],['Routes',Router.known().length],['Endpoints',configured+'/'+EndpointKeys.length],['Queued writes',s.pending.length]])}<div class="dashboard-grid"><section class="panel"><h2>Runtime checks</h2>${(()=>{
    /* I-16 — the tile states a bare fraction, so this panel has to say which checks are in
       it and what each failure costs. Failures are listed first: a reader who opens this
       screen is looking for what is wrong, and nine rows of PASS above the answer is how a
       number becomes something that cannot be acted on. */
    const failing=checks.filter(x=>!x[1]), passing=checks.filter(x=>x[1]);
    const row=([k,v])=>`<div class="action-row"><span>${k}${v?'':`<small class="meta">${esc(CHECK_CONSEQUENCE[k]||'This check is failing.')}</small>`}</span>${badge(v?'PASS':'ATTENTION',v?'ok':'danger')}</div>`;
    return (failing.length?`<p class="meta">${failing.length} of ${checks.length} ${failing.length===1?'check needs':'checks need'} attention. ${failing.length===1?'It is':'They are'} listed first.</p>`:'<p class="meta">All checks are passing.</p>')
      + failing.map(row).join('') + passing.map(row).join('');
  })()}</section><section class="panel"><h2>Governance & provisioning health</h2>${(h=>`<div class="action-row"><span>Provisioning</span>${badge(h?.ok===false?'ATTENTION':'PASS',h?.ok===false?'danger':'ok')}</div><div class="action-row"><span>Modules provisioned</span><b>${esc(String(h?.modules??h?.count??s.runtime?.provisioning?.modules??'0'))}</b></div>`)(provisioningHealth())}${(g=>`<div class="action-row"><span>${esc(g.label)}</span>${badge(g.error?'ATTENTION':'PASS',g.error?'danger':'ok')}</div>`)(obsidianGovernanceHealth())}<p class="meta">Last backend error: ${esc(s.runtime?.lastError||'None')}</p><p class="meta">Live synchronization, request lineage and queue oversight live in the Operator HUD.</p><a class="btn ghost" href="#/operator-hud">Open Operator HUD</a></section><section class="panel"><h2>Collections</h2>${[['Activities',s.activities],['Tasks',s.tracking],['Comments',s.comments],['Users',s.users],['Categories',s.categories],['Departments',s.departments],['Emails',s.emails]].map(([k,v])=>`<div class="action-row"><span>${k}</span><b>${v.length}</b></div>`).join('')}</section><section class="panel"><h2>Certified viewport contract</h2><p>${BrowserCertification.viewports.join(', ')} px</p><div class="chips">${BrowserCertification.contracts.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></section><section class="panel"><h2>Activities parity certification</h2>${(c=>`${c.checks.map(x=>`<div class="action-row"><span>${esc(x.label)}</span>${badge(x.ok?'PASS':'ATTENTION',x.ok?'ok':'danger')}</div><p class="meta">${esc(x.detail)}</p>`).join('')}`)(ActivityParity.certifyGovernance())}<div class="action-row"><span>Certified viewport matrix aligned</span>${badge(viewportsAligned?'PASS':'ATTENTION',viewportsAligned?'ok':'danger')}</div></section><section class="panel"><h2>Activity lifecycle backend readiness</h2>${(r=>`<div class="action-row"><span>DYNAMIC_ACTIONS operation recognition</span>${badge(r.status==='verified'?'PASS':r.status==='failed'?'FAILED':'ATTENTION',r.status==='verified'?'ok':'danger')}</div><p class="meta">${esc(r.summary)}</p><p class="meta">${r.dryRunAvailable?'A backend dry-run is wired into this check.':'No safe DYNAMIC_ACTIONS dry-run exists (every call is a write), so unprobed operations are reported as not verified — never as production-ready.'}</p>${r.checks.map(x=>`<div class="action-row"><span>${esc(x.label)}</span>${badge(x.status==='verified'?'PASS':x.status==='failed'?'FAILED':'ATTENTION',x.status==='verified'?'ok':'danger')}</div><p class="meta">${esc(x.detail)}</p>`).join('')}`)(ActivityParity.certifyBackendReadiness({recognition:s.runtime?.activityLifecycleRecognition||{}}))}</section></div><section class="panel"><h2>Deep-link inspector</h2>${(()=>{const ctx=State.get().deepLinkContext||{};return `<div class="action-row"><span>Resolved route</span><b>${esc(ctx.route||'None')}</b></div><div class="action-row"><span>Task / reference</span><b>${esc(ctx.taskId||ctx.referenceId||'—')}</b></div><div class="action-row"><span>Matched param</span><b>${esc(ctx.matchedParam||'—')}</b></div>`})()}</section><section class="panel"><h2>Receipt & offline action health</h2>${(()=>{const r=ReceiptLedger.stats(), q=OfflineActionQueue.summary();return `<div class="action-row"><span>Receipts</span><b>${r.count}</b></div><div class="action-row"><span>Queued acknowledgements</span><b>${q.count}</b></div><div class="action-row"><span>Failed receipts</span><b>${r.failed}</b></div><div class="toolbar"><button class="btn" data-retry-ack>Retry acknowledgements</button><button class="btn ghost" data-clear-receipts>Clear receipt ledger</button></div>`})()}</section></div>`;

el.querySelector('[data-retry-ack]')?.addEventListener('click',async e=>{e.target.disabled=true;try{const r=await OfflineActionQueue.retryAckQueue();toast(`Ack retry: ${r.ok} sent, ${r.fail} failed`,r.fail?'error':'success');render(el)}catch(x){toast(x.message,'error')}finally{e.target.disabled=false}});el.querySelector('[data-clear-receipts]')?.addEventListener('click',()=>{ReceiptLedger.clear();toast('Receipt ledger cleared','success');render(el)});}

export function obsidianGovernanceHealth(){ try { const stats = window.__OBSIDIAN_STATS__ || {}; return { label:'Entity Fabric Health', stats }; } catch { return { label:'Entity Fabric Health', error:true }; } }

export function provisioningHealth(){ return PlatformProvisioner.validate(); }

export function DataOpsHealth(){ return {cache:CacheManager.stats(), loading:LoadingState.snapshot(), performance:PerformanceMonitor.snapshot(), pending:PendingQueue.stats()}; }
