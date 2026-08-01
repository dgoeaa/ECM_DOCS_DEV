import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";

export async function listApprovals() {
  const res = await callApi(CONFIG.ACTIONS.APPROVAL_LIST, { filters: Store.ui.filters.approvals });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.approvals = data?.items ?? data ?? [];
  }
  return Store.entities.approvals;
}

export async function decideApproval(approvalId, decision, comments) {
  const res = await callApi(CONFIG.ACTIONS.APPROVAL_DECIDE, { approvalId, decision, comments });
  Store.entities.approvals = Store.entities.approvals.map(a => a.id === approvalId ? { ...a, status: decision === "Approve" ? "Approved" : "Rejected", decisionAt: new Date().toISOString(), comments, _local: !res.ok } : a);
  toast(res.ok ? "success" : "info", res.ok ? "Decision recorded." : "Recorded locally (demo/offline).");
  return res.ok;
}
