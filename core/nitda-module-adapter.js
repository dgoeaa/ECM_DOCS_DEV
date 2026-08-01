import { State } from './state.js';

const IN_SHELL = typeof window !== 'undefined' && window !== window.parent;
const DEFAULT_TIMEOUT_MS = 35000;
const SOURCE = 'NITDA_MODULE';
const TARGET = 'NITDA_SHELL';

const workflowEndpointMap = Object.freeze({
  ff455c68e9ac493e858fb984bcfd01fb: { endpointKey: 'REFERENCE_DATA', schemaId: 'S02_get-references-lookup-schema' },
  '818ec4053f1e4f0b87845114241d8b74': { endpointKey: 'GET_DOCS', schemaId: 'S01_get-docs-flow-trigger-schema' },
  '37642ba3597f4cf58288cc71b5e6b519': { endpointKey: 'FETCH_ACTIVITIES', schemaId: 'S04_get-tasks-flow-schema' },
  '3931e2ff995242b6b2c920c8b2209797': { endpointKey: 'SUBSIDIARY_ACTIONS', schemaId: 'S03_get-emails-flow-trigged-schema' },
  '85c556f10b8244ba9d839a2ebe240b91': { endpointKey: 'SUBSIDIARY_ACTIONS', schemaId: 'subsidiary-actions-schema' },
  '4a250f97181b4a28abc1d0fb0f7d4c4d': { endpointKey: 'FETCH_ALL', schemaId: 'fetch-all-schema' },
  d67f2acb3708449490eed561ee56efbe: { endpointKey: 'REFERENCE_DATA', schemaId: 'reference-data-schema' },
  '6b3bad3005b44bf6bced0f8074d3f2ed': { endpointKey: 'SINGLE_ASSIGNMENT', schemaId: 'single-assignment-schema' },
  '1154b50e1d17420dadb3b012e7e2a02c': { endpointKey: 'BULK_ASSIGNMENT', schemaId: 'bulk-assignment-schema' },
  '7e71fffe770a45ccb93bf216bb53786e': { endpointKey: 'BULK_ASSIGNMENT_DIRECT', schemaId: 'bulk-assignment-direct-schema' }
});

function randomId(){ return Math.random().toString(36).slice(2,10); }
function post(type, payload={}, id=randomId()){
  window.parent.postMessage({ source: SOURCE, type, payload, id }, window.location.origin || '*');
  return id;
}
function request(type, payload={}, opts={}){
  return new Promise(resolve => {
    const id = post(type, payload);
    pending.set(id, resolve);
    setTimeout(() => { if(pending.has(id)){ pending.delete(id); resolve(null); } }, opts.timeout || DEFAULT_TIMEOUT_MS);
  });
}
function workflowFromUrl(url=''){
  const m = String(url).match(/workflows\/([a-f0-9]{32})/i);
  return m ? m[1].toLowerCase() : '';
}
async function bodyFromArgs(args){
  const init = args[1] || {};
  if(init.body){ try { return JSON.parse(init.body); } catch { return {}; } }
  const req = args[0];
  if(req && typeof req.clone === 'function'){
    try { return JSON.parse(await req.clone().text()); } catch { return {}; }
  }
  return {};
}
async function routePowerAutomateFetch(originalFetch, args){
  const req = args[0];
  const url = typeof req === 'string' ? req : (req && req.url) || '';
  if(!/powerautomate\/automations\/direct/i.test(url)) return originalFetch.apply(window, args);
  const wf = workflowFromUrl(url);
  const map = workflowEndpointMap[wf] || { endpointKey: 'DYNAMIC_ACTIONS', schemaId: 'dynamic-action-schema' };
  const body = await bodyFromArgs(args);
  if(window.NITDA?.validate){
    const validation = await window.NITDA.validate(map.schemaId, body);
    if(validation && validation.valid === false){
      window.NITDA.toast('Invalid request payload', 'err', 'Validation failed');
      return new Response(JSON.stringify({ error:'Validation failed', validation }), { status:400, headers:{ 'Content-Type':'application/json' } });
    }
  }
  window.NITDA?.log?.(`[${map.endpointKey}] Direct Power Automate fetch routed through parent shell`);
  const result = await window.NITDA.callFlow(map.endpointKey, body, { timeout: DEFAULT_TIMEOUT_MS });
  if(result && result.ok !== false){
    window.NITDA?.publish?.('data:updated', { source:'dgo-runtime', endpointKey:map.endpointKey });
    return new Response(JSON.stringify(result.data || result), { status:200, headers:{ 'Content-Type':'application/json' } });
  }
  return new Response(JSON.stringify({ error: result?.error || 'Parent shell call failed', endpointKey: map.endpointKey }), { status:502, headers:{ 'Content-Type':'application/json' } });
}

