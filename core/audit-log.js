const _events=[]; const _byRef=new Map();
const clone=v=>structuredClone(v); const freeze=v=>Object.freeze(clone(v)); const uid=p=>`${p}-${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;
function index(ev){ if(!ev.ref) return; const a=_byRef.get(ev.ref)||[]; a.push(ev); _byRef.set(ev.ref,a); }
export const AuditLog=Object.freeze({record,byReference,query,hydrateFromState,snapshot});
export function record(event={}){ const ev={id:event.id||uid('AUD'),at:event.at||new Date().toISOString(),ref:event.ref||'',actor:event.actor||{},event:event.event||event.action||'audit:event',phase:event.phase??null,fromStatus:event.fromStatus||'',toStatus:event.toStatus||'',entityType:event.entityType||'',entityId:event.entityId||'',meta:event.meta||event.details||{},hash:event.hash||''}; _events.unshift(ev); if(_events.length>5000) _events.length=5000; index(ev); return freeze(ev); }
export function byReference(ref){ return freeze(_byRef.get(ref)||[]); }
export function query(filters={}){ return freeze(_events.filter(e=>Object.entries(filters).every(([k,v])=>v===undefined||v===''||e[k]===v))); }
export function hydrateFromState(state={}){ (state.audit||[]).forEach(a=>record({ref:a.ref||a.referenceId||a.RefIDD||'',actor:a.actor||{},event:a.event||a.action||'audit:legacy',meta:a})); return snapshot(); }
export function snapshot(){ return freeze({events:_events,byRef:Array.from(_byRef.entries())}); }
