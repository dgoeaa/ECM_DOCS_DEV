import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderBriefs() {
  const items = Store.entities.briefs || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(b => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Brief • ${escapeHtml(b.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(b.title || "Brief")}</div>
              <div class="mt-1 text-sm text-slate-600">${escapeHtml((b.summary||"").slice(0,180))}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(b.status || "Draft", b.status==="Approved"?"green":(b.status==="Rejected"?"red":(b.status==="Submitted"?"amber":"slate")))}
                ${badge(b.theme || "—", "blue")}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              ${b.status === "Draft" ? `<button data-action="brief.submit" data-id="${escapeHtml(b.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Submit</button>` : ""}
              ${b.status === "Submitted" ? `<button data-action="brief.decide.open" data-id="${escapeHtml(b.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Decide</button>` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No briefs yet.</div>`;

  return `
    <div class="space-y-4">
      ${card("Briefs & Submissions", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Create brief packs for decisions and ministerial submissions.</div>
          <div class="flex gap-2">
            ${button("New Brief", "modal.brief.open", "primary")}
            ${button("Refresh", "briefs.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
