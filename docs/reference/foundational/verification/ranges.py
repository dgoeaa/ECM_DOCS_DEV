import json,re,glob,os
BASE='/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows'
def arrays(s,key):
    out=[]
    for m in re.finditer(r'"'+key+r'"\s*:\s*\[',s):
        i=m.end()-1;d=0
        for j in range(i,len(s)):
            if s[j]=='[':d+=1
            elif s[j]==']':
                d-=1
                if d==0:
                    try:out.append(json.loads(s[i:j+1]))
                    except:pass
                    break
    return sorted(out,key=len,reverse=True)
def sent(v):
    s=str(v or '').strip()
    return (not s) or bool(re.match(r'^[Nn]o\s+\w',s)) or s.casefold() in {'n/a','none','----','unassigned'}
tasks={};docs={}
for p in glob.glob(BASE+'/**/*',recursive=True):
    if not os.path.isfile(p) or not re.search(r'\.(txt|json)$',p) or os.path.getsize(p)<500: continue
    try:s=open(p,encoding='utf8',errors='replace').read()
    except:continue
    a=arrays(s,'tasks')
    if a and a[0] and isinstance(a[0][0],dict):
        for t in a[0]:
            if 'ID' in t: tasks[t['ID']]=t
    b=arrays(s,'docs')
    if b and b[0] and isinstance(b[0][0],dict):
        for d in b[0]:
            if str(d.get('ID','')).isdigit(): docs[int(d['ID'])]=d.get('Created','')
def tp(t):
    m=re.match(r'^\s*(\d{3,7})\s*-',str(t.get('Title') or ''));return int(m.group(1)) if m else None
L=[t for t in tasks.values() if not sent(t.get('RefIDD'))]
U=[t for t in tasks.values() if sent(t.get('RefIDD'))]
for lbl,arr in (('LINKED',L),('UNLINKED',U)):
    ids=[tp(t) for t in arr]; ids=[i for i in ids if i]
    print(f'{lbl}: title-prefix docID range {min(ids)}-{max(ids)}  n={len(ids)}')
dk=sorted(docs)
print(f'DOCS universe: {len(dk)} ids, range {dk[0]}-{dk[-1]}')
# coverage by 500-wide bucket
import collections
buck=collections.Counter((i//500)*500 for i in dk)
print('docs coverage by bucket:', dict(sorted(buck.items())))
for lbl,arr in (('LINKED',L),('UNLINKED',U)):
    ids=[tp(t) for t in arr]; ids=[i for i in ids if i]
    b=collections.Counter((i//500)*500 for i in ids)
    print(f'{lbl} title-docID by bucket:', dict(sorted(b.items())))
# doc Created range
cr=[v for v in docs.values() if v]
print('docs Created range:',min(cr)[:10],'->',max(cr)[:10])
