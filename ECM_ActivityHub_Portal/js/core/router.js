import { Store, setRoute } from "./store.js";
import { renderApp } from "../views/layout.js";
import { getIdentity, isAuthEnforced } from "./auth.js";

/* AUDIT.md F-004 / F-005. The router had no authorization predicate and the sidebar
   rendered privileged destinations unconditionally. ROUTE_ROLES declares which roles may
   open which route; canOpen() is consulted by the router and by the sidebar.

   This is a UX control, not a security boundary — a client-side guard can always be
   bypassed. The boundary is the server, per AUTHENTICATION_CONTRACT.md §2. While auth is
   inert the guard is permissive by design, so development and pilots are unaffected. */
export const ROUTE_ROLES = Object.freeze({
  "/admin": ["SystemAdmin", "DGCEO"],
  "/audit": ["SystemAdmin", "DGCEO", "COS"],
  "/directory": ["SystemAdmin", "DGCEO", "COS"],
});

export function canOpen(route) {
  const allowed = ROUTE_ROLES[route];
  if (!allowed) return true;                 // unrestricted route
  if (!isAuthEnforced()) return true;        // inert: permissive, development unchanged
  const role = getIdentity(Store).role;
  return !!role && allowed.includes(role);
}

export const ROUTES = [
  "/dashboard","/inbox","/correspondence/inward","/correspondence/outward","/minutes","/approvals",
  "/briefs","/decisions","/meetings","/tasks","/projects","/kpi","/reports","/notifications","/audit",
  "/directory","/admin","/ai"
];

export function parseHash() {
  const h = window.location.hash || "#/dashboard";
  const path = h.startsWith("#") ? h.slice(1) : h;
  return path.startsWith("/") ? path : "/" + path;
}

export function navigate(route) {
  if (!route.startsWith("/")) route = "/" + route;
  window.location.hash = "#" + route;
}

export function startRouter() {
  const apply = () => {
    const route = parseHash();
    if (!canOpen(route)) {
      // Explicit denial rather than a blank pane, matching the runtime's behaviour.
      setRoute("/denied");
      renderApp();
      return;
    }
    setRoute(route);
    renderApp();
  };
  window.addEventListener("hashchange", apply);
  apply();
}

export function isActive(route) {
  return Store.ui.route === route;
}
