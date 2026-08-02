import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, esc, table, toast, confirmAction, mdBack, mdSwitch, resetDetailScroll } from '../core/ui.js';
import { capRows, RenderBudget } from '../core/render-budget.js';
import { updateTaskState } from '../core/enterprise-domain.js';
import { priorityLabel } from '../config/priority.config.js';
import { exportCsv } from '../core/report-export-service.js';
import { debouncedInput } from '../core/ui-interactions.js';
import { invoke } from '../core/api.js';
import { dynamicActionContract } from '../config/dynamic-actions.config.js';
import { UIState } from '../core/ui-state.js';
export async function mount(el){hydrateGovernance();render(el); }
function rows(s, q) { return s.tracking.filter(t => !q || [t.title, t.referenceId, t.assignedTo, t.status].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))); }
function exportList(list) {
  exportCsv(list, [{key:'referenceId',label:'referenceId'},{key:'title',label:'title'},{key:'assignedTo',label:'assignedTo'},{key:'priority',label:'priority'},{key:'status',label:'status'}], 'orchestrator.csv');
}
function render(el) {
  const s = State.get(); const u = UIState.get('orchestrator', { q: '', selected: null, md: 'list' }); const list = rows(s, u.q); const sel = list.find(t => t.id === u.selected) || null;
  el.innerHTML = `<div class="workspace">${head('Task Orchestrator', 'Cross-linked task lens — status, ownership and downstream routing.')}
    <div class="toolbar"><input data-q aria-label="Search tasks" placeholder="Search tasks" value="${esc(u.q)}"><div><button class="btn ghost" data-export>Export CSV</button></div></div>
    <div class="split" ${mdSwitch(sel?u.md:'list')}><div class="panel">${table([
      { key: 'referenceId', label: 'Reference' }, { key: 'title', label: 'Title' }, { key: 'assignedTo', label: 'Assigned To' },
      { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }], capRows(list, RenderBudget.tableRows), r => `data-id="${esc(r.id)}" class="row-link ${sel && sel.id === r.id ? 'row-active' : ''}"`)}</div>
    <div class="detail-col panel-stack">${sel ? detail(sel) : '<section class="panel"><div class="empty"><h2>Select a task</h2><p>Choose a task row to inspect and update it.</p></div></section>'}</div></div></div>`;
  debouncedInput(el.querySelector('[data-q]'),value=>{UIState.set('orchestrator',{q:value});render(el)},{refind:()=>el.querySelector('[data-q]')})
  el.querySelector('[data-export]').onclick = () => list.length ? exportList(list) : toast('Nothing to export', 'error');
  el.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => { UIState.set('orchestrator', { selected: tr.dataset.id, md: 'detail' }); render(el); resetDetailScroll(el); });
  el.querySelector('[data-md-back]')?.addEventListener('click', () => { UIState.set('orchestrator', { md: 'list' }); render(el); });
  const upd = el.querySelector('[data-mark-done]'); if (upd) upd.onclick = async () => {
    if (!await confirmAction({ title: 'Mark task completed', body: `<p><b>${esc(sel.title)}</b></p>` })) return;
    await executeOwnedAction('orchestrator', 'complete-action', () => {
      const r = updateTaskState(State.get(), sel.id, { status: 'Completed' }, s.profile.email, { surface: 'orchestrator' });
      if (r) State.patch(r.patch, { module: 'orchestrator', action: 'task:complete', ref: sel.referenceId || sel.id });
    }, { ref: sel.referenceId || sel.id });
    toast('Task marked completed', 'success'); render(el);
  };
  const openComments = el.querySelector('[data-open-comments]'); if (openComments) openComments.onclick = () => { State.patch({ selectedId: sel.referenceId }); location.hash = '#/comments'; };
  const setRem = el.querySelector('[data-set-reminder]'); if (setRem) setRem.onclick = async () => {
    const contract = dynamicActionContract('setReminder'); if (!contract) return;
    const dueAt = el.querySelector('[data-reminder-due]')?.value || '';
    if (contract.required.includes('dueAt') && !dueAt) { toast('A reminder date is required', 'error'); return; }
    const payload = { operation: contract.operation, action: 'setReminder', ref: sel.referenceId || sel.id, dueAt };
    if (!await confirmAction({ title: 'Confirm set reminder', body: `<p><b>${esc(sel.title)}</b></p><p>Reminder date: ${esc(dueAt)}</p><pre class="preview-box">${esc(JSON.stringify(payload, null, 2))}</pre>` })) return;
    await executeOwnedAction('orchestrator', 'set-reminder', () => State.patch({
      tracking: s.tracking.map(x => x.id === sel.id ? { ...x, reminderAt: dueAt } : x),
      notifications: [{ id: crypto.randomUUID(), at: new Date().toISOString(), taskId: sel.id, referenceId: sel.referenceId || '', title: `Reminder: ${sel.title}`, dueAt, assignedTo: sel.assignedTo || '' }, ...s.notifications]
    }, { module: 'orchestrator', action: 'setReminder', ref: sel.referenceId || sel.id }), { ref: sel.referenceId || sel.id });
    invoke('DYNAMIC_ACTIONS', payload).catch(() => toast('Reminder saved locally; synchronization queued', 'error'));
    toast(contract.successMessage, 'success'); render(el);
  };
}
function detail(t) {
  return `${mdBack('Back to tasks')}<section class="panel"><div class="eyebrow panel-eyebrow">Task Record</div><div class="meta">${esc(t.referenceId || '—')}</div><h2>${esc(t.title)}</h2>
    <p class="meta">Assigned to: ${esc(t.assignedTo || 'Unassigned')} · Priority: ${esc(priorityLabel(t.priority))} · Status: ${esc(t.status)}</p></section>
    <section class="panel"><div class="eyebrow panel-eyebrow">Task Actions</div><div class="form-row">${t.status !== 'Completed' ? '<button class="btn" data-mark-done>Mark Completed</button>' : ''}<a class="btn ghost" href="#/acknowledgment">Open Acknowledgment</a><button class="btn ghost" data-open-comments>Open Comments</button></div></section>
    <section class="panel"><div class="eyebrow panel-eyebrow">Reminder</div><div class="form-row" data-reminder-row>${t.reminderAt ? `<span class="pill">Reminder: ${esc(t.reminderAt)}</span>` : ''}<label class="sr-reminder">Reminder date<input type="date" data-reminder-due aria-label="Reminder date" value="${esc(t.reminderAt || '')}"></label><button class="btn ghost" data-set-reminder>Set reminder</button></div></section>`;
}
