export const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const jsonEsc = s => String(s).replace(/[&<>]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
const labelize = k => String(k).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();
function flattenPreview(obj, prefix=''){ const out={}; for(const [k,v] of Object.entries(obj||{})){ if(v===null||v===undefined||v==='') continue; if(Array.isArray(v)){ if(v.length) out[prefix+labelize(k)]=v.every(x=>typeof x!=='object')?v.join(', '):`${v.length} item(s)`; } else if(typeof v==='object'){ Object.assign(out, flattenPreview(v, prefix+labelize(k)+' · ')); } else out[prefix+labelize(k)]=v; } return out; }
// Shared governed-action preview: a readable label→value summary of `data` plus a collapsible raw
// payload. Replaces raw <pre>JSON</pre> dumps in confirmation dialogs across every module.
export function actionPreview(data={}, opts={}){
  const flat=flattenPreview(data);
  const rows=Object.entries(flat).map(([k,v])=>`<div class="preview-row"><span class="preview-k">${esc(k)}</span><span class="preview-v">${esc(String(v))}</span></div>`).join('');
  const list=rows?`<div class="preview-list">${rows}</div>`:'';
  const payload=opts.payload!==undefined?opts.payload:data;
  const tech=payload===false?'':`<details class="preview-details"><summary>Technical payload</summary><pre class="preview-box">${jsonEsc(JSON.stringify(payload,null,2))}</pre></details>`;
  return `<div class="assignment-preview">${list}${tech}</div>`;
}
// The visible intro block (eyebrow/title/subtitle) is intentionally suppressed to reclaim
// vertical space — the module name is already shown in the top bar. A single visually-hidden
// <h1> is retained so every workspace exposes exactly one programmatic heading for screen
// readers / heading navigation without any visual footprint.
export const head = (title, _subtitle, _eyebrow) => title ? `<h1 class="dgo-visually-hidden">${esc(title)}</h1>` : '';
// Sanctioned stat-row builder for non-dashboard workspaces (dashboards use kpis()).
export const statRow = (xs, cls='') => `<div class="stat-row ${cls}">${xs.map(x=>`<div class="kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('')}</div>`;
export const fmtDate = v => String(v??'').slice(0,10);
export const fmtDateTime = v => String(v??'').slice(0,16).replace('T',' ');
export const kpis = xs => `<div class="kpis dgo-dashboard__metrics">${xs.map(x=>`<div class="kpi dgo-metric"><small class="dgo-metric__label">${esc(x[0])}</small><b class="dgo-metric__value">${esc(x[1])}</b></div>`).join('')}</div>`;
export const toast = (m,t='') => document.querySelector('dgo-shell')?.toast(m,t);
function normalizeConfirmOptions(o){return typeof o==='string'?{title:'Confirm action',body:o}:o;}
export const confirmAction = async o => { const shell=typeof document!=='undefined'?document.querySelector('dgo-shell'):null; if(!shell?.confirm) return true; return shell.confirm(normalizeConfirmOptions(o)); };
const _pillTone = (text, passed) => {
  const k=String(text||'').toLowerCase().replace(/\s+/g,'-');
  const map={ 'not-started':'pending','not-assigned':'pending',assigned:'pending',pending:'pending',
    'in-progress':'info','in-review':'info','under-review':'info','new':'info',processing:'info',active:'info',normal:'info',
    completed:'success',complete:'success',closed:'success',approved:'success',treated:'success',processed:'success',low:'success',
    'awaiting-response':'warning','awaiting-ack':'warning','awaiting-approval':'warning',returned:'warning',warning:'warning',medium:'warning',
    overdue:'danger',rejected:'danger',blocked:'danger',high:'danger',urgent:'danger',critical:'danger',
    escalated:'escalated',routed:'routed',replied:'replied',draft:'draft',archived:'archived' };
  const passedMap={warn:'warning',ok:'success',success:'success',danger:'danger',error:'danger',info:'info'};
  return map[k] || passedMap[String(passed||'').toLowerCase()] || '';
};
export const badge = (text, tone='') => { const t=_pillTone(text,tone); return `<span class="dgo-pill${t?` dgo-pill--${t}`:''}">${esc(text)}</span>`; };
export const emptyState = (title, body) => `<div class="empty dgo-empty"><h2 class="dgo-empty__title">${esc(title)}</h2><p>${esc(body)}</p></div>`;
/* I-13 — one empty-state contract. "No official records found." states a fact and stops: it
   does not say whether the cause is an active filter, an empty queue or a failed load, and
   it offers nothing to do. During an offline audit every list was empty for the same reason
   — no data had loaded — and no empty state said so, so an operator would conclude the queue
   was clear when the platform had failed to reach its data. Three distinct causes, each with
   one action. */
export const emptyFor = ({filtered=false, failed=false, loaded=true, noun='records', createLabel='', createAttr='', clearAttr='data-clear-filters'} = {}) => {
  const act = (label, attr) => label && attr ? `<p><button type="button" class="btn" ${attr}>${esc(label)}</button></p>` : '';
  if (failed) return `<div class="empty dgo-empty"><h2 class="dgo-empty__title">Could not load ${esc(noun)}</h2><p>The registry could not be reached, so this list is not showing what is there. It is not empty.</p>${act('Try again','data-retry-load')}</div>`;
  if (filtered) return `<div class="empty dgo-empty"><h2 class="dgo-empty__title">No ${esc(noun)} match these filters</h2><p>There are ${esc(noun)} here, but none match what you have filtered to.</p>${act('Clear filters', clearAttr)}</div>`;
  if (!loaded) return `<div class="empty dgo-empty"><h2 class="dgo-empty__title">No ${esc(noun)} loaded yet</h2><p>Nothing has been loaded from the registry in this session.</p>${act('Load now','data-retry-load')}</div>`;
  return `<div class="empty dgo-empty"><h2 class="dgo-empty__title">No ${esc(noun)} yet</h2><p>Nothing has been recorded here.</p>${act(createLabel, createAttr)}</div>`;
};
export const chips = (items, active, attr='data-chip') => `<div class="chips">${items.map(i=>`<button type="button" class="chip dgo-chip ${i.value===active?'active':''}" ${attr}="${esc(i.value)}">${esc(i.label)}</button>`).join('')}</div>`;
export const table = (cols, rows, rowAttr) => rows.length
  ? `<div class="tablewrap dgo-table-wrap"><table class="dgo-table"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr ${rowAttr?rowAttr(r):''}>${cols.map(c=>`<td>${c.render?c.render(r):esc(r[c.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : emptyState('No records', 'Nothing to show for the current filter.');
export const listItem = (r, active, title, meta, id) => `<div class="list-item dgo-card ${active?'active':''}" data-ref="${esc(id)}"><h4>${esc(title)}</h4><div class="meta">${esc(meta)}</div></div>`;

// R11.6.2 master-detail view switching. On narrow viewports a data-md split shows one
// view at a time; mdBack() renders the portrait-only return control, mdSwitch() computes
// the attribute, and resetDetailScroll() pins the detail pane back to its top whenever a
// new row is selected (each pane is an independent scroll region on desktop).
export const mdBack = (label='Back to list') => `<button type="button" class="btn ghost md-back" data-md-back>← ${esc(label)}</button>`;
export const mdSwitch = view => `data-md="${view==='detail'?'detail':'list'}"`;
export const resetDetailScroll = el => { const d=el?.querySelector?.('[data-md]>*:last-child'); if(d&&typeof d.scrollTo==='function')d.scrollTo(0,0); };
export const resetWorkspaceScroll = () => { const m=typeof document!=='undefined'?document.querySelector('main'):null; if(m)m.scrollTop=0; };

export const authorityCard = (role, owns=[], excludes=[]) => `<section class="panel boundary-note"><div class="eyebrow">Module Authority</div><p><b>${esc(role)}</b></p><p class="meta">Owns: ${esc((owns||[]).join(', '))}</p><p class="meta">Does not own: ${esc((excludes||[]).join(', '))}</p></section>`;


// Figma UI/UX implementation helper aliases. Existing helpers remain authoritative;
// these helpers provide new module-ready surfaces without breaking imports.
export function figmaHead(title, subtitle='', eyebrow='DGO Digital Ops'){
  return `<section class="panel dgo-workspace-header"><div><div class="eyebrow panel-eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${subtitle?`<p class="meta">${esc(subtitle)}</p>`:''}</div></section>`;
}
export function figmaStatBand(items=[]){
  return `<section class="dgo-stat-band">${items.map(([label,value,note])=>`<article class="dgo-stat"><span class="dgo-stat__label">${esc(label)}</span><strong class="dgo-stat__value">${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</article>`).join('')}</section>`;
}
export function figmaToolbar(inner=''){ return `<section class="dgo-toolbar">${inner}</section>`; }
export function figmaEmpty(title='Nothing here yet', body='Records will appear here when available.'){ return `<section class="dgo-empty"><h2>${esc(title)}</h2><p>${esc(body)}</p></section>`; }
