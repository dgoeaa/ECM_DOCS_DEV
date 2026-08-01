import { State } from './state.js';
import { PerformanceBudget } from '../config/performance-budget.config.js';
const _events=[]; const _metrics=new Map();
const clone=v=>structuredClone(v);
function record(type,name,durationMs,meta={}){ const ev={type,name,durationMs,at:new Date().toISOString(),slow:isSlow(type,durationMs),meta}; _events.unshift(ev); if(_events.length>500)_events.pop(); const m=_metrics.get(name)||{count:0,totalMs:0,maxMs:0,lastMs:0,slow:0}; m.count++; m.totalMs+=durationMs; m.maxMs=Math.max(m.maxMs,durationMs); m.lastMs=durationMs; if(ev.slow)m.slow++; _metrics.set(name,m); publish(); return clone(ev); }
function isSlow(type,ms){ if(type==='fetch'&&ms>PerformanceBudget.fetchAllMs)return true; if(type==='render'&&ms>PerformanceBudget.moduleRenderMs)return true; if(type==='route'&&ms>PerformanceBudget.routeMountMs)return true; if(type==='cache'&&ms>PerformanceBudget.cacheReadMs)return true; return false; }
function publish(){ try{State.patch({runtime:{...State.get().runtime, performance:snapshot()}},{module:'performance-monitor',action:'publish-performance'});}catch{} }
export const PerformanceMonitor=Object.freeze({measure,record,snapshot,events,metrics,budget:PerformanceBudget});
export async function measure(type,name,fn,meta={}){ const t=performance.now(); try{return await fn();} finally{record(type,name,Math.round(performance.now()-t),meta);} }
export function events(){ return clone(_events); }
export function metrics(){ return clone(Object.fromEntries(_metrics.entries())); }
export function snapshot(){ return Object.freeze({budget:PerformanceBudget, events:events().slice(0,50), metrics:metrics()}); }
