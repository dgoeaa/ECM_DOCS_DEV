import { clearToast, Store } from "../core/store.js";
import { renderApp } from "../views/layout.js";

export function toast(type, message) {
  Store.ui.toast = { type, message, ts: Date.now() };
  renderApp();
  setTimeout(() => {
    if (Store.ui.toast && Date.now() - Store.ui.toast.ts >= 3500) {
      clearToast();
      renderApp();
    }
  }, 3600);
}
