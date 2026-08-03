// Briefs & Submissions — ported from the ECM Activity Hub under decision D6(b).
//
// An executive briefing pack: drafted by an officer, submitted for decision, approved or
// rejected. The lifecycle guard lives in core/executive-register.js so it is testable
// without a browser; this module is the workspace over it.
//
// The decide action is offered only on a SUBMITTED brief, and the underlying service refuses
// an illegal transition regardless — the Activity Hub applied any decision to any record, so
// a rejected brief could be re-decided and a draft approved without ever being submitted.

import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, kpis, esc, badge, toast, confirmAction, fmtDateTime, mdBack, mdSwitch, resetDetailScroll } from '../core/ui.js';
import { UIState, pageSlice, pager } from '../core/ui-state.js';
import { audit } from '../core/enterprise-domain.js';
import { invoke } from '../core/api.js';
import { debouncedInput } from '../core/ui-interactions.js';
import { Briefs, BriefStates } from '../core/executive-register.js';

const THEMES = ['Digital Public Infrastructure', 'Cybersecurity', 'Innovation',
                'Capacity Building', 'Regulatory'];

export async function mount(el) { hydrateGovernance(); render(el); }

function render(el) {
  const s = State.get();
  const u = UIState.get('briefs', { q: '', status: 'All', page: 1, size: 20, selected: null, md: 'list', creating: false, deciding: '' });
  const all = s.briefs || [];
  const rows = all
    .filter(b => u.status === 'All' || b.status === u.status)
    .filter(b => !u.q || [b.title, b.theme, b.summary, b.raisedBy].some(v => String(v || '').toLowerCase().includes(u.q.toLowerCase())));
  const p = pageSlice(rows, u.page, u.size);
  const sel = all.find(b => b.id === u.selected);

  el.innerHTML = `<div class="workspace">
    ${head('Briefs & Submissions', 'Brief packs for decisions and ministerial submissions. Drafted, submitted, then approved or rejected.')}
    ${kpis([
      ['Total', all.length],
      ['Draft', all.filter(b => b.status === 'Draft').length],
      ['Awaiting decision', all.filter(b => b.status === 'Submitted').length],
      ['Approved', all.filter(b => b.status === 'Approved').length],
    ])}
    <div class="toolbar">
      <input data-q value="${esc(u.q)}" placeholder="Search title, theme, summary or author">
      <select data-status><option>All</option>${BriefStates.map(x => `<option>${esc(x)}</option>`).join('')}</select>
      <button class="btn" data-new>New brief</button>
    </div>
    ${u.creating ? createForm() : ''}
    <div class="split" ${mdSwitch(sel ? u.md : 'list')}>
      <div><div class="list-col">${p.rows.map(b => `
        <article class="list-item ${b.id === sel?.id ? 'active' : ''}" data-select="${esc(b.id)}">
          <div>${badge(b.status)}</div>
          <h4>${esc(b.title)}</h4>
          <div class="meta">${esc(b.theme || 'No theme')} · ${esc(b.raisedBy || 'Unattributed')}</div>
        </article>`).join('') || '<div class="empty">No briefs in this queue.</div>'}</div>${pager(p)}</div>
      <div class="detail-col panel-stack">${sel ? detail(sel, u) : '<section class="panel"><p class="meta">Select a brief to read it.</p></section>'}</div>
    </div>
  </div>`;

  bind(el, s, u, all, sel);
}

function createForm() {
  return `<section class="panel"><form class="grid" data-create-form>
    <h3 class="wide">New brief</h3>
    <label class="wide">Title *<input name="title" required placeholder="What the brief is about"></label>
    <label>Theme<select name="theme">${THEMES.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
    <label class="wide">Summary<textarea name="summary" rows="3" placeholder="The decision being asked for, in a sentence or two."></textarea></label>
    <label class="wide">Background<textarea name="background" rows="3"></textarea></label>
    <label class="wide">Options considered<textarea name="options" rows="3"></textarea></label>
    <label class="wide">Risks<textarea name="risks" rows="2"></textarea></label>
    <label class="wide">Recommendation<textarea name="recommendation" rows="2"></textarea></label>
    <div class="wide form-row"><button class="btn">Save as draft</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
  </form></section>`;
}

function detail(b, u) {
  const next = Briefs.nextStates(b);
  const field = (label, value) => value
    ? `<div class="dgo-stack dgo-stack--2"><span class="eyebrow">${label}</span><p>${esc(value)}</p></div>` : '';
  return `${mdBack('Back to briefs')}
  <section class="panel">
    <div class="eyebrow panel-eyebrow">Brief</div>
    <div class="status-strip">${badge(b.status)}${b.theme ? badge(b.theme) : ''}</div>
    <h2>${esc(b.title)}</h2>
    <dl class="detail-grid">
      <dt>Raised by</dt><dd>${esc(b.raisedBy || '—')}</dd>
      <dt>Created</dt><dd>${esc(fmtDateTime(b.createdAt))}</dd>
      ${b.submittedAt ? `<dt>Submitted</dt><dd>${esc(fmtDateTime(b.submittedAt))} by ${esc(b.submittedBy || '—')}</dd>` : ''}
      ${b.decidedAt ? `<dt>Decided</dt><dd>${esc(fmtDateTime(b.decidedAt))} by ${esc(b.decidedBy || '—')}</dd>` : ''}
    </dl>
    <div class="form-row">
      ${next.includes('Submitted') ? '<button type="button" class="btn" data-to="Submitted">Submit for decision</button>' : ''}
      ${next.includes('Approved') ? '<button type="button" class="btn" data-to="Approved">Approve</button>' : ''}
      ${next.includes('Rejected') ? '<button type="button" class="btn ghost" data-to="Rejected" style="color:var(--dgo-color-action-danger)">Reject</button>' : ''}
      ${next.length ? '' : '<p class="meta">This brief is closed. No further decision is possible.</p>'}
    </div>
  </section>
  ${u.deciding ? `<section class="panel"><form class="grid" data-decide-form>
    <h3 class="wide">${u.deciding === 'Approved' ? 'Approve' : 'Reject'} this brief</h3>
    <label class="wide">Decision note<textarea name="comments" rows="3" placeholder="What was decided, and why."></textarea></label>
    <div class="wide form-row"><button class="btn">Record decision</button><button type="button" class="btn ghost" data-decide-cancel>Cancel</button></div>
  </form></section>` : ''}
  <section class="panel">
    ${field('Summary', b.summary)}${field('Background', b.background)}
    ${field('Options considered', b.options)}${field('Risks', b.risks)}
    ${field('Recommendation', b.recommendation)}
    ${b.decisionComments ? field('Decision note', b.decisionComments) : ''}
  </section>`;
}

