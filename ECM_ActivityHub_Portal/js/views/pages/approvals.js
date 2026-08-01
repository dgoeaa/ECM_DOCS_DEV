import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderApprovals() {
  const items = Store.entities.approvals || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(a => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Approval • ${escapeHtml(a.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(a.title || "Approval item")}</div>
              <div class="mt-1 text-sm text-slate-600">Requester: ${escapeHtml(a.requester || "—")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(a.status || "Pending", (a.status==="Approved")?"green":(a.status==="Rejected"?"red":"amber"))}
                ${badge(a.classification || "Internal", (a.classification==="Confidential"||a.classification==="Secret")?"purple":"blue")}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <button data-action="approval.decide.open" data-id="${escapeHtml(a.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Decide</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No approvals.</div>`;

  return `
    <div class="space-y-4">
      ${card("Approvals Queue", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Approve, reject, or request changes with full audit trail.</div>
          <div class="flex gap-2">
            ${button("Refresh", "approvals.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
