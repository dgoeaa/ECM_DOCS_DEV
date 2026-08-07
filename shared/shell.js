import { Routes } from '../config/routes.config.js';
import { NavGroups } from '../config/nav.config.js';
import { VisibleWorkspaces, HiddenTechnicalRoutes, workspaceGuide } from '../config/workflow-clarity.config.js';
import { State } from '../core/state.js';
import { createFocusTrap } from '../core/focus-trap.js';
import { Router } from '../core/router.js';
import { fmtDateTime } from '../core/ui.js';
import { setTheme, setDensity, nextTheme, nextDensity, applyRootAttributes, escapeHtml as esc, normalizeTheme, normalizeDensity } from './design-system-adapter.js';
import { CommandPalette, ToastHost } from './components.js';
import { installAccessibilityShortcuts, afterRouteChange } from './accessibility.js';
import { allWorkspaceCommands, guideFor } from './workspace-guide.js';
import { canCurrentUserAccess, personaLabel } from '../core/current-user.js';
import { NotificationCenter } from '../core/notification-center.js';

/* H-02 / V-06 — the internal platform had no icon set. Navigation, top-bar actions and
   source filters were drawn with Unicode typographic characters rendered in whatever glyph
   the user's system font happened to provide: 21 distinct symbols plus six bare ASCII
   letters standing in for icons (R, ∑, E, O, D, U), two routes sharing ▣, and "Email Desk"
   falling through to the '•' default because it had no entry at all. Glyph icons vary by
   operating system, sit off the text baseline, cannot be sized or coloured reliably, and
   carry no shared meaning.
   The portal already shipped a proper SVG sprite. It is now shipped with both packages and
   every route and action maps to a real symbol — 29 routes, 29 distinct icons. */
const I = Object.freeze({
  home:'i-home','ecm-erp-charter':'i-shield',activities:'i-grid',correspondence:'i-mail',
  orchestrator:'i-user','response-tracking':'i-eye','single-assignment':'i-id',
  'bulk-assignment':'i-filter',fasttrack:'i-clock',approvals:'i-check',
  acknowledgment:'i-bell',dispatch:'i-send','scan-intake':'i-upload',registry:'i-folder',
  briefs:'i-file',meetings:'i-calendar',projects:'i-building',comments:'i-chat',
  reports:'i-download',statistics:'i-chart',executive:'i-check-circle',assistant:'i-sparkle',
  lookup:'i-search','operator-hud':'i-info',settings:'i-settings',diagnostics:'i-alert',
  'user-admin':'i-users',archive:'i-lock','correspondence-email':'i-external'
});
const icon = (name, cls='dgo-icon') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${name||'i-info'}"></use></svg>`;
const routeIcon = route => icon(I[route] || 'i-file');

// The sidebar collapses to an off-canvas drawer at this width (see the `@media (max-width:900px)`
// block in styles/app.css that parks `.dgo-sidebar` at translateX(-100%)). Kept in sync by hand:
// the two have to agree or the drawer is either inert while visible, or tabbable while hidden.
const NAV_DRAWER_MAX = 900;

