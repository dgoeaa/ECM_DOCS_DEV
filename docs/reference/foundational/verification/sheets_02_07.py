#!/usr/bin/env python3
"""
Verify sheets '02 Field Matrix' and '07 JSON Paths' — the two the adapters consume directly.

02 Field Matrix supplies, per field: observed JSON type, recommended SharePoint column
type, present count, non-empty count. Every one of those four is testable.

07 JSON Paths supplies extraction paths with occurrence counts. Each path is resolved
against the real payload.

The sentinel problem established in FINDINGS.md is carried through: a "non-empty count"
that counts 'No RefIDD' describes the placeholder, not the data, and a column type chosen
from placeholder-bearing values will be wrong.
"""
import json, re, sys

S = '/tmp/claude-0/-home-user-ECM-DOCS-DEV/220e2372-4b43-53d8-b4fe-b151d1f119e9/scratchpad'
D = json.load(open(f'{S}/datasets.json', encoding='utf8'))
FM = json.load(open(f'{S}/fieldmatrix.json', encoding='utf8'))
JP = json.load(open(f'{S}/jsonpaths.json', encoding='utf8'))

SENT_EXACT = {'', 'n/a', 'na', 'none', 'null', 'unassigned', '----', '--', '-',
              'no route', 'no title', 'no description', 'no author', 'not assigned'}


def is_sentinel(v):
    if v is None or v is False:
        return True
    if isinstance(v, (list, dict)):
        return len(v) == 0
    s = str(v).strip()
    if not s:
        return True
    lo = s.casefold()
    return lo in SENT_EXACT or bool(re.match(r'^no\s+\w', lo))


