import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listInbox() {
  const res = await callApi(CONFIG.ACTIONS.INBOX_LIST, { filters: Store.ui.filters.inbox });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.inbox = data?.items ?? data ?? [];
    return Store.entities.inbox;
  }
  return Store.entities.inbox;
}

export async function triageInbox(itemId, patch) {
  const res = await callApi(CONFIG.ACTIONS.INBOX_TRIAGE, { itemId, patch });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    // backend may return updated item
    const updated = data?.item;
    if (updated) {
      Store.entities.inbox = Store.entities.inbox.map(x => x.id === itemId ? updated : x);
    } else {
      Store.entities.inbox = Store.entities.inbox.map(x => x.id === itemId ? { ...x, ...patch } : x);
    }
    toast("success", "Triage updated.");
    return true;
  }
  // local fallback
  Store.entities.inbox = Store.entities.inbox.map(x => x.id === itemId ? { ...x, ...patch, _local: true } : x);
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export function promoteToTask(item) {
  const t = {
    id: uid("TSK"),
    title: item.title || item.subject || "Directive",
    owner: "Chief of Staff",
    dueDate: item.dueDate || new Date().toISOString().slice(0,10),
    status: "Open",
    priority: item.priority || "Normal",
    relatedId: item.id
  };
  Store.entities.tasks.unshift(t);
  toast("success", "Created task from inbox item.");
  return t;
}
