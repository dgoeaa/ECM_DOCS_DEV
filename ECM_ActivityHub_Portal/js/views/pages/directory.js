import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderDirectory() {
  const items = Store.entities.directory?.length ? Store.entities.directory : Store.ref.people;
  const table = items.length ? `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500">
          <th class="py-2">Name</th><th>Email</th><th>Department</th>
        </tr></thead>
        <tbody>
          ${items.map(p => `
            <tr class="border-t border-slate-200">
              <td class="py-2 font-semibold">${escapeHtml(p.name||"")}</td>
              <td>${escapeHtml(p.email||"")}</td>
              <td>${escapeHtml(p.department||"")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="text-sm text-slate-500">No directory entries.</div>`;

  return `
    <div class="space-y-4">
      ${card("Directory", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Stakeholders and internal contacts.</div>
          <div class="flex gap-2">${button("Refresh", "directory.refresh", "ghost")}</div>
        </div>
      `)}
      ${card("People", table)}
    </div>
  `;
}
