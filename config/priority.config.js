// Canonical platform priority scale. Every module renders priority controls from this
// scale and stores the canonical id; legacy vocabularies (P1..P4, Medium, UPPERCASE)
// are normalized on ingest and on read so filters, reports and SLAs group correctly.
export const PriorityScale = Object.freeze([
  { id:'low', label:'Low' },
  { id:'normal', label:'Normal' },
  { id:'high', label:'High' },
  { id:'urgent', label:'Urgent' }
]);
const CANONICAL = new Set(PriorityScale.map(p => p.id));
const ALIASES = Object.freeze({
  'p4':'low', 'p4 (low)':'low',
  'medium':'normal', 'p3':'normal', 'p3 (normal)':'normal', 'standard':'normal',
  'p2':'high', 'p2 (medium)':'high',
  'p1':'urgent', 'p1 (high)':'urgent', 'critical':'urgent'
});
export function normalizePriority(value, fallback='normal'){
  const k = String(value ?? '').trim().toLowerCase();
  if (CANONICAL.has(k)) return k;
  return ALIASES[k] || fallback;
}
export function priorityLabel(value){
  const id = normalizePriority(value);
  return PriorityScale.find(p => p.id === id)?.label || 'Normal';
}
export function priorityTone(value){
  const id = normalizePriority(value);
  return id === 'urgent' ? 'danger' : id === 'high' ? 'warn' : '';
}
export function priorityOptions(selected){
  const id = normalizePriority(selected);
  return PriorityScale.map(p => `<option value="${p.id}" ${p.id===id?'selected':''}>${p.label}</option>`).join('');
}
export function isElevatedPriority(value){
  return ['high','urgent'].includes(normalizePriority(value));
}
