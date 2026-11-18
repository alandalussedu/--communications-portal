#!/usr/bin/env python3
"""
«دليل التحويلات» for «السنترال · الفروع»: turns the sheet «دليل تحويلات مدارس الأندلس - الاداري»
(tab «اداري الفروع - دليل التحويلات») into the protected document pbxDirectory/current
(editor_collection in schema.sql: editors and the owner only). Used from a Claude session:

  1. Read the sheet's link from the field sourceUrl of pbxDirectory/current in the
     database (it is not kept in the repository). Fetch the tab with spreadsheets.get
     (includeGridData, fields sheets.data.rowData.values.formattedValue) and save it as raw.json.
  2. python3 tools/pbx_directory.py raw.json --source-url URL --out DIR
     writes directory.json and write.sql; run write.sql on the project.

The sheet repeats column blocks «الأسم رباعي بالعربي / الوصف الوظيفي / رقم التحويلة» (the header
row), and a row with only a name is a section header («فرع الفيحاء بنين أهلي 5700 -5799»).
This keeps each extension's name, job title, sheet section and whether that section is head
office. The branch and stage come from the number in the portal (src/lib/pbxBranches.ts), so
an extension the sheet files under the wrong header still lands in its branch. Where the sheet
gives one extension several names, the first (in sheet order) is shown and the rest are kept
in «others» and listed in «issues» for whoever maintains the sheet. The sheet is never changed,
and no file id lives in the repository: the link is passed in.
"""
import argparse, datetime, json, os, re

INVIS = re.compile(r"[‎‏⁦-⁩‪-‮﻿]")
RANGE = re.compile(r"(\d{3,5})\s*-\s*(\d{3,5})")
SECTION_WORDS = re.compile(r"فرع|إدارة|الإدارة|المرحلة|بنين|بنات|رياض|مجمع|ابتدائ|متوسط|ثانوي|القسم|التواصل|التخطيط|بوفية|دبلوما|المسار|الطفولة")
HQ_SECTION = re.compile(r"^(الإدارة العامة|التخطيط|إدارة |الإدارة المالية|التواصل المؤسسي|بوفية)")
BRANCH_WORDS = re.compile(r"فرع|الزهراء|الروضة|الحمدانية|مكة|مكه|الطائف|ابها|أبها|عسير|خميس|الجوف|نجران|الشاطئ|الفيحاء|المنار|ابحر|أبحر|الرياض")


def clean(t):
    return re.sub(r"\s+", " ", INVIS.sub("", (t or "").replace("\n", " "))).strip()


KIND = [("بنين", r"بنين"), ("بنات", r"بنات"), ("رياض", r"رياض"), ("ابتدائي", r"ابتدائ|الأبتدائ"), ("متوسط", r"متوسط"), ("ثانوي", r"ثانوي"),
        ("عالمي", r"عالمي|العالمي"), ("أهلي", r"أهلي|الأهلي"), ("موازي", r"الموازي"), ("مصري", r"المصري"), ("دبلوما", r"دبلوما"), ("طفولة", r"الطفولة")]


def signature(label):
    """gender, stage and track words of a section header: two headers with the same range should agree"""
    return frozenset(k for k, rx in KIND if re.search(rx, label))


def section_label(t):
    t = RANGE.sub(" ", t)
    t = re.sub(r"\s*-\s*$|^\s*-\s*", "", t)
    t = re.sub(r"(\D)(\d{3,5})\b", r"\1", t)  # a range glued to the text («الدبلوما5400»)
    return re.sub(r"\s+", " ", t).strip(" -")


def build(raw_path, source_url):
    s = json.load(open(raw_path))["content"]["sheets"][0]
    grid = [[clean(c.get("formattedValue")) for c in (r.get("values") or [])] for r in s["data"][0]["rowData"]]
    width = max(len(r) for r in grid)
    grid = [r + [""] * (width - len(r)) for r in grid]
    head_row = next(i for i, r in enumerate(grid) if sum(1 for c in r if c.startswith("الأسم")) >= 2)
    head = grid[head_row]
    blocks = list(zip([i for i, c in enumerate(head) if c.startswith("الأسم")], [i for i, c in enumerate(head) if c.startswith("الوصف")], [i for i, c in enumerate(head) if c.startswith("رقم التحويلة")]))

    found, sections = [], []
    for b, (cn, ct, ce) in enumerate(blocks):
        sec = ""
        for ri in range(head_row + 1, len(grid)):
            name, title, extc = grid[ri][cn], grid[ri][ct], grid[ri][ce]
            if not (name or title or extc):
                continue
            if name and not title and not extc:
                if SECTION_WORDS.search(name) or RANGE.search(name):
                    sec = name
                    sections.append(name)
                continue
            for ext in re.findall(r"(?<!\d)\d{3,5}(?!\d)", extc):
                found.append({"ext": ext, "name": name or None, "title": title or None, "sheet": sec, "order": (b, ri)})

    by = {}
    for e in sorted(found, key=lambda e: e["order"]):
        by.setdefault(e["ext"], []).append(e)
    entries, issues = [], []
    for ext in sorted(by, key=int):
        es = by[ext]
        named = [e for e in es if e["name"]]
        first = named[0] if named else es[0]
        names = list(dict.fromkeys(e["name"] for e in named))
        title = first["title"] or next((e["title"] for e in es if e["title"] and e["name"] == first["name"]), None)
        sec = first["sheet"]
        hq = bool(HQ_SECTION.search(sec)) and not BRANCH_WORDS.search(sec)
        entry = {"ext": ext, "name": first["name"], "title": title, "section": section_label(sec), "hq": hq}
        if len(names) > 1:
            entry["others"] = names[1:]
            issues.append(f"التحويلة {ext} مكتوبة بأكثر من اسم: {'، '.join(names)}")
        entries.append(entry)

    # one range written for two different sections (a branch's general header sharing a range is fine)
    seen = {}
    for t in dict.fromkeys(sections):
        m = RANGE.search(t)
        if m:
            seen.setdefault((m[1], m[2]), []).append(section_label(t))
    for (lo, hi), labels in seen.items():
        labels = list(dict.fromkeys(labels))
        kinds = {signature(l) for l in labels if signature(l)}
        if len(kinds) > 1:
            issues.append(f"النطاق {lo}–{hi} مكتوب لأكثر من قسم: {'، '.join(labels)}")

    return {
        "entries": entries,
        "issues": issues,
        "source": "دليل تحويلات مدارس الأندلس - الاداري · اداري الفروع - دليل التحويلات",
        "sourceUrl": source_url,
        "syncedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def main():
    a = argparse.ArgumentParser()
    a.add_argument("raw")
    a.add_argument("--source-url", required=True)
    a.add_argument("--out", required=True)
    o = a.parse_args()
    doc = build(o.raw, o.source_url)
    json.dump(doc, open(os.path.join(o.out, "directory.json"), "w"), ensure_ascii=False, indent=1)
    j = json.dumps(doc, ensure_ascii=False)
    assert "$j$" not in j
    open(os.path.join(o.out, "write.sql"), "w").write(
        f"insert into public.docs (collection,id,data) values ('pbxDirectory','current',$j${j}$j$::jsonb) on conflict (collection,id) do update set data=excluded.data, updated_at=now();")
    named = sum(1 for e in doc["entries"] if e["name"])
    print("extensions", len(doc["entries"]), "named", named, "head office", sum(1 for e in doc["entries"] if e["hq"]), "issues", len(doc["issues"]))


if __name__ == "__main__":
    main()
