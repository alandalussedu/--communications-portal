/**
 * «السنترال · الفروع»: every branch extension the unified line transfers calls to,
 * not only the communication officers'. Editors and the owner only
 * (editor_collection in schema.sql).
 *
 * Where an extension belongs comes from its number: each branch and stage has its
 * own block of a hundred in «دليل التحويلات» (e.g. الفيحاء بنين 5700–5799), so a
 * number lands in its branch even when the directory does not list it. The
 * directory gives the person's name and job title. Head office keeps its own
 * blocks (1000–1199) and the top managers' four-digit repeats (1111, 2222, …).
 *
 * The unified line's own customer-service agents (3CX names starting «CRM.») and
 * the system numbers (auto-attendant, queues: 8xxx) are left out: their rows are
 * queue rings, not transfers.
 */
import type { PbxBranchReport, PbxDirEntry, PbxDirectory, PbxExtCount, PbxOfficer } from "@/data/types"
import { SMALL_SAMPLE, rate, type PbxFile } from "./pbx"

export const HQ = "الإدارة العامة"
/** a month's extension with at least this many unanswered calls goes on the follow-up list */
export const FOLLOW_MIN = 5

type Range = [lo: number, hi: number, branch: string, section: string]
/** From the section headers of «دليل التحويلات» (where two headers clashed, the one the switchboard uses). */
export const RANGES: Range[] = [
  [1000, 1019, HQ, "الموارد البشرية"],
  [1020, 1049, HQ, "الخدمات المدرسية"],
  [1050, 1075, HQ, "الإدارة المالية"],
  [1076, 1099, HQ, "التقنية"],
  [1100, 1109, HQ, "التخطيط والتميز المؤسسي"],
  [1110, 1119, HQ, "التواصل المؤسسي"],
  [1120, 1139, HQ, "التميز التعليمي الأهلي"],
  [1140, 1149, HQ, "التميز التعليمي العالمي"],
  [1150, 1199, HQ, "إدارات أخرى"],
  [1200, 1299, "الزهراء", "بنات · رياض الأطفال"],
  [1300, 1399, "الزهراء", "بنين · ابتدائي"],
  [1400, 1499, "الزهراء", "بنات · ابتدائي"],
  [1500, 1599, "الزهراء", "بنين · متوسط"],
  [1600, 1699, "الزهراء", "بنات · متوسط"],
  [1700, 1799, "الزهراء", "بنين · ثانوي"],
  [1800, 1899, "الزهراء", "بنات · ثانوي"],
  [1900, 1999, "الروضة", "بنين"],
  [2000, 2099, "الروضة", "بنات"],
  [2100, 2199, "الحمدانية", "بنين · متوسط وثانوي"],
  [2200, 2299, "الزهراء", "الطفولة المبكرة"],
  [2300, 2399, "مكة", "بنين · ابتدائي"],
  [2400, 2499, "مكة", "بنات · رياض وابتدائي"],
  [2500, 2599, "مكة", "بنين · متوسط وثانوي"],
  [2600, 2699, "مكة", "بنات · متوسط وثانوي"],
  [2700, 2799, "الطائف", "بنين · ابتدائي"],
  [2800, 2899, "الطائف", "بنين · متوسط"],
  [2900, 2999, "الطائف", "بنين · ثانوي"],
  [3000, 3099, "الطائف", "بنات"],
  [3100, 3199, "أبها", "بنين · ابتدائي"],
  [3200, 3299, "أبها", "بنين · متوسط"],
  [3300, 3399, "أبها", "بنين · ثانوي"],
  [3400, 3499, "أبها", "بنات"],
  [3500, 3599, "خميس مشيط", "بنين · ابتدائي"],
  [3600, 3699, "خميس مشيط", "بنين · متوسط"],
  [3700, 3799, "خميس مشيط", "بنين · ثانوي"],
  [3800, 3899, "خميس مشيط", "بنات"],
  [3900, 3999, "الجوف", "بنين · ابتدائي"],
  [4000, 4099, "الجوف", "بنين · متوسط"],
  [4100, 4199, "الجوف", "بنين · ثانوي"],
  [4200, 4299, "الجوف", "بنات · ابتدائي"],
  [4300, 4399, "الجوف", "بنات · متوسط وثانوي"],
  [4400, 4499, "الحمدانية", "بنين · ابتدائي أهلي"],
  [4500, 4599, "الحمدانية", "المسار المصري"],
  [4600, 4699, "الحمدانية", "بنات · ابتدائي"],
  [4700, 4799, "الحمدانية", "بنات · متوسط وثانوي"],
  [4800, 4899, "نجران", "بنين"],
  [4900, 4999, "نجران", "بنات"],
  [5000, 5099, "الشاطئ موهبة", "بنين"],
  [5100, 5199, "الحمدانية", "رياض الأطفال"],
  [5200, 5299, "الشاطئ العالمية", "بنين"],
  [5300, 5399, "الشاطئ العالمية", "بنات · ابتدائي"],
  [5400, 5499, "الطائف", "بنات · رياض ودبلوما"],
  [5500, 5599, "الحمدانية", "دبلوما"],
  [5600, 5699, "الشاطئ موهبة", "بنات"],
  [5700, 5799, "الفيحاء", "بنين"],
  [5800, 5899, "الفيحاء", "بنات · أهلي"],
  [5900, 5999, "الشاطئ العالمية", "بنات · متوسط وثانوي"],
  [6000, 6099, "الفيحاء", "بنات · عالمي"],
  [6100, 6199, "الفيحاء", "بنات · المسار الموازي"],
  [6200, 6299, "المنار", "بنين"],
  [6300, 6399, "أبحر", "بنين · أهلي"],
  [6400, 6499, "أبحر", "بنات · عالمي"],
  [6500, 6599, "المنار", "بنات · أهلي"],
  [6600, 6699, "أبحر", "بنات · أهلي"],
  [6700, 6799, "الروضة", "رياض الأطفال"],
  [6800, 6899, "المنار", "بنات · عالمي ورياض"],
  [6900, 6999, "الرياض", "بنين · أهلي"],
  [7000, 7099, "الرياض", "بنين · عالمي"],
  [7100, 7199, "الرياض", "بنات · أهلي"],
  [7200, 7299, "الرياض", "بنات · عالمي والأوائل"],
  [7300, 7399, "أبها", "عالمي · بنين"],
  [7400, 7499, "أبها", "عالمي · بنات"],
  [7500, 7599, "أبحر", "بنين · عالمي"],
]
/** head office's top managers: their numbers fall inside branch blocks, so they are placed first */
const TOP = new Set(["1111", "2222", "3333", "4444", "5555", "6666", "9999"])
const TOP_SECTION = "الإدارة العليا"

