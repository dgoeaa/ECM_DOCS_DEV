import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderNotifications() {
  const items = Store.entities.notifications || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(n => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">${escapeHtml(new Date(n.ts||Date.now()).toLocaleString())}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(n.title||"Notification")}</div>
              <div class="mt-1 text-sm text-slate-600">${escapeHtml(n.message||"")}</div>
              <div class="mt-2">${badge(n.acknowledged ? "Acknowledged" : "New", n.acknowledged ? "green" : "amber")}</div>
            </div>
            <div>
              ${!n.acknowledged ? `<button data-action="notif.ack" data-id="${escapeHtml(n.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Acknowledge</button>` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No notifications.</div>`;

  return `
    <div class="space-y-4">
      ${card("Notifications", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Escalations, SLA breaches, and updates.</div>
          <div class="flex gap-2">${button("Refresh", "notif.refresh", "ghost")}</div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
