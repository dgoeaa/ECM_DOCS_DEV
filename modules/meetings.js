// Meetings — ported from the ECM Activity Hub under decision D6(b).
//
// A meeting request, approved or declined, whose agreed actions become ordinary tasks in
// the platform's `operations` collection.
//
// The conversion is the reason this capability is worth porting at all. In the Activity Hub
// it was a remote call and nothing else: with no backend configured it toasted "No backend
// conversion; create tasks manually". Here the conversion happens locally and the tasks are
// real records, so the capability works whether or not a backend answers.

import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, kpis, esc, badge, toast, confirmAction, fmtDateTime, mdBack, mdSwitch, resetDetailScroll } from '../core/ui.js';
import { UIState, pageSlice, pager } from '../core/ui-state.js';
import { audit } from '../core/enterprise-domain.js';
import { invoke } from '../core/api.js';
import { debouncedInput } from '../core/ui-interactions.js';
import { Meetings, MeetingStates } from '../core/executive-register.js';

const LOCATIONS = ['Virtual', 'DG Conference Room', 'Boardroom', 'External venue'];

export async function mount(el) { hydrateGovernance(); render(el); }

function render(el) {
  const s = State.get();
  const u = UIState.get('meetings', { q: '', status: 'All', page: 1, size: 20, selected: null, md: 'list', creating: false, deciding: '', converting: false });
  const all = s.meetings || [];
  const rows = all
    .filter(m => u.status === 'All' || m.status === u.status)
    .filter(m => !u.q || [m.title, m.requestor, m.agenda, m.location].some(v => String(v || '').toLowerCase().includes(u.q.toLowerCase())));
  const p = pageSlice(rows, u.page, u.size);
  const sel = all.find(m => m.id === u.selected);

  el.innerHTML = `<div class="workspace">
    ${head('Meetings', 'Meeting requests, their approval, and the conversion of agreed actions into tracked tasks.')}
    ${kpis([
      ['Total', all.length],
      ['Awaiting decision', all.filter(m => m.status === 'Requested').length],
      ['Approved', all.filter(m => m.status === 'Approved').length],
      ['Held', all.filter(m => m.status === 'Held').length],
    ])}
    <div class="toolbar">
      <input data-q value="${esc(u.q)}" placeholder="Search title, requestor, agenda or location">
      <select data-status><option>All</option>${MeetingStates.map(x => `<option>${esc(x)}</option>`).join('')}</select>
      <button class="btn" data-new>Request a meeting</button>
    </div>
    ${u.creating ? createForm() : ''}
    <div class="split" ${mdSwitch(sel ? u.md : 'list')}>
      <div><div class="list-col">${p.rows.map(m => `
        <article class="list-item ${m.id === sel?.id ? 'active' : ''}" data-select="${esc(m.id)}">
          <div>${badge(m.status)}</div>
          <h4>${esc(m.title)}</h4>
          <div class="meta">${esc(m.date)}${m.time ? ' · ' + esc(m.time) : ''} · ${esc(m.location)}</div>
        </article>`).join('') || '<div class="empty">No meetings in this queue.</div>'}</div>${pager(p)}</div>
      <div class="detail-col panel-stack">${sel ? detail(sel, u, s) : '<section class="panel"><p class="meta">Select a meeting to open it.</p></section>'}</div>
    </div>
  </div>`;

  bind(el, s, u, all, sel);
}

function createForm() {
  return `<section class="panel"><form class="grid" data-create-form>
    <h3 class="wide">Request a meeting</h3>
    <label class="wide">Title *<input name="title" required placeholder="What the meeting is for"></label>
    <label>Date *<input name="date" type="date" required></label>
    <label>Time<input name="time" type="time"></label>
    <label>Location<select name="location">${LOCATIONS.map(l => `<option>${esc(l)}</option>`).join('')}</select></label>
    <label>Requestor<input name="requestor" placeholder="Defaults to you"></label>
    <label class="wide">Agenda<textarea name="agenda" rows="3"></textarea></label>
    <label class="wide">Attendees<textarea name="attendees" rows="2" placeholder="One per line, or comma separated."></textarea></label>
    <div class="wide form-row"><button class="btn">Submit request</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
  </form></section>`;
}

