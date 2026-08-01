export const RequiredStateCollections = Object.freeze(['activities','tracking','correspondence','operations','registryFiles','fileMovements','registryMinutes','escalations','notifications','dispatches','correspondenceEmails','comments','approvals','users','categories','departments','emails','audit','pending']);
export const RequiredStateObjects = Object.freeze(['profile','settings','runtime']);
export const CollectionDefaults = Object.freeze(Object.fromEntries(RequiredStateCollections.map(k=>[k,[]])));
export function normalizePlatformState(raw={}){ const out={...raw}; for(const k of RequiredStateCollections) if(!Array.isArray(out[k])) out[k]=[]; for(const k of RequiredStateObjects) if(!out[k]||typeof out[k]!=='object') out[k]={}; return out; }
