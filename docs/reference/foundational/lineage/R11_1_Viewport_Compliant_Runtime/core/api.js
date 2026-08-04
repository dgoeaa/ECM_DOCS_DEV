import { State } from './state.js';
import { EndpointContracts } from '../config/endpoints.config.js';
export async function invoke(key, payload={}) {
  const st = State.get(); const contract = EndpointContracts[key]; const url = st.settings.endpoints[key];
  if (!contract) throw new Error('Unknown endpoint '+key);
  if (!url) throw new Error('Endpoint '+key+' is not configured');
  const id = crypto.randomUUID(); const ctl = new AbortController(); const timer=setTimeout(()=>ctl.abort(),45000);
  try { const r = await fetch(url,{method:contract.method,headers:{'Content-Type':'application/json','X-Correlation-Id':id},body:JSON.stringify({action:contract.action,payload,userEmail:st.profile.email,requestId:id,timestamp:new Date().toISOString()}),signal:ctl.signal}); if(!r.ok)throw new Error('HTTP '+r.status); return await r.json(); }
  catch(e){ const now=State.get(); State.patch({pending:[...now.pending,{id,key,url,payload,error:e.message,at:new Date().toISOString()}].slice(-250)}); throw e; }
  finally{clearTimeout(timer)}
}
