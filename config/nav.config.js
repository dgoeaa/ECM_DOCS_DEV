import { VisibleWorkspaces } from './workflow-clarity.config.js';
export const NavGroups = Object.freeze([
  { group:'START HERE', routes: VisibleWorkspaces.filter(w=>w.group==='START HERE').map(w=>w.route) },
  { group:'OPERATIONS', routes: VisibleWorkspaces.filter(w=>w.group==='OPERATIONS').map(w=>w.route) },
  { group:'CONTROL', routes: VisibleWorkspaces.filter(w=>w.group==='CONTROL').map(w=>w.route) },
  { group:'CLOSURE', routes: VisibleWorkspaces.filter(w=>w.group==='CLOSURE').map(w=>w.route) },
  { group:'SYSTEM', routes: VisibleWorkspaces.filter(w=>w.group==='SYSTEM').map(w=>w.route) }
]);
