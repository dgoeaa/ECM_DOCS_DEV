const enc=new TextEncoder(); async function sha256(s){ const h=await crypto.subtle.digest('SHA-256',enc.encode(s)); return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
export const ExportBundle=Object.freeze({createArchiveJson,createArchiveManifest,createEvidenceIndex,createArchiveHash});
export function createArchiveJson(bundle){ return JSON.stringify(bundle,null,2); }
export async function createArchiveHash(bundle){ const copy=structuredClone(bundle); delete copy.hash; return sha256(JSON.stringify(copy)); }
export async function createArchiveManifest(bundle,exportedBy=''){ return {ref:bundle.ref,exportedAt:new Date().toISOString(),exportedBy,archiveHash:bundle.hash||await createArchiveHash(bundle),files:[{path:'archive.json',sha256:await sha256(createArchiveJson(bundle))},{path:'audit-thread.json',sha256:await sha256(JSON.stringify(bundle.auditThread||[]))}]}; }
export function createEvidenceIndex(bundle){ return `<!doctype html><meta charset="utf-8"><title>Archive Evidence ${bundle.ref}</title><h1>Archive Evidence: ${bundle.ref}</h1><p>Archived: ${bundle.archivedAt}</p><p>Hash: ${bundle.hash}</p>`; }
