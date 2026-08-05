import { State } from './state.js';
import { invoke } from './api.js';
import { FetchManager } from './fetch-manager.js';
import { LoadingState } from './loading-state.js';
import { assertEnvelope,collection,responseMeta } from './contracts.js';
import { reconcileEnterprise } from './enterprise-domain.js';
import { Entities } from './entity-store.js';
import { PlatformProvisioner } from './platform-provisioner.js';
import { normalizeDocument,normalizeTask,normalizeComment,normalizeUser,normalizeCategory,normalizeDepartment,normalizeEmail } from './domain.js';
import { sanitizeSourceRecord, sanitizeTaskRecord } from './source-normalizer.js';
import { partition } from './entry-point-feeds.js';
import { EntryPoints } from '../config/entry-points.config.js';
const specs={activities:{aliases:['docs','activities','Activities','correspondence','items','records'],map:normalizeDocument,pre:sanitizeSourceRecord},tracking:{aliases:['tasks','tracking','Tracking','Tasks'],map:normalizeTask,pre:sanitizeTaskRecord},comments:{lane:false,aliases:['taskComments','comments','Comments'],map:normalizeComment},users:{lane:false,aliases:['users','Users'],map:normalizeUser},categories:{lane:false,aliases:['categories','Categories'],map:normalizeCategory},departments:{lane:false,aliases:['departments','Departments'],map:normalizeDepartment},emails:{aliases:['emails','Emails'],map:normalizeEmail,lane:'email'},approvals:{lane:false,aliases:['approvals','Approvals'],map:x=>x}};
let activeLoad=null;
const clean = xs => xs.filter(x=>x&&typeof x==='object');
export function parseFetchAll(response){const data=assertEnvelope(response,'fetchAll'),patch={},counts={},warnings=[],feeds={};for(const [target,spec] of Object.entries(specs)){const present=spec.aliases.some(k=>Array.isArray(data?.[k]));if(!present)continue;/* collection absent from this response — leave existing state untouched */const rows=collection(data,...spec.aliases);/* D4: stamp provenance AT THE DOOR, before anything else touches the row. FETCH_ALL is a
   shared endpoint carrying several channels, so the partition happens here — each row is
   assigned to the entry point it declares, and one that declares nothing is stamped null and
   counted rather than defaulting into a channel it was never seen at. Only then does the row
   pass through the sanitiser and the normaliser, which is the convergence layer. */
const laneSpec=spec.lane!==false;const split=laneSpec?partition(clean(rows),{assume:typeof spec.lane==='string'?spec.lane:null}):{stamped:clean(rows),unplaced:[],conflicts:[]};patch[target]=split.stamped.map(spec.pre||sanitizeSourceRecord).map(spec.map);counts[target]=patch[target].length;if(laneSpec){feeds[target]={unplaced:split.unplaced.length,conflicts:split.conflicts.length,byEntryPoint:Object.fromEntries(EntryPoints.map(e=>[e.id,split.byEntryPoint[e.id].length]))};if(split.unplaced.length)warnings.push(`${target}: ${split.unplaced.length} record(s) declare no entry point`);if(split.conflicts.length)warnings.push(`${target}: ${split.conflicts.length} record(s) disagree with the lane that carried them`);}if(rows.some(x=>!x||typeof x!=='object'))warnings.push(`${target}: non-object rows skipped`)}return{patch,counts,warnings,feeds,meta:responseMeta(response)}}
function mergeById(current=[],incoming=[]){const map=new Map(current.map(x=>[String(x.id),x]));for(const row of incoming)map.set(String(row.id),{...(map.get(String(row.id))||{}),...row});return[...map.values()]}
export function applyFetchAll(response,{replace=true}={}){const parsed=parseFetchAll(response),current=State.get(),patch={};for(const key of Object.keys(parsed.patch))patch[key]=replace?parsed.patch[key]:mergeById(current[key],parsed.patch[key]);Object.assign(patch,reconcileEnterprise({...current,...patch}));patch.runtime={...(current.runtime||{}),source:'FETCH_ALL',contract:parsed.meta,lastWarnings:parsed.warnings,lastCounts:parsed.counts,feeds:parsed.feeds};State.patch(patch);Entities.hydrateFromState(State.get());PlatformProvisioner.ensure();return parsed}
export async function loadRuntimeData({force=false,replace=true}={}){const current=State.get();if(activeLoad)return activeLoad;const inflight=(async()=>{try{const response=(await FetchManager.fetch('FETCH_ALL',{force,requestedAt:new Date().toISOString()},{force,cacheNamespace:'FETCH_ALL'})).data;const parsed=applyFetchAll(response,{replace});const result={ok:true,key:'FETCH_ALL',at:new Date().toISOString(),counts:parsed.counts,meta:parsed.meta,warnings:parsed.warnings};State.patch({runtime:{...State.get().runtime,loading:false,lastLoad:result,lastError:null}});return result}catch(primary){try{const response=(await FetchManager.fetch('FETCH_ACTIVITIES',{force,requestedAt:new Date().toISOString()},{force,cacheNamespace:'FETCH_ACTIVITIES'})).data;const data=assertEnvelope(response);const rows=Array.isArray(data)?data:collection(data,'activities','docs','items','records','value');const activities=rows.map(sanitizeSourceRecord).map(normalizeDocument);if(!activities.length)throw new Error('FETCH_ACTIVITIES returned no records');State.patch({activities,runtime:{...State.get().runtime,loading:false,lastLoad:{ok:true,key:'FETCH_ACTIVITIES',at:new Date().toISOString(),counts:{activities:activities.length},fallbackReason:primary.message},lastError:null}});Entities.hydrateFromState(State.get());PlatformProvisioner.ensure();return State.get().runtime.lastLoad}catch(fallback){const message=`FETCH_ALL: ${primary.message}; FETCH_ACTIVITIES: ${fallback.message}`;const result={ok:false,key:'deferred-runtime-data',at:new Date().toISOString(),offline:true,message,counts:{},warnings:[message]};State.patch({runtime:{...State.get().runtime,loading:false,lastLoad:result,lastError:null,lastWarnings:[...(State.get().runtime?.lastWarnings||[]),message].slice(-10)}});return result}}})();activeLoad=inflight.finally(()=>{activeLoad=null});State.patch({runtime:{...(current.runtime||{}),loading:true,lastError:null}});return activeLoad}

// R11.6.3 sync façade: the single implementation behind every sync trigger in the
// platform (shell, Operator HUD, Diagnostics, Executive, Correspondence, Statistics,
// FastTrack ribbon, Lookup direct). mode 'full' refreshes the whole runtime dataset;
// mode 'endpoint' routes a scoped governed request. Both record one audit vocabulary.
export async function requestSync({source='workspace',mode='full',endpoint='DYNAMIC_ACTIONS',payload={}}={}){
  const meta={module:source,action:'sync:request',ref:mode==='full'?'FETCH_ALL':endpoint};
  if(mode==='full'){
    const result=await loadRuntimeData({force:true});
    State.patch({},{...meta,event:'audit:sync-request'});
    return result;
  }
  const res=await invoke(endpoint,{...payload,source});
  State.patch({},{...meta,event:'audit:sync-request'});
  return res;
}
