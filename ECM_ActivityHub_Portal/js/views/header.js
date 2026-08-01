import { Store } from "../core/store.js";
import { escapeHtml } from "../utils/fn.js";

export function renderHeader() {
  const u = Store.auth.user;
  return `
  <div class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200 no-print">
    <div class="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button data-action="sidebar.toggle" class="md:hidden p-2 rounded-xl hover:bg-slate-100">
          <i data-lucide="menu"></i>
        </button>
        <div>
          <div class="text-sm font-extrabold text-slate-900">DG/CEO Executive Operations</div>
          <div class="text-xs text-slate-500">NITDA Digital Operations Hub</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden md:block text-right">
          <div class="text-sm font-semibold">${escapeHtml(u.name)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(u.email)} • ${escapeHtml(u.role)}</div>
        </div>
        <button data-action="role.switch" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
          Switch Role
        </button>
      </div>
    </div>
  </div>`;
}