/** The branches in the order the portal lists them elsewhere. */
export const BRANCH_ORDER = ["الزهراء", "الروضة", "الحمدانية", "مكة", "الطائف", "أبها", "خميس مشيط", "الجوف", "نجران", "الشاطئ العالمية", "الشاطئ موهبة", "الفيحاء", "المنار", "أبحر", "الرياض"]

export type Place = { branch: string; section: string; range: string | null }

export function placeOf(ext: string, entry?: PbxDirEntry | null): Place | null {
  if (TOP.has(ext)) return { branch: HQ, section: TOP_SECTION, range: null }
  const n = Number(ext)
  if (Number.isFinite(n)) for (const [lo, hi, branch, section] of RANGES) if (n >= lo && n <= hi) return { branch, section, range: `${lo}–${hi}` }
  if (entry?.hq) return { branch: HQ, section: entry.section || "إدارات أخرى", range: null }
  return null
}

export const dirMap = (d: PbxDirectory | null | undefined) => new Map((d?.entries ?? []).map((e) => [e.ext, e]))

/** One extension's month from an uploaded file. The unified line's own agents and system numbers are not kept. */
export function countBranchMonth(file: PbxFile, month: string, directory: PbxDirectory | null) {
  const dir = dirMap(directory)
  const rows = file.rows.filter((r) => r.day.startsWith(month))
  const labels = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.label) continue
    const m = labels.get(r.ext) ?? new Map<string, number>()
    m.set(r.label, (m.get(r.label) ?? 0) + 1)
    labels.set(r.ext, m)
  }
  const agent = (ext: string) => [...(labels.get(ext)?.keys() ?? [])].some((l) => /^crm\./i.test(l))
  const by = new Map<string, { answered: number; unanswered: number; vm: number; ring: number[] }>()
  let waiting = 0
  for (const r of rows) {
    if (agent(r.ext) || !placeOf(r.ext, dir.get(r.ext))) continue
    const c = by.get(r.ext) ?? { answered: 0, unanswered: 0, vm: 0, ring: [] }
    if (r.voicemail) c.vm++
    else if (r.status === "answered") (c.answered++, r.ring !== null && c.ring.push(r.ring))
    else if (r.status === "unanswered") c.unanswered++
    else if (r.status === "waiting") waiting++
    by.set(r.ext, c)
  }
  const lines: PbxExtCount[] = [...by]
    .filter(([, c]) => c.answered + c.unanswered > 0)
    .map(([ext, c]) => {
      const named = [...(labels.get(ext) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1])
      return { ext, attempts: c.answered + c.unanswered, answered: c.answered, unanswered: c.unanswered, voicemail: Math.min(c.vm, c.unanswered), ring: c.ring, label: named[0]?.[0] ?? null }
    })
    .sort((a, b) => Number(a.ext) - Number(b.ext))
  const days = rows.map((r) => r.day).sort()
  return { lines, waiting, from: days[0] ?? null, to: days[days.length - 1] ?? null }
}

