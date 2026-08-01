import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, esc, toast, confirmAction, badge, chips, mdBack, mdSwitch, resetDetailScroll,fmtDate,fmtDateTime} from '../core/ui.js';
import { UIState } from '../core/ui-state.js';
export async function mount(el){hydrateGovernance();render(el); }
function pending(s) { return s.approvals.filter(a => a["status"] === 'pending'); }
function decided(s) { return s.approvals.filter(a => a["status"] !== 'pending'); }
function render(el) {
  const s = State.get(); const u = UIState.get('approvals', { selected: null, creating: false, view: 'pending', md: 'list' });
  const list = u.view === 'pending' ? pending(s) : decided(s);
  const sel = list.find(a => a.id === u.selected) || null;
  el.innerHTML = `<div class="workspace">${head('Approvals', 'Executive sign-off desk — approve or reject with a recorded minute.')}
    <div class="toolbar">${chips([{ value: 'pending', label: `Pending (${pending(s).length})` }, { value: 'decided', label: `Decided (${decided(s).length})` }], u.view, 'data-view')}<span class="meta flex-1">${list.length} in view</span><div><button class="btn" data-new>New Approval Request</button> <a class="btn ghost" href="#/executive">Open Executive Exceptions</a></div></div>
    <div class="split" ${mdSwitch((sel||u.creating)?u.md:'list')}><div class="list-col">${list.length ? list.map(a => `<div class="list-item ${sel && sel.id === a.id ? 'active' : ''}" data-ref="${esc(a.id)}">
      <div class="meta">${esc(a.ref || '—')} · ${badge(a.status === 'pending' ? 'Pending' : a.status === 'approved' ? 'Approved' : 'Rejected', a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'danger' : '')}</div><h4>${esc(a.title)}</h4><div class="meta">From ${esc(a.from || '—')}</div></div>`).join('') :
      `<div class="empty"><h2>${u.view === 'pending' ? 'No pending approvals' : 'No decided approvals'}</h2><p>${u.view === 'pending' ? 'Submit a new approval request to begin.' : 'Decisions will appear here with their recorded minutes.'}</p></div>`}</div>
    <div class="detail-col panel-stack">${u.creating ? `${mdBack('Back to approvals')}<section class="panel">${createForm()}</section>` : (sel ? detail(sel) : '<section class="panel"><div class="empty"><h2>Select a request</h2><p>Choose an approval to review.</p></div></section>')}</div></div></div>`;
  el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { UIState.set('approvals', { view: b.dataset.view, selected: null, creating: false }); render(el); });
  el.querySelector('[data-new]').onclick = () => { UIState.set('approvals', { creating: true, selected: null, view: 'pending', md: 'detail' }); render(el); resetDetailScroll(el); };
  el.querySelector('[data-md-back]')?.addEventListener('click', () => { UIState.set('approvals', { md: 'list' }); render(el); });
  el.querySelectorAll('[data-ref]').forEach(c => c.onclick = () => { UIState.set('approvals', { selected: c.dataset.ref, creating: false, md: 'detail' }); render(el); resetDetailScroll(el); });
  const cancelBtn = el.querySelector('[data-cancel]'); if (cancelBtn) cancelBtn.onclick = () => { UIState.set('approvals', { creating: false }); render(el); };
  const form = el.querySelector('form.new-approval'); if (form) form.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(form));
    const rec = { id: crypto.randomUUID(), ref: d.ref || ('APR-' + Date.now()), title: d.title, from: s.profile.name, summary: d.summary, ts: new Date().toISOString(), status: 'pending' };
    executeOwnedAction('approvals', 'create-approval', () => State.patch({ approvals: [rec, ...s.approvals] }, { module: 'approvals', action: 'approval:create', ref: rec.ref }), { ref: rec.ref });
    UIState.set('approvals', { creating: false, selected: rec.id }); toast('Approval request submitted', 'success'); render(el);
  };
  ['approve', 'reject'].forEach(kind => {
    const btn = el.querySelector(`[data-${kind}]`); if (!btn) return;
    btn.onclick = async () => {
      const comment = el.querySelector('#ap-comment')?.value || ''; const signed = !!el.querySelector('#ap-sign')?.checked;
      if (kind === 'reject' && !comment.trim()) { toast('A reason is required to reject', 'error'); return; }
      if (!await confirmAction({ title: kind === 'approve' ? 'Confirm approval' : 'Confirm rejection', body: `<p><b>${esc(sel.title)}</b></p><p>Minute: ${esc(comment || '—')}</p><p>Signed: ${signed ? 'Yes' : 'No'}</p>` })) return;
      const decidedStatus = kind === 'approve' ? 'approved' : 'rejected';
      await executeOwnedAction('approvals', kind === 'approve' ? 'approve' : 'reject', () => State.patch({ approvals: s.approvals.map(a => a.id === sel.id ? { ...a, status: decidedStatus, minute: comment, signed, decidedBy: s.profile.email, decidedAt: new Date().toISOString() } : a) }, { module: 'approvals', action: kind === 'approve' ? 'approval:approve' : 'approval:reject', ref: sel.ref || sel.id }), { ref: sel.ref || sel.id });
      UIState.set('approvals', { selected: null }); toast(kind === 'approve' ? 'Approved' : 'Rejected', kind === 'approve' ? 'success' : 'error'); render(el);
    };
  });
}
function detail(a) {
  const isPending = a.status === 'pending';
  return `${mdBack('Back to approvals')}<section class="panel"><div class="eyebrow panel-eyebrow">Approval Request</div><div class="meta">${esc(a.ref || '—')} · ${badge(isPending ? 'Pending' : a.status === 'approved' ? 'Approved' : 'Rejected', a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'danger' : '')}</div><h2>${esc(a.title)}</h2>
    <p class="meta">Submitted by ${esc(a.from || '—')} · ${esc(fmtDate(a.ts))}</p>
    <p>${esc(a.summary || 'No summary provided.')}</p></section>
    ${isPending ? `<section class="panel"><div class="eyebrow panel-eyebrow">Decision</div><label class="wide">Minute<textarea id="ap-comment" rows="3" placeholder="Record a minute for this decision"></textarea></label>
    <label class="check-inline"><input type="checkbox" id="ap-sign"> Digitally sign this decision</label>
    <div class="form-row"><button class="btn" data-approve>Approve</button><button class="btn ghost" data-reject>Reject</button></div></section>`
    : `<section class="panel"><div class="eyebrow panel-eyebrow">Decision Record</div><dl class="detail-grid"><dt>Decision</dt><dd>${esc(a.status)}</dd><dt>Decided by</dt><dd>${esc(a.decidedBy || '—')}</dd><dt>Decided at</dt><dd>${esc(fmtDateTime(a.decidedAt || '') || '—')}</dd><dt>Signed</dt><dd>${a.signed ? 'Yes' : 'No'}</dd><dt>Minute</dt><dd>${esc(a.minute || '—')}</dd></dl></section>`}`;
}
function createForm() {
  return `<form class="grid new-approval"><h2 class="grid-title">New Approval Request</h2>
    <label>Reference<input name="ref"></label><label>Title<input name="title" required></label>
    <label class="wide">Summary<textarea name="summary" rows="3"></textarea></label>
    <div class="wide"><button class="btn">Submit for Approval</button> <button type="button" class="btn ghost" data-cancel>Cancel</button></div></form>`;
}
