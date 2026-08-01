import { CONFIG } from "../../core/config.js";
import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderAdmin() {
  return `
    <div class="space-y-4">
      ${card("Admin Console", `
        <div class="text-sm text-slate-600">Configuration, reference data and governance controls.</div>
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <div class="text-xs font-semibold text-slate-600">Environment</div>
            <div class="mt-1 text-sm"><span class="font-semibold">ENV:</span> ${escapeHtml(CONFIG.ENV)}<br>
              <span class="font-semibold">API_URL:</span> ${escapeHtml(CONFIG.API_URL || "(not set)")}</div>
          </div>
          <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <div class="text-xs font-semibold text-slate-600">Current User</div>
            <div class="mt-1 text-sm">${escapeHtml(Store.auth.user.name)}<br>${escapeHtml(Store.auth.user.email)}<br>${escapeHtml(Store.auth.user.role)}</div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${button("Refresh All", "refresh.all", "primary")}
          ${button("Toggle Demo Toast", "admin.demoToast", "ghost")}
        </div>
      `)}
    </div>
  `;
}
