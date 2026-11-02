"""Build public-data.json from a db dump (<dir>/<collection>/<id>.json).

The public copy is only the fallback the site reads when the database cannot be
reached. It holds the open collections only: «الأداء والتطوير» data lives in
Supabase behind the members' sign-in and is never published in a file.
"""
import json, os, sys, glob, datetime
src, out = sys.argv[1], sys.argv[2]
OPEN = ['files', 'settings', 'socialAccounts', 'socialReadings', 'events']
cols = {}
for c in OPEN:
    rows = []
    for p in sorted(glob.glob(f'{src}/{c}/*.json')):
        d = json.load(open(p, encoding='utf-8'))
        if set(d.keys()) == {'enc'}:
            sys.exit(f'ENCRYPTED document in open collection {c}/{os.path.basename(p)} - refusing')
        d['id'] = os.path.basename(p)[:-5]
        rows.append(d)
    cols[c] = rows
snap = {'v': 2, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'vault': None, 'collections': cols}
json.dump(snap, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('docs', sum(len(r) for r in cols.values()), 'bytes', os.path.getsize(out))
