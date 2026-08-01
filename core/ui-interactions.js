import { State } from './state.js';
export const UIInteractions=Object.freeze({select,selected,bindSelectable,debouncedInput});
export function select(id,{route='',stateKey='selectedId',extra={}}={}){ State.patch({[stateKey]:id,...extra},{module:'ui-interactions',action:'select-item',ref:id}); if(route) location.hash = route.startsWith('#') ? route : '#/'+route; return id; }
export function selected(stateKey='selectedId'){ return State.get()[stateKey]||null; }
export function bindSelectable(root,{selector='[data-select],[data-id],[data-ref],[data-open]',getId,route,stateKey='selectedId',onSelect}={}){ root.querySelectorAll(selector).forEach(el=>{ if(el.__dgoSelectableBound) return; el.__dgoSelectableBound=true; el.setAttribute('tabindex',el.getAttribute('tabindex')||'0'); el.setAttribute('role',el.getAttribute('role')||'button'); const run=()=>{ const id=getId?getId(el):(el.dataset.select||el.dataset.id||el.dataset.ref||el.dataset.open); if(!id) return; select(id,{route:typeof route==='function'?route(el):route,stateKey}); onSelect?.(id,el); }; el.addEventListener('click',run); el.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();run();} }); }); }

// Shared debounced search binding: re-renders via callback and restores focus + caret,
// replacing seven per-module hand-rolled copies of this pattern.
export function debouncedInput(input,fn,{delay=150,caret=true,refind}={}){
  if(!input) return;
  let timer;
  input.oninput=e=>{
    const value=e.target.value, pos=e.target.selectionStart;
    clearTimeout(timer);
    timer=setTimeout(()=>{
      fn(value);
      if(!caret) return;
      const again=refind?refind():input;
      if(again&&typeof again.focus==='function'){ again.focus(); again.setSelectionRange?.(pos,pos); }
    },delay);
  };
}
