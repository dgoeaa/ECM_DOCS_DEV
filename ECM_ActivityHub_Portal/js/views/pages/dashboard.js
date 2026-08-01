import { Store } from "../../core/store.js";
import { card, pillStat } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderDashboard() {
  const inboxOpen = Store.entities.inbox.filter(x => (x.status || "Open") !== "Closed").length;
  const approvalsPending = Store.entities.approvals.filter(x => (x.status || "Pending") === "Pending").length;
  const tasksOpen = Store.entities.tasks.filter(x => (x.status || "Open") === "Open").length;

  const stats = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${pillStat("Open Inbox Items", String(inboxOpen))}
      ${pillStat("Pending Approvals", String(approvalsPending))}
      ${pillStat("Open Tasks", String(tasksOpen))}
    </div>
  `;

  const kpi = Store.entities.kpi?.snapshot || [];
  const kpiHtml = kpi.length ? `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${kpi.map(x => `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div class="text-xs font-semibold text-slate-600">${escapeHtml(x.name)}</div>
        <div class="mt-1 text-2xl font-extrabold">${escapeHtml(x.value)}</div>
      </div>`).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No KPI snapshot loaded.</div>`;

  const redFlags = [
    ...Store.entities.tasks.filter(t => t.status === "Open" && t.priority === "Urgent").slice(0, 5).map(t => ({ k:"Task", v:t.title, p:"Urgent"})),
    ...Store.entities.approvals.filter(a => a.status === "Pending").slice(0, 5).map(a => ({ k:"Approval", v:a.title, p:"Pending"}))
  ];

  const redHtml = redFlags.length ? `
    <div class="space-y-2">
      ${redFlags.map(r => `
        <div class="flex items-center justify-between gap-3 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
          <div>
            <div class="text-xs text-slate-500">${escapeHtml(r.k)}</div>
            <div class="text-sm font-semibold">${escapeHtml(r.v)}</div>
          </div>
          <div>${badge(r.p, r.p === "Urgent" ? "red" : "amber")}</div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No red flags.</div>`;

  return `
    <div class="space-y-4">
      ${card("Executive Overview", stats, `<button data-action="refresh.all" class="text-sm font-semibold text-nitda hover:underline">Refresh</button>`)}
      ${card("KPI Snapshot", kpiHtml)}
      ${card("Red Flags", redHtml)}
    </div>
  `;
}
