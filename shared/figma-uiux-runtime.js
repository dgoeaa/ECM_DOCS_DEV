
// DGO R11.6 Figma UI/UX runtime enhancer: non-invasive, no framework, no endpoint changes.
// Guarded so the module is safely importable in non-browser (diagnostic) contexts.
if (typeof document !== 'undefined' && typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') (function(){
  const root=document.documentElement;
  root.classList.add('dgo-figma-uiux-implemented');
  // R11.6 §F — keyboard-accessible drawer focus management: trap Tab within an open drawer
  // (role=dialog/aria-modal) and restore focus to the opener on close. WCAG 2.1.1, 2.4.3.
  let _drawerOpener=null,_drawerTrap=null,_trappedDrawer=null;
  const focusablesIn=el=>[...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
  function releaseTrap(){ if(_trappedDrawer&&_drawerTrap) _trappedDrawer.removeEventListener('keydown',_drawerTrap); _drawerTrap=null; _trappedDrawer=null; }
  function trapDrawer(d){ releaseTrap(); _trappedDrawer=d;
    _drawerTrap=e=>{ if(e.key!=='Tab')return; const f=focusablesIn(d); if(!f.length)return; const first=f[0],last=f[f.length-1],a=document.activeElement;
      if(e.shiftKey){ if(a===first||!d.contains(a)){ e.preventDefault(); last.focus(); } } else { if(a===last||!d.contains(a)){ e.preventDefault(); first.focus(); } } };
    d.addEventListener('keydown',_drawerTrap); }
  function closeDrawers(){ let had=false; document.querySelectorAll('.dgo-drawer:not([hidden])').forEach(d=>{ d.hidden=true; had=true; }); releaseTrap(); if(had&&_drawerOpener){ try{ _drawerOpener.focus(); }catch{} } _drawerOpener=null; }
  // Placeholder "state treatment" cards that some workspaces still emit are removed here.
  //
  // This used to match on textContent: it read and normalised the full text of every
  // .panel/.card/section in the workspace on EVERY mutation, then deleted any node whose
  // text merely CONTAINED one of three sentences. Two problems, both real:
  //   · Cost — an O(subtree) string build per mutation, inside the MutationObserver that
  //     its own node.remove() calls re-trigger. On a registry table of a few hundred rows
  //     that is a full re-read of the rendered document per render.
  //   · Correctness — it is content-based deletion. Any genuine record whose subject or
  //     comment happened to quote one of those sentences would be silently removed from
  //     the operator's screen, with no error and no trace. A governed console must never
  //     delete displayed content because of what the content says.
  // Matching a marker attribute instead is exact, O(matches), and cannot collide with
  // operational data. Modules that still emit the placeholders carry data-demo-state.
  const DEMO_SELECTOR='[data-demo-state]';
  function scrubDemoStateCards(root=document){
    const route=(location.hash||'#/home').replace(/^#\/?/,'')||'home';
    if(route==='diagnostics'||route==='operator-hud') return;
    root.querySelectorAll?.(DEMO_SELECTOR).forEach(node=>{
      const host=node.parentElement;
      node.remove();
      if(host && !host.children.length && host.closest('.workspace')) host.remove();
    });
  }

  document.addEventListener('click', function(e){
    const close=e.target.closest('[data-drawer-close]'); if(close){ closeDrawers(); }
    const open=e.target.closest('[data-open-drawer]'); if(open){ const d=document.querySelector(`[data-drawer="${CSS.escape(open.dataset.openDrawer)}"]`); if(d){ _drawerOpener=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:open; d.hidden=false; trapDrawer(d); (focusablesIn(d)[0]||d.querySelector('button,input,select,textarea,a'))?.focus(); }}
  }, true);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeDrawers(); }, true);
  // Responsive-table labelling: each <td> carries its column header so the stacked
  // card layout below the table breakpoint can render "Header: value" pairs.
  function labelTables(root){
    root.querySelectorAll?.('table').forEach(t=>{
      if(t.dataset.dgoLabelled==='1' && !t.dataset.dgoDirty) return;
      const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      if(!heads.length) return;
      t.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{
        if(!td.hasAttribute('data-label') && heads[i]) td.setAttribute('data-label',heads[i]);
      }));
      t.dataset.dgoLabelled='1';
    });
  }
  function markContextualPanels(root){
    root.querySelectorAll?.('.panel h2 + .meta, .panel .meta + h2')
      .forEach(x=>x.closest('.panel')?.classList.add('dgo-panel-contextual'));
  }

  // The observer previously re-walked the WHOLE document on every mutation record —
  // including the mutations it caused itself — so a single route render triggered dozens
  // of full-document sweeps. Now it processes only the subtrees that were actually added,
  // and coalesces a burst of records into one rAF pass. Same output, bounded cost.
  let pending=null;
  const queue=new Set();
  function flush(){
    pending=null;
    const roots=[...queue]; queue.clear();
    for(const r of roots){ if(!r.isConnected) continue; labelTables(r); markContextualPanels(r); }
    scrubDemoStateCards();
  }
  const obs=new MutationObserver(records=>{
    for(const rec of records){
      for(const node of rec.addedNodes){
        if(node.nodeType===1) queue.add(node.matches?.('table,.panel')?node.parentElement||node:node);
      }
    }
    if(queue.size && !pending) pending=requestAnimationFrame(flush);
  });
  obs.observe(document.body,{childList:true,subtree:true});
  labelTables(document); markContextualPanels(document); scrubDemoStateCards();
  window.addEventListener('hashchange',()=>requestAnimationFrame(()=>{
    labelTables(document); markContextualPanels(document); scrubDemoStateCards();
  }));
})();
