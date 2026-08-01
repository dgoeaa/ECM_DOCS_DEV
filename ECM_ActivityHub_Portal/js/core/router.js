import { Store, setRoute } from "./store.js";
import { renderApp } from "../views/layout.js";

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
    setRoute(route);
    renderApp();
  };
  window.addEventListener("hashchange", apply);
  apply();
}

export function isActive(route) {
  return Store.ui.route === route;
}
