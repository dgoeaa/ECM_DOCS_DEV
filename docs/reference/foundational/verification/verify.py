#!/usr/bin/env python3
"""
Independent verification of every claim in the Power Automate Data Structure Matrix,
against the canonical payload the matrix itself was built from.

Method, stated so the result can be challenged:
  · SENTINELS. The flows coalesce nulls to human placeholders ('No RefIDD', 'Unassigned',
    '----', 'N/A', …). A field carrying one is NOT populated. Any census that counts string
    length is measuring the placeholder, not the data. Sentinels are detected structurally
    (leading 'No ', exact 'N/A'/'Unassigned'/'----'/'None', empty) rather than hand-listed.
  · TYPE COERCION. SharePoint returns IDs as int in one list and str in another. A join is
    tested on canonical form, not on Python equality.
  · MULTI-VALUE. Person columns hold ';'-delimited addresses. Each address is tested.
  · CASE/WHITESPACE. Emails are compared casefolded and stripped.
  · DENOMINATOR. Match rates are reported against GENUINELY POPULATED values, and separately
    against the range actually comparable (a foreign key pointing past the snapshot ceiling
    is not a broken link).
"""
import json, re, sys

D = json.load(open('/tmp/claude-0/-home-user-ECM-DOCS-DEV/220e2372-4b43-53d8-b4fe-b151d1f119e9/scratchpad/datasets.json', encoding='utf8'))

SENTINEL_EXACT = {'', 'n/a', 'na', 'none', 'null', 'unassigned', '----', '--', '-',
                  'no route', 'no title', 'no description', 'no author', 'not assigned',
                  'no assigned value', 'no 3rdassigned value'}


def is_sentinel(v):
    if v is None or v is False:
        return True
    if isinstance(v, (list, dict)):
        return len(v) == 0
    s = str(v).strip()
    if not s:
        return True
    low = s.casefold()
    if low in SENTINEL_EXACT:
        return True
    # 'No RefIDD', 'No Reference ID', 'No Due Date', 'No Editor Email', 'No Start Date'…
    if re.match(r'^no\s+\w', low):
        return True
    return False


def populated(recs, field):
    return [r[field] for r in recs if field in r and not is_sentinel(r[field])]


def canon_id(v):
    """Canonical form of an identifier: digits as int-string, else casefolded text."""
    s = str(v).strip()
    return str(int(s)) if s.isdigit() else s.casefold()


def emails_in(v):
    if v is None:
        return []
    return [e.strip().casefold() for e in re.split(r'[;,]', str(v)) if '@' in e]


def user_emails():
    out = set()
    for u in D['users']:
        for k, val in u.items():
            if isinstance(val, str) and '@' in val:
                out.add(val.strip().casefold())
    return out


OUT = []


def report(claim, matrix_says, verdict, measured, note):
    OUT.append((claim, matrix_says, verdict, measured, note))


# ─────────────────────────────────────────────────────────────── dataset census
print('SECTION 1 — DATASET CENSUS  (matrix sheet "01 Dataset Matrix")\n')
CENSUS = {'taskComments': (2, 6), 'docs': (300, 12), 'tasks': (300, 20),
          'users': (794, 4), 'categories': (45, 14), 'departments': (50, 7),
          'emails': (50, 18)}
for name, (crec, cfld) in CENSUS.items():
    recs = D[name]
    flds = len({k for r in recs for k in r})
    ok = (len(recs) == crec and flds == cfld)
    print(f'  {name:<14} matrix={crec}rec/{cfld}fld   actual={len(recs)}rec/{flds}fld   '
          f'{"CONFIRMED" if ok else "*** DISCREPANCY ***"}')
    if not ok:
        report(f'census:{name}', f'{crec} rec / {cfld} fld', 'REFUTED',
               f'{len(recs)} rec / {flds} fld', 'record or field count differs')

