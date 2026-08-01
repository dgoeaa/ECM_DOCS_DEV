export const ErrorClass = Object.freeze({
  VALIDATION_ERROR:'VALIDATION_ERROR', AUTH_ERROR:'AUTH_ERROR', SCOPE_ERROR:'SCOPE_ERROR', DIRECTORATE_SCOPE_ERROR:'DIRECTORATE_SCOPE_ERROR',
  OTP_REQUIRED:'OTP_REQUIRED', OTP_VERIFICATION_FAILED:'OTP_VERIFICATION_FAILED', IDEMPOTENCY_CONFLICT:'IDEMPOTENCY_CONFLICT',
  FLOW_UNAVAILABLE:'FLOW_UNAVAILABLE', FLOW_CONTRACT_ERROR:'FLOW_CONTRACT_ERROR', DISPATCH_FAILED:'DISPATCH_FAILED', ARCHIVE_FAILED:'ARCHIVE_FAILED',
  CLOSURE_GATE_FAILED:'CLOSURE_GATE_FAILED', NO_ORPHAN_VIOLATION:'NO_ORPHAN_VIOLATION', QUARANTINED_RECORD:'QUARANTINED_RECORD', UNKNOWN_ERROR:'UNKNOWN_ERROR'
});
export class ObsidianError extends Error { constructor(errorClass, message, details={}){ super(message||errorClass); this.name='ObsidianError'; this.errorClass=errorClass; this.details=details; this.retryable=!!details.retryable; } }
export const createError=(errorClass,message,details={})=>new ObsidianError(errorClass,message,details);
export const createValidationError=(message,details={})=>createError(ErrorClass.VALIDATION_ERROR,message,details);
export const createScopeError=(message,details={})=>createError(ErrorClass.SCOPE_ERROR,message,details);
export const createClosureError=(message,details={})=>createError(ErrorClass.CLOSURE_GATE_FAILED,message,details);
export function normalizeError(error, context={}){ if(error?.errorClass) return {ok:false,errorClass:error.errorClass,message:error.message,retryable:!!error.retryable,details:{...error.details,...context}}; if(error?.ok===false) return {ok:false,errorClass:error.errorClass||ErrorClass.FLOW_CONTRACT_ERROR,message:error.message||'Backend returned ok:false',retryable:!!error.retryable,details:{...error.details,...context}}; return {ok:false,errorClass:ErrorClass.UNKNOWN_ERROR,message:error?.message||'Unknown error',retryable:false,details:context}; }
