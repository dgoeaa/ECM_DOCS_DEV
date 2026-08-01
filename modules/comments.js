import { hydrateGovernance, executeOwnedAction } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { head, esc, toast, confirmAction,fmtDateTime} from '../core/ui.js';
function scopeRef(s) {
  const a = s.activities.find(x => x.id === s.selectedId) || s.tracking.find(x => x.id === s.selectedId);
  return a ? (a.referenceId || a.id) : null;
}
export async function mount(el){hydrateGovernance();render(el); }
function render(el) {
  const s = State.get(); const ref = scopeRef(s);
  const items = ref ? s.comments.filter(c => c.referenceId === ref) : s.comments;
  el.innerHTML = `<div class="workspace">${head('Comments', ref ? `Scoped to ${ref}` : 'All comments across the workspace.')}
    <div class="toolbar"><span class="meta">${ref ? `Reference ${esc(ref)} · ${items.length} comment(s)` : `${items.length} comment(s)`}</span>
      <div>${ref ? '<button class="btn ghost" data-clear-scope>Show All</button>' : ''}<button class="btn ghost" data-refresh>Refresh</button></div></div>
    <div class="panel"><div class="thread">${items.length ? items.map(c => `<div class="msg ${c.author === s.profile.email ? 'mine' : ''}"><span class="who">${esc(c.author)} · ${esc(fmtDateTime(c.ts))} ${c.referenceId ? '· ' + esc(c.referenceId) : ''}</span>${esc(c.body)}</div>`).join('') : '<p class="meta">No comments yet.</p>'}</div>
    <form class="grid" id="comment-form">${ref ? '' : '<label class="wide">Reference ID (optional)<input name="referenceId" placeholder="e.g. REF-001"></label>'}
      <label class="wide">Comment<textarea name="body" rows="3" required></textarea></label>
      <div class="wide"><button class="btn">Post Comment</button></div></form></div></div>`;
  const clearBtn = el.querySelector('[data-clear-scope]'); if (clearBtn) clearBtn.onclick = () => { State.patch({ selectedId: null }); render(el); };
  el.querySelector('[data-refresh]').onclick = () => render(el);
  el.querySelector('#comment-form').onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
    const referenceId = ref || d.referenceId || '';
    if (!await confirmAction({ title: 'Confirm comment', body: `<p>${esc(d.body)}</p>${referenceId ? `<p>Reference: ${esc(referenceId)}</p>` : ''}` })) return;
    await executeOwnedAction('comments', 'add-comment', () => State.patch({ comments: [...s.comments, { id: crypto.randomUUID(), referenceId, body: d.body, author: s.profile.email, ts: new Date().toISOString(), type: 'comment' }] }, { module: 'comments', action: 'comment:add', ref: referenceId }), { ref: referenceId });
    toast('Comment added', 'success'); render(el);
  };
}
