import { VisibleWorkspaces, HiddenTechnicalRoutes, workspaceGuide } from '../config/workflow-clarity.config.js';
export function guideFor(route){ return workspaceGuide?.(route) || VisibleWorkspaces.find(w=>w.route===route) || HiddenTechnicalRoutes[route] || null; }
export function allWorkspaceCommands(){
  return [
    ...VisibleWorkspaces.map(w=>({route:w.route,label:w.label,group:w.group,purpose:w.purpose,primary:true})),
    ...Object.entries(HiddenTechnicalRoutes).map(([route,v])=>({route,label:route.replace(/-/g,' '),group:'Contextual',purpose:v.reason,visibleThrough:v.visibleThrough,primary:false}))
  ];
}
