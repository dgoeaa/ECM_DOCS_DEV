// Projects — ported from the ECM Activity Hub under decision D6(b).
//
// The lightest of the three: a register of projects with an owner, a status and a KPI note.
// A list with an update, not a workflow, which is why it has no lifecycle guard — only an
// allow-listed patch. The Activity Hub spread an arbitrary object onto the record
// (`{...p, ...patch}`), so a caller could overwrite `id` or invent fields; the service
// refuses both.

import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, kpis, esc, badge, toast, confirmAction, fmtDateTime, mdBack, mdSwitch, resetDetailScroll } from '../core/ui.js';
import { UIState, pageSlice, pager } from '../core/ui-state.js';
import { audit } from '../core/enterprise-domain.js';
import { invoke } from '../core/api.js';
import { debouncedInput } from '../core/ui-interactions.js';
import { Projects, ProjectStates } from '../core/executive-register.js';

export async function mount(el) { hydrateGovernance(); render(el); }

function render(el) {
  const s = State.get();
  const u = UIState.get('projects', { q: '', status: 'All', page: 1, size: 20, selected: null, md: 'list', creating: false, editing: false });
  const all = s.projects || [];
  const rows = all
    .filter(x => u.status === 'All' || x.status === u.status)
    .filter(x => !u.q || [x.name, x.owner, x.kpi].some(v => String(v || '').toLowerCase().includes(u.q.toLowerCase())));
  const p = pageSlice(rows, u.page, u.size);
  const sel = all.find(x => x.id === u.selected);

  el.innerHTML = `<div class="workspace">
    ${head('Projects', 'Register of projects with an accountable owner, a status and the measure they are tracked against.')}
    ${kpis([
      ['Total', all.length],
      ['Active', all.filter(x => x.status === 'Active').length],
      ['On hold', all.filter(x => x.status === 'On Hold').length],
      ['Completed', all.filter(x => x.status === 'Completed').length],
    ])}
    <div class="toolbar">
      <input data-q value="${esc(u.q)}" placeholder="Search name, owner or measure">
      <select data-status><option>All</option>${ProjectStates.map(x => `<option>${esc(x)}</option>`).join('')}</select>
      <button class="btn" data-new>New project</button>
    </div>
    ${u.creating ? projectForm('New project', {}) : ''}
    <div class="split" ${mdSwitch(sel ? u.md : 'list')}>
      <div><div class="list-col">${p.rows.map(x => `
        <article class="list-item ${x.id === sel?.id ? 'active' : ''}" data-select="${esc(x.id)}">
          <div>${badge(x.status)}</div>
          <h4>${esc(x.name)}</h4>
          <div class="meta">${esc(x.owner || 'No owner')}${x.kpi ? ' · ' + esc(x.kpi) : ''}</div>
        </article>`).join('') || '<div class="empty">No projects in this view.</div>'}</div>${pager(p)}</div>
      <div class="detail-col panel-stack">${sel ? detail(sel, u) : '<section class="panel"><p class="meta">Select a project to open it.</p></section>'}</div>
    </div>
  </div>`;

  bind(el, s, u, all, sel);
}

