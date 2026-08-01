import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listBriefs() {
  const res = await callApi(CONFIG.ACTIONS.BRIEF_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.briefs = data?.items ?? data ?? [];
  }
  return Store.entities.briefs;
}

export async function createBrief(form) {
  const payload = { ...form, status: "Draft" };
  const res = await callApi(CONFIG.ACTIONS.BRIEF_CREATE, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("BRF");
    Store.entities.briefs.unshift(item);
    toast("success", "Brief created.");
    return true;
  }
  Store.entities.briefs.unshift({ ...payload, id: uid("BRF"), _local: true });
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export async function submitBrief(briefId) {
  const res = await callApi(CONFIG.ACTIONS.BRIEF_SUBMIT, { briefId });
  Store.entities.briefs = Store.entities.briefs.map(b => b.id === briefId ? { ...b, status: "Submitted", submittedAt: new Date().toISOString(), _local: !res.ok } : b);
  toast(res.ok ? "success" : "info", res.ok ? "Brief submitted." : "Submitted locally (demo/offline).");
  return res.ok;
}

export async function decideBrief(briefId, decision, comments) {
  const res = await callApi(CONFIG.ACTIONS.BRIEF_DECIDE, { briefId, decision, comments });
  Store.entities.briefs = Store.entities.briefs.map(b => b.id === briefId ? { ...b, status: decision === "Approve" ? "Approved" : "Rejected", decisionAt: new Date().toISOString(), comments, _local: !res.ok } : b);
  toast(res.ok ? "success" : "info", res.ok ? "Decision recorded." : "Recorded locally (demo/offline).");
  return res.ok;
}
