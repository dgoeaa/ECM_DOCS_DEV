import { hydrateGovernance } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { status } from '../core/domain.js';
import { head, kpis, esc } from '../core/ui.js';
import { VisibleWorkspaces } from '../config/workflow-clarity.config.js';
function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
export async function mount(el){hydrateGovernance();render(el);}
function card(w, count='', note='', priority='normal'){
  if(!w) return '';
  return `<a class="panel action-card cc-action ${priority==='primary'?'cc-primary-action':''}" href="#/${w.route}" data-cc-card="${esc(w.id)}"><div><div class="eyebrow">${esc(w.group)}</div><h2>${esc(w.label)}</h2><p>${esc(note||w.purpose)}</p></div>${count!==''?`<b class="kpi-inline">${esc(count)}</b>`:''}</a>`
}
function render(el){const s=State.get();const open=s.activities.filter(a=>!['Treated','Processed'].includes(status(a)));const unassigned=s.activities.filter(a=>!a.assignedTo&&!['Treated','Processed'].includes(status(a)));const active=s.tracking.filter(t=>t.status!=='Completed');const overdue=s.tracking.filter(t=>t.due&&new Date(t.due)<new Date()&&t.status!=='Completed');const approvals=(s.approvals||[]).filter(a=>['Pending','Draft'].includes(a.status||'Pending'));const dispatchedTotal=s.dispatches.length;const dispatches=(s.dispatches||[]).filter(d=>!d.closedAt);const by=Object.fromEntries(VisibleWorkspaces.map(w=>[w.id,w]));
  el.innerHTML=`<div class="workspace cc-workspace">${head('Command Center',`${greeting()}, ${esc(s.profile.name)}. Start here: manage all four ingestion sources through one DGCEO operating lifecycle.`)}
  <section class="cc-hero-grid" aria-label="Command Center overview">
    <div class="cc-kpi-band" data-critical="true">
      ${kpis([['Open References',open.length],['Unassigned',unassigned.length],['Active Tasks',active.length],['Overdue',overdue.length],['Dispatched',dispatchedTotal]])}
    </div>
    <aside class="panel cc-source-strip" aria-label="Four ingestion sources">
      <div class="eyebrow panel-eyebrow">Four ingestion sources</div>
      <div class="cc-source-list">
        <span>Physical documents received and scanned</span><span>Customer Service emails</span><span>Public portal submissions</span><span>DGCEO outgoing correspondence</span>
      </div>
    </aside>
  </section>
  <section class="panel cc-actions-panel"><div class="eyebrow panel-eyebrow">Recommended next actions</div><div class="quick-grid cc-action-grid">
    ${card(by.intake,unassigned.length,'Capture, triage and assign incoming correspondence into governed tasks — in one place.','primary')}
    ${card(by['my-work'],active.length,'Acknowledge, start, update or complete assigned work.','primary')}
    ${card(by.tracking,overdue.length,'Monitor overdue, ageing and matched document/email responses.','primary')}
    ${card(by['review-approval'],approvals.length,'Review, return, reject or approve controlled work.')}
    ${card(by['dispatch-archive'],dispatches.length,'Dispatch, close and archive completed work.')}
  </div></section>
  <section class="split cc-support-panels" aria-label="Command Center guidance">
    <section class="panel"><div class="eyebrow panel-eyebrow">Guided internal routes</div><div class="form-row"><a class="btn ghost" href="#/activities">Open Activities Lens</a><a class="btn ghost" href="#/fasttrack">Open FastTrack</a><a class="btn ghost" href="#/assistant">Open Assistant</a></div></section>
    <details class="panel cc-progressive" open><summary><span class="eyebrow panel-eyebrow">Plain-language workflow</span></summary><ol class="journey-list"><li><b>Intake & Assignment</b> captures the record and assigns it into a governed task.</li><li><b>My Work</b> executes the task.</li><li><b>Tracking</b> monitors SLA and response evidence.</li><li><b>Review & Approval</b> records decisions.</li><li><b>Dispatch & Archive</b> closes the matter.</li></ol></details>
    <details class="panel cc-progressive"><summary><span class="eyebrow panel-eyebrow">Module rule</span></summary><p>No module should make you guess what it does. If an action belongs elsewhere, the platform routes you to the owning workspace instead of exposing every technical module in the sidebar.</p><p class="meta">Use the ? button in the header to see what the current workspace owns and where it hands off.</p></details>
  </section></div>`}