// Guarded: the custom element is only declared/registered in a browser, so this module is
// safely importable in non-browser (diagnostic) contexts without a ReferenceError.
if (typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
class Shell extends HTMLElement{
  connectedCallback(){ this._installed=false; this.render(); this._off=State.on(()=>this.refreshIdentityAndNav()); Router.start(); if(!this._installed){ installAccessibilityShortcuts(this); this._installed=true; } }
  disconnectedCallback(){ this._off?.(); this._offFeed?.(); }
  render(){
    const s=State.get(); const route=Router.path(); const theme=normalizeTheme(s.settings.theme); const density=normalizeDensity(s.settings.density); applyRootAttributes(route,{theme,density});
    this.innerHTML=`<div class="dgo-ministry-bar">Federal Ministry of Communications, Innovation & Digital Economy</div>
    <div class="dgo-shell-grid" data-shell-grid>
      <aside class="dgo-sidebar" aria-label="Primary navigation" data-nav>
        <div class="dgo-brand-lockup"><img src="assets/dgo-mark.svg" alt="" aria-hidden="true"><span><b>DG<span>O</span> Digital Ops</b><small>An Initiative of NITDA</small></span></div>
        <nav class="dgo-sidebar__nav">${this.navHtml()}</nav>
        <div class="dgo-sidebar__identity"><b data-name>${esc(s.profile.name)}</b><small data-role>${esc(personaLabel(s.profile.persona))} · ${esc(s.profile.email)}</small></div>
      </aside>
      <section class="dgo-workarea">
        <header class="dgo-topbar">
          <button type="button" class="dgo-iconbtn dgo-hamburger" data-menu aria-label="Toggle navigation">${icon('i-menu')}</button>
          <div class="dgo-route-title"><small data-eyebrow>ACTIVE WORKSPACE</small><b data-context>${esc(this.routeLabel(route))}</b></div>
          <div class="dgo-topbar__spacer"></div>
          <button type="button" class="dgo-search-trigger" data-palette aria-label="Search and command palette">${icon('i-search')}<span>Search references, tasks, people...</span><kbd>Ctrl K</kbd></button>
          <button type="button" class="dgo-iconbtn" data-guide aria-label="Workspace guide" title="Workspace guide">${icon('i-help')}</button>
          <button type="button" class="dgo-iconbtn" data-sync aria-label="Synchronize data" title="Synchronize data">${icon('i-refresh')}</button>
          <button type="button" class="dgo-iconbtn" data-density aria-label="Toggle density" title="Density: ${esc(density)}">${icon('i-chevron-down')}</button>
          <button type="button" class="dgo-iconbtn" data-theme aria-label="Switch theme" title="Theme: ${esc(theme)}">${icon('i-globe')}</button>
          <button type="button" class="dgo-iconbtn dgo-notify-trigger" data-notify-open aria-label="Activity and notifications" title="Activity" aria-haspopup="dialog" aria-expanded="false">${icon('i-bell')}<span class="dgo-notify-badge" data-notify-badge hidden></span></button>
          <button type="button" class="dgo-persona-button" data-persona aria-haspopup="menu" aria-expanded="false"><span class="dgo-avatar">${esc((s.profile.name||'R').slice(0,1).toUpperCase())}</span><span><b>${esc(s.profile.name)}</b><small>${esc(personaLabel(s.profile.persona))}</small></span></button>
        </header>
        <main id="main" class="dgo-main dgo-scroll" data-outlet tabindex="-1"></main>
        ${/* I-01 — the twenty guided routes are declared as handoffs of a visible workspace
             but had no link anywhere in the shell, so the only way to reach them was the
             command palette or a typed hash. This strip renders the current workspace's
             declared handoffs as links. It does not decide which of the twenty belong in
             the sidebar — that is the agency's triage — but it does mean no built screen
             is reachable only by knowing its URL. */''}
        <nav class="dgo-related" data-related aria-label="Related workspaces" hidden></nav>
        <footer class="dgo-footer"><span>DGO Digital Operations</span><small>Governed runtime · ${esc(fmtDateTime(new Date().toISOString()))}</small></footer>
      </section>
    </div>
    <div class="dgo-scrim" data-scrim hidden></div>
    <div class="dgo-live-region" aria-live="polite" data-live-region></div>
    ${ToastHost()}${CommandPalette()}${this.notifyPanelHtml()}`;
    this.bind(); this.active(route); this.watchNavBreakpoint(); this.syncNavInert(); this.syncNavScrollHint(); addEventListener('resize',()=>this.syncNavScrollHint());
  }
  navHtml(){ return NavGroups.map(g=>{ const routes=VisibleWorkspaces.filter(w=>g.routes.includes(w.route)).map(w=>Routes.find(r=>r.path===w.route)).filter(r=>r&&canCurrentUserAccess(r.path)); if(!routes.length) return ''; return `<div class="dgo-nav-group"><div class="dgo-nav-group__label">${esc(g.group)}</div>${routes.map(r=>`<a class="dgo-sidebar__item" href="#/${r.path}" data-route="${esc(r.path)}" title="${esc(r.label)}"><span class="dgo-nav-icon">${routeIcon(r.path)}</span><span>${esc(r.label)}</span></a>`).join('')}</div>`; }).join(''); }
  bind(){
    this.querySelector('[data-menu]')?.addEventListener('click',()=>this.toggleNav());
    this.querySelector('[data-scrim]')?.addEventListener('click',()=>this.closeNav());
    this.querySelector('[data-theme]')?.addEventListener('click',()=>{ const t=setTheme(nextTheme()); this.toast(`Theme set to ${t}`,'success'); });
    this.querySelector('[data-density]')?.addEventListener('click',()=>{ const d=setDensity(nextDensity()); this.toast(`Density set to ${d}`,'success'); });
    this.querySelector('[data-palette]')?.addEventListener('click',()=>this.openCommandPalette());
    this.querySelector('[data-guide]')?.addEventListener('click',()=>this.showGuide());
    this.querySelector('[data-sync]')?.addEventListener('click',()=>{ State.patch({runtime:{...State.get().runtime,lastLoad:new Date().toISOString()}},{module:'shell',action:'sync',event:'audit:sync-requested'}); this.toast('Synchronization requested','info'); });
    this.querySelectorAll('.dgo-sidebar__item').forEach(a=>a.addEventListener('click',()=>this.closeNav()));
    this.querySelector('[data-command-close]')?.addEventListener('click',()=>this.closeCommandPalette());
    this.querySelector('[data-command-input]')?.addEventListener('input',e=>this.renderCommandResults(e.target.value));
    this.querySelector('[data-notify-open]')?.addEventListener('click',()=>this.toggleNotifications());
    this.querySelector('[data-notify-close]')?.addEventListener('click',()=>this.closeNotifications());
    this.querySelector('[data-notify-clear]')?.addEventListener('click',()=>{ NotificationCenter.clear(); this.announce('Activity history cleared'); });
    this._offFeed?.(); this._offFeed=NotificationCenter.subscribe(()=>this.renderNotifications());
    this.renderNotifications();
  }

  /* ── Durable feedback surface (finding 03) ─────────────────────────────────────────
     The toast remains the at-a-glance signal; this is where it goes afterwards, so an
     outcome the user did not happen to be looking at is still recoverable. */
  notifyPanelHtml(){
    return `<div class="dgo-notify-panel" data-notify-panel hidden>
      <section role="dialog" aria-modal="false" aria-label="Activity and notifications">
        <header>
          <h2>Activity</h2>
          <div>
            <button type="button" class="dgo-btn dgo-btn--secondary dgo-btn--sm" data-notify-clear>Clear all</button>
            <button type="button" class="dgo-iconbtn" data-notify-close aria-label="Close activity">&times;</button>
          </div>
        </header>
        <ol data-notify-list></ol>
      </section>
    </div>`;
  }
  renderNotifications(){
    const badge=this.querySelector('[data-notify-badge]');
    const list=this.querySelector('[data-notify-list]');
    const items=NotificationCenter.all();
    const unread=NotificationCenter.unreadCount();
    if(badge){ badge.hidden=unread===0; badge.textContent=unread>99?'99+':String(unread); }
    const trigger=this.querySelector('[data-notify-open]');
    if(trigger) trigger.setAttribute('aria-label',unread?`Activity and notifications, ${unread} unread`:'Activity and notifications');
    if(!list) return;
    list.innerHTML = items.length
      ? items.map(r=>`<li class="dgo-notify-item dgo-notify-item--${esc(r.tone)}${r.read?'':' is-unread'}">
          <div>
            <p>${esc(r.message)}</p>
            <small>${esc(fmtDateTime(r.at))}${r.module?` &middot; ${esc(r.module)}`:''}${r.ref?` &middot; ${esc(r.ref)}`:''}</small>
          </div>
          <button type="button" class="dgo-iconbtn" data-notify-dismiss="${esc(r.id)}" aria-label="Dismiss: ${esc(r.message)}">&times;</button>
        </li>`).join('')
      : '<li class="dgo-notify-empty">Nothing yet. Actions you take, and anything that fails, will be recorded here.</li>';
    list.querySelectorAll('[data-notify-dismiss]').forEach(b=>b.addEventListener('click',()=>NotificationCenter.dismiss(b.dataset.notifyDismiss)));
  }
  toggleNotifications(){ this.querySelector('[data-notify-panel]')?.hidden ? this.openNotifications() : this.closeNotifications(); }
  openNotifications(){
    const panel=this.querySelector('[data-notify-panel]'); if(!panel) return;
    panel.hidden=false;
    this.querySelector('[data-notify-open]')?.setAttribute('aria-expanded','true');
    NotificationCenter.markAllRead();
    this.renderNotifications();
    panel._releaseTrap=createFocusTrap(panel,{onEscape:()=>this.closeNotifications()});
    requestAnimationFrame(()=>panel.querySelector('button')?.focus());
  }
  closeNotifications(){
    const panel=this.querySelector('[data-notify-panel]'); if(!panel||panel.hidden) return;
    panel._releaseTrap?.(); panel._releaseTrap=null;
    panel.hidden=true;
    const trigger=this.querySelector('[data-notify-open]');
    trigger?.setAttribute('aria-expanded','false');
    trigger?.focus();
  }
  announce(message){ const live=this.querySelector('[data-live-region]'); if(live) live.textContent=String(message||''); }
  toggleNav(){ const open=this.dataset.navopen==='true'; this.dataset.navopen=open?'false':'true'; this.querySelector('[data-scrim]').hidden=open; this.syncNavInert(); }
  closeNav(){ this.dataset.navopen='false'; const s=this.querySelector('[data-scrim]'); if(s) s.hidden=true; this.syncNavInert(); }
  // Below the drawer breakpoint the sidebar is parked off-canvas with translateX(-100%), which
  // hides it visually but leaves every link tabbable: keyboard users land on invisible controls
  // they cannot scroll into view. `inert` removes the subtree from both the tab order and the
  // accessibility tree while it is closed. It must be scoped to the drawer layout — above the
  // breakpoint the sidebar is permanently visible, and marking it inert would strip primary
  // navigation from keyboard and screen-reader users entirely.
  syncNavInert(){
    const nav=this.querySelector('[data-nav]'); if(!nav) return;
    const drawer=typeof matchMedia==='function' && matchMedia(`(max-width:${NAV_DRAWER_MAX}px)`).matches;
    nav.inert = drawer && this.dataset.navopen!=='true';
  }
  watchNavBreakpoint(){
    if(this._navQuery || typeof matchMedia!=='function') return;
    this._navQuery=matchMedia(`(max-width:${NAV_DRAWER_MAX}px)`);
    this._navQuery.addEventListener('change',()=>this.syncNavInert());
  }
  // Keyboard-accessible modal focus management: trap Tab within an open surface and return focus to
  // the opener on close. Dialogs additionally own an Escape handler that settles their own
  // dismissal contract (see dialog()/confirm()).
  _trapFocus(surface){
    // Single shared implementation so dialogs, drawers, the command palette and the
    // welcome/OTP overlay all deliver the same keyboard contract.
    createFocusTrap(surface);
  }
  // A dialog that carries a pending promise (confirm) must be dismissed through its own
  // _dismiss() so the awaiting governed action is cancelled rather than stranded.
  closeTransientSurfaces(){ this.closeNav(); this.closeCommandPalette(); this.querySelectorAll('[data-dialog]').forEach(d=>{ if(d._dismiss){ d._dismiss(); return; } d._releaseTrap?.(); d.remove(); }); }
  active(route){ applyRootAttributes(route); this.querySelectorAll('.dgo-sidebar__item').forEach(a=>{ const on=a.dataset.route===route; a.classList.toggle('active',on); if(on)a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }); const ctx=this.querySelector('[data-context]'); if(ctx)ctx.textContent=this.routeLabel(route); const mainEl=this.querySelector('#main'); if(mainEl)mainEl.setAttribute('aria-label',this.routeLabel(route)); this.renderRelated(route); this.applyTitle(route); afterRouteChange(); }
  routeLabel(route){ return Routes.find(r=>r.path===route)?.label || route || 'Command Center'; }
  // I-17 — the tab title names the screen, matching the portal's own pattern
  // ("Track a request — NITDA Intelligent Portal"). It used to be one static string on
  // every screen, and that string was the internal release codename and design-system
  // version: "R11.6 Obsidian Harmonized Design System Runtime". A tab title is how a user
  // finds the right window among ten.
  applyTitle(route){ document.title=`${this.routeLabel(route)} — DGO Digital Operations`; }
  // I-10 — mark the nav as scrollable only when it actually overflows, so the fade at the
  // boundary is a signal that there is more below rather than permanent decoration.
  syncNavScrollHint(){
    const nav=this.querySelector('.dgo-sidebar__nav'); if(!nav) return;
    nav.dataset.scrollable=String(nav.scrollHeight>nav.clientHeight+1);
  }
  // I-01 — render the current workspace's declared handoffs as links.
  renderRelated(route){
    const host=this.querySelector('[data-related]'); if(!host) return;
    const g=guideFor(route);
    const targets=(g?.handoffs||[]).filter(p=>p!==route&&Routes.some(r=>r.path===p)&&canCurrentUserAccess(p));
    if(!targets.length){ host.hidden=true; host.innerHTML=''; return; }
    host.hidden=false;
    host.innerHTML=`<span class="dgo-related__label">Continue in</span>${targets.map(p=>`<a class="dgo-related__link" href="#/${esc(p)}">${routeIcon(p)}${esc(this.routeLabel(p))}</a>`).join('')}`;
  }
  refreshIdentityAndNav(){ const s=State.get(); const n=this.querySelector('[data-name]'), r=this.querySelector('[data-role]'); if(n)n.textContent=s.profile.name; if(r)r.textContent=`${personaLabel(s.profile.persona)} · ${s.profile.email}`; applyRootAttributes(Router.path()); }
  openCommandPalette(){ const p=this.querySelector('[data-command-palette]'); if(!p)return; p.hidden=false; this.renderCommandResults(''); this._trapFocus(p); requestAnimationFrame(()=>this.querySelector('[data-command-input]')?.focus()); }
  closeCommandPalette(){ const p=this.querySelector('[data-command-palette]'); if(p){ p.hidden=true; p._releaseTrap?.(); } }
  renderCommandResults(q=''){ const box=this.querySelector('[data-command-results]'); if(!box)return; const query=String(q).toLowerCase(); const items=allWorkspaceCommands().filter(c=>canCurrentUserAccess(c.route)).filter(c=>!query || `${c.label} ${c.route} ${c.purpose}`.toLowerCase().includes(query)).slice(0,20); box.innerHTML=items.map(c=>`<button type="button" role="option" class="dgo-cmdk__item" data-open-route="${esc(c.route)}"><span class="dgo-cmdk__icon">${routeIcon(c.route)}</span><span><b>${esc(c.label)}</b><small>${esc(c.primary?'Workspace':(c.visibleThrough||'Contextual'))}</small></span></button>`).join('') || '<div class="dgo-cmdk__empty">No matching workspace.</div>'; box.querySelectorAll('[data-open-route]').forEach(b=>b.addEventListener('click',()=>{Router.go(b.dataset.openRoute); this.closeCommandPalette();})); }
  showGuide(){ const route=Router.path(); const g=guideFor(route); const title=g?.label || this.routeLabel(route); const body=`<p>${esc(g?.purpose || g?.reason || 'This workspace is governed by the DGO operating model.')}</p>${g?.owns?`<p><b>Owns:</b> ${esc(g.owns.join(', '))}</p>`:''}${g?.handoffs?`<p><b>Handoffs:</b> ${esc(g.handoffs.join(', '))}</p>`:''}`; this.dialog(title, body); }
  /* The transient half of the feedback channel. Every toast is also written to the
     notification centre before it is shown, so the 4200ms timeout below decides only how
     long the message stays in front of the user — never whether it survives at all. */
  toast(message,tone='info',meta={}){
    NotificationCenter.push(message,tone,meta);
    const host=this.querySelector('[data-toast-host]'); if(!host)return;
    const node=document.createElement('div'); node.className=`dgo-toast dgo-toast--${tone}`; node.textContent=String(message||'');
    host.appendChild(node); setTimeout(()=>node.remove(),4200);
  }
  dialog(title, body){ const wrap=document.createElement('div'); wrap.className='dgo-dialog-backdrop'; wrap.dataset.dialog='guide'; wrap.innerHTML=`<section class="dgo-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" class="dgo-iconbtn" data-dialog-close aria-label="Close dialog">×</button></header><div class="dgo-dialog__body">${body}</div><footer><button type="button" class="dgo-btn dgo-btn--primary" data-dialog-close>Close</button></footer></section>`; const close=()=>{ wrap._releaseTrap?.(); wrap.remove(); }; wrap._dismiss=close; wrap.querySelectorAll('[data-dialog-close]').forEach(b=>b.addEventListener('click',close)); this.appendChild(wrap); createFocusTrap(wrap,{onEscape:close}); requestAnimationFrame(()=>wrap.querySelector('button')?.focus()); }
  confirm(options){ const o=typeof options==='string'?{title:'Confirm action',body:options}:options||{}; return new Promise(resolve=>{ const wrap=document.createElement('div'); wrap.className='dgo-dialog-backdrop'; wrap.dataset.dialog='confirm'; wrap.innerHTML=`<section class="dgo-dialog" role="dialog" aria-modal="true" aria-label="${esc(o.title||'Confirm action')}"><header><h2>${esc(o.title||'Confirm action')}</h2></header><div class="dgo-dialog__body">${/<[a-z][\s\S]*>/i.test(o.body||'')?(o.body||''):('<p>'+esc(o.body||'Do you want to continue?')+'</p>')}</div><footer><button type="button" class="dgo-btn dgo-btn--secondary" data-no>Cancel</button><button type="button" class="dgo-btn dgo-btn--primary" data-yes>Continue</button></footer></section>`;
    // Every dismissal route (Cancel, Escape, global transient close) must resolve the
    // promise: an unresolved confirm would strand the governed action awaiting it.
    let settled=false; const settle=value=>{ if(settled) return; settled=true; wrap._releaseTrap?.(); wrap.remove(); resolve(value); }; wrap._dismiss=()=>settle(false); wrap.querySelector('[data-no]').addEventListener('click',()=>settle(false)); wrap.querySelector('[data-yes]').addEventListener('click',()=>settle(true)); this.appendChild(wrap); createFocusTrap(wrap,{initialFocus:'[data-yes]',onEscape:()=>settle(false)}); requestAnimationFrame(()=>wrap.querySelector('[data-yes]')?.focus()); }); }
}
customElements.define('dgo-shell', Shell);
}
