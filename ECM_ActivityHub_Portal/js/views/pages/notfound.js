import { card } from "../components/ui.js";

export function renderNotFound() {
  return card("Not Found", `<div class="text-sm text-slate-600">The requested page does not exist.</div>`);
}

/* Rendered when a route guard refuses navigation (AUDIT.md F-004/F-005). Distinct from
   "not found" so the operator is told the route exists but is not theirs to open. */
export function renderDenied() {
  return `
  <div class="p-8">
    <div class="max-w-lg mx-auto text-center bg-white border border-slate-200 rounded-2xl p-8">
      <div class="text-[11px] tracking-wide uppercase font-extrabold text-slate-400">Access denied</div>
      <h2 class="mt-2 text-xl font-extrabold text-slate-800">This workspace is not available to your role</h2>
      <p class="mt-2 text-sm text-slate-600">
        Your signed-in account does not carry a role permitted to open this destination.
        Contact an administrator if you believe this is incorrect.
      </p>
      <button data-action="nav" data-route="/dashboard"
        class="mt-5 px-4 py-2 rounded-xl bg-nitda text-white text-sm font-semibold">Back to dashboard</button>
    </div>
  </div>`;
}
