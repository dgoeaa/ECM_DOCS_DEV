import { State } from './state.js';
const _loads=new Map();
const clone=v=>structuredClone(v);
function now(){return new Date().toISOString();}
function key(scope,id){return `${scope}:${id||'default'}`;}
function publish(){ State.patch({runtime:{...State.get().runtime, loadingState:snapshot()}},{module:'loading-state',action:'publish-loading',silent:false}); }
export const LoadingState=Object.freeze({start,refreshing,success,error,get,snapshot,clear,isBusy});
export function start(scope,id='default',meta={}){ const k=key(scope,id); const rec={scope,id,status:'loading',startedAt:now(),finishedAt:'',durationMs:0,errorClass:'',message:'',source:meta.source||'',counts:meta.counts||{},lastGoodAt:meta.lastGoodAt||'',retryable:false}; _loads.set(k,rec); publish(); return clone(rec); }
export function refreshing(scope,id='default',meta={}){ const rec=start(scope,id,meta); rec.status='refreshing'; _loads.set(key(scope,id),rec); publish(); return clone(rec); }
export function success(scope,id='default',meta={}){ const k=key(scope,id); const rec=_loads.get(k)||{scope,id,startedAt:now()}; rec.status='success'; rec.finishedAt=now(); rec.durationMs=Date.parse(rec.finishedAt)-Date.parse(rec.startedAt||rec.finishedAt); rec.source=meta.source||rec.source||'network'; rec.counts=meta.counts||rec.counts||{}; rec.lastGoodAt=rec.finishedAt; rec.message=meta.message||''; _loads.set(k,rec); publish(); return clone(rec); }
export function error(scope,id='default',err={},meta={}){ const k=key(scope,id); const rec=_loads.get(k)||{scope,id,startedAt:now()}; rec.status='error'; rec.finishedAt=now(); rec.durationMs=Date.parse(rec.finishedAt)-Date.parse(rec.startedAt||rec.finishedAt); rec.errorClass=err.errorClass||err.name||'ERROR'; rec.message=err.message||String(err); rec.retryable=!!meta.retryable; _loads.set(k,rec); publish(); return clone(rec); }
export function get(scope,id='default'){ return clone(_loads.get(key(scope,id))||{scope,id,status:'idle'}); }
export function snapshot(){ return Object.freeze(Array.from(_loads.values()).map(clone)); }
export function clear(scope,id){ if(scope) _loads.delete(key(scope,id||'default')); else _loads.clear(); publish(); }
export function isBusy(scope){ return snapshot().some(x=>(!scope||x.scope===scope)&&['loading','refreshing'].includes(x.status)); }
