import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderInward() {
  const items = Store.entities.inward || [];
  const table = items.length ? `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500">
          <th class="py-2">Ref No</th><th>Sender</th><th>Subject</th><th>Class</th><th>Priority</th><th>Received</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${items.map(x => `
            <tr class="border-t border-slate-200">
              <td class="py-2 font-semibold">${escapeHtml(x.refNo||x.id)}</td>
              <td>${escapeHtml(x.sender||"")}</td>
              <td>${escapeHtml(x.subject||"")}</td>
              <td>${badge(x.classification||"Internal", (x.classification==="Confidential"||x.classification==="Secret")?"purple":"blue")}</td>
              <td>${badge(x.priority||"Normal", x.priority==="Urgent"?"red":(x.priority==="High"?"amber":"slate"))}</td>
              <td>${escapeHtml(x.receivedDate||"")}</td>
              <td>${badge(x.status||"Open", (x.status==="Closed")?"green":"slate")}</td>
              <td class="text-right">
                <button data-action="corr.inward.delete" data-id="${escapeHtml(x.id)}" class="text-xs font-semibold text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="text-sm text-slate-500">No inward records.</div>`;

  return `
    <div class="space-y-4">
      ${card("Inward Registry", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Registry of incoming correspondence (scanned/registered).</div>
          <div class="flex gap-2">
            ${button("New Inward", "modal.inward.open", "primary")}
            ${button("Refresh", "corr.inward.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Records", table)}
    </div>
  `;
}
