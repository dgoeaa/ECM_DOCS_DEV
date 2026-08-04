#!/usr/bin/env python3
"""
Identify the shell-task cohort exactly: which records, from which export, over what dates,
and which documents their titles point at. Writes a register that can be checked row by row
against the live SharePoint list.
"""
import json, re, glob, os, csv

BASE = '/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows'
OUT = '/home/user/ECM_DOCS_DEV/docs/reference/foundational/verification/shell-tasks.csv'


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


def sent(v):
    s = str(v or '').strip()
    return (not s) or bool(re.match(r'^[Nn]o\s+\w', s)) or s.casefold() in {
        'n/a', 'none', '----', 'unassigned', 'not assigned'}


tasks, origin, docs = {}, {}, set()
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
                origin.setdefault(t['ID'], os.path.relpath(p, BASE))
    b = arrays(s, 'docs')
    if b and b[0] and isinstance(b[0][0], dict):
        for d in b[0]:
            if str(d.get('ID', '')).isdigit():
                docs.add(int(d['ID']))

# A shell record: no assignee, no dates, no priority, no linkage — only identity fields.
CORE = ['AssignedTo', 'Assigned', 'DueDate', 'StartDate', 'Priority', 'RefIDD', 'Reference_ID']
shell = [t for t in tasks.values() if all(sent(t.get(f)) for f in CORE)]
full = [t for t in tasks.values() if not all(sent(t.get(f)) for f in CORE)]


def titledoc(t):
    m = re.match(r'^\s*(\d{3,7})\s*-', str(t.get('Title') or ''))
    return int(m.group(1)) if m else None


ids = sorted(t['ID'] for t in shell)
print(f'SHELL COHORT: {len(shell)} of {len(tasks)} pooled tasks\n')
print(f'  task ID range      : {min(ids)} – {max(ids)}')
print(f'  contiguous?        : {"YES — an unbroken block" if ids == list(range(min(ids), max(ids)+1)) else "no, with gaps"}')
created = sorted(str(t.get('Created') or '') for t in shell if t.get('Created'))
print(f'  created range      : {created[0][:19]} – {created[-1][:19]}')
srcs = {}
for t in shell:
    srcs[origin[t['ID']]] = srcs.get(origin[t['ID']], 0) + 1
print(f'  appears in exports : ')
for k, v in sorted(srcs.items(), key=lambda x: -x[1]):
    print(f'      {v:>4} records — {k}')

fulls = sorted(t['ID'] for t in full)
print(f'\nFULL COHORT for contrast: {len(full)} tasks, ID range {min(fulls)} – {max(fulls)}')
fc = sorted(str(t.get('Created') or '') for t in full if t.get('Created'))
print(f'  created range      : {fc[0][:19]} – {fc[-1][:19]}')

print('\n  DO THE ID RANGES OVERLAP?')
print(f'    shell {min(ids)}–{max(ids)}   full {min(fulls)}–{max(fulls)}   '
      f'-> {"INTERLEAVED" if min(ids) < max(fulls) and min(fulls) < max(ids) else "DISJOINT BLOCKS"}')

print('\n\nFIRST FIVE SHELL RECORDS, VERBATIM:\n')
for t in sorted(shell, key=lambda x: x['ID'])[:5]:
    print(f"  ID={t['ID']}  Created={t.get('Created')}  Progress={t.get('Progress')!r}  "
          f"Classification={str(t.get('Classification'))[:28]!r}")
    print(f"      Title={str(t.get('Title'))[:96]!r}")
    td = titledoc(t)
    print(f"      title points at document {td}"
          f"{'  (present in corpus docs)' if td in docs else '  (not in any docs export here)'}")
    print()

with open(OUT, 'w', newline='', encoding='utf8') as fh:
    w = csv.writer(fh)
    w.writerow(['TaskID', 'Created', 'Classification', 'Progress',
                'TitleDocumentID', 'DocumentPresentInCorpus', 'Title', 'SourceExport'])
    for t in sorted(shell, key=lambda x: x['ID']):
        td = titledoc(t)
        w.writerow([t['ID'], t.get('Created'), t.get('Classification'), t.get('Progress'),
                    td or '', 'yes' if td in docs else 'no',
                    str(t.get('Title'))[:160], origin[t['ID']]])
print(f'REGISTER WRITTEN -> {os.path.relpath(OUT, "/home/user/ECM_DOCS_DEV")}  ({len(shell)} rows)')
