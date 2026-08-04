#!/usr/bin/env python3
"""
Two explanations for the May collapse, and they demand different responses:
  H1 REGRESSION  — the pipeline stopped writing the linkage fields for a period.
  H2 PROVENANCE  — the May records were created by a different route that never wrote them.
Distinguish by profiling every other field of the two cohorts. A regression leaves the
rest of the record normal; a different provenance leaves a broader fingerprint.

Then: does the Title prefix — the only near-100% carrier — actually resolve to real
documents in the outage window?
"""
import json, re, glob, os
from collections import Counter

BASE = '/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows'


def arrays(s, key):
    out = []
    for m in re.finditer(r'"' + key + r'"\s*:\s*\[', s):
        i = m.end() - 1
        d = 0
        for j in range(i, len(s)):
            if s[j] == '[':
                d += 1
            elif s[j] == ']':
                d -= 1
                if d == 0:
                    try:
                        out.append(json.loads(s[i:j + 1]))
                    except Exception:
                        pass
                    break
    return sorted(out, key=len, reverse=True)


def sentinel(v):
    s = str(v or '').strip()
    return (not s) or bool(re.match(r'^[Nn]o\s+\w', s)) or s.casefold() in {'n/a', 'none', '----', 'unassigned'}


tasks, docs = {}, set()
for p in glob.glob(BASE + '/**/*', recursive=True):
    if not os.path.isfile(p) or not re.search(r'\.(txt|json)$', p) or os.path.getsize(p) < 500:
        continue
    try:
        s = open(p, encoding='utf8', errors='replace').read()
    except Exception:
        continue
    a = arrays(s, 'tasks')
    if a and a[0] and isinstance(a[0][0], dict):
        for t in a[0]:
            if 'ID' in t:
                tasks[t['ID']] = t
    b = arrays(s, 'docs')
    if b and b[0] and isinstance(b[0][0], dict):
        for d in b[0]:
            if str(d.get('ID', '')).isdigit():
                docs.add(int(d['ID']))

LINKED = [t for t in tasks.values() if not sentinel(t.get('RefIDD'))]
UNLINKED = [t for t in tasks.values() if sentinel(t.get('RefIDD'))]
print(f'cohorts: linked={len(LINKED)}  unlinked={len(UNLINKED)}\n')

print('H1 vs H2 — field-by-field fingerprint of the two cohorts')
print(f'{"field":<24} {"linked %populated":>19} {"unlinked %populated":>21}  signal')
print('-' * 78)
fields = sorted({k for t in tasks.values() for k in t})
for f in fields:
    lp = sum(1 for t in LINKED if not sentinel(t.get(f)))
    up = sum(1 for t in UNLINKED if not sentinel(t.get(f)))
    lpc = 100 * lp // max(len(LINKED), 1)
    upc = 100 * up // max(len(UNLINKED), 1)
    diff = lpc - upc
    sig = '<<< DIVERGES' if abs(diff) >= 40 else ('differs' if abs(diff) >= 15 else '')
    print(f'{f:<24} {lpc:>18}% {upc:>20}%  {sig}')

print('\n\nDOES THE TITLE PREFIX RESOLVE IN THE OUTAGE WINDOW?')
for label, arr in (('linked cohort', LINKED), ('unlinked cohort', UNLINKED)):
    ids = []
    for t in arr:
        m = re.match(r'^\s*(\d{3,7})\s*-', str(t.get('Title') or ''))
        if m:
            ids.append(int(m.group(1)))
    inrange = [i for i in ids if min(docs) <= i <= max(docs)]
    hit = [i for i in inrange if i in docs]
    print(f'  {label:<16} title-prefix present={len(ids)}/{len(arr)}  '
          f'within docs range={len(inrange)}  resolves={len(hit)}'
          f'  ({100*len(hit)//len(inrange) if inrange else 0}% of comparable)')

print('\n\nCROSS-CHECK — where RefIDD IS populated, does it equal the Title prefix?')
agree = dis = 0
for t in LINKED:
    m = re.match(r'^\s*(\d{3,7})\s*-', str(t.get('Title') or ''))
    r = str(t.get('RefIDD') or '').strip()
    if m and r.isdigit():
        if int(m.group(1)) == int(r):
            agree += 1
        else:
            dis += 1
print(f'  agree={agree}  disagree={dis}  -> '
      f'{"Title prefix is a faithful proxy for RefIDD" if dis == 0 else "CARRIERS CONFLICT"}')
