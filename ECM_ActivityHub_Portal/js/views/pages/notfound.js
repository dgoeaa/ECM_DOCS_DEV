import { card } from "../components/ui.js";

export function renderNotFound() {
  return card("Not Found", `<div class="text-sm text-slate-600">The requested page does not exist.</div>`);
}
