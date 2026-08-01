export const RetentionPolicy=Object.freeze({defaultYears:7,classes:{'Official correspondence':7,Financial:7,Legal:10,'Executive directive':10,'Routine administrative':5,General:3}});
export const Retention=Object.freeze({calculate,classForRecord,dateFromYears});
export function classForRecord(records={},meta={}){ return meta.retentionClass || records?.registryFile?.[0]?.retentionClass || records?.correspondence?.[0]?.category || 'Official correspondence'; }
export function dateFromYears(date=new Date(),years=7){ const d=new Date(date); d.setFullYear(d.getFullYear()+years); return d.toISOString(); }
export function calculate(records={},meta={}){ const retentionClass=classForRecord(records,meta); const years=RetentionPolicy.classes[retentionClass]||RetentionPolicy.defaultYears; return {retentionClass,retentionYears:years,retentionUntil:dateFromYears(new Date(),years),securityClass:meta.securityClass||records?.registryFile?.[0]?.securityClass||'Official'}; }
