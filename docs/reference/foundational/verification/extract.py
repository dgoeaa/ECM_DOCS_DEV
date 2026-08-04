#!/usr/bin/env python3
"""Locate and extract the canonical seven-dataset payload from the master run record."""
import json, os, sys

SRC = ('/home/user/ECM_DOCS_DEV/docs/reference/foundational/flows/definitions/'
       'Copy of - Fetch_All_Data_&_References_Matrix-POST__08584201914788160149253197884CU95__flow_run_record.json')
OUT = '/tmp/claude-0/-home-user-ECM-DOCS-DEV/220e2372-4b43-53d8-b4fe-b151d1f119e9/scratchpad/datasets.json'
WANT = {'docs', 'tasks', 'emails', 'users', 'categories', 'departments', 'taskComments'}

doc = json.load(open(SRC, encoding='utf8'))
print('top-level keys:', list(doc)[:12])

best = None
seen = []


def walk(node, path=''):
    """Find every dict that directly holds several of the wanted dataset arrays."""
    global best
    if isinstance(node, dict):
        keys = {k for k, v in node.items() if k in WANT and isinstance(v, list)}
        if keys:
            counts = {k: len(node[k]) for k in keys}
            seen.append((path, counts))
            score = (len(keys), sum(counts.values()))
            if best is None or score > best[0]:
                best = (score, path, node)
        for k, v in node.items():
            walk(v, f'{path}.{k}')
    elif isinstance(node, list):
        for i, v in enumerate(node[:50]):
            walk(v, f'{path}[{i}]')


walk(doc)

print(f'\ncandidate payload locations ({len(seen)}):')
for path, counts in sorted(seen, key=lambda x: -sum(x[1].values()))[:8]:
    print(f'  {path[:70]:<70} {counts}')

if not best:
    sys.exit('no payload found')

score, path, node = best
print(f'\nCANONICAL PAYLOAD AT: {path or "<root>"}')
data = {k: node[k] for k in WANT if k in node and isinstance(node[k], list)}
for k, v in sorted(data.items()):
    print(f'  {k:<14} {len(v):>5} records, {len(v[0]) if v else 0} fields on first record')

json.dump(data, open(OUT, 'w', encoding='utf8'))
print(f'\nwritten -> {OUT} ({os.path.getsize(OUT):,} bytes)')
