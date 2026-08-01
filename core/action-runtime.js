import { State } from './state.js';
import { PlatformProvisioning } from '../config/platform-provisioning.config.js';
import { executeOwnedAction, auditAction } from './action-authority.js';
import { DispatchService } from './dispatch-service.js';
import { ArchiveService } from './archive.js';
import { OtpService } from './otp-service.js';
export const ActionRuntime = Object.freeze({canRun, run, actionsFor});
export function actionsFor(moduleName){ return PlatformProvisioning[moduleName]?.actions||[]; }
export function canRun(moduleName, action){ return actionsFor(moduleName).includes(action); }
export async function run(moduleName, action, payload={}){
  if(!canRun(moduleName, action)) throw new Error(`Action ${action} is not enabled for ${moduleName}`);
  return executeOwnedAction(moduleName, action, async()=>{
    const s=State.get();
    switch(action){
      case 'send-dispatch': return DispatchService.dispatchOutbound({...payload, actor:s.profile});
      case 'archive-reference': return ArchiveService.archiveReference(payload.ref, s.profile, payload.meta||{});
      case 'request-otp': return OtpService.requestOtp({...payload, actor:s.profile});
      case 'verify-otp': return OtpService.verifyOtp({...payload, actor:s.profile});
      default: auditAction(moduleName, action, {ref:payload.ref||payload.referenceId||'', meta:{payloadKeys:Object.keys(payload)}}); return {ok:true, module:moduleName, action, payload};
    }
  }, {ref:payload.ref||payload.referenceId||''});
}
