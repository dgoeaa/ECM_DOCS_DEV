import { Store } from "../../core/store.js";
import { closeModal } from "../../core/store.js";
import { escapeHtml } from "../../utils/fn.js";

function shell(title, body, actionsHtml) {
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 no-print">
    <div class="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div class="font-extrabold">${escapeHtml(title)}</div>
        <button data-action="modal.close" class="p-2 rounded-xl hover:bg-slate-100"><i data-lucide="x"></i></button>
      </div>
      <div class="p-4">${body}</div>
      <div class="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">${actionsHtml}</div>
    </div>
  </div>`;
}

export function modalInward() {
  const f = Store.ui.forms.inward;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block"><div class="text-xs font-semibold text-slate-600">Ref No</div>
        <input data-bind="ui.forms.inward.refNo" value="${escapeHtml(f.refNo)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="NITDA/DG/INW/..." />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Received Date</div>
        <input type="date" data-bind="ui.forms.inward.receivedDate" value="${escapeHtml(f.receivedDate)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Sender</div>
        <input data-bind="ui.forms.inward.sender" value="${escapeHtml(f.sender)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Subject</div>
        <input data-bind="ui.forms.inward.subject" value="${escapeHtml(f.subject)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Classification</div>
        <select data-bind="ui.forms.inward.classification" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Public","Internal","Confidential","Secret"].map(o => `<option ${o===f.classification?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Priority</div>
        <select data-bind="ui.forms.inward.priority" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Low","Normal","High","Urgent"].map(o => `<option ${o===f.priority?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Notes</div>
        <textarea data-bind="ui.forms.inward.notes" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.notes||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="corr.inward.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Register Inward", body, actions);
}

export function modalOutward() {
  const f = Store.ui.forms.outward;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block"><div class="text-xs font-semibold text-slate-600">Ref No</div>
        <input data-bind="ui.forms.outward.refNo" value="${escapeHtml(f.refNo)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="NITDA/DG/OUT/..." />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Dispatch Mode</div>
        <select data-bind="ui.forms.outward.dispatchMode" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Email","Courier","Hand Delivery"].map(o => `<option ${o===f.dispatchMode?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Recipient</div>
        <input data-bind="ui.forms.outward.recipient" value="${escapeHtml(f.recipient)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Subject</div>
        <input data-bind="ui.forms.outward.subject" value="${escapeHtml(f.subject)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Classification</div>
        <select data-bind="ui.forms.outward.classification" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Public","Internal","Confidential","Secret"].map(o => `<option ${o===f.classification?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Priority</div>
        <select data-bind="ui.forms.outward.priority" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Low","Normal","High","Urgent"].map(o => `<option ${o===f.priority?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Body</div>
        <textarea data-bind="ui.forms.outward.body" rows="6" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.body||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="corr.outward.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save Draft</button>
  `;
  return shell("Create Outward Draft", body, actions);
}

export function modalMinute(itemId = "") {
  Store.ui.forms.minute.itemId = itemId || Store.ui.forms.minute.itemId;
  const f = Store.ui.forms.minute;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Related Item</div>
        <input data-bind="ui.forms.minute.itemId" value="${escapeHtml(f.itemId)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Inward ref, inbox id, etc." />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Directive</div>
        <input data-bind="ui.forms.minute.directive" value="${escapeHtml(f.directive)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g., Please prepare…" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Route To</div>
        <input data-bind="ui.forms.minute.routeTo" value="${escapeHtml(f.routeTo)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Department/Person" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Due Date</div>
        <input type="date" data-bind="ui.forms.minute.dueDate" value="${escapeHtml(f.dueDate)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Comments</div>
        <textarea data-bind="ui.forms.minute.comments" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.comments||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="minute.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Create Minute Sheet", body, actions);
}

export function modalApprovalDecision(approvalId) {
  Store.ui.forms.approvalDecision.approvalId = approvalId;
  const f = Store.ui.forms.approvalDecision;
  const body = `
    <div class="grid grid-cols-1 gap-3">
      <div class="text-sm text-slate-600">Approval ID: <span class="font-semibold">${escapeHtml(approvalId)}</span></div>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Decision</div>
        <select data-bind="ui.forms.approvalDecision.decision" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Approve","Reject"].map(o => `<option ${o===f.decision?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Comments</div>
        <textarea data-bind="ui.forms.approvalDecision.comments" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.comments||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="approval.decide.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Record Approval Decision", body, actions);
}

