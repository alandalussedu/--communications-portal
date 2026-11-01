"""Build public-data.json from a db dump (<dir>/<collection>/<id>.json). Refuses plaintext in protected collections."""
import json, os, sys, glob, datetime
src, out = sys.argv[1], sys.argv[2]
OPEN = ['files', 'settings', 'socialAccounts', 'socialReadings', 'events']
PROT = ['branches', 'indicators', 'stages', 'meta', 'syncLog', 'alertState', 'remedialFiles', 'remedialStages', 'remedialRows',
        'remedialMonthly', 'remedialLog', 'remedialSync', 'competitors', 'competitorsMeta']
cols = {}
for c in OPEN + PROT:
    rows = []
    for p in sorted(glob.glob(f'{src}/{c}/*.json')):
        d = json.load(open(p, encoding='utf-8'))
        if c in PROT and (set(d.keys()) != {'enc'} or not isinstance(d['enc'], dict)):
            sys.exit(f'PLAINTEXT in protected {c}/{os.path.basename(p)} - refusing')
        d['id'] = os.path.basename(p)[:-5]
        rows.append(d)
    cols[c] = rows
vault = None
vp = f'{src}/vault/main.json'
if os.path.exists(vp):
    v = json.load(open(vp, encoding='utf-8'))
    vault = {k: v[k] for k in ('v', 'kdf', 'iter', 'salt', 'iv', 'wrapped', 'keyId', 'updatedAt') if k in v}
snap = {'v': 1, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'vault': vault, 'collections': cols}
json.dump(snap, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('docs', sum(len(r) for r in cols.values()), 'bytes', os.path.getsize(out))
