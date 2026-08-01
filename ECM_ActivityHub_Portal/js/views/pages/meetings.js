import { Store } from "../../core/store.js";
import { card, button } from "../components/ui.js";
import { badge } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderMeetings() {
  const items = Store.entities.meetings || [];
  const list = items.length ? `
    <div class="space-y-2">
      ${items.map(m => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs text-slate-500">Meeting • ${escapeHtml(m.id)}</div>
              <div class="mt-1 text-sm font-extrabold">${escapeHtml(m.title||"Meeting")}</div>
              <div class="mt-1 text-sm text-slate-600">${escapeHtml(m.date||"")} ${escapeHtml(m.time||"")} • ${escapeHtml(m.location||"")}</div>
              <div class="mt-2 flex flex-wrap gap-2">
                ${badge(m.status||"Requested", m.status==="Approved"?"green":(m.status==="Declined"?"red":"amber"))}
                ${badge(m.requestor||"—","blue")}
              </div>
              <div class="mt-2 text-sm text-slate-600">${escapeHtml((m.agenda||"").slice(0,180))}</div>
            </div>
            <div class="flex flex-col gap-2">
              ${m.status==="Requested" ? `
                <button data-action="meeting.decide" data-id="${escapeHtml(m.id)}" data-decision="Approve" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Approve</button>
                <button data-action="meeting.decide" data-id="${escapeHtml(m.id)}" data-decision="Decline" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Decline</button>
              ` : ""}
              <button data-action="meeting.tasks" data-id="${escapeHtml(m.id)}" class="rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-200 hover:bg-slate-50">Minutes → Tasks</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="text-sm text-slate-500">No meetings.</div>`;

  return `
    <div class="space-y-4">
      ${card("Meetings Control Center", `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-600">Requests, agenda control, brief packs, actions.</div>
          <div class="flex gap-2">
            ${button("New Request", "modal.meeting.open", "primary")}
            ${button("Refresh", "meetings.refresh", "ghost")}
          </div>
        </div>
      `)}
      ${card("Items", list)}
    </div>
  `;
}
