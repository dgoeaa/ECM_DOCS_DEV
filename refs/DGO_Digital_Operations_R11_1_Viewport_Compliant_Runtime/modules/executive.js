import { State } from '../core/state.js';
import { head,kpis } from '../core/ui.js';
export async function mount(el){const s=State.get();el.innerHTML=`<div class="workspace">${head("Executive Dashboard","Executive Dashboard workspace.")}${kpis([['Activities',s.activities.length],['Tasks',s.tracking.length],['Pending',s.pending.length],['Audit',s.audit.length]])}<div class="panel"><p>Summary indicators are shown because this is a dashboard or monitoring module.</p></div></div>`;}
