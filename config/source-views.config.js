export const SourceViewAll = 'all';
export const SourceViews = Object.freeze([
  { id:'all', label:'All Sources', short:'All', icon:'◎', entry:'Command Center', purpose:'All matters from every ingestion source.' },
  { id:'physical-scanned-documents', label:'Physical Scans', short:'Physical', icon:'▧', entry:'Intake & Assignment', purpose:'Physical documents received, scanned, registered, minuted and assigned.' },
  { id:'customer-service-emails', label:'Customer Service Emails', short:'Email', icon:'✉', entry:'Intake & Assignment', purpose:'Customer-service emails converted to correspondence or task.' },
  { id:'public-portal-correspondence', label:'Public Portal', short:'Portal', icon:'◉', entry:'Intake & Assignment', purpose:'Submitted public portal correspondence registered and assigned.' },
  { id:'dgceo-outgoing-correspondence', label:'DGCEO Outgoing', short:'Outgoing', icon:'➤', entry:'Dispatch & Archive / Correspondence Email Desk', purpose:'DGCEO outgoing correspondence, directives, minutes and follow-up tasks.' }
]);
export const SourceViewIds = Object.freeze(SourceViews.map(s=>s.id));
export function sourceView(id){ return SourceViews.find(s=>s.id===id) || SourceViews[0]; }
export function isSourceView(id){ return SourceViewIds.includes(id); }
