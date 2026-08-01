import { Store, setDeepValue, closeModal } from "../core/store.js";
import { debounce } from "../utils/fn.js";
import { dispatchAction } from "../controllers/actions.js";
import { renderApp } from "../views/layout.js";

export function registerBindings() {
  // Generic data-bind (input/select/textarea)
  document.addEventListener("input", (e) => {
    const el = e.target;
    const bind = el?.dataset?.bind;
    if (!bind) return;
    setDeepValue(Store, bind, el.value);
  });

  // Enter to close modal (Esc)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && Store.ui.modal) {
      closeModal();
      renderApp();
    }
  });

  // Click actions
  document.addEventListener("click", async (e) => {
    const el = e.target?.closest?.("[data-action]");
    if (!el) return;
    e.preventDefault();
    await dispatchAction(el.dataset.action, el);
  });

  // (Reserved) Debounced search hooks
  document.addEventListener("keyup", debounce(() => {}, 250));
}
