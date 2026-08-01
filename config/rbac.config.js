export const Personas = ['admin','executive','registry','general'];
export const RoleRouteAccess = Object.freeze({
  systemAdmin: ['*'],
  userAdmin: ['home','settings','user-admin','diagnostics','operator-hud'],
  executive: ['home','executive','response-tracking','approvals','reports','statistics','lookup','assistant','archive'],
  director: ['home','activities','correspondence','response-tracking','orchestrator','approvals','dispatch','reports','statistics','lookup','assistant'],
  operator: ['home','activities','correspondence','response-tracking','orchestrator','single-assignment','bulk-assignment','registry','comments','dispatch','correspondence-email','lookup','assistant'],
  viewer: ['home','response-tracking','reports','statistics','lookup']
});
export const RolePersonaMap = Object.freeze({systemAdmin:'admin', userAdmin:'admin', executive:'executive', director:'registry', operator:'registry', viewer:'general'});
function routeAllowedForRole(role, route){ const xs=RoleRouteAccess[role]||[]; return xs.includes('*') || xs.includes(route); }
export function canAccess(subject, route) {
  const user=typeof subject==='string'?{persona:subject,role:'',status:'active'}:(subject||{});
  if(user.status && user.status!=='active') return false;
  if(user.role && routeAllowedForRole(user.role, route)) return true;
  const persona=user.persona;
  if (persona === 'admin') return true;
  if (route === 'user-admin') return false;
  if (persona === 'executive') return !['settings','operator-hud','user-admin'].includes(route);
  if (persona === 'general') return !['executive','settings','operator-hud','diagnostics','user-admin'].includes(route);
  return persona === 'registry' ? route !== 'user-admin' : false;
}
// Capability model ported from the R11.5 platform's rbac.config.js (roles/permissions), used by
// User Administration for the role-capability matrix. Route gating above is unchanged (canAccess()).
export const Permissions = Object.freeze({
  USER_VIEW: 'user:view', USER_CREATE: 'user:create', USER_UPDATE: 'user:update', USER_DISABLE: 'user:disable',
  ROLE_ASSIGN: 'role:assign', ROLE_VIEW: 'role:view', SETTINGS_MANAGE: 'settings:manage', AUDIT_VIEW: 'audit:view',
  DISPATCH_APPROVE: 'dispatch:approve', BULK_ASSIGN: 'bulk:assign', ROUTE_MANAGE: 'route:manage',
  EXECUTIVE_VIEW: 'executive:view', EXECUTIVE_EXPORT: 'executive:export'
});
export const Roles = Object.freeze({
  systemAdmin: { id: 'systemAdmin', label: 'System Administrator', permissions: Object.values(Permissions) },
  userAdmin: { id: 'userAdmin', label: 'User Administrator', permissions: [Permissions.USER_VIEW, Permissions.USER_CREATE, Permissions.USER_UPDATE, Permissions.USER_DISABLE, Permissions.ROLE_ASSIGN, Permissions.ROLE_VIEW, Permissions.AUDIT_VIEW] },
  executive: { id: 'executive', label: 'Executive', permissions: [Permissions.EXECUTIVE_VIEW, Permissions.EXECUTIVE_EXPORT, Permissions.AUDIT_VIEW] },
  director: { id: 'director', label: 'Director / Directorate Lead', permissions: [Permissions.EXECUTIVE_VIEW, Permissions.ROUTE_MANAGE, Permissions.DISPATCH_APPROVE, Permissions.BULK_ASSIGN] },
  operator: { id: 'operator', label: 'Operator', permissions: [Permissions.ROUTE_MANAGE, Permissions.BULK_ASSIGN] },
  viewer: { id: 'viewer', label: 'Read-only Viewer', permissions: [] }
});
export const RoleList = Object.values(Roles);

export const PersonaScopes = Object.freeze({
  admin: { directorateScope:['all'], canInspectQuarantine:true, canArchive:true, canClose:true },
  executive: { directorateScope:['all'], canInspectQuarantine:false, canArchive:true, canClose:true },
  registry: { directorateScope:['all'], canInspectQuarantine:true, canArchive:true, canClose:true },
  general: { directorateScope:[], canInspectQuarantine:false, canArchive:false, canClose:false }
});
