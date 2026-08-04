import { Routes } from '../config/routes.config.js';
import { NavGroups } from '../config/nav.config.js';
import { canAccess } from '../config/rbac.config.js';
import { State } from '../core/state.js';
import { Router } from '../core/router.js';
const glyph={home:'⌂',activities:'▤',correspondence:'✉','response-tracking':'↔',orchestrator:'⌘','single-assignment':'１','bulk-assignment':'∞',fasttrack:'⚡',approvals:'✓',acknowledgment:'A',dispatch:'➤',registry:'▣',comments:'◌',reports:'R',statistics:'∑',executive:'E',assistant:'✦',lookup:'⌕','operator-hud':'O',settings:'⚙',diagnostics:'D','user-admin':'U'};
class Shell extends HTMLElement{
  connectedCallback(){this.render(); State.on(()=>this.identity()); Router.start();}
  render(){const s=State.get(); const nav=NavGroups.map(g=>{const rs=Routes.filter(r=>g.routes.includes(r.path)&&canAccess(s.profile.persona,r.path)); return rs.length?`<div class="group">${g.group}</div>${rs.map(r=>`<a class="navlink" href="#/${r.path}" data-route="${r.path}" title="${r.label}"><span class="glyph">${glyph[r.path]||'•'}</span><span class="label">${r.label}</span></a>`).join('')}`:''}).join('');
    this.innerHTML=`<div class="ministry">FEDERAL MINISTRY OF COMMUNICATIONS, INNOVATION & DIGITAL ECONOMY</div><header class="top"><button class="iconbtn" data-menu aria-label="Toggle navigation">☰</button><img class="logo" src="assets/dgo-logo.svg" alt="DGO Digital Ops"><div class="context"><small>ACTIVE WORKSPACE</small><b data-context>Activities</b></div><div class="grow"></div><label class="header-search"><span>⌕</span><input data-search placeholder="Search current workspace" aria-label="Search current workspace"></label><button class="iconbtn" data-theme title="Change theme" aria-label="Change theme">◐</button><button class="btn ghost" data-export>Export</button></header><div class="shell" data-shell><nav class="nav" data-nav>${nav}<div class="identity"><b data-name>${s.profile.name}</b><small data-role>${s.profile.persona} · ${s.profile.email}</small></div></nav><div class="content"><main id="main" data-outlet tabindex="-1"></main><footer class="footer"><div class="brand"><img src="assets/dgo-mark.svg" alt=""><span><b>DGO Digital Operations</b><br><small>An Initiative of NITDA</small></span></div><p>National Information Technology Development Agency · Secure internal workspace</p><small class="copy">© ${new Date().getFullYear()} NITDA Digital Ops</small></footer></div></div><aside class="pane hidden" data-pane><button class="btn ghost" data-close>Close</button><div data-pane-body></div></aside><div class="feedback" aria-live="polite"></div><dialog><form method="dialog"><h2 data-title></h2><div data-body></div><p><button class="btn" value="ok">Confirm</button> <button class="btn ghost" value="cancel">Cancel</button></p></form></dialog>`;
    const shell=this.querySelector('[data-shell]'), navEl=this.querySelector('[data-nav]'), main=this.querySelector('main');
    const collapse=()=>{ if(innerWidth<=768) navEl.classList.remove('open'); else shell.classList.add('collapsed'); };
    this.querySelector('[data-menu]').onclick=e=>{e.stopPropagation(); if(innerWidth<=768) navEl.classList.toggle('open'); else shell.classList.toggle('collapsed');};
    navEl.addEventListener('pointerdown', collapse); main.addEventListener('pointerdown', collapse);
    this.querySelector('[data-close]').onclick=()=>this.closePane();
    this.querySelector('[data-theme]').onclick=e=>{e.stopPropagation(); const a=['government','dark','high-contrast']; const i=(a.indexOf(State.get().settings.theme)+1)%a.length; State.patch({settings:{...State.get().settings,theme:a[i]}}); document.documentElement.dataset.theme=a[i];};
    this.querySelector('[data-export]').onclick=e=>{e.stopPropagation(); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(State.get(),null,2)],{type:'application/json'})); a.download='dgo-runtime-export.json'; a.click();};
    this.querySelector('[data-search]').oninput=e=>{const q=e.target.value.toLowerCase(); this.querySelectorAll('main .record, main .data-line, main tbody tr').forEach(x=>x.hidden=q && !x.textContent.toLowerCase().includes(q));};
  }
  active(p){const r=Routes.find(x=>x.path===p); this.querySelector('[data-context]').textContent=r?.label||'Workspace'; this.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===p)); if(innerWidth<=768)this.querySelector('.nav')?.classList.remove('open');}
  identity(){const s=State.get(); this.querySelector('[data-name]').textContent=s.profile.name; this.querySelector('[data-role]').textContent=`${s.profile.persona} · ${s.profile.email}`;}
  toast(m,t=''){const x=document.createElement('div'); x.className='toast '+t; x.textContent=m; this.querySelector('.feedback').append(x); setTimeout(()=>x.remove(),3500);}
  confirm({title,body}){const d=this.querySelector('dialog'); d.querySelector('[data-title]').textContent=title; d.querySelector('[data-body]').innerHTML=body; d.showModal(); return new Promise(r=>d.addEventListener('close',()=>r(d.returnValue==='ok'),{once:true}));}
  openPane(h){this.querySelector('[data-pane-body]').innerHTML=h; this.querySelector('[data-pane]').classList.remove('hidden');}
  closePane(){this.querySelector('[data-pane]').classList.add('hidden');}
}
if(!customElements.get('dgo-shell'))customElements.define('dgo-shell',Shell);
