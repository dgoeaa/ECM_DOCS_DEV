import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listDecisions() {
  const res = await callApi(CONFIG.ACTIONS.DECISION_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.decisions = data?.items ?? data ?? [];
  }
  return Store.entities.decisions;
}

export async function recordDecision(form) {
  const payload = { ...form, createdAt: new Date().toISOString() };
  const res = await callApi(CONFIG.ACTIONS.DECISION_RECORD, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("DEC");
    Store.entities.decisions.unshift(item);
    toast("success", "Decision recorded.");
    return true;
  }
  Store.entities.decisions.unshift({ ...payload, id: uid("DEC"), _local: true });
  toast("info", "Saved locally (demo/offline).");
  return false;
}
