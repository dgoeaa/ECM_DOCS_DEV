import { State } from './state.js';
import { PlatformProvisioning, ProvisioningVersion } from '../config/platform-provisioning.config.js';
import { normalizePlatformState, RequiredStateCollections, RequiredStateObjects } from '../config/state-schema.config.js';
import { AuditLog } from './audit-log.js';
export const PlatformProvisioner = Object.freeze({version:ProvisioningVersion, ensure, validate, moduleSpec, allModules, stateCoverage});
export function ensure(){
  const s=State.get(); const normalized=normalizePlatformState(s); const patch={};
  for(const k of RequiredStateCollections) if(!Array.isArray(s[k])) patch[k]=[];
  for(const k of RequiredStateObjects) if(!s[k]||typeof s[k]!=='object') patch[k]={};
  if(!s.runtime?.provisioning || s.runtime.provisioning.version!==ProvisioningVersion){ patch.runtime={...(s.runtime||{}), provisioning:{version:ProvisioningVersion, appliedAt:new Date().toISOString(), modules:Object.keys(PlatformProvisioning).length}}; }
  if(Object.keys(patch).length) State.patch(patch,{module:'platform-provisioner',action:'ensure-provisioning'});
  AuditLog.record({event:'audit:platform-provisioned', actor:State.get().profile||{}, meta:{version:ProvisioningVersion, modules:Object.keys(PlatformProvisioning).length}});
  return validate();
}
/**
 * Provisioning health, as rendered by Diagnostics and published on __DGO_PROVISIONING__.
 *
 * `readOnly` workspaces declare no actions, and that is a provisioned state rather than an
 * unprovisioned one — ecm-erp-charter renders a charter and changes nothing. Requiring a
 * non-empty action list of every module would report the only correct entry for such a
 * workspace as a defect; not distinguishing them at all would let a workflow module that
 * had lost its actions pass as a reference page. The flag is declared in the manifest, so
 * the difference is a decision on the record rather than an inference made here.
 */
export function validate(){
  const s=State.get(); const missingState=[...RequiredStateCollections,...RequiredStateObjects].filter(k=>s[k]===undefined);
  const modules=Object.entries(PlatformProvisioning).map(([module,spec])=>{
    const readOnly=!!spec.readOnly;
    const actions=spec.actions.length;
    return {module, enabled:!!spec.enabled, readOnly, features:spec.features.length, functions:spec.functions.length, actions, stateKeys:spec.stateKeys.length,
      ok:!!spec.enabled&&spec.features.length>0&&spec.functions.length>0&&(readOnly?actions===0:actions>0)};
  });
  return Object.freeze({ok:missingState.length===0&&modules.every(m=>m.ok), version:ProvisioningVersion, missingState, modules});
}
export function moduleSpec(moduleName){ return PlatformProvisioning[moduleName]||null; }
export function allModules(){ return PlatformProvisioning; }
export function stateCoverage(){ const s=State.get(); return Object.fromEntries(Object.keys(PlatformProvisioning).map(m=>[m, (PlatformProvisioning[m].stateKeys||[]).filter(k=>s[k]!==undefined)])); }
