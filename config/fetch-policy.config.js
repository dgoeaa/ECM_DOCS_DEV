export const FetchPolicy = Object.freeze({
  // Bounded UI-facing timeouts: a sync against an unreachable endpoint must surface its failure
  // toast promptly rather than spinning for up to 45-120s. Values still accommodate Power Automate
  // manual-trigger cold starts (typically <10s).
  defaults: { timeoutMs:15000, retry:1, dedupe:true, staleWhileRevalidate:true, cacheTtlMs:300000, backgroundRefresh:false },
  endpoints: {
    FETCH_ALL: { timeoutMs:20000, retry:1, dedupe:true, staleWhileRevalidate:true, cacheTtlMs:600000, payloadBudgetBytes:6500000 },
    FETCH_ACTIVITIES: { timeoutMs:15000, retry:1, dedupe:true, staleWhileRevalidate:true, cacheTtlMs:300000, payloadBudgetBytes:2500000 },
    AI_CHAT: { timeoutMs:30000, retry:0, dedupe:false, staleWhileRevalidate:false, cacheTtlMs:0, payloadBudgetBytes:500000 },
    DYNAMIC_ACTIONS: { timeoutMs:15000, retry:0, dedupe:false, staleWhileRevalidate:false, cacheTtlMs:0, payloadBudgetBytes:1000000 },
    OTP_GENERATE: { timeoutMs:20000, retry:0, dedupe:false, staleWhileRevalidate:false, cacheTtlMs:0 },
    OTP_VERIFY: { timeoutMs:20000, retry:0, dedupe:false, staleWhileRevalidate:false, cacheTtlMs:0 }
  }
});
export function fetchPolicyFor(key){ return Object.freeze({ ...FetchPolicy.defaults, ...(FetchPolicy.endpoints[key]||{}) }); }
