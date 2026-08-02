import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { clientMayAssertIdentity, authHeaders, ensureAuthenticated, AuthConfig, isAuthEnforced } from "../core/auth.js";

/** Endpoint target. Enforced posture routes through the authenticating proxy. */
function endpoint() {
  if (isAuthEnforced() && AuthConfig.proxyBaseUrl) {
    return String(AuthConfig.proxyBaseUrl).replace(/\/+$/, "");
  }
  return CONFIG.API_URL;
}

export async function callApi(action, payload = {}) {
  // Enforced posture: never let a governed request leave unauthenticated. No-op while inert.
  await ensureAuthenticated(Store, action);

  /* AUDIT.md F-003. While auth is inert the client asserts user and role from local Store,
     exactly as before. Once enforced BOTH fields are dropped and identity travels only in
     the bearer token, so a tampered Store cannot influence the backend. */
  const asserted = clientMayAssertIdentity()
    ? { user: Store.auth.user?.email || "unknown", role: Store.auth.user?.role || "unknown" }
    : {};

  const envelope = {
    action,
    ...asserted,
    timestamp: new Date().toISOString(),
    payload
  };

  const url = endpoint();
  if (!url) {
    return { ok: false, error: "API_URL not configured", data: null };
  }

  // Prefer a Power Automate client if present.
  const pa = window.PowerAutomateClient;
  if (pa && typeof pa.request === "function") {
    return await pa.request(url, envelope, await authHeaders());
  }

  // Fallback fetch
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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
