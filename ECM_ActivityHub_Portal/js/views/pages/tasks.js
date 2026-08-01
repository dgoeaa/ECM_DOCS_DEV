import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderTasks() {
  const items = Store.entities.tasks || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(t => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Task • ${escapeHtml(t.id)} • Related: ${escapeHtml(t.relatedId||"—")}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(t.title||"Task")}</div>
              <div class="mt-1 text-sm text-slate-600">Owner: ${escapeHtml(t.owner||"—")} • Due: ${escapeHtml(t.dueDate||"—")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(t.status||"Open", t.status==="Completed"?"green":"slate")}
                ${badge(t.priority||"Normal", t.priority==="Urgent"?"red":(t.priority==="High"?"amber":"slate"))}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              ${t.status!=="Completed" ? `<button data-action="task.complete" data-id="${escapeHtml(t.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Complete</button>` : ""}
              <button data-action="task.delete" data-id="${escapeHtml(t.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Delete</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No tasks.</div>`;

  return `
    <div class="space-y-4">
      ${card("Directive & Task Tracking", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Track DG/CEO directives, ownership, evidence and SLAs.</div>
          <div class="flex gap-2">
            ${button("New Task", "modal.task.open", "primary")}
            ${button("Refresh", "tasks.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