function detail(m, u, s) {
  const next = Meetings.nextStates(m);
  const converted = (s.operations || []).filter(t => t.referenceId === m.id && t.source === 'meeting');
  return `${mdBack('Back to meetings')}
  <section class="panel">
    <div class="eyebrow panel-eyebrow">Meeting</div>
    <div class="status-strip">${badge(m.status)}</div>
    <h2>${esc(m.title)}</h2>
    <dl class="detail-grid">
      <dt>When</dt><dd>${esc(m.date)}${m.time ? ' at ' + esc(m.time) : ''}</dd>
      <dt>Where</dt><dd>${esc(m.location)}</dd>
      <dt>Requested by</dt><dd>${esc(m.requestor || '—')}</dd>
      <dt>Logged</dt><dd>${esc(fmtDateTime(m.createdAt))}</dd>
      ${m.decidedAt ? `<dt>Decided</dt><dd>${esc(fmtDateTime(m.decidedAt))} by ${esc(m.decidedBy || '—')}</dd>` : ''}
      ${m.attendees ? `<dt>Attendees</dt><dd>${esc(m.attendees)}</dd>` : ''}
      ${m.agenda ? `<dt>Agenda</dt><dd>${esc(m.agenda)}</dd>` : ''}
    </dl>
    <div class="form-row">
      ${next.includes('Approved') ? '<button type="button" class="btn" data-to="Approved">Approve</button>' : ''}
      ${next.includes('Declined') ? '<button type="button" class="btn ghost" data-to="Declined" style="color:var(--dgo-color-action-danger)">Decline</button>' : ''}
      ${next.includes('Held') ? '<button type="button" class="btn" data-to="Held">Mark as held</button>' : ''}
      ${m.status === 'Approved' || m.status === 'Held' ? `<button type="button" class="btn ghost" data-convert-toggle>${u.converting ? 'Close' : 'Record agreed actions'}</button>` : ''}
      ${next.length || m.status === 'Held' ? '' : '<p class="meta">This request is closed.</p>'}
    </div>
    ${m.decisionComments ? `<p class="meta">${esc(m.decisionComments)}</p>` : ''}
  </section>
  ${u.deciding ? `<section class="panel"><form class="grid" data-decide-form>
    <h3 class="wide">${u.deciding === 'Approved' ? 'Approve' : 'Decline'} this request</h3>
    <label class="wide">Decision note<textarea name="comments" rows="3"></textarea></label>
    <div class="wide form-row"><button class="btn">Record decision</button><button type="button" class="btn ghost" data-decide-cancel>Cancel</button></div>
  </form></section>` : ''}
  ${u.converting ? `<section class="panel"><form class="grid" data-convert-form>
    <h3 class="wide">Agreed actions</h3>
    <label class="wide">One action per line<textarea name="actions" rows="5" required placeholder="Draft the policy note&#10;Circulate the minutes"></textarea></label>
    <label>Due date<input name="dueDate" type="date"></label>
    <div class="wide form-row"><button class="btn">Create tasks</button><button type="button" class="btn ghost" data-convert-cancel>Cancel</button></div>
    <p class="wide meta">Each line becomes a task in <b>My Work / Departmental Work</b>, linked back to this meeting.</p>
  </form></section>` : ''}
  ${converted.length ? `<section class="panel">
    <h3>Tasks from this meeting</h3>
    <ul class="timeline">${converted.map(t => `<li><b>${esc(t.title)}</b><div class="meta">${badge(t.status)}${t.dueDate ? ' · due ' + esc(t.dueDate) : ''}</div></li>`).join('')}</ul>
  </section>` : ''}`;
}

