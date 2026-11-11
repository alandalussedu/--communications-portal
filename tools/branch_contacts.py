#!/usr/bin/env python3
"""
«دليل أرقام الفروع»: turns the sheet «أرقام التواصل للفروع» (tab « دليل التواصل»)
into the public document settings/contacts. Used from a Claude session:

  1. Fetch « دليل التواصل»!A1:J200 with spreadsheets.get (includeGridData,
     fields sheets.merges + sheets.data.rowData.values) and save it as raw.json.
  2. python3 tools/branch_contacts.py raw.json --source-url URL --out DIR
     writes contacts.json and write.sql.

Merged cells carry the meaning (a finance number merged over all a branch's rows
covers the whole branch), so every number is placed at the scope it covers.
Numbers are only cleaned for display: the sheet is never changed.
"""
import argparse, datetime, json, os, re

DEPTS = [(5, "admission", "القبول والتسجيل"), (6, "comms", "التواصل المؤسسي"), (7, "finance", "المالية"), (8, "transport", "الحركة والنقل"), (9, "extra", "أرقام المراحل")]
SLUG = {"الزهراء": "zahra", "الروضة": "rawdah", "الشاطئ عالمية": "shatee-intl", "الشاطئ الموهوبين": "shatee-gifted", "الحمدانية": "hamdaniya",
        "الفيحاء": "faiha", "مكة": "makkah", "الطائف": "taif", "أبها": "abha", "خميس مشيط": "khamis", "الجوف": "jouf", "نجران": "najran",
        "أبحر": "abhur", "المنار": "manar", "الرياض": "riyadh", "الرياض الأوائل": "riyadh-awael"}
STAGE_ORDER = ["رياض أطفال", "ابتدائي", "ابتدائي - المبكرة", "ابتدائي - العليا", "متوسط", "ثانوي"]
INVIS = re.compile(r"[‎‏⁦-⁩‪-‮﻿]")


def clean(t):
    return re.sub(r"\s+", " ", INVIS.sub("", t or "")).strip()


def norm_name(t):
    t = clean(t).replace("أندلس", "").replace("ابها", "أبها").replace("ابحر", "أبحر")
    return re.sub(r"\s+", " ", t).strip()


def phones(raw):
    """Cleaned numbers in a cell, and the pieces that could not be read as a number."""
    raw = INVIS.sub("", raw or "")
    good, bad = [], []
    for part in re.split(r"[-/،,\n]+|\s{2,}(?=0?5)", raw):
        d = re.sub(r"\D", "", part)
        if not d:
            continue
        if d.startswith("00966"):
            d = "0" + d[5:]
        elif d.startswith("966"):
            d = "0" + d[3:]
        if len(d) == 9 and d[0] == "5":
            d = "0" + d
        if re.fullmatch(r"05\d{8}|01\d{8}|9200\d{5}|800\d{7}", d):
            if d not in good:
                good.append(d)
        else:
            bad.append(d)
    return good, bad


