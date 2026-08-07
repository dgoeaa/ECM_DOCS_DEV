import { hydrateGovernance } from '../core/governed-actions.js';
import { State } from '../core/state.js';
import { status } from '../core/domain.js';
import { head, esc, toast, confirmAction,fmtDate, actionPreview} from '../core/ui.js';
import { invoke } from '../core/api.js';
import { UIState } from '../core/ui-state.js';
import { statRow } from '../core/ui.js';
import { normalizeReportRows, filterByDateRange, reportSummary, exportHtmlDoc } from '../core/report-export-service.js';

const allTemplates = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10'];
let activeTemplates = new Set(['M1','M4','M6']);
let lastReportRows = [];
const today = () => new Date().toISOString().slice(0,10);
const daysAgo = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
let filters = { dgoStart: daysAgo(14), dgoEnd: today(), gtqStart: daysAgo(14), gtqEnd: today(), source:'DGO' };
function syncLocal(){const u=UIState.get('reports',{templates:[...activeTemplates],...filters});activeTemplates=new Set(u.templates);filters={dgoStart:u.dgoStart,dgoEnd:u.dgoEnd,gtqStart:u.gtqStart,gtqEnd:u.gtqEnd,source:u.source};}
const val = x => typeof x === 'object' && x ? (x.Value || x.value || '') : (x || '');
const rowDate = r => fmtDate(r.created || r.Created || r.due || r.DueDate || '');
const inRange = (r,start,end) => { const d=rowDate(r); return !d || (!start || d>=start) && (!end || d<=end); };
const normalizeRows = s => normalizeReportRows(s);
const summary = rows => reportSummary(rows);
const statCards = xs => statRow(xs,'dgo-report-kpis');
function templateButton(t){const on=activeTemplates.has(t);return `<button class="chip ${on?'active':''}" data-template="${t}" aria-pressed="${on}">${on?'✓ ':''}${t}</button>`;}
function tableRows(rows){return rows.map(r=>`<tr><td>${esc(r.title||'')}</td><td>${esc(rowDate(r))}</td><td>${esc(r.category||'')}</td><td>${esc(r.assignedTo||'')}</td><td>${esc(r.due||'')}</td><td>${esc(val(r.status)||'Pending')}</td><td>${esc(val(r.ack)||'Pending')}</td><td><a href="${esc(r.link||'#')}" target="_blank" rel="noreferrer">View</a></td></tr>`).join('') || '<tr><td colspan="8">No records for this range.</td></tr>';}
function buildTemplate(id,rows,s){const sum=summary(rows); if(id==='M1')return `<section class="report-template"><h2>Document Summary</h2><p><b>From:</b> ${esc(s.profile.name)} · <b>Department:</b> ${esc(s.profile.persona)}</p><div class="tablewrap"><table><thead><tr><th>Title</th><th>Created</th><th>Category</th><th>Assigned</th><th>Due</th><th>Status</th><th>Ack</th><th>Link</th></tr></thead><tbody>${tableRows(rows)}</tbody></table></div></section>`;
if(id==='M2')return `<section class="report-template"><h2>Management Insight</h2>${statCards([['Total',sum.total],['Completed',sum.completed],['Pending',sum.pending],['Overdue',sum.overdue]])}<p>${sum.overdue?'Immediate attention is required for overdue items.':'No overdue item is visible in the selected range.'}</p></section>`;
if(id==='M3')return `<section class="report-template compact"><h2>Minimal View</h2><div class="tablewrap"><table><thead><tr><th>Title</th><th>Progress</th><th>Acknowledgment</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(val(r.status)||'Pending')}</td><td>${esc(val(r.ack)||'Pending')}</td></tr>`).join('')||'<tr><td colspan="3">No records.</td></tr>'}</tbody></table></div></section>`;
if(['M4','M7'].includes(id))return `<section class="report-template"><h2>Activity Summary</h2><div class="tablewrap"><table><thead><tr><th>Activity</th><th>Department</th><th>Start Date</th><th>Status</th><th>Remarks</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.category)}</td><td>${esc(rowDate(r))}</td><td>${esc(val(r.status))}</td><td>${esc(r.comments)}</td></tr>`).join('')||'<tr><td colspan="5">No records.</td></tr>'}</tbody></table></div></section>`;
if(['M5','M6'].includes(id))return `<section class="report-template"><h2>${id==='M5'?'Task Table':'Progress Matrix'}</h2><div class="tablewrap"><table><thead><tr><th>Title</th><th>Date Created</th><th>Category</th><th>Assigned To</th><th>Due Date</th><th>Progress</th><th>Acknowledgment Status</th><th>Link</th></tr></thead><tbody>${tableRows(rows)}</tbody></table></div></section>`;
return `<section class="report-template extended"><h2>Extended Report ${esc(id)}</h2>${buildTemplate('M2',rows,s)}${buildTemplate('M4',rows,s)}</section>`;}
function updateRows(s){const all=normalizeRows(s); const start=filters.source==='DGO'?filters.dgoStart:filters.gtqStart; const end=filters.source==='DGO'?filters.dgoEnd:filters.gtqEnd; lastReportRows=filterByDateRange(all,start,end); return lastReportRows;}
function reportHtml(s,rows){return `<!doctype html><html><head><meta charset="utf-8"><title>NITDA Management Report</title></head><body><h1>NITDA Management Report</h1>${[...activeTemplates].map(t=>buildTemplate(t,rows,s)).join('')}</body></html>`;}
export async function mount(el){hydrateGovernance();render(el);}
function render(el){syncLocal();const s=State.get(); const rows=updateRows(s); const sum=summary(rows); el.innerHTML=`<div class="workspace">${head('Reports','NITDA management reports, GTQ/DGO date ranges and multi-template report views.')}
${statCards([['Selected Rows',sum.total],['Completed',sum.completed],['Pending',sum.pending],['Overdue',sum.overdue]])}
<section class="panel report-controls"><div class="form-row"><label>DGO From<input type="date" data-filter="dgoStart" value="${filters.dgoStart}"></label><label>DGO To<input type="date" data-filter="dgoEnd" value="${filters.dgoEnd}"></label><label>GTQ From<input type="date" data-filter="gtqStart" value="${filters.gtqStart}"></label><label>GTQ To<input type="date" data-filter="gtqEnd" value="${filters.gtqEnd}"></label><label>Source<select data-filter="source"><option>DGO</option><option>GTQ</option><option>Combined</option></select></label></div><div class="chips dgo-report-tags">${allTemplates.map(templateButton).join('')}<button class="chip" data-all>All</button><button class="chip" data-none>None</button></div><p class="meta" data-report-label>${activeTemplates.size?'PARTIAL VIEW RENDERED':'ALL CHECKBOXES ARE INACTIVE'}</p><div class="form-row"><button class="btn ghost" data-print>Print</button><button class="btn ghost" data-html>Download HTML</button><button class="btn" data-email>DGO Email</button><button class="btn" data-email-gtq>GTQ Email</button><button class="btn danger" data-email-dual>Dual Report Email</button></div></section>
<div class="panel" id="report-body"><div class="report-banner"><h2>NITDA Management Report</h2><p>DGO Digital Ops · ${esc(filters.source)} · ${esc(s.profile.email)}</p></div>${[...activeTemplates].map(t=>buildTemplate(t,rows,s)).join('')||'<div class="empty"><h2>No report view selected</h2><p>Select M1-M10 or All.</p></div>'}</div></div>`;
el.querySelector(`[data-filter="source"]`).value=filters.source; el.querySelectorAll('[data-filter]').forEach(x=>x.onchange=()=>{UIState.set('reports',{[x.dataset.filter]:x.value}); render(el);});
el.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{activeTemplates.has(b.dataset.template)?activeTemplates.delete(b.dataset.template):activeTemplates.add(b.dataset.template); UIState.set('reports',{templates:[...activeTemplates]}); render(el);});
el.querySelector('[data-all]').onclick=()=>{UIState.set('reports',{templates:[...allTemplates]}); render(el);}; el.querySelector('[data-none]').onclick=()=>{UIState.set('reports',{templates:[]}); render(el);};
el.querySelector('[data-print]').onclick=()=>rows.length?print():toast('No report data to print','error');
el.querySelector('[data-html]').onclick=()=>{if(!rows.length)return toast('No report data to download','error'); exportHtmlDoc('nitda-management-report.html','NITDA Management Report',[...activeTemplates].map(t=>buildTemplate(t,rows,s)).join(''));};
const send=async subject=>{const preview={subject,source:filters.source,rows:rows.length,templates:[...activeTemplates],recipient:s.profile.email}; if(!await confirmAction({title:'Confirm report email',body:`<p>Check who this report goes to before sending it.</p>${actionPreview(preview)}`,confirmText:'Send report',cancelText:'Cancel'}))return; try{await invoke('EMAIL',{subject,summary:summary(rows),templates:[...activeTemplates],html:reportHtml(s,rows)});toast('Report email sent','success')}catch{toast('Endpoint unavailable; report action queued locally','error')}};
el.querySelector('[data-email]').onclick=()=>send('DGO Report'); el.querySelector('[data-email-gtq]').onclick=()=>send('GTQ Report'); el.querySelector('[data-email-dual]').onclick=()=>send('Dual Report');}
