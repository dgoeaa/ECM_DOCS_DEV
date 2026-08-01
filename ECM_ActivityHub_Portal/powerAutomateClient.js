(function () {
  /**
   * Minimal fetch-based client for Power Automate HTTP-trigger flows.
   * If you already have a richer client, replace this file while keeping the same API:
   *   window.PowerAutomateClient.request(url, payload) -> Promise<{ok:boolean, data:any, error?:string}>
   *
   * Configuration via window.DGO_CONFIG (set in config.local.js before this script loads):
   *   window.DGO_CONFIG = {
   *     API_URL: "https://your-rotated-flow-url...",   // overrides js/core/config.js API_URL
   *   };
   */
  async function request(url, payload) {
    // Allow window.DGO_CONFIG to override the URL passed by the caller.
    const effectiveUrl =
      (typeof window !== 'undefined' && window.DGO_CONFIG?.API_URL) || url;

    if (!effectiveUrl) {
      return { ok: false, error: 'No API URL configured', data: null };
    }

    try {
      const res = await fetch(effectiveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, data };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: String(e), data: null };
    }
  }
  window.PowerAutomateClient = { request };
})();
