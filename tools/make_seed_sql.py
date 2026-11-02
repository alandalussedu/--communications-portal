"""Turn public-data.json into SQL that loads every document into Supabase (table public.docs).

Usage: python3 tools/make_seed_sql.py docs/public-data.json supabase/seed
Writes seed-01.sql, seed-02.sql, ... (each small enough for the SQL Editor).
Protected collections stay encrypted exactly as they are; nothing is decrypted.
"""
import json, os, sys

src, out_dir = sys.argv[1], sys.argv[2]
MAX = 400_000  # bytes per file
snap = json.load(open(src, encoding='utf-8'))
PROT = {'branches', 'indicators', 'stages', 'meta', 'syncLog', 'alertState', 'remedialFiles', 'remedialStages', 'remedialRows',
        'remedialMonthly', 'remedialLog', 'remedialSync', 'competitors', 'competitorsMeta'}

def q(s):
    return "'" + s.replace("'", "''") + "'"

rows = []
for coll, docs in snap['collections'].items():
    for d in docs:
        d = dict(d)
        doc_id = d.pop('id')
        if coll in PROT and set(d) != {'enc'}:
            sys.exit(f'PLAINTEXT in protected {coll}/{doc_id} - refusing')
        rows.append((coll, doc_id, d))
if snap.get('vault'):
    rows.append(('vault', 'main', snap['vault']))

os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.startswith('seed-') and f.endswith('.sql'):
        os.remove(os.path.join(out_dir, f))
parts, cur, size = [], [], 0
for coll, doc_id, data in rows:
    line = f"({q(coll)},{q(doc_id)},{q(json.dumps(data, ensure_ascii=False, separators=(',', ':')))}::jsonb)"
    if cur and size + len(line.encode()) > MAX:
        parts.append(cur); cur, size = [], 0
    cur.append(line); size += len(line.encode())
if cur:
    parts.append(cur)
for i, p in enumerate(parts, 1):
    sql = ('insert into public.docs (collection, id, data) values\n' + ',\n'.join(p) +
           '\non conflict (collection, id) do update set data = excluded.data;\n')
    open(os.path.join(out_dir, f'seed-{i:02d}.sql'), 'w', encoding='utf-8').write(sql)
print('docs', len(rows), 'files', len(parts), 'generatedAt', snap.get('generatedAt'))
