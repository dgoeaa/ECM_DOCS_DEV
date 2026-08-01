import { DataClient } from './data-client.js';
import { CacheManager } from './cache-manager.js';
import { fetchPolicyFor } from '../config/fetch-policy.config.js';
import { LoadingState } from './loading-state.js';
const _inflight=new Map();
function sig(key,payload){ return `${key}:${JSON.stringify(payload||{})}`; }
export const FetchManager=Object.freeze({fetch,refresh,inflight:snapshotInflight,clearInflight});
export async function fetch(key,payload={},options={}){ const policy={...fetchPolicyFor(key),...options}; const signature=sig(key,payload); if(policy.dedupe&&_inflight.has(signature)) return _inflight.get(signature); const run=(async()=>{ const namespace=options.cacheNamespace||key; if(policy.cacheTtlMs>0&&!options.force){ const cached=await CacheManager.get(namespace,payload); if(cached){ LoadingState.success('data',key,{source:'cache'}); return {ok:true,key,data:cached,source:'cache'}; } } LoadingState.start('data',key,{source:'network'}); const res=await DataClient.request(key,payload,policy); if(policy.cacheTtlMs>0) await CacheManager.set(namespace,payload,res.data,{key}); return {...res,source:'network'}; })(); if(policy.dedupe){ const deduped=run.finally(()=>_inflight.delete(signature)); // Silence unhandled-rejection on the stored entry: callers receive `run`
  // directly and are responsible for handling any rejection there.
  deduped.catch(()=>{}); _inflight.set(signature,deduped); } return run; }
export async function refresh(key,payload={},options={}){ LoadingState.refreshing('data',key); return fetch(key,payload,{...options,force:true}); }
export function snapshotInflight(){ return Object.freeze([..._inflight.keys()]); }
export function clearInflight(){ _inflight.clear(); }
