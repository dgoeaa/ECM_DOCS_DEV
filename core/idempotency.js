const _seen=new Map(); const enc=new TextEncoder();
async function digestPayload(payload){ const s=JSON.stringify(payload,Object.keys(payload||{}).sort()); const h=await crypto.subtle.digest('SHA-256',enc.encode(s)); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export const Idempotency=Object.freeze({key,remember,seen,clearExpired,bucket});
export function bucket(windowSeconds=300){ return Math.floor(Date.now()/(windowSeconds*1000)); }
export async function key({operation,ref='',actor={},payload={},windowSeconds=300}){ return ['idem',operation,ref,String(actor.email||'').toLowerCase(),bucket(windowSeconds),await digestPayload(payload)].join(':'); }
export function remember(k,ttlMs=300000){ _seen.set(k,Date.now()+ttlMs); return k; }
export function seen(k){ const exp=_seen.get(k); if(!exp) return false; if(exp<Date.now()){_seen.delete(k);return false;} return true; }
export function clearExpired(){ for(const [k,exp] of _seen) if(exp<Date.now()) _seen.delete(k); return _seen.size; }
