import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";

export async function listNotifications() {
  const res = await callApi(CONFIG.ACTIONS.NOTIFICATIONS_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.notifications = data?.items ?? data ?? [];
  }
  return Store.entities.notifications;
}

export async function ackNotification(id) {
  const res = await callApi(CONFIG.ACTIONS.NOTIFICATIONS_ACK, { id });
  Store.entities.notifications = Store.entities.notifications.map(n => n.id === id ? { ...n, acknowledged: true, _local: !res.ok } : n);
  return res.ok;
}

export async function listAudit(filter = {}) {
  const res = await callApi(CONFIG.ACTIONS.AUDIT_LIST, { filter });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.audit = data?.items ?? data ?? [];
  }
  return Store.entities.audit;
}

export async function getSlaMetrics() {
  const res = await callApi(CONFIG.ACTIONS.SLA_METRICS, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.sla = data?.sla ?? data ?? Store.entities.sla;
    Store.entities.sla.updatedAt = new Date().toISOString();
  }
  return Store.entities.sla;
}

export async function listDirectory() {
  const res = await callApi(CONFIG.ACTIONS.DIRECTORY_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.directory = data?.items ?? data ?? [];
  }
  return Store.entities.directory;
}

export async function generateReport(reportType) {
  const res = await callApi(CONFIG.ACTIONS.REPORT_GENERATE, { reportType });
  return res;
}
