// Shared modal focus trap (Workstream D2.1).
// One implementation for every modal-class surface: shell dialogs, drawers, the command
// palette and the welcome/OTP overlay. Traps Tab and Shift+Tab inside the active surface,
// makes background content non-focusable, supports Escape where the caller allows it, and
// restores focus to the launching control on release.
const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,object,embed,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

const isVisible = el => {
  if (!el) return false;
  if (el.hidden) return false;
  // Elements inside a hidden, inert or aria-hidden subtree are out of the tab order.
  if (el.closest && el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  // offsetParent is undefined in non-layout environments (tests/diagnostics): treat as visible.
  if (typeof el.offsetParent === 'undefined') return true;
  return el.offsetParent !== null || el.tagName === 'DIALOG';
};

/** Focusable elements inside a container, in document order. */
export function focusableWithin(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(isVisible);
}

/**
 * Trap focus inside `container`.
 * @param {Element} container surface that owns focus while open
 * @param {object} options
 * @param {Element|string|Function} [options.initialFocus] element, selector or resolver focused on open
 * @param {Function} [options.onEscape] called when Escape is pressed; omit to ignore Escape
 * @param {Element} [options.restoreFocusTo] control that receives focus on release
 * @param {Function} [options.scope] returns the currently active sub-surface (multi-phase overlays)
 * @returns {{release: Function, refocus: Function}}
 */
export function createFocusTrap(container, options = {}) {
  const doc = container?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!container || !doc) return { release() {}, refocus() {} };

  const opener = options.restoreFocusTo
    || (doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null);
  const scope = () => (typeof options.scope === 'function' && options.scope()) || container;

  // Background content must not be reachable by keyboard or assistive technology.
  const hidden = [];
  const body = doc.body;
  if (body && body.children) {
    Array.from(body.children).forEach(node => {
      if (node === container || node.contains?.(container)) return;
      hidden.push({ node, inert: node.inert, ariaHidden: node.getAttribute?.('aria-hidden') });
      try { node.inert = true; } catch { /* older engines */ }
      node.setAttribute?.('aria-hidden', 'true');
    });
  }

  const onKeyDown = event => {
    if (event.key === 'Escape' && typeof options.onEscape === 'function') {
      event.preventDefault();
      options.onEscape(event);
      return;
    }
    if (event.key !== 'Tab') return;
    const surface = scope();
    const items = focusableWithin(surface);
    if (!items.length) { event.preventDefault(); container.focus?.(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const activeEl = doc.activeElement;
    const inside = surface.contains?.(activeEl);
    if (event.shiftKey) {
      if (!inside || activeEl === first) { event.preventDefault(); last.focus?.(); }
    } else if (!inside || activeEl === last) {
      event.preventDefault();
      first.focus?.();
    }
  };

  // Guards focus moves that bypass keyboard navigation (programmatic focus, screen-reader cursor).
  const onFocusIn = event => {
    const surface = scope();
    if (surface.contains?.(event.target)) return;
    const items = focusableWithin(surface);
    (items[0] || container).focus?.();
  };

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('focusin', onFocusIn, true);

  const refocus = () => {
    const surface = scope();
    let target = typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus;
    if (typeof target === 'string') target = surface.querySelector?.(target);
    if (!target || !isVisible(target)) target = focusableWithin(surface)[0];
    (target || container).focus?.();
  };
  refocus();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    hidden.forEach(({ node, inert, ariaHidden }) => {
      try { node.inert = !!inert; } catch { /* older engines */ }
      if (ariaHidden === null || ariaHidden === undefined) node.removeAttribute?.('aria-hidden');
      else node.setAttribute?.('aria-hidden', ariaHidden);
    });
    try { opener?.focus?.(); } catch { /* opener detached */ }
  };

  container._releaseTrap = release;
  return { release, refocus };
}

export default createFocusTrap;
