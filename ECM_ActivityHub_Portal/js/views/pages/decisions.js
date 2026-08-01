import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderDecisions() {
  const items = Store.entities.decisions || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(d => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs text-slate-500">Decision • ${escapeHtml(d.id)}</div>
          <div class="mt-1 text-sm font-extrabold">${escapeHtml(d.title || "Decision")}</div>
          <div class="mt-1 text-sm text-slate-600 whitespace-pre-wrap">${escapeHtml(d.text || "")}</div>
          <div class="mt-2 text-xs text-slate-500">Owner: ${escapeHtml(d.owner||"—")} • Due: ${escapeHtml(d.dueDate||"—")} • Related: ${escapeHtml(d.relatedId||"—")}</div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No decisions recorded.</div>`;

  return `
    <div class="space-y-4">
      ${card("Decisions Register", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Record DG/CEO decisions, rationale and follow-ups.</div>
          <div class="flex gap-2">
            ${button("New Decision", "modal.decision.open", "primary")}
            ${button("Refresh", "decisions.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
