import { Store } from "../core/store.js";
import { renderSidebar } from "./sidebar.js";
import { renderHeader } from "./header.js";
import { renderRoute } from "./router.js";
import { escapeHtml } from "../utils/fn.js";

export function renderApp() {
  const app = document.getElementById("app");
  if (!app) return;

  const overlay = Store.ui.sidebarOpen ? `<div data-action="sidebar.close" class="fixed inset-0 bg-black/20 z-30 md:hidden no-print"></div>` : "";
  const toast = Store.ui.toast ? `
    <div class="fixed bottom-4 right-4 z-50 no-print">
      <div class="bg-white border border-slate-200 shadow-lg rounded-2xl px-4 py-3 max-w-sm">
        <div class="text-xs font-extrabold uppercase tracking-wide text-slate-400">${escapeHtml(Store.ui.toast.type||"info")}</div>
        <div class="text-sm font-semibold">${escapeHtml(Store.ui.toast.message||"")}</div>
      </div>
    </div>` : "";

  const busy = Store.ui.busy ? `
    <div class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center no-print">
      <div class="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 w-[320px]">
        <div class="flex items-center gap-2">
          <div class="animate-spin w-4 h-4 border-2 border-slate-300 border-t-nitda rounded-full"></div>
          <div class="text-sm font-semibold">${escapeHtml(Store.ui.busyText||"Loading…")}</div>
        </div>
        <div class="mt-2 text-xs text-slate-500">Please wait.</div>
      </div>
    </div>` : "";

  const modal = Store.ui.modal ? Store.ui.modal : "";

  app.innerHTML = `
    <div class="min-h-screen flex">
      ${renderSidebar()}
      ${overlay}
      <main class="flex-1 min-w-0">
        ${renderHeader()}
        <div class="px-4 md:px-6 py-6">
          ${renderRoute()}
        </div>
      </main>
    </div>
    ${toast}
    ${busy}
    ${modal}
  `;

  // icons
  window.lucide?.createIcons?.();
}
