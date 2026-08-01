import { State } from './state.js';
import { EndpointRegistry } from './endpoint-registry.js';
import { unwrapActionResponse } from './contracts.js';
import { AuditLog } from './audit-log.js';
import { DataClient } from './data-client.js';
export const ObsidianActionAliases = Object.freeze({ REQUEST_OTP:{endpoint:'OTP_GENERATE',operation:'requestOtp'}, VERIFY_OTP:{endpoint:'OTP_VERIFY',operation:'verifyOtp'}, VERIFY_OTP_AND_EXECUTE:{endpoint:'OTP_VERIFY',operation:'verifyOtpAndExecute'}, DISPATCH_OUTBOUND:{endpoint:'DYNAMIC_ACTIONS',operation:'dispatchOutbound'}, TRANSITION_STATUS:{endpoint:'DYNAMIC_ACTIONS',operation:'transitionStatus'}, ARCHIVE_REFERENCE:{endpoint:'DYNAMIC_ACTIONS',operation:'archiveReference'}, LOG_AUDIT_EVENT:{endpoint:'DYNAMIC_ACTIONS',operation:'logAuditEvent'} });
export function resolveEndpointUrl(key, actor={}) { const st=State.get(); const overrides=st.settings?.endpoints||{}; const override=overrides[key]; const defaultUrl=EndpointRegistry.url(key); if(!override || override===defaultUrl) return defaultUrl; if(actor?.persona && actor.persona!=='admin'){ AuditLog.record({ref:'',actor,event:'audit:endpoint-override-denied',meta:{endpoint:key}}); return defaultUrl; } return EndpointRegistry.url(key,{overrides}); }
export async function invokeObsidianAction(action,payload={}){ const a=ObsidianActionAliases[action]; if(!a) throw new Error('Unknown OBSIDIAN action '+action); return invoke(a.endpoint,{operation:a.operation,...payload}); }
export async function invoke(key, payload={}, options={}) { const res = await DataClient.request(key,payload,options); return res.data; }

export async function invokeData(key,payload={},options={}){return unwrapActionResponse(key,await invoke(key,payload,options));}
