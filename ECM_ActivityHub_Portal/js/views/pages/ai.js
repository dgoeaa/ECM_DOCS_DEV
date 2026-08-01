import { Store } from "../../core/store.js";
import { card, button, textArea } from "../components/ui.js";
import { escapeHtml } from "../../utils/fn.js";

export function renderAi() {
  const history = Store.ui.aiHistory || [{ role: "system", content: "You are the DG/CEO Executive Assistant. Provide concise, policy-compliant support." }];
  const body = `
    <div class="space-y-3">
      <div class="h-80 overflow-y-auto scrollbar-thin bg-slate-50 border border-slate-200 rounded-2xl p-3" id="ai-scroll">
        ${history.map(m => `
          <div class="mb-2">
            <div class="text-[11px] uppercase tracking-wide font-extrabold text-slate-400">${escapeHtml(m.role)}</div>
            <div class="text-sm whitespace-pre-wrap">${escapeHtml(m.content)}</div>
          </div>
        `).join("")}
      </div>
      <textarea data-bind="ui.aiDraft" rows="4" placeholder="Ask the assistant…" class="w-full rounded-2xl border border-slate-200 p-3 text-sm"></textarea>
      <div class="flex gap-2">
        ${button("Send", "ai.send", "primary")}
        ${button("Clear", "ai.clear", "ghost")}
      </div>
      <div class="text-xs text-slate-500">AI is optional and should be policy-gated for confidential materials.</div>
    </div>
  `;
  return card("AI Assistant", body);
}
