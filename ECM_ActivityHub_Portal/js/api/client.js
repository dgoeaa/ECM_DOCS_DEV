import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";

export async function callApi(action, payload = {}) {
  const envelope = {
    action,
    user: Store.auth.user?.email || "unknown",
    role: Store.auth.user?.role || "unknown",
    timestamp: new Date().toISOString(),
    payload
  };

  if (!CONFIG.API_URL) {
    return { ok: false, error: "API_URL not configured", data: null };
  }

  // Prefer a Power Automate client if present.
  const pa = window.PowerAutomateClient;
  if (pa && typeof pa.request === "function") {
    return await pa.request(CONFIG.API_URL, envelope);
  }

  // Fallback fetch
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope)
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