const pending = new Map();
const topicHandlers = new Map();
const unmountHandlers = [];

export function installNitdaModuleAdapter(){
  if(!IN_SHELL || window.__DGO_NITDA_ADAPTER_INSTALLED__) return false;
  window.__DGO_NITDA_ADAPTER_INSTALLED__ = true;
  document.documentElement.setAttribute('data-nitda-embed','1');

  window.addEventListener('message', event => {
    const data = event.data || {};
    if(data.source !== TARGET) return;
    if(data.replyId && pending.has(data.replyId)){ pending.get(data.replyId)(data.payload); pending.delete(data.replyId); return; }
    if(data.id && pending.has(data.id)){ pending.get(data.id)(data.payload); pending.delete(data.id); return; }
    if(data.type === 'THEME_CHANGE' && data.payload?.theme) document.documentElement.dataset.theme = data.payload.theme;
    if(data.type === 'TOKEN_MAP' && data.payload) Object.entries(data.payload).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
    if(data.type === 'CONFIG_PUSH') window.__NITDA_SHELL_CONFIG__ = data.payload || {};
    if(data.type === 'PUB_DATA') (topicHandlers.get(data.payload?.topic) || []).forEach(cb => { try{ cb(data.payload.data, data.payload.from); }catch{} });
    if(data.type === 'WILL_UNLOAD') unmountHandlers.splice(0).forEach(cb => { try{ cb(); }catch{} });
  });

  window.NITDA = Object.freeze({
    ready: () => post('MODULE_READY', { title: document.title, runtime:'DGO_R11_6_OBSIDIAN' }),
    onUnmount: cb => { if(typeof cb === 'function') unmountHandlers.push(cb); },
    toast: (msg, type='inf', title='') => post('TOAST', { msg, type, title }),
    callFlow: (endpointId, body={}, opts={}) => request('PA_CALL', { endpointId, body, opts }, { timeout: opts.timeout || DEFAULT_TIMEOUT_MS }),
    validate: (schemaId, data) => request('VALIDATE', { schemaId, data }),
    publish: (topic, data) => post('PUB_PUBLISH', { topic, data }),
    subscribe: (topic, cb) => { const list = topicHandlers.get(topic) || []; list.push(cb); topicHandlers.set(topic, list); return () => topicHandlers.set(topic, list.filter(x => x !== cb)); },
    log: msg => post('AUDIT', { msg, at:new Date().toISOString() }),
    getUser: () => request('GET_USER', {})
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = (...args) => routePowerAutomateFetch(originalFetch, args);

  window.NITDA.getUser().then(user => {
    const u = user?.user || user;
    if(u?.email) State.patch({ profile:{ ...State.get().profile, email:u.email, name:u.name || u.displayName || State.get().profile.name } }, { action:'nitda-shell-identity', module:'nitda-module-adapter' });
  }).catch(() => {});

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.NITDA.ready(), { once:true });
  else window.NITDA.ready();
  return true;
}

installNitdaModuleAdapter();
