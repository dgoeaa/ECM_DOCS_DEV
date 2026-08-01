import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderMinutes() {
  const items = Store.entities.minutes || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(m => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Minute • ${escapeHtml(m.itemId || m.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(m.directive || "Directive")}</div>
              <div class="mt-1 text-sm text-slate-600">${escapeHtml(m.comments || "")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(m.status || "Open", m.status==="Closed"?"green":(m.status==="Routed"?"amber":"slate"))}
                ${badge(m.routeTo || "—", "blue")}
                ${badge(m.dueDate || "—", "slate")}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <button data-action="minute.route" data-id="${escapeHtml(m.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Route</button>
              <button data-action="minute.close" data-id="${escapeHtml(m.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No minute sheets.</div>`;

  return `
    <div class="space-y-4">
      ${card("Minute Sheets", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Create directives, route to departments, track completion.</div>
          <div class="flex gap-2">
            ${button("New Minute", "modal.minute.open", "primary")}
            ${button("Refresh", "minute.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
