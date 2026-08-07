import { VisibleWorkspaces, HiddenTechnicalRoutes, workspaceGuide } from '../config/workflow-clarity.config.js';
import { Routes } from '../config/routes.config.js';
export function guideFor(route){ return workspaceGuide?.(route) || VisibleWorkspaces.find(w=>w.route===route) || HiddenTechnicalRoutes[route] || null; }
export function allWorkspaceCommands(){
  return [
    ...VisibleWorkspaces.map(w=>({route:w.route,label:w.label,group:w.group,purpose:w.purpose,primary:true})),
    // V-05 — the palette is the one surface that reaches all 29 routes, so it is the one
    // surface where a screen must not be called something no other surface calls it. These
    // used to be route.replace(/-/g,' '), so the palette listed "scan intake" and "user
    // admin" in lower case beside nine properly-named workspaces.
    ...Object.entries(HiddenTechnicalRoutes).map(([route,v])=>({route,label:Routes.find(r=>r.path===route)?.label||route,group:'Contextual',purpose:v.reason,visibleThrough:v.visibleThrough,primary:false}))
  ];
}