# ─────────────────────────────────────────────────────── sentinel contamination
print('\n\nSECTION 2 — SENTINEL CONTAMINATION  (the flaw invalidating the census method)\n')
print(f'  {"dataset.field":<34} {"records":>7} {"nonblank":>9} {"REAL":>6} {"sentinel":>9}  dominant placeholder')
for name in ['tasks', 'docs', 'departments']:
    recs = D[name]
    for f in sorted({k for r in recs for k in r}):
        vals = [r.get(f) for r in recs]
        nonblank = [v for v in vals if v not in (None, '', [], {}) and v is not False]
        real = [v for v in vals if not is_sentinel(v)]
        sent = len(nonblank) - len(real)
        if sent > 0:
            from collections import Counter
            c = Counter(str(v)[:34] for v in vals if is_sentinel(v) and v not in (None, '', [], {}))
            top = c.most_common(1)[0][0] if c else ''
            print(f'  {name+"."+f:<34} {len(vals):>7} {len(nonblank):>9} {len(real):>6} {sent:>9}  {top!r}')

# ────────────────────────────────────────────────────────────── relationships
print('\n\nSECTION 3 — RELATIONSHIP CLAIMS  (matrix sheet "03 Relationships")\n')
docs, tasks, cats, deps, emails = D['docs'], D['tasks'], D['categories'], D['departments'], D['emails']
UE = user_emails()
doc_ids = {canon_id(d['ID']) for d in docs}
doc_max = max(int(d['ID']) for d in docs)
cat_names = {str(c['Category']).strip().casefold() for c in cats if not is_sentinel(c.get('Category'))}
dep_keys = {str(d['DSU_KEY']).strip().casefold() for d in deps if not is_sentinel(d.get('DSU_KEY'))}


