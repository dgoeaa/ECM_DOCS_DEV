import { State } from '../core/state.js';
import { Router } from '../core/router.js';
import { esc, toast } from '../core/ui.js';
import { WelcomeExperienceConfig as C } from '../config/welcome-experience.config.js';
import { createFocusTrap } from '../core/focus-trap.js';

let active = null;
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const embedded = () => document.documentElement.dataset.nitdaEmbed === '1';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const stamp = () => new Date().toLocaleString(undefined, { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
function markSeen(extra={}){
  const s = State.get();
  State.patch({
    settings:{ ...(s.settings||{}), welcomeSeen:true },
    runtime:{ ...(s.runtime||{}), welcomeCompletedAt:new Date().toISOString(), ...extra }
  }, { module:'welcome', action:'complete-welcome', event:'audit:welcome-completed' });
}
function markUnseen(){
  const s = State.get();
  State.patch({ settings:{ ...(s.settings||{}), welcomeSeen:false } }, { module:'welcome', action:'reset-welcome', event:'audit:welcome-reset' });
}
// Must agree with shouldSkip() in core/welcome-experience.js. Both layers read the same
// WelcomeExperienceConfig, but this one previously gated on welcomeSeen alone and ignored
// the query params entirely — so ?skipWelcome=1 suppressed the core welcome and this
// overlay still took over the screen. CONTRIBUTING.md tells test authors to rely on that
// parameter, so the documented idiom did not work.
function shouldShow({force=false}={}){
  if(force) return true;                                   // explicit replay always wins
  if(!C.enabled) return false;
  const q = new URLSearchParams(location.search);
  if((C.forceQueryParams||[]).some(k=>q.has(k))) return true;
  if((C.skipQueryParams||[]).some(k=>q.has(k))) return false;
  return !embedded() && State.get().settings?.welcomeSeen === false;
}
function overlayHtml(){
  const s = State.get(), p = s.profile || {};
  const persona = p.persona || 'operator';
  return `<div class="dgo-welcome" role="dialog" aria-modal="true" aria-labelledby="dgo-welcome-title" aria-describedby="dgo-welcome-desc" tabindex="-1" data-phase="boot">
    <p id="dgo-welcome-desc" class="dgo-visually-hidden">Confirm your workspace profile to continue. Press Escape to skip.</p>
    <div class="dgo-visually-hidden" role="status" aria-live="polite" data-welcome-announce></div>
    <section class="dgo-welcome__boot" data-welcome-boot>
      <div class="dgo-welcome__agency">Federal Ministry of Communications, Innovation & Digital Economy</div>
      <div class="dgo-welcome__ring" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"></circle><circle data-ring cx="60" cy="60" r="52"></circle></svg><b data-progress>0%</b></div>
      <h1 id="dgo-welcome-title">DGO Digital Ops</h1>
      <p>An Initiative of NITDA</p>
      <ol class="dgo-welcome__steps" data-steps>${C.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      <small data-tip>${esc(C.tips[0])}</small>
    </section>
    <section class="dgo-welcome__card" data-welcome-card hidden>
      <div class="dgo-welcome__brand"><img src="assets/dgo-mark.svg" alt="" aria-hidden="true"><span><b>DG<span>O</span> Digital Ops</b><small>A NITDA Platform</small></span></div>
      <div class="dgo-welcome__intro"><small>${esc(stamp())}</small><h2>${esc(greeting())}, ${esc(p.name || 'Registry')}</h2><p>${esc(persona)} · ${esc(p.email || 'not configured')}</p></div>
      <div class="dgo-welcome__spotlight">${C.spotlight.map(x=>`<article><b>${esc(x.title)}</b><p>${esc(x.body)}</p></article>`).join('')}</div>
      <form class="dgo-welcome__profile" data-welcome-profile>
        <label>Name<input name="name" value="${esc(p.name || 'Registry')}"></label>
        <label>Email<input name="email" type="email" value="${esc(p.email || '')}"></label>
        <label>Persona<select name="persona">${['admin','executive','registry','general'].map(x=>`<option ${x===persona?'selected':''}>${x}</option>`).join('')}</select></label>
        <label class="dgo-welcome__remember"><input name="remember" type="checkbox" checked> Remember this workspace profile on this device</label>
        <div class="dgo-welcome__actions"><button class="btn" type="submit">Continue to Command Center</button><button class="btn ghost" type="button" data-welcome-skip>Skip for now</button></div>
      </form>
    </section>
  </div>`;
}
function setProgress(wrap, ratio){
  const pct = Math.round(ratio * 100), c = 2 * Math.PI * 52;
  const step = Math.min(C.steps.length - 1, Math.floor(ratio * C.steps.length));
  if(wrap._announcedStep !== step){ wrap._announcedStep = step; announce(wrap, C.steps[step]); }
  const progress = wrap.querySelector('[data-progress]'); if(progress) progress.textContent = pct + '%';
  const ring = wrap.querySelector('[data-ring]'); if(ring) ring.style.strokeDashoffset = String(c * (1 - ratio));
  wrap.querySelectorAll('[data-steps] li').forEach((li,i)=>li.classList.toggle('done', i < Math.floor(ratio * C.steps.length)));
}
function announce(wrap, message){
  const live = wrap.querySelector('[data-welcome-announce]');
  if(live) live.textContent = String(message||'');
}
function revealCard(wrap){
  wrap.dataset.phase = 'welcome';
  const boot = wrap.querySelector('[data-welcome-boot]'); if(boot) boot.hidden = true;
  const card = wrap.querySelector('[data-welcome-card]'); if(card) card.hidden = false;
  announce(wrap, 'Workspace ready. Confirm your profile to continue to the Command Center.');
  wrap._trap?.refocus?.();
}
function close(wrap, {persist=true}={}){
  if(persist) markSeen();
  wrap._trap?.release?.();
  wrap._trap = null;
  wrap.classList.add('closing');
  setTimeout(()=>wrap.remove(), reduceMotion()?0:180);
  active = null;
}
function bind(wrap){
  wrap.querySelector('[data-welcome-skip]')?.addEventListener('click', ()=>close(wrap,{persist:true}));
  wrap.querySelector('[data-welcome-profile]')?.addEventListener('submit', e=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const s = State.get();
    State.patch({
      profile:{ ...(s.profile||{}), name:String(d.name||'Registry').trim() || 'Registry', email:String(d.email||s.profile?.email||'').trim(), persona:d.persona || s.profile?.persona || 'admin' },
      settings:{ ...(s.settings||{}), welcomeSeen:true }
    }, { module:'welcome', action:'confirm-profile', event:'audit:welcome-profile-confirmed' });
    toast('Welcome experience completed', 'success');
    close(wrap,{persist:false});
    if(!location.hash || location.hash === '#/') Router.go('home');
  });
  // Escape is handled by the focus trap so that background content stays inert until release.
  wrap._trap = createFocusTrap(wrap, {
    initialFocus: () => wrap.querySelector('[data-welcome-card]:not([hidden]) input, [data-welcome-card]:not([hidden]) button'),
    onEscape: () => close(wrap, { persist:true }),
  });
}
export function launchWelcome(options={}){
  if(!shouldShow(options)) return false;
  active?.remove?.();
  const tmp = document.createElement('div');
  tmp.innerHTML = overlayHtml();
  const wrap = tmp.firstElementChild;
  document.body.appendChild(wrap);
  active = wrap;
  bind(wrap);
  const circumference = 2 * Math.PI * 52;
  const ring = wrap.querySelector('[data-ring]');
  if(ring){ ring.style.strokeDasharray = String(circumference); ring.style.strokeDashoffset = String(circumference); }
  const ms = reduceMotion() ? C.reducedMotionBootMs : C.bootMs;
  const start = performance.now();
  let tip = 0;
  const tipTimer = setInterval(()=>{ tip = (tip + 1) % C.tips.length; const el = wrap.querySelector('[data-tip]'); if(el) el.textContent = C.tips[tip]; }, C.tipsIntervalMs);
  const tick = now => {
    if(!wrap.isConnected){ clearInterval(tipTimer); return; }
    const ratio = Math.min(1, (now - start) / ms);
    setProgress(wrap, ratio);
    if(ratio < 1) requestAnimationFrame(tick);
    else { clearInterval(tipTimer); setTimeout(()=>revealCard(wrap), reduceMotion()?0:220); }
  };
  requestAnimationFrame(tick);
  return true;
}
export function resetWelcomeExperience({launch=true}={}){
  markUnseen();
  if(launch) launchWelcome({force:true});
}
if(typeof window !== 'undefined') window.DGOWelcome = Object.freeze({ launch:()=>launchWelcome({force:true}), reset:()=>resetWelcomeExperience({launch:true}) });
