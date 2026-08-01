import { State } from '../core/state.js';

export const DesignSystem = Object.freeze({
  version: 'DGO-DS-HARMONIZED-R11.6',
  themes: ['light','dark','hc'],
  densities: ['comfortable','compact'],
  defaultTheme: 'light',
  defaultDensity: 'comfortable'
});

const themeAliases = Object.freeze({ government:'light', 'high-contrast':'hc' });
const toneMap = Object.freeze({
  // canonical tones map to the .dgo-pill--<tone> modifiers in components.css
  pending:'pending', routed:'routed', replied:'replied', reply:'replied', action:'action',
  draft:'draft', archived:'archived', archive:'archived', escalated:'escalated',
  overdue:'danger', rejected:'danger', blocked:'danger', high:'danger', urgent:'danger', critical:'danger',
  completed:'success', complete:'success', closed:'success', approved:'success', treated:'success', processed:'success', low:'success',
  returned:'warning', warning:'warning', warn:'warning', medium:'warning', 'awaiting-response':'warning', 'awaiting-ack':'warning', 'awaiting-approval':'warning',
  'not-started':'pending', assigned:'pending', 'not-assigned':'pending',
  'in-progress':'info', 'in-review':'info', 'under-review':'info', 'new':'info', processing:'info', active:'info', normal:'info'
});
const sourceMap = Object.freeze({
  'physical-scanned-documents':'physical', physical:'physical', scan:'physical', scanned:'physical',
  'customer-service-emails':'email', email:'email', emails:'email',
  'public-portal-correspondence':'portal', portal:'portal',
  'dgceo-outgoing-correspondence':'dgceo', outgoing:'dgceo', dgceo:'dgceo'
});

export function normalizeTheme(theme){ const t=themeAliases[theme]||theme||DesignSystem.defaultTheme; return DesignSystem.themes.includes(t)?t:DesignSystem.defaultTheme; }
export function normalizeDensity(density){ return DesignSystem.densities.includes(density)?density:DesignSystem.defaultDensity; }
export function getTheme(){ return normalizeTheme(State.get()?.settings?.theme); }
export function getDensity(){ return normalizeDensity(State.get()?.settings?.density); }
export function applyRootAttributes(route='home', options={}){
  const theme=normalizeTheme(options.theme || getTheme());
  const density=normalizeDensity(options.density || getDensity());
  document.documentElement.dataset.theme=theme;
  document.documentElement.dataset.density=density;
  document.body?.setAttribute('data-theme', theme);
  document.body?.setAttribute('data-density', density);
  const shell=document.querySelector('dgo-shell');
  if(shell){ shell.dataset.theme=theme; shell.dataset.density=density; shell.dataset.route=route; }
  return { theme, density, route };
}
export function setTheme(theme){ const t=normalizeTheme(theme); State.patch({settings:{...State.get().settings, theme:t}}, {module:'settings', action:'theme', event:'audit:theme-updated'}); applyRootAttributes(undefined,{theme:t}); return t; }
export function setDensity(density){ const d=normalizeDensity(density); State.patch({settings:{...State.get().settings, density:d}}, {module:'settings', action:'density', event:'audit:density-updated'}); applyRootAttributes(undefined,{density:d}); return d; }
export function nextTheme(){ const t=getTheme(); return DesignSystem.themes[(DesignSystem.themes.indexOf(t)+1)%DesignSystem.themes.length]; }
export function nextDensity(){ return getDensity()==='comfortable'?'compact':'comfortable'; }
export function shellAttrs(route, options={}){ const t=normalizeTheme(options.theme || getTheme()), d=normalizeDensity(options.density || getDensity()); return `class="dgo-shell" data-theme="${t}" data-density="${d}" data-route="${safeAttr(route||'home')}" data-navopen="${options.navOpen?'true':'false'}"`; }
export function statusClass(status){ const key=String(status||'neutral').toLowerCase().replace(/\s+/g,'-'); const tone=toneMap[key]||'neutral'; return `dgo-pill dgo-pill--${tone}`; }
export function sourceClass(sourceId){ const key=String(sourceId||'unknown').toLowerCase().replace(/\s+/g,'-'); return `dgo-source dgo-source--${sourceMap[key]||key||'unknown'}`; }
export function priorityClass(priority){ const key=String(priority||'normal').toLowerCase(); const tone=toneMap[key]||'info'; return `dgo-pill dgo-pill--${tone}`; }
export function densityClass(size){ return `dgo-density-${safeAttr(size||getDensity())}`; }
export function componentClass(name, variant='', size=''){ return ['dgo-'+safeAttr(name), variant&&'dgo-'+safeAttr(name)+'--'+safeAttr(variant), size&&'dgo-'+safeAttr(name)+'--'+safeAttr(size)].filter(Boolean).join(' '); }
export function responsiveClass(kind, state={}){ return ['dgo-rsp', 'dgo-rsp--'+safeAttr(kind), ...Object.entries(state).filter(([,v])=>!!v).map(([k])=>'is-'+safeAttr(k))].join(' '); }
export function safeLabel(value, fallback=''){ return String(value ?? fallback ?? '').trim() || String(fallback||''); }
export function safeAttr(value){ return String(value??'').replace(/[^a-zA-Z0-9_-]/g,'-'); }
export function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
export function iconButtonLabel(action, context=''){ return [action, context].filter(Boolean).join(' - '); }
export function focusMain(){ const main=document.getElementById('main') || document.querySelector('[data-outlet]'); if(main && typeof main.focus==='function') requestAnimationFrame(()=>main.focus({preventScroll:true})); }
export function announce(message, tone='info'){ const region=document.querySelector('[data-live-region]'); if(region){ region.dataset.tone=tone; region.textContent=String(message||''); } document.querySelector('dgo-shell')?.toast?.(message,tone); }
