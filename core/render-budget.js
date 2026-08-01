export const RenderBudget = Object.freeze({
  listRows: 100,
  tableRows: 120,
  timelineItems: 30,
  pendingRows: 20,
  searchDebounceMs: 150
});
export function capRows(rows=[], limit=RenderBudget.listRows){ return Array.isArray(rows) ? rows.slice(0, limit) : []; }
export function hasMore(rows=[], limit=RenderBudget.listRows){ return Array.isArray(rows) && rows.length > limit; }
export function duplicateSummary(rows=[]){
  const seen=new Map(), dupIds=new Set();
  for(const row of rows){
    const subject=String(row.subject||'').trim().toLowerCase();
    const link=String(row.attachmentLink||'').trim();
    const key=link ? `link:${link}` : subject ? `subject:${subject}` : '';
    if(!key) continue;
    if(seen.has(key)){ dupIds.add(row.id); dupIds.add(seen.get(key)); } else seen.set(key,row.id);
  }
  return {count:dupIds.size, ids:dupIds};
}
export function memoizeBySignature(factory){
  let sig='', value;
  return function(input=[]){
    const next=`${input.length}:${input[0]?.id||''}:${input[input.length-1]?.id||''}`;
    if(next!==sig){ sig=next; value=factory(input); }
    return value;
  };
}
