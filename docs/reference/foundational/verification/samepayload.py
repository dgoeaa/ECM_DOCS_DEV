#!/usr/bin/env python3
"""
Two questions the aggregate cannot answer:
  Q1. When docs and tasks come from the SAME export at the SAME moment, does the
      linkage hold completely? (isolates snapshot-boundary effects)
  Q2. Why does one export carry sentinels where others carry data? (isolates the
      flow's select-mapping as the cause, rather than the underlying list)
"""
import json, re, glob, os

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


print('Q1 — SAME-PAYLOAD LINKAGE (docs and tasks from one export)\n')
print(f'{"export":<54} {"tasks":>6} {"docs":>6} {"RefIDD->docs.ID":>18}')
print('-' * 88)
for p in sorted(glob.glob(BASE + '/**/*', recursive=True)):
    if not os.path.isfile(p) or not re.search(r'\.(txt|json)$', p) or os.path.getsize(p) < 500:
        continue
    try:
        s = open(p, encoding='utf8', errors='replace').read()
    except Exception:
        continue
    ta, da = arrays(s, 'tasks'), arrays(s, 'docs')
    if not ta or not da:
        continue
    tasks, docs = ta[0], da[0]
    if not (tasks and docs and isinstance(tasks[0], dict) and isinstance(docs[0], dict)):
        continue
    ids = {int(d['ID']) for d in docs if str(d.get('ID', '')).isdigit()}
    real = [str(t.get('RefIDD', '')).strip() for t in tasks]
    real = [v for v in real if v.isdigit()]
    hit = [v for v in real if int(v) in ids]
    verdict = f'{len(hit)}/{len(real)}' if real else 'all sentinel'
    pct = f' = {100*len(hit)//len(real)}%' if real else ''
    print(f'{os.path.relpath(p, BASE)[-54:]:<54} {len(tasks):>6} {len(docs):>6} {verdict+pct:>18}')

print('\n\nQ2 — WHY ONE EXPORT LOSES THE LINKAGE\n')
# The matrix source is the "Fetch_All_Data_&_References_Matrix" flow. Compare its task
# select-mapping with the dedicated Fetch_Tasks flow's mapping.
for label, pat, needle in [
    ('Fetch_All_..._Matrix (matrix source)', '**/Copy of - Fetch_All_Data*', 'RefIDD'),
    ('Fetch_Tasks_POST (dedicated)', '**/Fetch_Tasks_POST*full_definition.json', 'RefIDD'),
]:
    for p in glob.glob(BASE + '/' + pat, recursive=True)[:1]:
        s = open(p, encoding='utf8', errors='replace').read()
        print(f'  {label}')
        # find the select expression that produces RefIDD
        for m in re.finditer(r'"RefIDD"\s*:\s*"([^"]{0,200})"', s):
            expr = m.group(1)
            if 'item()' in expr or 'coalesce' in expr.lower():
                print(f'      RefIDD mapping: {expr[:150]}')
                break
        else:
            print('      RefIDD mapping: (not found as an expression in this file)')
        print()
