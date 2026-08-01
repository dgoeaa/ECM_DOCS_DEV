import { escapeHtml } from "../../utils/fn.js";

export function badge(text, tone = "slate") {
  const t = escapeHtml(text);
  const cls = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700"
  }[tone] || "bg-slate-100 text-slate-700";
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${t}</span>`;
}

export function card(title, bodyHtml, rightHtml = "") {
  return `
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200">
    <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
      <div class="font-semibold">${escapeHtml(title)}</div>
      <div class="flex items-center gap-2">${rightHtml || ""}</div>
    </div>
    <div class="p-4">${bodyHtml}</div>
  </div>`;
}

export function textField(label, bindPath, placeholder = "", type="text") {
  return `
  <label class="block">
    <div class="text-xs font-semibold text-slate-600">${escapeHtml(label)}</div>
    <input data-bind="${escapeHtml(bindPath)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}"
      class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nitda/30" />
  </label>`;
}

export function selectField(label, bindPath, options = []) {
  const opts = options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
  return `
  <label class="block">
    <div class="text-xs font-semibold text-slate-600">${escapeHtml(label)}</div>
    <select data-bind="${escapeHtml(bindPath)}" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nitda/30">
      ${opts}
    </select>
  </label>`;
}

export function textArea(label, bindPath, rows=4, placeholder="") {
  return `
  <label class="block">
    <div class="text-xs font-semibold text-slate-600">${escapeHtml(label)}</div>
    <textarea data-bind="${escapeHtml(bindPath)}" rows="${rows}" placeholder="${escapeHtml(placeholder)}"
      class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nitda/30"></textarea>
  </label>`;
}

export function button(label, action, tone="primary", attrs="") {
  const cls = tone === "primary"
    ? "bg-nitda text-white hover:opacity-90"
    : tone === "danger"
    ? "bg-red-600 text-white hover:opacity-90"
    : tone === "ghost"
    ? "bg-white border border-slate-200 hover:bg-slate-50"
    : "bg-slate-800 text-white hover:opacity-90";
  return `<button data-action="${escapeHtml(action)}" class="rounded-xl px-3 py-2 text-sm font-semibold ${cls}" ${attrs}>${escapeHtml(label)}</button>`;
}

export function pillStat(label, value) {
  return `
  <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
    <div class="text-xs font-semibold text-slate-600">${escapeHtml(label)}</div>
    <div class="mt-1 text-2xl font-extrabold">${escapeHtml(value)}</div>
  </div>`;
}
