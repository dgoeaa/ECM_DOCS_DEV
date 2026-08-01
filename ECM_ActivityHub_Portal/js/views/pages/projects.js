import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderProjects() {
  const items = Store.entities.projects || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(p => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Project • ${escapeHtml(p.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(p.name||"Project")}</div>
              <div class="mt-1 text-sm text-slate-600">Owner: ${escapeHtml(p.owner||"—")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(p.status||"—", p.status==="On Track"?"green":(p.status==="At Risk"?"amber":(p.status==="Off Track"?"red":"slate")))}
                ${badge(p.kpi||"—","blue")}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <button data-action="project.status" data-id="${escapeHtml(p.id)}" data-status="On Track" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">On Track</button>
              <button data-action="project.status" data-id="${escapeHtml(p.id)}" data-status="At Risk" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">At Risk</button>
              <button data-action="project.status" data-id="${escapeHtml(p.id)}" data-status="Off Track" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Off Track</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No projects.</div>`;

  return `
    <div class="space-y-4">
      ${card("Strategic Initiatives", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Oversight of strategic programs and milestones.</div>
          <div class="flex gap-2">
            ${button("Refresh", "projects.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