function bind(el, s, u, all, sel) {
  const st = el.querySelector('[data-status]'); if (st) { st.value = u.status; st.onchange = e => { UIState.set('meetings', { status: e.target.value, page: 1 }); render(el); }; }
  debouncedInput(el.querySelector('[data-q]'), v => { UIState.set('meetings', { q: v, page: 1 }); render(el); }, { refind: () => el.querySelector('[data-q]') });
  el.querySelectorAll('[data-select]').forEach(x => x.onclick = () => { UIState.set('meetings', { selected: x.dataset.select, md: 'detail' }); render(el); resetDetailScroll(el); });
  el.querySelector('[data-md-back]')?.addEventListener('click', () => { UIState.set('meetings', { md: 'list' }); render(el); });
  el.querySelectorAll('[data-page]').forEach(x => x.onclick = () => { UIState.set('meetings', { page: +x.dataset.page }); render(el); });
  el.querySelector('[data-new]')?.addEventListener('click', () => { UIState.set('meetings', { creating: true }); render(el); });
  el.querySelector('[data-cancel]')?.addEventListener('click', () => { UIState.set('meetings', { creating: false }); render(el); });
  el.querySelector('[data-convert-toggle]')?.addEventListener('click', () => { UIState.set('meetings', { converting: !u.converting }); render(el); });
  el.querySelector('[data-convert-cancel]')?.addEventListener('click', () => { UIState.set('meetings', { converting: false }); render(el); });

  el.querySelector('[data-create-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    let meeting;
    try { meeting = Meetings.create(d, s.profile.email); }
    catch (err) { return toast(err.reason === 'missing_date' ? 'A meeting needs a date' : 'A meeting needs a title', 'error'); }
    if (!await confirmAction({ title: 'Log this meeting request', body: `<p>${esc(meeting.title)}</p><p class="meta">${esc(meeting.date)} · ${esc(meeting.location)}</p>` })) return;

    await executeOwnedAction('meetings', 'request-meeting', () => {
      State.patch({
        meetings: [meeting, ...all],
        audit: [audit('Meeting Requested', 'meeting', meeting.id, { title: meeting.title }, s.profile.email), ...s.audit],
      }, { module: 'meetings', action: 'meetings:request', ref: meeting.id });
      invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Meetings', data: meeting })
        .catch(() => toast('Saved locally; synchronization queued', 'error'));
    }, { ref: meeting.id });

    UIState.set('meetings', { creating: false, selected: meeting.id, md: 'detail' });
    toast('Meeting request logged', 'success');
    render(el);
  });

  el.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
    // Marking held needs no note; a decision does, so it opens the inline form instead.
    if (b.dataset.to === 'Held') return apply(el, s, all, sel, 'Held', '');
    UIState.set('meetings', { deciding: b.dataset.to });
    render(el);
  });
  el.querySelector('[data-decide-cancel]')?.addEventListener('click', () => { UIState.set('meetings', { deciding: '' }); render(el); });
  el.querySelector('[data-decide-form]')?.addEventListener('submit', e => {
    e.preventDefault();
    apply(el, s, all, sel, u.deciding, Object.fromEntries(new FormData(e.target)).comments || '');
  });

  el.querySelector('[data-convert-form]')?.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    convert(el, s, sel, d.actions, d.dueDate);
  });
}

async function apply(el, s, all, sel, to, comments) {
  const verb = { Approved: 'Approve', Declined: 'Decline', Held: 'Mark as held' }[to] || to;
  if (!await confirmAction({ title: `${verb} this meeting`, body: `<p>${esc(sel.title)}</p>` })) return;

  let next;
  try {
    next = Meetings.transition(sel, to, { comments, by: s.profile.email });
  } catch (err) {
    return toast(err.reason === 'illegal_transition'
      ? 'That is not a legal step for this meeting' : err.message, 'error');
  }

  await executeOwnedAction('meetings', 'decide-meeting', () => {
    State.patch({
      meetings: all.map(m => m.id === sel.id ? next : m),
      audit: [audit(`Meeting ${to}`, 'meeting', sel.id, { from: sel.status, to }, s.profile.email), ...s.audit],
    }, { module: 'meetings', action: `meetings:${to.toLowerCase()}`, ref: sel.id });
    invoke('DYNAMIC_ACTIONS', { action: 'transition_status', module: 'DGCEO_Meetings', ref: sel.id, status: to })
      .catch(() => toast('Recorded locally; synchronization queued', 'error'));
  }, { ref: sel.id });

  UIState.set('meetings', { deciding: '' });
  toast(`Meeting ${to.toLowerCase()}`, 'success');
  render(el);
}

async function convert(el, s, sel, actions, dueDate) {
  let tasks;
  try { tasks = Meetings.actionsToTasks(sel, actions, { by: s.profile.email, dueDate }); }
  catch (err) { return toast(err.reason === 'no_actions' ? 'Enter at least one action' : err.message, 'error'); }

  if (!await confirmAction({
    title: `Create ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
    body: `<ul>${tasks.map(t => `<li>${esc(t.title)}</li>`).join('')}</ul>`,
  })) return;

  // The tasks are ordinary operations records, not a parallel kind of work — they appear in
  // My Work alongside everything else and are tracked the same way.
  await executeOwnedAction('meetings', 'meeting-actions-to-tasks', () => {
    State.patch({
      operations: [...tasks, ...(s.operations || [])],
      audit: [audit('Meeting Actions Converted', 'meeting', sel.id, { tasks: tasks.length }, s.profile.email), ...s.audit],
    }, { module: 'meetings', action: 'meetings:actions-to-tasks', ref: sel.id });
    for (const t of tasks) {
      invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Tasks', data: t })
        .catch(() => toast('Created locally; synchronization queued', 'error'));
    }
  }, { ref: sel.id });

  UIState.set('meetings', { converting: false });
  toast(`${tasks.length} task${tasks.length === 1 ? '' : 's'} created`, 'success');
  render(el);
}
