#!/usr/bin/env python3
"""
Multidimensional test of the task->document relationship across EVERY carrier and
EVERY available sample, so the conclusion does not rest on one export.

Carriers of the linkage, in order of directness:
  1. tasks.RefIDD              the parent document ID, as a string
  2. tasks.Reference_ID        composite {date}-{docID}-{classCode}-{taskID}
  3. tasks.Title               prefix '{docID} -{date} -{SENDER} (SUBJECT).PDF'
"""
import json, re, glob, os

BASE = '/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows'


def sentinel(v):
    if v is None or v is False:
        return True
    s = str(v).strip()
    return (not s) or s.casefold() in {'n/a', 'none', 'unassigned', '----'} or bool(re.match(r'^[Nn]o\s+\w', s))


def load_arrays(path, key):
    """Every array named `key` anywhere in a JSON-ish text file, largest first."""
    try:
        s = open(path, encoding='utf8', errors='replace').read()
    except Exception:
        return []
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


def title_docid(t):
    m = re.match(r'^\s*(\d{3,7})\s*-', str(t or ''))
    return m.group(1) if m else None


# gather every sample carrying tasks, and every sample carrying docs
task_sets, doc_sets = {}, {}
for p in glob.glob(BASE + '/**/*', recursive=True):
    if not os.path.isfile(p) or os.path.getsize(p) < 500:
        continue
    if not re.search(r'\.(txt|json)$', p):
        continue
    for arr in load_arrays(p, 'tasks')[:1]:
        if arr and isinstance(arr[0], dict) and 'Title' in arr[0]:
            task_sets[os.path.relpath(p, BASE)] = arr
    for arr in load_arrays(p, 'docs')[:1]:
        if arr and isinstance(arr[0], dict) and 'ID' in arr[0]:
            doc_sets[os.path.relpath(p, BASE)] = arr

# universe of known document IDs across every docs export
ALL_DOC_IDS, doc_max = set(), 0
for name, arr in doc_sets.items():
    for d in arr:
        try:
            n = int(d['ID'])
        except Exception:
            continue
        ALL_DOC_IDS.add(n)
        doc_max = max(doc_max, n)

print(f'DOCUMENT ID UNIVERSE: {len(ALL_DOC_IDS):,} distinct IDs across {len(doc_sets)} docs exports')
print(f'  range {min(ALL_DOC_IDS)}–{doc_max}\n')
print(f'TASK EXPORTS EXAMINED: {len(task_sets)}\n')

hdr = f'{"task export":<52} {"recs":>5} {"RefIDD":>14} {"Reference_ID":>14} {"Title prefix":>14}'
print(hdr)
print('-' * len(hdr))

agg = {'refidd': [0, 0], 'refid': [0, 0], 'title': [0, 0]}
for name, arr in sorted(task_sets.items(), key=lambda x: -len(x[1])):
    def rate(vals):
        real = [v for v in vals if v is not None and not sentinel(v)]
        ids = []
        for v in real:
            s = str(v).strip()
            if s.isdigit():
                ids.append(int(s))
            else:
                m = re.match(r'^(\d{8})-(\d+)-', s)
                if m:
                    ids.append(int(m.group(2)))
        inrange = [i for i in ids if i <= doc_max]
        hit = [i for i in inrange if i in ALL_DOC_IDS]
        return len(hit), len(inrange), len(real)

    r1 = rate([t.get('RefIDD') for t in arr])
    r2 = rate([t.get('Reference_ID') for t in arr])
    r3 = rate([title_docid(t.get('Title')) for t in arr])
    for k, r in (('refidd', r1), ('refid', r2), ('title', r3)):
        agg[k][0] += r[0]; agg[k][1] += r[1]

    def f(r):
        return f'{r[0]}/{r[1]}' if r[1] else ('all sentinel' if r[2] == 0 else '—')
    print(f'{name[-52:]:<52} {len(arr):>5} {f(r1):>14} {f(r2):>14} {f(r3):>14}')

print('-' * len(hdr))
for k, label in (('refidd', 'tasks.RefIDD'), ('refid', 'tasks.Reference_ID'), ('title', 'tasks.Title prefix')):
    h, n = agg[k]
    print(f'  {label:<24} AGGREGATE {h}/{n}' + (f' = {100*h//n}%' if n else '  (no populated values anywhere)'))
