import { focusMain } from './design-system-adapter.js';
export function installAccessibilityShortcuts(shell){
  addEventListener('keydown', evt=>{
    if((evt.ctrlKey||evt.metaKey) && String(evt.key).toLowerCase()==='k'){
      evt.preventDefault(); shell?.openCommandPalette?.();
    }
    if(evt.key==='Escape') shell?.closeTransientSurfaces?.();
  });
}
export function afterRouteChange(){ focusMain(); }
export function labelledIcon(label){ return { 'aria-label': label, title: label }; }