export function modalBrief() {
  const f = Store.ui.forms.brief;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Title</div>
        <input data-bind="ui.forms.brief.title" value="${escapeHtml(f.title)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Theme</div>
        <select data-bind="ui.forms.brief.theme" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Digital Public Infrastructure","Cybersecurity","Innovation","Capacity Building","Regulatory"].map(o => `<option ${o===f.theme?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <div></div>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Executive Summary</div>
        <textarea data-bind="ui.forms.brief.summary" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.summary||"")}</textarea>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Background</div>
        <textarea data-bind="ui.forms.brief.background" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.background||"")}</textarea>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Options</div>
        <textarea data-bind="ui.forms.brief.options" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.options||"")}</textarea>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Risks</div>
        <textarea data-bind="ui.forms.brief.risks" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.risks||"")}</textarea>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Recommendation</div>
        <textarea data-bind="ui.forms.brief.recommendation" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.recommendation||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="brief.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Create Brief", body, actions);
}

export function modalDecision() {
  const f = Store.ui.forms.decision;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Title</div>
        <input data-bind="ui.forms.decision.title" value="${escapeHtml(f.title)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Owner</div>
        <input data-bind="ui.forms.decision.owner" value="${escapeHtml(f.owner)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Department/Person" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Due Date</div>
        <input type="date" data-bind="ui.forms.decision.dueDate" value="${escapeHtml(f.dueDate)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Related ID / Ref</div>
        <input data-bind="ui.forms.decision.relatedId" value="${escapeHtml(f.relatedId)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Decision Text</div>
        <textarea data-bind="ui.forms.decision.text" rows="5" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.text||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="decision.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Record Decision", body, actions);
}

export function modalMeeting() {
  const f = Store.ui.forms.meeting;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Title</div>
        <input data-bind="ui.forms.meeting.title" value="${escapeHtml(f.title)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Requestor</div>
        <input data-bind="ui.forms.meeting.requestor" value="${escapeHtml(f.requestor)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Location</div>
        <input data-bind="ui.forms.meeting.location" value="${escapeHtml(f.location)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Date</div>
        <input type="date" data-bind="ui.forms.meeting.date" value="${escapeHtml(f.date)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Time</div>
        <input data-bind="ui.forms.meeting.time" value="${escapeHtml(f.time)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="10:00" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Agenda</div>
        <textarea data-bind="ui.forms.meeting.agenda" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.agenda||"")}</textarea>
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Attendees (comma-separated)</div>
        <input data-bind="ui.forms.meeting.attendees" value="${escapeHtml(f.attendees)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="meeting.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Meeting Request", body, actions);
}

export function modalTask() {
  const f = Store.ui.forms.task;
  const body = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Title</div>
        <input data-bind="ui.forms.task.title" value="${escapeHtml(f.title)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Owner</div>
        <input data-bind="ui.forms.task.owner" value="${escapeHtml(f.owner)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Due Date</div>
        <input type="date" data-bind="ui.forms.task.dueDate" value="${escapeHtml(f.dueDate)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Priority</div>
        <select data-bind="ui.forms.task.priority" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          ${["Low","Normal","High","Urgent"].map(o => `<option ${o===f.priority?"selected":""} value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
      <label class="block"><div class="text-xs font-semibold text-slate-600">Related ID/Ref</div>
        <input data-bind="ui.forms.task.relatedId" value="${escapeHtml(f.relatedId)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label class="block md:col-span-2"><div class="text-xs font-semibold text-slate-600">Description</div>
        <textarea data-bind="ui.forms.task.description" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">${escapeHtml(f.description||"")}</textarea>
      </label>
    </div>
  `;
  const actions = `
    <button data-action="modal.close" class="rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-50">Cancel</button>
    <button data-action="task.save" class="rounded-xl px-3 py-2 text-sm font-semibold bg-nitda text-white hover:opacity-90">Save</button>
  `;
  return shell("Create Task", body, actions);
}