def build(raw_path, source_url):
    s = json.load(open(raw_path))["content"]["sheets"][0]
    g = s["data"][0]
    rows = g["rowData"]
    cell = {}
    for i, r in enumerate(rows):
        for j, v in enumerate(r.get("values", [])):
            t = v.get("formattedValue")
            if t is not None and str(t).strip():
                cell[(i, j)] = str(t)
    # every merged cell points at its top-left cell
    owner = {}
    for m in s.get("merges", []):
        for i in range(m["startRowIndex"], m["endRowIndex"]):
            for j in range(m["startColumnIndex"], m["endColumnIndex"]):
                owner[(i, j)] = (m["startRowIndex"], m["startColumnIndex"])
    top = lambda i, j: owner.get((i, j), (i, j))
    val = lambda i, j: clean(cell.get(top(i, j), ""))

    header = next(i for i in range(len(rows)) if val(i, 1) == "الفرع")
    stage_rows = [i for i in range(header + 1, len(rows)) if val(i, 1) or val(i, 4)]
    branches, order, issues = [], [], []
    by_branch = {}
    for i in stage_rows:
        b = norm_name(val(i, 1))
        if not b:
            continue
        if b not in by_branch:
            by_branch[b] = []
            order.append(b)
        by_branch[b].append(i)

    for k, b in enumerate(order):
        rws = by_branch[b]
        grp_of = {}
        groups = []
        for i in rws:
            track = re.sub(r"^اهلي", "أهلي", clean(val(i, 2))) or "—"
            gender = clean(val(i, 3)) or ""
            if gender == clean(val(i, 2)):  # a row merged across track, gender and stage
                gender = ""
            key = (track, gender)
            if key not in [x["key"] for x in groups]:
                groups.append({"key": key, "track": track, "gender": gender, "rows": []})
            next(x for x in groups if x["key"] == key)["rows"].append(i)
            grp_of[i] = key
        # one entry per (top-left cell, department)
        seen = {}
        for i in rws:
            for col, dkey, dlabel in DEPTS:
                t = top(i, col)
                if (t, dkey) in seen:
                    seen[(t, dkey)]["rows"].append(i)
                    continue
                txt = cell.get(t, "")
                good, bad = phones(txt)
                for d in bad:
                    issues.append({"branch": b, "cell": f"{'ABCDEFGHIJ'[col]}{t[0] + 1}", "dept": dlabel, "reason": "رقم غير مكتمل أو غير صحيح بعد التنظيف", "digits": len(d)})
                if good:
                    seen[(t, dkey)] = {"dept": dkey, "label": dlabel, "numbers": good, "rows": [i]}
        general, gshared, stages = [], {}, {}
        all_rows = set(rws)
        for e in seen.values():
            rs = set(e["rows"])
            item = {"dept": e["dept"], "label": e["label"], "numbers": e["numbers"]}
            if rs == all_rows and len(groups) > 1:
                general.append(item)
                continue
            keys = {grp_of[i] for i in rs}
            whole = [gk for gk in keys if set(next(x for x in groups if x["key"] == gk)["rows"]) <= rs]
            if len(keys) == 1 and whole:
                gshared.setdefault(next(iter(keys)), []).append(item)
            elif whole and len(whole) == len(keys):
                for gk in keys:
                    gshared.setdefault(gk, []).append(item)
            else:
                for i in sorted(rs):
                    stages.setdefault(i, []).append(item)
        # a branch where every number is the same one: a single main number
        allnums = {n for e in seen.values() for n in e["numbers"]}
        main = None
        if len(allnums) == 1 and len(seen) > 1:
            main = next(iter(allnums))
            general, gshared, stages = [], {}, {}
        out_groups = []
        for x in groups:
            st = []
            for i in x["rows"]:
                items = stages.get(i, [])
                stg = clean(val(i, 4))
                st.append({"stage": "—" if not stg or stg == clean(val(i, 2)) else stg, "items": items})
            shared = gshared.get(x["key"], [])
            if shared or any(s_["items"] for s_ in st):
                out_groups.append({"track": x["track"], "gender": x["gender"], "shared": shared, "stages": [s_ for s_ in st if s_["items"]]})
        empty = not (main or general or out_groups)
        branches.append({"name": "أندلس " + b, "short": b, "slug": SLUG.get(b), "order": k, "main": main, "general": general, "groups": out_groups, "empty": empty})

    return {
        "id": "contacts",
        "kind": "branchContacts",
        "title": "دليل أرقام الفروع",
        "source": source_url,
        "readAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "depts": [{"key": d, "label": l} for _, d, l in DEPTS],
        "branches": branches,
        "issues": issues,
    }


def main():
    a = argparse.ArgumentParser()
    a.add_argument("raw")
    a.add_argument("--source-url", required=True)
    a.add_argument("--out", required=True)
    o = a.parse_args()
    doc = build(o.raw, o.source_url)
    json.dump(doc, open(os.path.join(o.out, "contacts.json"), "w"), ensure_ascii=False, indent=1)
    j = json.dumps(doc, ensure_ascii=False)
    assert "$j$" not in j
    open(os.path.join(o.out, "write.sql"), "w").write(
        f"insert into public.docs (collection,id,data) values ('settings','contacts',$j${j}$j$::jsonb) on conflict (collection,id) do update set data=excluded.data;")
    for b in doc["branches"]:
        n = sum(len(x["shared"]) + sum(len(s["items"]) for s in x["stages"]) for x in b["groups"]) + len(b["general"]) + (1 if b["main"] else 0)
        print(b["short"], b["slug"], "groups", len(b["groups"]), "entries", n, "main" if b["main"] else "", "EMPTY" if b["empty"] else "")
    print("issues", len(doc["issues"]))


if __name__ == "__main__":
    main()
