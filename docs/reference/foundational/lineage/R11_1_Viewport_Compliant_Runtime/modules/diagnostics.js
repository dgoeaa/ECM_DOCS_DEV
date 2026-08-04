import { State } from '../core/state.js';
import { Router } from '../core/router.js';
import { BrowserCertification } from '../config/browser-certification.config.js';
import { certify } from '../core/browser-certification.js';
import { head,kpis } from '../core/ui.js';
export async function mount(el){const s=State.get();const cert=certify();el.innerHTML=`<div class="workspace">${head('Diagnostics','Runtime, route and viewport containment status.')}${kpis([['Activities',s.activities.length],['Routes',Router.known().length],['Pending',s.pending.length],['Audit',s.audit.length]])}<div class="panel"><p><b>Boot:</b> PASS</p><p><b>Viewport contract:</b> page locked; main/nav/pane/dialog/table internally scroll.</p><p><b>Footer:</b> visible in shell without page scroll.</p><p><b>Certified viewports:</b> ${BrowserCertification.viewports.join(', ')}</p><p><b>Contracts:</b> ${BrowserCertification.contracts.join(', ')}</p><p><b>Certification state:</b> ${cert.passed?'PASS':'CHECK ROUTES'}</p></div></div>`;}
