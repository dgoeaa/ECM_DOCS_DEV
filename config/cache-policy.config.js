export const CachePolicy = Object.freeze({
  enabled:true,
  namespaces:{
    FETCH_ALL:{ttlMs:600000, immutable:false, staleWhileRevalidate:true},
    LOOKUP:{ttlMs:180000, immutable:false, staleWhileRevalidate:true},
    DASHBOARD:{ttlMs:120000, immutable:false, staleWhileRevalidate:true},
    REFERENCE_DETAIL:{ttlMs:300000, immutable:false, staleWhileRevalidate:true},
    ARCHIVE:{ttlMs:86400000, immutable:true, staleWhileRevalidate:false},
    SETTINGS:{ttlMs:86400000, immutable:false, staleWhileRevalidate:false}
  },
  maxEntries:250,
  maxPayloadBytes:7000000
});
export function cachePolicyFor(namespace){ return CachePolicy.namespaces[namespace] || {ttlMs:300000, immutable:false, staleWhileRevalidate:true}; }
