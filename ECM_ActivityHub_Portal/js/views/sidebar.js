import { Store } from "../core/store.js";
import { isActive } from "../core/router.js";
import { escapeHtml } from "../utils/fn.js";

const NAV = [
  { group: "Executive", items: [
    { label: "Dashboard", route: "/dashboard", icon: "layout-dashboard" },
    { label: "Unified Inbox", route: "/inbox", icon: "inbox" },
    { label: "Approvals", route: "/approvals", icon: "stamp" },
    { label: "Briefs & Submissions", route: "/briefs", icon: "file-text" },
    { label: "Decisions", route: "/decisions", icon: "check-circle" },
    { label: "Meetings", route: "/meetings", icon: "calendar" },
    { label: "Tasks", route: "/tasks", icon: "list-checks" }
  ]},
  { group: "Records", items: [
    { label: "Inward Registry", route: "/correspondence/inward", icon: "folder-down" },
    { label: "Outward Registry", route: "/correspondence/outward", icon: "send" },
    { label: "Minute Sheets", route: "/minutes", icon: "route" },
    { label: "Directory", route: "/directory", icon: "users" }
  ]},
  { group: "Oversight", items: [
    { label: "Projects", route: "/projects", icon: "layers" },
    { label: "KPI Scorecards", route: "/kpi", icon: "bar-chart-3" },
    { label: "Reports", route: "/reports", icon: "download" },
    { label: "Notifications", route: "/notifications", icon: "bell" },
    { label: "Audit & Compliance", route: "/audit", icon: "shield" }
  ]},
  { group: "Admin", items: [
    { label: "Admin Console", route: "/admin", icon: "settings" },
    { label: "AI Assistant", route: "/ai", icon: "sparkles" }
  ]}
];

export function renderSidebar() {
  const open = Store.ui.sidebarOpen;
  const cls = open ? "translate-x-0" : "-translate-x-full md:translate-x-0";
  return `
  <aside class="fixed md:static inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-40 transform ${cls} transition-transform no-print">
    <div class="px-4 py-4 border-b border-slate-200 flex items-center justify-between">
      <div>
        <div class="font-extrabold text-nitda">DG/CEO Hub</div>
        <div class="text-xs text-slate-500">Executive SPA</div>
      </div>
      <button data-action="sidebar.close" class="md:hidden p-2 rounded-xl hover:bg-slate-100">
        <i data-lucide="x"></i>
      </button>
    </div>

    <div class="p-3 overflow-y-auto h-[calc(100vh-64px)] scrollbar-thin">
      ${NAV.map(sec => `
        <div class="mb-4">
          <div class="px-2 text-[11px] tracking-wide uppercase font-extrabold text-slate-400">${escapeHtml(sec.group)}</div>
          <div class="mt-2 space-y-1">
            ${sec.items.map(it => {
              const active = isActive(it.route);
              const aCls = active ? "bg-nitda/10 border-nitda text-nitda" : "hover:bg-slate-50 border-transparent text-slate-700";
              return `
                <button data-action="nav" data-route="${escapeHtml(it.route)}"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-xl border ${aCls}">
                  <i data-lucide="${escapeHtml(it.icon)}" class="w-4 h-4"></i>
                  <span class="text-sm font-semibold">${escapeHtml(it.label)}</span>
                </button>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  </aside>`;
}
