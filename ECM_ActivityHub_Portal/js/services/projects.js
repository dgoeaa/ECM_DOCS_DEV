import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";

export async function listProjects() {
  const res = await callApi(CONFIG.ACTIONS.PROJECT_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.projects = data?.items ?? data ?? [];
  }
  return Store.entities.projects;
}

export async function updateProject(projectId, patch) {
  const res = await callApi(CONFIG.ACTIONS.PROJECT_UPDATE, { projectId, patch });
  Store.entities.projects = Store.entities.projects.map(p => p.id === projectId ? { ...p, ...patch, _local: !res.ok } : p);
  toast(res.ok ? "success" : "info", res.ok ? "Project updated." : "Updated locally (demo/offline).");
  return res.ok;
}