function projectForm(heading, v, marker = 'data-create-form') {
  return `<section class="panel"><form class="grid" ${marker}>
    <h3 class="wide">${esc(heading)}</h3>
    <label class="wide">Name *<input name="name" required value="${esc(v.name || '')}"></label>
    <label>Owner<input name="owner" value="${esc(v.owner || '')}" placeholder="Defaults to you"></label>
    <label>Status<select name="status">${ProjectStates.map(x => `<option ${x === v.status ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="wide">Measure / KPI<input name="kpi" value="${esc(v.kpi || '')}" placeholder="How progress is judged"></label>
    <div class="wide form-row"><button class="btn">Save</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
  </form></section>`;
}

function detail(x, u) {
  return `${mdBack('Back to projects')}
  <section class="panel">
    <div class="eyebrow panel-eyebrow">Project</div>
    <div class="status-strip">${badge(x.status)}</div>
    <h2>${esc(x.name)}</h2>
    <dl class="detail-grid">
      <dt>Owner</dt><dd>${esc(x.owner || '—')}</dd>
      <dt>Measure</dt><dd>${esc(x.kpi || '—')}</dd>
      <dt>Created</dt><dd>${esc(fmtDateTime(x.createdAt))}</dd>
      <dt>Last updated</dt><dd>${esc(fmtDateTime(x.updatedAt))}</dd>
    </dl>
    <div class="form-row"><button type="button" class="btn ghost" data-edit-toggle>${u.editing ? 'Close' : 'Update project'}</button></div>
  </section>
  ${u.editing ? projectForm('Update project', x, 'data-edit-form') : ''}`;
}

function bind(el, s, u, all, sel) {
  const st = el.querySelector('[data-status]'); if (st) { st.value = u.status; st.onchange = e => { UIState.set('projects', { status: e.target.value, page: 1 }); render(el); }; }
  debouncedInput(el.querySelector('[data-q]'), v => { UIState.set('projects', { q: v, page: 1 }); render(el); }, { refind: () => el.querySelector('[data-q]') });
  el.querySelectorAll('[data-select]').forEach(x => x.onclick = () => { UIState.set('projects', { selected: x.dataset.select, md: 'detail', editing: false }); render(el); resetDetailScroll(el); });
  el.querySelector('[data-md-back]')?.addEventListener('click', () => { UIState.set('projects', { md: 'list' }); render(el); });
  el.querySelectorAll('[data-page]').forEach(x => x.onclick = () => { UIState.set('projects', { page: +x.dataset.page }); render(el); });
  el.querySelector('[data-new]')?.addEventListener('click', () => { UIState.set('projects', { creating: true }); render(el); });
  el.querySelector('[data-edit-toggle]')?.addEventListener('click', () => { UIState.set('projects', { editing: !u.editing }); render(el); });
  el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { UIState.set('projects', { creating: false, editing: false }); render(el); });

  el.querySelector('[data-create-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    let project;
    try { project = Projects.create(d, s.profile.email); }
    catch (err) { return toast(err.reason === 'missing_name' ? 'A project needs a name' : err.message, 'error'); }
    if (!await confirmAction({ title: 'Add this project', body: `<p>${esc(project.name)}</p><p class="meta">${esc(project.status)} · ${esc(project.owner || 'no owner')}</p>` })) return;

    await executeOwnedAction('projects', 'create-project', () => {
      State.patch({
        projects: [project, ...all],
        audit: [audit('Project Added', 'project', project.id, { name: project.name }, s.profile.email), ...s.audit],
      }, { module: 'projects', action: 'projects:create', ref: project.id });
      invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Projects', data: project })
        .catch(() => toast('Saved locally; synchronization queued', 'error'));
    }, { ref: project.id });

    UIState.set('projects', { creating: false, selected: project.id, md: 'detail' });
    toast('Project added', 'success');
    render(el);
  });

  el.querySelector('[data-edit-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    let next;
    try { next = Projects.update(sel, d); }
    catch (err) { return toast(err.reason === 'missing_name' ? 'A project needs a name' : err.message, 'error'); }
    if (!await confirmAction({ title: 'Update this project', body: `<p>${esc(next.name)}</p><p class="meta">${esc(next.status)} · ${esc(next.owner || 'no owner')}</p>` })) return;

    await executeOwnedAction('projects', 'update-project', () => {
      State.patch({
        projects: all.map(x => x.id === sel.id ? next : x),
        audit: [audit('Project Updated', 'project', sel.id, { status: next.status }, s.profile.email), ...s.audit],
      }, { module: 'projects', action: 'projects:update', ref: sel.id });
      invoke('DYNAMIC_ACTIONS', { action: 'upsert_record', module: 'DGCEO_Projects', data: next })
        .catch(() => toast('Updated locally; synchronization queued', 'error'));
    }, { ref: sel.id });

    UIState.set('projects', { editing: false });
    toast('Project updated', 'success');
    render(el);
  });
}