function bind(el, s, u, all, sel) {
  const st = el.querySelector('[data-status]'); if (st) { st.value = u.status; st.onchange = e => { UIState.set('briefs', { status: e.target.value, page: 1 }); render(el); }; }
  debouncedInput(el.querySelector('[data-q]'), v => { UIState.set('briefs', { q: v, page: 1 }); render(el); }, { refind: () => el.querySelector('[data-q]') });
  el.querySelectorAll('[data-select]').forEach(x => x.onclick = () => { UIState.set('briefs', { selected: x.dataset.select, md: 'detail' }); render(el); resetDetailScroll(el); });
  el.querySelector('[data-md-back]')?.addEventListener('click', () => { UIState.set('briefs', { md: 'list' }); render(el); });
  el.querySelectorAll('[data-page]').forEach(x => x.onclick = () => { UIState.set('briefs', { page: +x.dataset.page }); render(el); });
  el.querySelector('[data-new]')?.addEventListener('click', () => { UIState.set('briefs', { creating: true }); render(el); });
  el.querySelector('[data-cancel]')?.addEventListener('click', () => { UIState.set('briefs', { creating: false }); render(el); });

  el.querySelector('[data-create-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    let brief;
    try { brief = Briefs.create(d, s.profile.email); }
    catch (err) { return toast(err.reason === 'missing_title' ? 'A brief needs a title' : err.message, 'error'); }
    if (!await confirmAction({ title: 'Save this brief as a draft', body: `<p>${esc(brief.title)}</p>` })) return;

    await executeOwnedAction('briefs', 'create-brief', () => {
      State.patch({
        briefs: [brief, ...all],
        audit: [audit('Brief Created', 'brief', brief.id, { title: brief.title }, s.profile.email), ...s.audit],
      }, { module: 'briefs', action: 'briefs:create', ref: brief.id });
      invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Briefs', data: brief })
        .catch(() => toast('Saved locally; synchronization queued', 'error'));
    }, { ref: brief.id });

    UIState.set('briefs', { creating: false, selected: brief.id, md: 'detail' });
    toast('Brief saved as a draft', 'success');
    render(el);
  });

  el.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
    // Submitting needs no note; a decision does, so it opens the inline form instead.
    if (b.dataset.to === 'Submitted') return apply(el, s, all, sel, 'Submitted', '');
    UIState.set('briefs', { deciding: b.dataset.to });
    render(el);
  });
  el.querySelector('[data-decide-cancel]')?.addEventListener('click', () => { UIState.set('briefs', { deciding: '' }); render(el); });
  el.querySelector('[data-decide-form]')?.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    apply(el, s, all, sel, u.deciding, d.comments || '');
  });
}

async function apply(el, s, all, sel, to, comments) {
  const label = to === 'Submitted' ? 'Submit this brief for decision'
              : `${to === 'Approved' ? 'Approve' : 'Reject'} this brief`;
  if (!await confirmAction({
    title: label,
    body: `<p>${esc(sel.title)}</p>` + (to === 'Submitted'
      ? '<p class="meta">It moves to the decision queue and can no longer be edited.</p>'
      : (comments ? `<p class="meta">${esc(comments)}</p>` : '<p class="meta">No decision note was given.</p>')),
  })) return;

  let next;
  try {
    next = Briefs.transition(sel, to, { comments, by: s.profile.email });
  } catch (err) {
    // The service is the authority on what is legal, not the buttons this page rendered.
    return toast(err.reason === 'illegal_transition'
      ? 'That is not a legal step for this brief' : err.message, 'error');
  }

  await executeOwnedAction('briefs', to === 'Submitted' ? 'submit-brief' : 'decide-brief', () => {
    State.patch({
      briefs: all.map(b => b.id === sel.id ? next : b),
      audit: [audit(`Brief ${to}`, 'brief', sel.id, { from: sel.status, to }, s.profile.email), ...s.audit],
    }, { module: 'briefs', action: `briefs:${to.toLowerCase()}`, ref: sel.id });
    invoke('DYNAMIC_ACTIONS', { action: 'transition_status', module: 'DGCEO_Briefs', ref: sel.id, status: to })
      .catch(() => toast('Recorded locally; synchronization queued', 'error'));
  }, { ref: sel.id });

  UIState.set('briefs', { deciding: '' });
  toast(`Brief ${to.toLowerCase()}`, 'success');
  render(el);
}
