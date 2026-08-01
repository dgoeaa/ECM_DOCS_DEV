import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";

export async function getKpiSnapshot() {
  const res = await callApi(CONFIG.ACTIONS.KPI_SNAPSHOT, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.kpi = data?.kpi ?? data ?? Store.entities.kpi;
    Store.entities.kpi.updatedAt = new Date().toISOString();
  }
  return Store.entities.kpi;
}
