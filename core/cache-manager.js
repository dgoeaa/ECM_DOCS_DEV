import { CachePolicy, cachePolicyFor } from '../config/cache-policy.config.js';
import { PerformanceMonitor } from './performance-monitor.js';
const _cache=new Map(); let _hits=0,_misses=0,_evictions=0;
const enc=new TextEncoder(); const clone=v=>structuredClone(v);
async function hash(v){ const s=typeof v==='string'?v:JSON.stringify(v||{}); const h=await crypto.subtle.digest('SHA-256',enc.encode(s)); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function key(namespace,params={}){ return `${namespace}:${await hash(params)}`; }
function bytes(v){ try{return new Blob([JSON.stringify(v)]).size;}catch{return 0;} }
function evictIfNeeded(){ while(_cache.size>CachePolicy.maxEntries){ const oldest=[..._cache.entries()].sort((a,b)=>a[1].created-b[1].created)[0]; if(!oldest)break; _cache.delete(oldest[0]); _evictions++; } }
export const CacheManager=Object.freeze({get,set,remember,invalidate,clear,stats,key,hasFresh});
export async function get(namespace,params={}){ const start=performance.now(); const k=await key(namespace,params); const rec=_cache.get(k); const p=cachePolicyFor(namespace); if(!rec){_misses++; PerformanceMonitor.record('cache',`cache:${namespace}`,Math.round(performance.now()-start),{hit:false}); return null;} const age=Date.now()-rec.created; const stale=!p.immutable && age>p.ttlMs; if(stale){_misses++; PerformanceMonitor.record('cache',`cache:${namespace}`,Math.round(performance.now()-start),{hit:false,stale:true}); return null;} _hits++; rec.lastAccess=Date.now(); PerformanceMonitor.record('cache',`cache:${namespace}`,Math.round(performance.now()-start),{hit:true}); return clone(rec.value); }
export async function hasFresh(namespace,params={}){ return !!(await get(namespace,params)); }
export async function set(namespace,params,value,meta={}){ const k=await key(namespace,params); const payloadBytes=bytes(value); if(payloadBytes>CachePolicy.maxPayloadBytes && !meta.force) return null; _cache.set(k,{namespace,params,value:clone(value),created:Date.now(),lastAccess:Date.now(),payloadBytes,meta}); evictIfNeeded(); return k; }
export async function remember(namespace,params,loader,meta={}){ const cached=await get(namespace,params); if(cached) return {source:'cache', value:cached}; const value=await loader(); await set(namespace,params,value,meta); return {source:'network', value}; }
export function invalidate(namespace,predicate){ let n=0; for(const [k,v] of _cache){ if(!namespace||v.namespace===namespace){ if(!predicate||predicate(v)){_cache.delete(k);n++;}}} return n; }
export function clear(){ const n=_cache.size; _cache.clear(); return n; }
export function stats(){ return Object.freeze({entries:_cache.size,hits:_hits,misses:_misses,evictions:_evictions,hitRate:_hits+_misses?Math.round(_hits/(_hits+_misses)*100):0,bytes:[..._cache.values()].reduce((a,b)=>a+(b.payloadBytes||0),0)}); }
