import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listInward() {
  const res = await callApi(CONFIG.ACTIONS.CORR_INWARD_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.inward = data?.items ?? data ?? [];
  }
  return Store.entities.inward;
}

export async function listOutward() {
  const res = await callApi(CONFIG.ACTIONS.CORR_OUTWARD_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.outward = data?.items ?? data ?? [];
  }
  return Store.entities.outward;
}

export async function registerInward(form) {
  const payload = { ...form };
  const res = await callApi(CONFIG.ACTIONS.CORR_REGISTER_INWARD, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("INW");
    Store.entities.inward.unshift(item);
    toast("success", "Inward registered.");
    return true;
  }
  const local = { ...payload, id: uid("INW"), status: "Open", _local: true };
  Store.entities.inward.unshift(local);
  toast("info", "Registered locally (demo/offline).");
  return false;
}

export async function createOutward(form) {
  const payload = { ...form };
  const res = await callApi(CONFIG.ACTIONS.CORR_CREATE_OUTWARD, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("OUT");
    Store.entities.outward.unshift(item);
    toast("success", "Outward created.");
    return true;
  }
  const local = { ...payload, id: uid("OUT"), status: "Draft", _local: true };
  Store.entities.outward.unshift(local);
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export async function deleteCorrespondence(type, id) {
  const res = await callApi(CONFIG.ACTIONS.CORR_DELETE, { type, id });
  if (type === "inward") Store.entities.inward = Store.entities.inward.filter(x => x.id !== id);
  if (type === "outward") Store.entities.outward = Store.entities.outward.filter(x => x.id !== id);
  toast(res.ok ? "success" : "info", res.ok ? "Deleted." : "Deleted locally (demo/offline).");
  return res.ok;
}