def fk_check(label, matrix_claim, recs, field, target_set, target_max=None, numeric=False):
    vals = populated(recs, field)
    canon = [canon_id(v) for v in vals]
    hit = [v for v in canon if v in target_set]
    if numeric and target_max is not None:
        inrange = [v for v in canon if v.isdigit() and int(v) <= target_max]
        hit_in = [v for v in inrange if v in target_set]
        beyond = len([v for v in canon if v.isdigit() and int(v) > target_max])
    else:
        inrange, hit_in, beyond = canon, hit, 0
    pct = (100 * len(hit) // len(canon)) if canon else 0
    pct_in = (100 * len(hit_in) // len(inrange)) if inrange else 0
    print(f'  {label}')
    print(f'      matrix claim : {matrix_claim}')
    print(f'      populated    : {len(vals)}/{len(recs)} records carry a real value '
          f'({len(recs)-len(vals)} sentinel/blank)')
    print(f'      match (all)  : {len(hit)}/{len(canon)} = {pct}%')
    if beyond:
        print(f'      beyond snapshot ceiling ({target_max}): {beyond} — target not in this export')
        print(f'      MATCH IN COMPARABLE RANGE : {len(hit_in)}/{len(inrange)} = {pct_in}%')
    return len(hit_in), len(inrange), pct_in


print('R1/R2 — task to document linkage')
fk_check('tasks.Reference_ID -> docs.ID', 'Low confidence, 0/300 match',
         tasks, 'Reference_ID', doc_ids)
print()
# Reference_ID is composite: {date}-{docID}-{class}-{taskID}. Extract component 2.
comp = []
for t in tasks:
    v = t.get('Reference_ID')
    if is_sentinel(v):
        continue
    m = re.match(r'^(\d{8})-(\d+)-([A-Z\-]+)-(\d+)$', str(v).strip())
    if m:
        comp.append(m)
print(f'  Reference_ID composite-key parse: {len(comp)}/{len(populated(tasks,"Reference_ID"))} '
      f'populated values match {{date}}-{{docID}}-{{class}}-{{taskID}}')
if comp:
    dm = [m for m in comp if canon_id(m.group(2)) in doc_ids]
    inr = [m for m in comp if int(m.group(2)) <= doc_max]
    dmi = [m for m in inr if canon_id(m.group(2)) in doc_ids]
    tm = sum(1 for m in comp if canon_id(m.group(4)) == canon_id(
        next((t['ID'] for t in tasks if str(t.get('Reference_ID', '')).strip() == m.group(0)), '')))
    print(f'      embedded docID -> docs.ID : {len(dm)}/{len(comp)} overall; '
          f'{len(dmi)}/{len(inr)} within snapshot range')
    print(f'      embedded taskID -> own ID : {tm}/{len(comp)} self-consistent')
print()
fk_check('tasks.RefIDD -> docs.ID', 'Low confidence, 0/300 match',
         tasks, 'RefIDD', doc_ids, doc_max, numeric=True)

print('\nR3 — document category')
fk_check('docs.Category -> categories.Category', 'High confidence, 108/108 match',
         docs, 'Category', cat_names)

print('\nR4 — task classification')
fk_check('tasks.Classification -> categories.Category', 'Medium confidence, 299/300 match',
         tasks, 'Classification', cat_names)

print('\nR5 — category to department')
fk_check('categories.DSU_KEY -> departments.DSU_KEY', 'Medium confidence, 3/44 match',
         cats, 'DSU_KEY', dep_keys)

print('\nR6-R11 — person/email joins to the user directory')
for label, recs, field, claim in [
    ('docs.AssignedTo   -> users.email', docs, 'AssignedTo', 'High, 105/108'),
    ('docs.Assigned     -> users.email', docs, 'Assigned', 'High, 32/35'),
    ("docs.CC'dTo       -> users.email", docs, 'CC_x0027_dTo', 'High, 212/213'),
    ('deps.DSU_HeadEmail-> users.email', deps, 'DSU_HeadEmail', 'High, 42/48'),
    ('deps.DSU_HeadPersonalEmail', deps, 'DSU_HeadPersonalEmail', 'High, 42/48'),
    ('emails.fromAddress-> users.email', emails, 'fromAddress', 'High, 44/50'),
]:
    vals = populated(recs, field)
    addrs = [a for v in vals for a in emails_in(v)]
    hit = [a for a in addrs if a in UE]
    recs_with = len(vals)
    recs_ok = sum(1 for v in vals if any(a in UE for a in emails_in(v)))
    pct = 100 * len(hit) // len(addrs) if addrs else 0
    print(f'  {label:<36} matrix={claim:<14} populated={recs_with:>3}/{len(recs):<3} '
          f'addresses={len(addrs):>4} matched={len(hit):>4} ({pct}%)  records_resolving={recs_ok}')

print('\n\nSECTION 4 — DATA QUALITY CLAIMS  (matrix sheet "06 Data Quality")\n')
DQ = [('docs', 'Assigned', 300, 35), ('docs', 'AssignedTo', 300, 300), ('docs', "CC_x0027_dTo", 300, 108),
      ('docs', 'Category', 300, 108), ('docs', 'RoutedToDSU', 300, 108), ('docs', 'Status', 300, 108),
      ('tasks', 'CoAssigneeDSU', 300, 0), ('tasks', 'DSULookUp', 300, 0),
      ('users', 'department', 794, 70), ('users', 'jobTitle', 794, 47),
      ('categories', 'Default Supporting Department/Unit', 45, 12), ('categories', 'INFORMDSU3', 45, 4),
      ('departments', 'DSU_Email', 50, 0), ('emails', 'bccRecipients', 50, 0)]
print(f'  {"dataset.field":<44} {"claimed":>8} {"nonblank":>9} {"REAL":>6}  verdict')
for ds, f, pres, claim_ne in DQ:
    recs = D.get(ds, [])
    if not recs or not any(f in r for r in recs):
        print(f'  {ds+"."+f:<44} {claim_ne:>8} {"—":>9} {"—":>6}  FIELD ABSENT from payload')
        continue
    vals = [r.get(f) for r in recs]
    nonblank = len([v for v in vals if v not in (None, '', [], {}) and v is not False])
    real = len([v for v in vals if not is_sentinel(v)])
    v = 'CONFIRMED' if real == claim_ne else ('nonblank matches claim' if nonblank == claim_ne
                                              else '*** DIFFERS ***')
    print(f'  {ds+"."+f:<44} {claim_ne:>8} {nonblank:>9} {real:>6}  {v}')
