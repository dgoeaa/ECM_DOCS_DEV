import { entryPoint } from '../config/entry-points.config.js';
import {ReceiptLedger} from '../core/receipt-ledger.js';
import {OfflineActionQueue} from '../core/offline-action-queue.js';
import {DeepLinkResolver} from '../core/deeplink-resolver.js';
import { CacheManager } from '../core/cache-manager.js';
import { LoadingState } from '../core/loading-state.js';
import { PendingQueue } from '../core/pending-queue.js';
import { capRows, RenderBudget } from '../core/render-budget.js';
import { hydrateGovernance } from '../core/governed-actions.js';
import {State} from '../core/state.js';import {head,kpis,esc,badge,toast} from '../core/ui.js';import {requestSync} from '../core/data-loader.js';
import {operationalMetrics} from '../core/metrics-service.js';

/* D4 — what each entry point actually admitted, and the two numbers that mean something is
   wrong upstream.

   `unplaced` is a record that declared no entry point. It used to be invisible: the old
   inference defaulted such records to physical-scanned-documents, so "we do not know where
   this came from" was indistinguishable from "it was scanned at the counter". Surfacing the
   count is the point — a rising number here means a producer stopped stamping its channel.

   `conflicts` is a record that arrived on one lane and declared another. Either the endpoint
   or the producer is wrong, and neither is discoverable if the disagreement is resolved
   silently. */
function feedPanel(s){
  const feeds=s.runtime?.feeds;
  if(!feeds||!Object.keys(feeds).length) return '<p class="meta">No feed inventory yet — synchronize to populate it.</p>';
  return Object.entries(feeds).map(([collection,f])=>{
    const lanes=Object.entries(f.byEntryPoint||{}).map(([id,n])=>`<div class="action-row"><span>${esc(entryPoint(id)?.label||id)}</span><b>${n}</b></div>`).join('');
    const flags=[
      f.unplaced?`<div class="action-row"><span>declared no entry point</span>${badge(String(f.unplaced),'danger')}</div>`:'',
      f.conflicts?`<div class="action-row"><span>disagree with their lane</span>${badge(String(f.conflicts),'danger')}</div>`:'',
    ].join('');
    return `<div class="feed-group"><div class="eyebrow">${esc(collection)}</div>${lanes}${flags||'<div class="action-row"><span>all records placed</span>'+badge('clean')+'</div>'}</div>`;
  }).join('');
}

export async function mount(el){hydrateGovernance();render(el)}function render(el){const s=State.get(),load=s.runtime?.lastLoad;el.innerHTML=`<div class="workspace">${head('Operator HUD','Live operational telemetry, synchronization control and queued-action oversight.')}${kpis([['Data source',load?.key||'None'],['Queued writes',s.pending.length],['Warnings',s.runtime?.lastWarnings?.length||0],['Audit events',s.audit.length]])}<div class="dashboard-grid"><section class="panel"><h2>Synchronization</h2><p>Last load: <b>${esc(load?.at?new Date(load.at).toLocaleString():'Never')}</b></p><p>Request: <code>${esc(load?.meta?.requestId||'—')}</code></p><p>Run: <code>${esc(load?.meta?.runId||'—')}</code></p><p>Contract: ${badge(load?.meta?.contractVersion||'Unknown')}</p><button class="btn" data-sync>Synchronize now</button></section><section class="panel"><h2>Collection inventory</h2>${Object.entries(load?.counts||{}).map(([k,v])=>`<div class="action-row"><span>${esc(k)}</span><b>${v}</b></div>`).join('')||'<p>No synchronization inventory.</p>'}</section><section class="panel"><h2>Intake feeds · D4</h2>${feedPanel(s)}</section><section class="panel"><h2>Live operational metrics</h2>${(m=>['openReferences','openTasks','overdue','dueSoon','pendingApprovals','pendingDispatch'].map(k=>`<div class="action-row"><span>${esc(k.replace(/([A-Z])/g,' $1').toLowerCase())}</span><b>${m[k]}</b></div>`).join(''))(operationalMetrics(s))}</section><section class="panel"><h2>Data operations</h2>${(d=>`<div class="action-row"><span>cache entries</span><b>${esc(String(d.cache?.entries??d.cache?.size??'—'))}</b></div><div class="action-row"><span>loading states</span><b>${esc(String(Object.keys(d.loading||{}).length))}</b></div><div class="action-row"><span>pending writes</span><b>${esc(String(d.pending?.count??s.pending.length))}</b></div>`)(operatorDataOpsSummary())}</section><section class="panel wide-panel"><h2>Pending write queue</h2>${capRows(s.pending,RenderBudget.pendingRows).map(p=>`<div class="action-row"><span><b>${esc(p.key)}</b><small>${esc(p.at)} · ${esc(p.error)}</small></span>${badge('Queued')}</div>`).join('')||'<p>No queued writes.</p>'}</section></div><section class="panel"><h2>Deep-link inspector</h2>${(()=>{const ctx=State.get().deepLinkContext||{};return `<div class="action-row"><span>Resolved route</span><b>${esc(ctx.route||'None')}</b></div><div class="action-row"><span>Task / reference</span><b>${esc(ctx.taskId||ctx.referenceId||'—')}</b></div><div class="action-row"><span>Matched param</span><b>${esc(ctx.matchedParam||'—')}</b></div>`})()}</section><section class="panel"><h2>Receipt & offline action health</h2>${(()=>{const r=ReceiptLedger.stats(), q=OfflineActionQueue.summary();return `<div class="action-row"><span>Receipts</span><b>${r.count}</b></div><div class="action-row"><span>Queued acknowledgements</span><b>${q.count}</b></div><div class="action-row"><span>Failed receipts</span><b>${r.failed}</b></div><div class="toolbar"><button class="btn" data-retry-ack>Retry acknowledgements</button><button class="btn ghost" data-export-ack>Export receipts</button></div>`})()}</section></div>`;el.querySelector('[data-sync]').onclick=async e=>{e.target.disabled=true;try{await requestSync({source:'operator-hud',mode:'full'});toast('Synchronization completed','success');render(el)}catch(x){toast(x.message,'error')}finally{e.target.disabled=false}};el.querySelector('[data-retry-ack]')?.addEventListener('click',async e=>{e.target.disabled=true;try{const r=await OfflineActionQueue.retryAckQueue();toast(`Ack retry: ${r.ok} sent, ${r.fail} failed`,r.fail?'error':'success');render(el)}catch(x){toast(x.message,'error')}finally{e.target.disabled=false}});el.querySelector('[data-export-ack]')?.addEventListener('click',()=>{const blob=new Blob([ReceiptLedger.exportJSON()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dgo-acknowledgement-receipts.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});}

export function operatorDataOpsSummary(){ return {cache:CacheManager.stats(), loading:LoadingState.snapshot(), pending:PendingQueue.stats()}; }
