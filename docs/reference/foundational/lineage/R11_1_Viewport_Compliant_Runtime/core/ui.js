export const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export const head = (title, subtitle, eyebrow='DGO DIGITAL OPS · A NITDA PLATFORM') => `<header class="pagehead"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div></header>`;
export const kpis = xs => `<div class="kpis">${xs.map(x=>`<div class="kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div>`;
export const toast = (m,t='') => document.querySelector('dgo-shell')?.toast(m,t);
export const confirmAction = o => document.querySelector('dgo-shell')?.confirm(o);
