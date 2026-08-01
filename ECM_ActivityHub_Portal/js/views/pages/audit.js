import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderAudit() {
  const items = Store.entities.audit || [];
  const table = items.length ? `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500">
          <th class="py-2">Time</th><th>Actor</th><th>Action</th><th>Target</th>
        </tr></thead>
        <tbody>
          ${items.map(a => `
            <tr class="border-t border-slate-200">
              <td class="py-2">${escapeHtml(new Date(a.ts||Date.now()).toLocaleString())}</td>
              <td class="font-semibold">${escapeHtml(a.actor||"")}</td>
              <td>${escapeHtml(a.action||"")}</td>
              <td>${escapeHtml(a.target||"")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="text-sm text-slate-500">No audit events.</div>`;

  return `
    <div class="space-y-4">
      ${card("Audit & Compliance", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Immutable log of actions and governance events.</div>
          <div class="flex gap-2">${button("Refresh", "audit.refresh", "ghost")}</div>
        </div>
      `)}
      ${card("Events", table)}
    </div>
  `;
}
