import { Store } from "../../core/store.js";
import { card, selectField, textField, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

function toneForPriority(p) {
  if (p === "Urgent") return "red";
  if (p === "High") return "amber";
  return "slate";
}

export function renderInbox() {
  const f = Store.ui.filters.inbox;
  const items = Store.entities.inbox
    .filter(x => !f.status || (x.status || "Open") === f.status)
    .filter(x => !f.priority || (x.priority || "") === f.priority)
    .filter(x => !f.q || (String(x.title||x.subject||x.refNo||"").toLowerCase().includes(String(f.q).toLowerCase())));

  const filters = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <label class="block">
        <div class="text-xs font-semibold text-slate-600">Search</div>
        <input value="${escapeHtml(f.q||"")}" data-action="filter.inbox.q" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ref, subject, title" />
      </label>
      ${selectField("Status", "ui.filters.inbox.status", ["","Open","Pending","Routed","Closed"])}
      ${selectField("Priority", "ui.filters.inbox.priority", ["","Low","Normal","High","Urgent"])}
      <div class="flex items-end gap-2">
        ${button("Refresh", "inbox.refresh", "ghost")}
        ${button("New Inward", "modal.inward.open", "primary")}
      </div>
    </div>
  `;

  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(it => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">${escapeHtml(it.type || "Item")} • ${escapeHtml(it.refNo || it.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(it.title || it.subject || "Untitled")}</div>
              <div class="mt-1 text-sm text-slate-600">${escapeHtml(it.summary || "")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(it.status || "Open", (it.status==="Closed")?"green":(it.status==="Pending"?"amber":"slate"))}
                ${badge(it.priority || "Normal", toneForPriority(it.priority))}
                ${badge(it.classification || "Internal", (it.classification==="Confidential"||it.classification==="Secret")?"purple":"blue")}
              </div>
            </div>
            <div class="flex flex-col gap-2 min-w-[170px]">
              <button data-action="inbox.route" data-id="${escapeHtml(it.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Route / Delegate</button>
              <button data-action="inbox.task" data-id="${escapeHtml(it.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Create Task</button>
              <button data-action="inbox.close" data-id="${escapeHtml(it.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No inbox items match your filters.</div>`;

  return `
    <div class="space-y-4">
      ${card("Unified Executive Inbox", filters)}
      ${card("Queue", list, `<div class="text-xs text-slate-500">${items.length} item(s)</div>`)}
    </div>
  `;
}
