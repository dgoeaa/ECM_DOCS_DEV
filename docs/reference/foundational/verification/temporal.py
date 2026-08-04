#!/usr/bin/env python3
"""
The mapping is identical across flows, so the sentinel is not the cause — the records
themselves differ. Hypothesis: RefIDD population is a function of WHEN the task was
created. Test it by correlating linkage population against Created month, pooled across
every task export in the corpus.
"""
import json, re, glob, os
from collections import defaultdict

BASE = '/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows'


def arrays(s, key):
    out = []
    for m in re.finditer(r'"' + key + r'"\s*:\s*\[', s):
        i = m.end() - 1
        depth = 0
        for j in range(i, len(s)):
            if s[j] == '[':
                depth += 1
            elif s[j] == ']':
                depth -= 1
                if depth == 0:
                    try:
                        out.append(json.loads(s[i:j + 1]))
                    except Exception:
                        pass
                    break
    return sorted(out, key=len, reverse=True)


def sentinel(v):
    s = str(v or '').strip()
    return (not s) or bool(re.match(r'^[Nn]o\s+\w', s)) or s.casefold() in {'n/a', 'none', '----', 'unassigned'}


pool = {}
for p in glob.glob(BASE + '/**/*', recursive=True):
    if not os.path.isfile(p) or not re.search(r'\.(txt|json)$', p) or os.path.getsize(p) < 500:
        continue
    try:
        s = open(p, encoding='utf8', errors='replace').read()
    except Exception:
        continue
    a = arrays(s, 'tasks')
    if not a or not isinstance(a[0][0] if a[0] else None, dict):
        continue
    for t in a[0]:
        if 'ID' in t:
            pool[t['ID']] = t   # dedupe by task ID across exports

print(f'POOLED DISTINCT TASKS: {len(pool)}\n')

by_month = defaultdict(lambda: {'n': 0, 'refidd': 0, 'refid': 0, 'title': 0})
for t in pool.values():
    c = str(t.get('Created') or '')
    m = c[:7] if re.match(r'^\d{4}-\d{2}', c) else 'unknown'
    b = by_month[m]
    b['n'] += 1
    if not sentinel(t.get('RefIDD')):
        b['refidd'] += 1
    if not sentinel(t.get('Reference_ID')):
        b['refid'] += 1
    if re.match(r'^\s*\d{3,7}\s*-', str(t.get('Title') or '')):
        b['title'] += 1

print(f'{"month":<10} {"tasks":>6} {"RefIDD":>14} {"Reference_ID":>14} {"Title prefix":>14}')
print('-' * 64)
for m in sorted(by_month):
    b = by_month[m]
    f = lambda k: f'{b[k]:>4} ({100*b[k]//b["n"]:>3}%)'
    print(f'{m:<10} {b["n"]:>6} {f("refidd"):>14} {f("refid"):>14} {f("title"):>14}')

print('\n\nWHAT CHANGED — first and last task carrying a real RefIDD:')
withref = sorted([t for t in pool.values() if not sentinel(t.get('RefIDD'))],
                 key=lambda t: str(t.get('Created') or ''))
without = sorted([t for t in pool.values() if sentinel(t.get('RefIDD'))],
                 key=lambda t: str(t.get('Created') or ''))
if withref:
    print(f'  populated : {withref[0].get("Created")}  ->  {withref[-1].get("Created")}   (n={len(withref)})')
if without:
    print(f'  sentinel  : {without[0].get("Created")}  ->  {without[-1].get("Created")}   (n={len(without)})')

print('\nSAMPLE OF EACH:')
for label, arr in (('WITH RefIDD', withref), ('WITHOUT RefIDD', without)):
    if arr:
        t = arr[-1]
        print(f'  {label}: ID={t.get("ID")} Created={t.get("Created")} '
              f'RefIDD={t.get("RefIDD")!r} Ref={str(t.get("Reference_ID"))[:44]!r}')
        print(f'      Title={str(t.get("Title"))[:88]!r}')