def jtype(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'boolean'
    if isinstance(v, int):
        return 'integer'
    if isinstance(v, float):
        return 'number'
    if isinstance(v, list):
        return 'array'
    if isinstance(v, dict):
        return 'object'
    return 'string'


# ── SHEET 02 ────────────────────────────────────────────────────────────────
print('=' * 104)
print('SHEET 02 — FIELD MATRIX   (82 rows: type, recommended column, present, non-empty)')
print('=' * 104)

type_ok = type_bad = pres_ok = pres_bad = ne_ok = ne_bad = 0
absent = []
sentinel_typed = []   # column type recommended from placeholder-bearing data
rows_checked = 0

for r in FM[1:]:
    ds, field, obstype, rec, pres, nonempty = (r + [''] * 8)[:6]
    if not ds or ds not in D:
        continue
    recs = D[ds]
    if not any(field in x for x in recs):
        absent.append(f'{ds}.{field}')
        continue
    rows_checked += 1
    vals = [x.get(field) for x in recs]

    # (a) observed type
    types = sorted({jtype(v) for v in vals})
    claimed = set(re.findall(r'([a-z]+)\(', str(obstype)))
    if claimed and claimed == set(types):
        type_ok += 1
    elif claimed:
        type_bad += 1
        if type_bad <= 8:
            print(f'  TYPE   {ds}.{field:<28} matrix={obstype:<24} actual={",".join(types)}')

    # (b) present count
    try:
        if int(pres) == len(vals):
            pres_ok += 1
        else:
            pres_bad += 1
    except Exception:
        pass

    # (c) non-empty count — matrix method vs sentinel-aware
    nonblank = len([v for v in vals if v not in (None, '', [], {}) and v is not False])
    real = len([v for v in vals if not is_sentinel(v)])
    try:
        claim = int(nonempty)
        if claim == real:
            ne_ok += 1
        else:
            ne_bad += 1
            if claim == nonblank and real != nonblank:
                sentinel_typed.append((f'{ds}.{field}', claim, real, rec))
    except Exception:
        pass

print(f'\n  observed JSON type   confirmed {type_ok:>3}   differs {type_bad:>3}')
print(f'  present count        confirmed {pres_ok:>3}   differs {pres_bad:>3}')
print(f'  non-empty count      confirmed {ne_ok:>3}   differs {ne_bad:>3}')
print(f'  fields in sheet but absent from payload: {len(absent)}'
      + (f'  -> {", ".join(absent[:6])}' if absent else ''))

print(f'\n  SENTINEL-INFLATED ROWS ({len(sentinel_typed)}) — the count is the placeholder,')
print('  and the recommended column type was chosen from placeholder-bearing values:\n')
print(f'  {"field":<34} {"claimed":>8} {"REAL":>6}  recommended column type')
for f, c, rl, rec in sentinel_typed[:22]:
    print(f'  {f:<34} {c:>8} {rl:>6}  {rec[:42]}')

# The specific hazard: a numeric identifier typed as free text because placeholders are text
print('\n  TYPE HAZARDS the sentinels create:')
for ds, field in [('tasks', 'RefIDD'), ('tasks', 'Reference_ID'), ('tasks', 'DueDate'),
                  ('tasks', 'StartDate'), ('tasks', 'Priority'), ('docs', 'AssignedTo')]:
    if ds not in D or not any(field in x for x in D[ds]):
        continue
    vals = [x.get(field) for x in D[ds]]
    real = [v for v in vals if not is_sentinel(v)]
    row = next((r for r in FM[1:] if r[0] == ds and r[1] == field), None)
    rec = row[3] if row else '?'
    kind = ('numeric identifier' if real and all(str(v).strip().isdigit() for v in real)
            else 'ISO datetime' if real and all(re.match(r'^\d{4}-\d\d-\d\d', str(v)) for v in real)
            else 'text/other' if real else 'NO REAL VALUES IN THIS EXPORT')
    print(f'    {ds}.{field:<16} recommended={rec[:34]:<34} real values are: {kind}')

# ── SHEET 07 ────────────────────────────────────────────────────────────────
print('\n' + '=' * 104)
print('SHEET 07 — JSON PATHS   (130 rows: path, occurrences, type)')
print('=' * 104)


def resolve(path, root):
    """Resolve the sheet's $.a.b[].c dialect. Returns the list of values reached."""
    cur = [root]
    for part in path.replace('$', '', 1).split('.'):
        if not part:
            continue
        nxt = []
        arr = part.endswith('[]')
        key = part[:-2] if arr else part
        for c in cur:
            if isinstance(c, dict) and key in c:
                v = c[key]
                if arr and isinstance(v, list):
                    nxt.extend(v)
                else:
                    nxt.append(v)
        cur = nxt
        if not cur:
            return []
    return cur


# The real response envelope, not a reconstruction. An earlier run of this script used
# {'ok':True,'data':D} and consequently reported 22 envelope paths as unresolvable when the
# fault was the harness, not the sheet. Load the genuine body_sent.
import json as _j
_SRC = ('/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows/definitions/'
        'Copy of - Fetch_All_Data_&_References_Matrix-POST__08584201914788160149253197884CU95'
        '__flow_run_record.json')
root = _j.load(open(_SRC, encoding='utf8'))['response_record']['body_sent']
ok = wrong = unresolved = 0
bad = []
for r in JP[1:]:
    path, occ, obstype = (r + [''] * 6)[:3]
    if not path or not path.startswith('$'):
        continue
    got = resolve(path, root)
    if not got:
        unresolved += 1
        bad.append((path, occ, 'PATH DOES NOT RESOLVE'))
        continue
    try:
        claim = int(occ)
    except Exception:
        continue
    if len(got) == claim:
        ok += 1
    else:
        wrong += 1
        bad.append((path, occ, f'resolves to {len(got)}'))

print(f'\n  paths resolving with the claimed occurrence count : {ok}')
print(f'  paths resolving with a DIFFERENT count           : {wrong}')
print(f'  paths that do not resolve at all                 : {unresolved}')
if bad:
    print('\n  discrepancies:')
    for p, o, why in bad[:18]:
        print(f'    {p[:62]:<62} claimed={o:<5} {why}')
