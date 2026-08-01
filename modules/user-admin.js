import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, esc, toast, confirmAction } from '../core/ui.js';
import { UIState } from '../core/ui-state.js';
import { RoleList, RolePersonaMap } from '../config/rbac.config.js';
import { capRows, RenderBudget } from '../core/render-budget.js';
import { getCurrentUser, canManageUsers, normalizeEmail, roleToPersona } from '../core/current-user.js';
import { invoke } from '../core/api.js';
import { PendingQueue } from '../core/pending-queue.js';
export async function mount(el){hydrateGovernance();render(el); }
const split=x=>String(x||'').split(',').map(s=>s.trim()).filter(Boolean);
async function persistUserMutation(operation,user){
  try{ await invoke('DYNAMIC_ACTIONS',{operation:'user-admin:'+operation,module:'user-admin',user}); }
  catch(e){ PendingQueue.enqueue({key:'DYNAMIC_ACTIONS',operation:'user-admin:'+operation,payload:{user},ref:user.email,error:e.message,retryable:true,queueType:'user-admin'}); }
}
function userForm(editing, actor){
  const role=editing?.role||'viewer', persona=editing?.persona||RolePersonaMap[role]||roleToPersona(role);
  return `<form class="grid" id="ua-form">
    <label>Full Name<input name="fullName" value="${esc(editing?.fullName || '')}" required></label>
    <label>Email<input name="email" type="email" value="${esc(editing?.email || '')}" required></label>
    <label>Directorate / DSU<input name="directorate" value="${esc(editing?.directorate || '')}"></label>
    <label>Department<input name="department" value="${esc(editing?.department || '')}"></label>
    <label>Unit<input name="unit" value="${esc(editing?.unit || '')}"></label>
    <label>Job Title<input name="jobTitle" value="${esc(editing?.jobTitle || '')}"></label>
    <label>Phone / Support Contact<input name="phone" value="${esc(editing?.phone || '')}"></label>
    <label>Pilot Cohort<input name="pilotCohort" value="${esc(editing?.pilotCohort || '')}" placeholder="Cohort 1"></label>
    <label>Role<select name="role">${RoleList.map(r => `<option value="${r.id}" ${role === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></label>
    <label>Persona<select name="persona">${Object.entries(RolePersonaMap).map(([,p])=>p).filter((v,i,a)=>a.indexOf(v)===i).map(p=>`<option value="${p}" ${persona===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    <label>Status<select name="status"><option value="active" ${editing?.status !== 'disabled' ? 'selected' : ''}>Active</option><option value="disabled" ${editing?.status === 'disabled' ? 'selected' : ''}>Disabled</option></select></label>
    <label class="wide">Access Scope<input name="accessScope" value="${esc((editing?.accessScope||[]).join?.(', ') || editing?.accessScope || '')}" placeholder="all, Registry, Operations"></label>
    <label class="wide">Disabled Reason<input name="disabledReason" value="${esc(editing?.disabledReason || '')}" placeholder="Required when disabling directly"></label>
    <div class="wide"><button class="btn">${editing ? 'Update User' : 'Create User'}</button> <button type="button" class="btn ghost" data-clear>Clear Form</button><p class="meta">Admin actor: ${esc(actor.fullName||actor.email)} · ${esc(actor.role)} · ${esc(actor.status)}</p></div>
  </form>`;
}
function render(el) {
  const s = State.get(); const users = s.users||[];
  const actor=getCurrentUser(s);
  if(!canManageUsers(actor)){ el.innerHTML=`<div class="workspace">${head('User Administration')}<section class="panel"><div class="empty"><h2>Access denied</h2><p>Your current enrolled role cannot administer pilot users.</p></div></section></div>`; return; }
  const u = UIState.get('user-admin', { editing: null });
  const editing = users.find(x => x.id === u.editing) || null;
  el.innerHTML = `<div class="workspace">${head('User Administration', 'Manage pilot users, roles, access status and RBAC capability assignments.')}
    <div class="split user-admin-split"><div class="detail-col panel">
      <div class="eyebrow panel-eyebrow">Pilot User Enrollment</div>
      ${userForm(editing, actor)}</div>
    <div class="panel"><div class="eyebrow panel-eyebrow">Users and Assignments</div>
      ${users.length ? `<div class="tablewrap dgo-table-wrap"><table class="dgo-table"><thead><tr><th>Name</th><th>Email</th><th>Directorate</th><th>Role</th><th>Persona</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${capRows(users, RenderBudget.tableRows).map(x => `<tr class="${editing?.id === x.id ? 'row-active' : ''}"><td>${esc(x.fullName || '—')}</td><td>${esc(x.email)}</td><td>${esc(x.directorate || '—')}</td><td>${esc(RoleList.find(r => r.id === x.role)?.label || x.role)}</td><td>${esc(x.persona||RolePersonaMap[x.role]||'general')}</td><td><span class="pill ${x.status === 'disabled' ? 'danger' : 'ok'}">${esc(x.status||'active')}</span></td>
        <td><button class="btn ghost compact" data-edit="${esc(x.id)}">Edit</button> <button class="btn ghost compact" data-disable="${esc(x.id)}" ${x.status === 'disabled' ? 'disabled' : ''}>Disable</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty"><h2>No users configured</h2><p>Create the first pilot user with the form.</p></div>'}
      </div></div>
    <div class="panel stack-panel"><div class="eyebrow panel-eyebrow">Role Capability Matrix</div>
      ${RoleList.map(r => `<details class="role-details"><summary><b>${esc(r.label)}</b> · ${r.permissions.length} permission(s) · persona ${esc(RolePersonaMap[r.id]||roleToPersona(r.id))}</summary>
        <div class="chips">${r.permissions.length ? r.permissions.map(p => `<span class="chip">${esc(p)}</span>`).join('') : '<span class="chip">read-only / no elevated permissions</span>'}</div></details>`).join('')}
    </div></div>`;
  const form=el.querySelector('#ua-form');
  form.onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
    if (!d.email.includes('@')) { toast('Enter a valid email address', 'error'); return; }
    const previous=editing||{}; const email=normalizeEmail(d.email);
    const rec = { id: editing?.id || crypto.randomUUID(), fullName: d.fullName.trim(), email, directorate: d.directorate.trim(), department:d.department.trim(), unit:d.unit.trim(), jobTitle:d.jobTitle.trim(), phone:d.phone.trim(), role: d.role, persona: d.persona || RolePersonaMap[d.role] || roleToPersona(d.role), status: d.status, accessScope: split(d.accessScope), pilotCohort:d.pilotCohort.trim(), disabledReason:d.status==='disabled'?d.disabledReason.trim():'', createdAt: editing?.createdAt || new Date().toISOString(), createdBy: editing?.createdBy || actor.email, updatedAt:new Date().toISOString(), updatedBy:actor.email };
    const list = editing ? users.map(x => x.id === rec.id ? rec : x) : [...users, rec];
    const roleChanged=editing && (previous.role!==rec.role || previous.persona!==rec.persona);
    const action = editing ? (roleChanged ? 'assign-role' : 'update-user') : 'create-user';
    if(roleChanged && !await confirmAction({title:'Assign new pilot role',body:`<p>${esc(rec.fullName)} will change from <b>${esc(previous.role||'none')}</b> to <b>${esc(rec.role)}</b>.</p>`,confirmText:'Assign role',cancelText:'Cancel'})) return;
    await executeOwnedAction('user-admin', action, async () => { State.patch({ users: list }, { module: 'user-admin', action: 'user:'+action, ref: rec.email, event: action==='assign-role'?'audit:user-role-assigned':undefined }); await persistUserMutation(action, rec); }, { ref: rec.email, meta:{previousRole:previous.role||'',newRole:rec.role,previousPersona:previous.persona||'',newPersona:rec.persona} });
    UIState.set('user-admin', { editing: null }); toast((editing?'Saved ':'Created ')+rec.email, 'success'); render(el);
  };
  el.querySelector('[data-clear]').onclick = () => { UIState.set('user-admin', { editing: null }); render(el); };
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { UIState.set('user-admin', { editing: b.dataset.edit }); render(el); });
  el.querySelectorAll('[data-disable]').forEach(b => b.onclick = async () => {
    const x = users.find(y => y.id === b.dataset.disable); if (!x) return;
    if (!await confirmAction({ title: 'Disable pilot user', body: `<p>Revoke platform access for <b>${esc(x.fullName || x.email)}</b>?</p><p>This immediately blocks route and action access where the user is the current profile.</p>`, confirmText:'Disable user', cancelText:'Cancel' })) return;
    const row={...x,status:'disabled',disabledReason:'Disabled by '+actor.email,updatedAt:new Date().toISOString(),updatedBy:actor.email};
    await executeOwnedAction('user-admin', 'disable-user', async () => { State.patch({ users: users.map(y => y.id === x.id ? row : y) }, { module: 'user-admin', action: 'user:disable', ref: x.email }); await persistUserMutation('disable-user', row); }, { ref: x.email });
    toast('Disabled ' + x.email, 'error'); render(el);
  });
}
