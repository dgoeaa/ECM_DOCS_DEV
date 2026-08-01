import { State } from './state.js';
import { AuditLog } from './audit-log.js';
import { Roles, RoleList, Permissions, canAccess as canAccessSubject } from '../config/rbac.config.js';
import { isAuthEnforced } from '../config/auth.config.js';
import { getIdentity } from './auth.js';

export const BOOTSTRAP_ADMIN_EMAIL = 'dgsregistry@nitda.gov.ng';

export function normalizeEmail(email=''){
  return String(email||'').trim().toLowerCase();
}

export function roleToPersona(role='viewer'){
  const r=String(role||'viewer');
  if(r==='systemAdmin'||r==='userAdmin') return 'admin';
  if(r==='executive') return 'executive';
  if(r==='director'||r==='operator') return 'registry';
  return 'general';
}

export function bootstrapAdmin(profile={}){
  const email=normalizeEmail(profile.email||BOOTSTRAP_ADMIN_EMAIL);
  return {
    id:'bootstrap-registry-admin',
    fullName: profile.name || 'Registry',
    email,
    directorate:'Registry',
    department:'Office of the Director-General',
    unit:'Digital Operations',
    jobTitle:'Bootstrap Administrator',
    role:'systemAdmin',
    persona:'admin',
    status:'active',
    accessScope:['all'],
    pilotCohort:'bootstrap',
    createdAt:new Date().toISOString(),
    createdBy:'system-bootstrap'
  };
}

export function normalizeUserRecord(user={}, profile={}){
  const role=user.role || profile.role || (profile.persona==='admin'?'systemAdmin':'viewer');
  const persona=user.persona || profile.persona || roleToPersona(role);
  return {
    id:user.id || normalizeEmail(user.email||profile.email) || crypto.randomUUID?.() || String(Date.now()),
    fullName:user.fullName || user.name || profile.name || user.email || profile.email || 'Unknown user',
    email:normalizeEmail(user.email || profile.email),
    directorate:user.directorate || user.department || profile.department || '',
    department:user.department || '',
    unit:user.unit || '',
    jobTitle:user.jobTitle || '',
    phone:user.phone || '',
    role,
    persona,
    status:user.status || 'active',
    accessScope:Array.isArray(user.accessScope)?user.accessScope:(user.accessScope?String(user.accessScope).split(',').map(x=>x.trim()).filter(Boolean):[]),
    pilotCohort:user.pilotCohort || user.cohort || '',
    createdAt:user.createdAt || new Date().toISOString(),
    updatedAt:user.updatedAt || '',
    disabledReason:user.disabledReason || '',
    createdBy:user.createdBy || '',
    updatedBy:user.updatedBy || ''
  };
}

export function getCurrentUser(state=State.get()){
  // Enforced posture: identity and role come from the validated token, never from local
  // state. This is what closes the viewer -> systemAdmin escalation: editing localStorage
  // no longer influences the effective role, because the role is not read from there.
  if(isAuthEnforced()){
    const id=getIdentity();
    if(!id.email || !id.role){
      return normalizeUserRecord({id:'unauthenticated',email:id.email||'',fullName:id.name||'',role:'viewer',persona:'general',status:'unregistered'},{});
    }
    return {...normalizeUserRecord({id:id.email,email:id.email,fullName:id.name,role:id.role,persona:roleToPersona(id.role),status:'active'},{}), registered:true, verified:true, source:'token-claims'};
  }
  const profile=state.profile||{};
  const users=Array.isArray(state.users)?state.users:[];
  const email=normalizeEmail(profile.email);
  if(!users.length){
    return {...bootstrapAdmin(profile), bootstrap:true, registered:true};
  }
  const found=users.find(u=>normalizeEmail(u.email)===email);
  if(!found){
    return normalizeUserRecord({id:'unregistered-current-user',email,fullName:profile.name||email,role:'viewer',persona:'general',status:'unregistered'}, profile);
  }
  return {...normalizeUserRecord(found, profile), registered:true};
}

export function hasPermission(user, permission){
  if(!user || user.status!=='active') return false;
  const role=Roles[user.role];
  return role?.permissions?.includes(permission) || role?.permissions?.includes('*') || false;
}

export function canManageUsers(user=getCurrentUser()){
  return hasPermission(user, Permissions.USER_CREATE) || hasPermission(user, Permissions.ROLE_ASSIGN);
}

export function canCurrentUserAccess(route, state=State.get()){
  return canAccessSubject(getCurrentUser(state), route);
}

export function ensureCurrentUserActive(action='open-workspace'){
  const user=getCurrentUser();
  if(user.status==='active') return user;
  AuditLog.record({event:'audit:access-denied',actor:State.get().profile||{},ref:user.email||'',meta:{reason:user.status, action}});
  throw new Error(user.status==='disabled'?'User account is disabled.':'User is not enrolled for this pilot.');
}

export function userSummary(user=getCurrentUser()){
  return `${user.fullName||user.email} · ${user.role} · ${user.status}`;
}