/* ------------------------------------------------------------ the month, grouped for the tab and the PDF */
export type Totals = { attempts: number; answered: number; unanswered: number; voicemail: number; exts: number }
export type ExtRow = PbxExtCount & {
  place: Place
  /** from the officers list first, then the directory */
  name: string | null
  title: string | null
  officer: boolean
  inDir: boolean
  /** other names the directory gives the same extension */
  others: string[]
}
export type SectionGroup = Totals & { label: string; range: string | null; rows: ExtRow[] }
export type BranchGroup = Totals & { name: string; sections: SectionGroup[]; rows: ExtRow[]; off: Totals; oth: Totals }
export type BranchView = {
  total: Totals & { branches: number; ringMedian: number | null }
  off: Totals
  oth: Totals
  /** every branch, ranked: by answer rate, then branches with too few calls, then those with none */
  branches: BranchGroup[]
  hq: BranchGroup | null
  follow: ExtRow[]
  notInDir: ExtRow[]
}

const zero = (): Totals => ({ attempts: 0, answered: 0, unanswered: 0, voicemail: 0, exts: 0 })
function sum(rows: ExtRow[]): Totals {
  const t = zero()
  for (const r of rows) (t.attempts += r.attempts), (t.answered += r.answered), (t.unanswered += r.unanswered), (t.voicemail += r.voicemail), t.exts++
  return t
}
export function median(v: number[]): number | null {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const sectionKey = (r: ExtRow) => (r.place.range ? Number(r.place.range.split("–")[0]) : 0)

function group(name: string, rows: ExtRow[]): BranchGroup {
  const sections = new Map<string, ExtRow[]>()
  for (const r of rows) sections.set(r.place.section, [...(sections.get(r.place.section) ?? []), r])
  const list: SectionGroup[] = [...sections].map(([label, rs]) => ({
    label,
    range: rs[0].place.range,
    ...sum(rs),
    rows: [...rs].sort((a, b) => b.attempts - a.attempts || b.unanswered - a.unanswered || Number(a.ext) - Number(b.ext)),
  }))
  list.sort((a, b) => (sectionKey(a.rows[0]) || 99999) - (sectionKey(b.rows[0]) || 99999) || a.label.localeCompare(b.label, "ar"))
  return { name, ...sum(rows), sections: list, rows, off: sum(rows.filter((r) => r.officer)), oth: sum(rows.filter((r) => !r.officer)) }
}

/** highest answer rate first; fewer than SMALL_SAMPLE calls after; branches without calls last */
export function rankBranches<T extends Totals & { name: string }>(list: T[]): T[] {
  const tier = (b: T) => (b.attempts === 0 ? 2 : b.attempts < SMALL_SAMPLE ? 1 : 0)
  return [...list].sort((a, b) => tier(a) - tier(b) || (rate(b) ?? -1) - (rate(a) ?? -1) || b.attempts - a.attempts || BRANCH_ORDER.indexOf(a.name) - BRANCH_ORDER.indexOf(b.name))
}

export function branchView(report: PbxBranchReport, directory: PbxDirectory | null, officers: PbxOfficer[]): BranchView {
  const dir = dirMap(directory)
  const officerOf = new Map<string, PbxOfficer>()
  for (const o of officers) if (o.active) for (const x of o.exts) officerOf.set(x, o)
  const rows: ExtRow[] = []
  for (const l of report.lines) {
    const entry = dir.get(l.ext) ?? null
    const place = placeOf(l.ext, entry)
    if (!place) continue
    const o = officerOf.get(l.ext)
    rows.push({
      ...l,
      place,
      name: o?.name ?? entry?.name ?? null,
      title: entry?.title ?? (o ? "مسؤول التواصل" : null),
      officer: !!o,
      inDir: !!entry,
      others: (entry?.others ?? []).filter((n) => n !== (o?.name ?? entry?.name)),
    })
  }
  const branchRows = rows.filter((r) => r.place.branch !== HQ)
  const hqRows = rows.filter((r) => r.place.branch === HQ)
  const branches = rankBranches(BRANCH_ORDER.map((b) => group(b, branchRows.filter((r) => r.place.branch === b))))
  const total = sum(branchRows)
  return {
    total: { ...total, branches: branches.filter((b) => b.attempts > 0).length, ringMedian: median(branchRows.flatMap((r) => r.ring)) },
    off: sum(branchRows.filter((r) => r.officer)),
    oth: sum(branchRows.filter((r) => !r.officer)),
    branches,
    hq: hqRows.length ? group(HQ, hqRows) : null,
    follow: branchRows.filter((r) => r.unanswered >= FOLLOW_MIN).sort((a, b) => b.unanswered - a.unanswered || b.attempts - a.attempts || Number(a.ext) - Number(b.ext)),
    notInDir: branchRows.filter((r) => !r.inDir).sort((a, b) => b.attempts - a.attempts || Number(a.ext) - Number(b.ext)),
  }
}
