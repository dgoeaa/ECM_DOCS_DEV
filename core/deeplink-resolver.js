import { DeepLinkConfig, deeplinkParamEntries } from '../config/deeplink.config.js';
import { State } from './state.js';
import { Router } from './router.js';
import { ReceiptLedger } from './receipt-ledger.js';
function paramsFrom(url=location.href){
  const u=new URL(url, location.href); const merged=new URLSearchParams(u.search);
  const h=String(u.hash||''); const q=h.includes('?')?h.slice(h.indexOf('?')+1):''; if(q){ const hp=new URLSearchParams(q); hp.forEach((v,k)=>{ if(!merged.has(k)) merged.set(k,v); }); }
  return {u,params:merged};
}
function parse(url=location.href){ const {params}=paramsFrom(url); const out={route:'', context:{}, matchedParam:'', action:''}; for(const [param,spec] of deeplinkParamEntries()){ const val=params.get(param); if(val){ out.route=spec.route; out.context[spec.contextKey]=val; out.matchedParam=param; out.action=spec.action; break; } } for(const p of DeepLinkConfig.preserveQueryParams){ const v=params.get(p); if(v) out.context[p]=v; } return out; }
export const DeepLinkResolver=Object.freeze({parse, resolveInitial, apply});
export function apply(result, options={}){ if(!result?.route) return false; const current=State.get(); const ctx={...(current.deepLinkContext||{}),...result.context, route:result.route, action:result.action, matchedParam:result.matchedParam, resolvedAt:new Date().toISOString(), source:DeepLinkConfig.source}; State.patch({deepLinkContext:ctx, selectedId:ctx.referenceId||ctx.taskId||current.selectedId}, {module:'deeplink', action:'resolve', event:'audit:deeplink-resolved', ref:ctx.referenceId||ctx.taskId||''}); if(result.route==='acknowledgment'||result.action==='acknowledge-task')ReceiptLedger.record({type:'acknowledgement',ref:ctx.referenceId||ctx.taskId||'',taskId:ctx.taskId||'',status:'deeplink-resolved',source:ctx.source,payload:ctx}); if(options.navigate!==false) Router.go(result.route); return true; }
export function resolveInitial(){ try{ const r=parse(); return apply(r,{navigate:true}); }catch(e){ console.warn('[DGO deeplink]',e); return false; } }
