import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderKpi() {
  const snap = Store.entities.kpi?.snapshot || [];
  const updated = Store.entities.kpi?.updatedAt;
  const body = snap.length ? `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${snap.map(x => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-semibold text-slate-600">${escapeHtml(x.name)}</div>
          <div class="mt-1 text-2xl font-extrabold">${escapeHtml(x.value)}</div>
        </div>
      `).join("")}
    </div>
    <div class="mt-2 text-xs text-slate-500">Updated: ${escapeHtml(updated || "—")}</div>
  ` : `<div class="text-sm text-slate-500">No KPI snapshot loaded.</div>`;

  return `
    <div class="space-y-4">
      ${card("KPI Scorecards", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Executive performance indicators (departmental and strategic).</div>
          <div class="flex gap-2">${button("Refresh", "kpi.refresh", "ghost")}</div>
        </div>
      `)}
      ${card("Snapshot", body)}
    </div>
  `;
}
