#!/usr/bin/env python3
"""Field inventory and value shapes per dataset — the ground truth for verification."""
import json

D = json.load(open('/tmp/claude-0/-home-user-ECM-DOCS-DEV/220e2372-4b43-53d8-b4fe-b151d1f119e9/scratchpad/datasets.json', encoding='utf8'))


def shape(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'bool'
    if isinstance(v, int):
        return 'int'
    if isinstance(v, float):
        return 'float'
    if isinstance(v, list):
        return f'list[{len(v)}]'
    if isinstance(v, dict):
        return 'dict'
    s = str(v)
    return f'str({len(s)})'


for name in sorted(D):
    recs = D[name]
    print(f'\n{"="*100}\n{name.upper()}  —  {len(recs)} records')
    fields = {}
    for r in recs:
        for k, v in r.items():
            fields.setdefault(k, []).append(v)
    print(f'{len(fields)} distinct fields')
    for k, vals in fields.items():
        nonempty = [v for v in vals if v not in (None, '', [], {})]
        types = {}
        for v in vals:
            t = shape(v).split('(')[0]
            types[t] = types.get(t, 0) + 1
        sample = next((repr(v)[:78] for v in nonempty), '—')
        tdesc = ','.join(f'{t}:{c}' for t, c in sorted(types.items(), key=lambda x: -x[1])[:3])
        print(f'  {k:<26} present={len(vals):<4} nonempty={len(nonempty):<4} [{tdesc}]')
        print(f'      e.g. {sample}')
