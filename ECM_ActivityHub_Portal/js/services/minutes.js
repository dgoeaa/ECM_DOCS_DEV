import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listMinutes() {
  const res = await callApi(CONFIG.ACTIONS.MINUTE_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.minutes = data?.items ?? data ?? [];
  }
  return Store.entities.minutes;
}

export async function createMinute(form) {
  const payload = { ...form };
  const res = await callApi(CONFIG.ACTIONS.MINUTE_CREATE, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("MIN");
    item.status = item.status || "Open";
    Store.entities.minutes.unshift(item);
    toast("success", "Minute created.");
    return true;
  }
  Store.entities.minutes.unshift({ ...payload, id: uid("MIN"), status: "Open", _local: true });
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export async function routeMinute(minuteId, routeTo, comments) {
  const res = await callApi(CONFIG.ACTIONS.MINUTE_ROUTE, { minuteId, routeTo, comments });
  Store.entities.minutes = Store.entities.minutes.map(m => m.id === minuteId ? { ...m, routeTo, comments, routedAt: new Date().toISOString(), status: "Routed", _local: !res.ok } : m);
  toast(res.ok ? "success" : "info", res.ok ? "Minute routed." : "Routed locally (demo/offline).");
  return res.ok;
}

export async function closeMinute(minuteId, closureNote = "") {
  const res = await callApi(CONFIG.ACTIONS.MINUTE_CLOSE, { minuteId, closureNote });
  Store.entities.minutes = Store.entities.minutes.map(m => m.id === minuteId ? { ...m, status: "Closed", closureNote, closedAt: new Date().toISOString(), _local: !res.ok } : m);
  toast(res.ok ? "success" : "info", res.ok ? "Minute closed." : "Closed locally (demo/offline).");
  return res.ok;
}
