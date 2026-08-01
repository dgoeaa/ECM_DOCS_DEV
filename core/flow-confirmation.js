import { confirmAction, esc } from './ui.js';
const SENSITIVE=/token|secret|password|authorization|apikey|apiKey|otp/i;
const READ_ENDPOINT=/^FETCH_|^GET_|^LOAD_|^LIST_|^SEARCH_/;
function redact(value,key=''){
  if(SENSITIVE.test(key)) return '[REDACTED]';
  if(Array.isArray(value)) return value.slice(0,25).map((v,i)=>redact(v,String(i))).concat(value.length>25?[`… ${value.length-25} more`]:[]);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).slice(0,60).map(([k,v])=>[k,redact(v,k)]));
  return value;
}
function summarizePayload(payload={}){
  const clean=redact(payload||{});
  const keys=Object.keys(payload||{}).filter(k=>!k.startsWith('__'));
  return {keys, preview:clean};
}
export function isFlowEndpoint(key,contract={},payload={},options={}){
  if(options.skipConfirmation) return false;
  if(options.requireConfirmation) return true;
  if(payload?.__confirmedByUI || payload?.__skipConfirmation) return false;
  if(contract?.write) return true;
  if(payload?.operation && !READ_ENDPOINT.test(key)) return true;
  return false;
}
export function requiresInputPreview(payload={}){
  return !!(payload && Object.keys(payload).some(k=>!k.startsWith('__') && payload[k]!==undefined && payload[k]!==null && String(payload[k]).length>0));
}
export async function confirmFlowExecution({key,contract={},payload={},options={}}){
  if(!isFlowEndpoint(key,contract,payload,options)) return true;
  const {keys,preview}=summarizePayload(payload);
  const action=contract.action||payload.operation||key;
  const isInput=requiresInputPreview(payload);
  const body=`<div class="flow-preview"><p><b>Endpoint / flow:</b> ${esc(key)}</p><p><b>Action:</b> ${esc(action)}</p><p><b>Writes/processes data:</b> ${contract.write?'Yes':'Potentially'}</p>${isInput?`<p><b>User/input payload keys:</b> ${esc(keys.join(', ')||'None')}</p><pre class="preview-box">${esc(JSON.stringify(preview,null,2)).slice(0,6000)}</pre>`:'<p>No user/input payload supplied.</p>'}<p class="meta">Review this preview before execution. This action may invoke a backend flow/endpoint and process or write data.</p></div>`;
  const res=await confirmAction({title:`Confirm ${key} execution`, body, confirmText:'Execute', cancelText:'Cancel'});
  return res!==false;
}
