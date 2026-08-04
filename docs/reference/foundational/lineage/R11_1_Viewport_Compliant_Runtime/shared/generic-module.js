import { State } from '../core/state.js';
import { head, esc } from '../core/ui.js';
export const generic = (title, subtitle) => async el => { const s=State.get(); el.innerHTML=`<div class="workspace">${head(title,subtitle)}<div class="panel"><p class="module-intro">This workspace is connected to the shared reference-keyed fabric.</p>${s.tracking.slice(0,12).map(x=>`<p class="data-line"><b>${esc(x.referenceId||'—')}</b><span>${esc(x.title)}</span><small>${esc(x.status)}</small></p>`).join('')||'<div class="empty"><p>No records yet.</p></div>'}</div></div>`; };
