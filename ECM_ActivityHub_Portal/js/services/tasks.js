import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listTasks() {
  const res = await callApi(CONFIG.ACTIONS.TASK_LIST, { filters: Store.ui.filters.tasks });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.tasks = data?.items ?? data ?? [];
  }
  return Store.entities.tasks;
}

export async function createTask(form) {
  const payload = { ...form, status: "Open" };
  const res = await callApi(CONFIG.ACTIONS.TASK_CREATE, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("TSK");
    Store.entities.tasks.unshift(item);
    toast("success", "Task created.");
    return true;
  }
  Store.entities.tasks.unshift({ ...payload, id: uid("TSK"), _local: true });
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export async function updateTask(taskId, patch) {
  const res = await callApi(CONFIG.ACTIONS.TASK_UPDATE, { taskId, patch });
  Store.entities.tasks = Store.entities.tasks.map(t => t.id === taskId ? { ...t, ...patch, _local: !res.ok } : t);
  toast(res.ok ? "success" : "info", res.ok ? "Task updated." : "Updated locally (demo/offline).");
  return res.ok;
}

export async function completeTask(taskId) {
  return updateTask(taskId, { status: "Completed", completedAt: new Date().toISOString() });
}

export async function deleteTask(taskId) {
  const res = await callApi(CONFIG.ACTIONS.TASK_DELETE, { taskId });
  Store.entities.tasks = Store.entities.tasks.filter(t => t.id !== taskId);
  toast(res.ok ? "success" : "info", res.ok ? "Task deleted." : "Deleted locally (demo/offline).");
  return res.ok;
}
