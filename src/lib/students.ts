/**
 * «أعداد الطلاب»: reads the Excel file «مؤشرات أعداد الطلاب» (pulled from the
 * school system) in the browser. Every number is taken from the file as it is;
 * nothing is recomputed except the checks that warn when the sheets disagree.
 */
import * as XLSX from "xlsx"
import type { StudentCounts, StudentRow } from "@/data/types"

export class StudentFileError extends Error {}

/** Levels approved by the platform owner (17 Nov 2026). */
export const WITHDRAWAL_LEVELS = { good: 0.08, follow: 0.12 }
export const OCCUPANCY_LEVELS = { high: 0.85, good: 0.7 }
export type Tone = "ok" | "sky" | "warn" | "bad"
export type Status = { tone: Tone; label: string }

export function withdrawalStatus(r: number): Status {
  if (r <= WITHDRAWAL_LEVELS.good) return { tone: "ok", label: "جيد" }
  if (r <= WITHDRAWAL_LEVELS.follow) return { tone: "warn", label: "متابعة" }
  return { tone: "bad", label: "مرتفع" }
}
export function occupancyStatus(r: number): Status {
  if (r >= OCCUPANCY_LEVELS.high) return { tone: "ok", label: "مرتفع" }
  if (r >= OCCUPANCY_LEVELS.good) return { tone: "sky", label: "جيد" }
  return { tone: "warn", label: "منخفض" }
}

/** «أندلس أبحر» → «أبحر» */
export const shortName = (name: string) => name.replace(/^\s*[أا]ندلس\s+/, "").trim()
/** 0.1114 → «11.1%» */
export const pct = (r: number | null | undefined, d = 1) => (r === null || r === undefined || Number.isNaN(r) ? "—" : `${(r * 100).toFixed(d)}%`)
/** 0.0795 → «+8.0%», -0.17 → «−17.9%» (wrap in dir="ltr" when shown) */
export const signedPct = (r: number | null | undefined) => (r === null || r === undefined ? "—" : `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)}%`)

/** Notes whose title names the branch (e.g. «ملاحظة: أندلس أبها»). */
export const notesFor = (c: StudentCounts, name: string) => {
  const s = shortName(name)
  return c.notes.filter((n) => n.title.includes(s))
}
/** The file calls the growth basis preliminary while it waits for approval. */
export const growthPreliminary = (c: StudentCounts) => c.notes.some((n) => n.title.includes("النمو") && /مبدئي/.test(n.title + n.text))

/* ---------------------------------------------------------------- reading */
const norm = (v: unknown) =>
  String(v ?? "")
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim()

type Grid = unknown[][]
function sheet(wb: XLSX.WorkBook, title: string): Grid | null {
  const name = wb.SheetNames.find((n) => norm(n) === norm(title))
  if (!name) return null
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: true, defval: null, raw: true }) as Grid
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const t = norm(v).replace(/,/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  const m = t.match(/^(-|−)?\d+(\.\d+)?%?$/)
  if (!m) return null
  const n = Number(t.replace("−", "-").replace("%", ""))
  return t.endsWith("%") ? n / 100 : n
}

/** The table under the header row that starts with «الفرع»: column titles and one map per branch, plus the total row. */
function table(g: Grid) {
  const h = g.findIndex((r) => norm(r?.[0]) === "الفرع")
  if (h < 0) return null
  const rawHead = (g[h] ?? []).map((x) => String(x ?? "").trim())
  const head = rawHead.map(norm)
  const rows: { name: string; cells: unknown[] }[] = []
  let total: unknown[] | null = null
  for (let i = h + 1; i < g.length; i++) {
    const name = String(g[i]?.[0] ?? "").trim()
    if (!name) break
    if (norm(name) === "الاجمالي") {
      total = g[i]
      break
    }
    rows.push({ name, cells: g[i] })
  }
  const col = (prefix: string) => head.findIndex((x) => x.startsWith(norm(prefix)))
  return { head, rawHead, rows, total, col }
}

const sameBranch = (a: string, b: string) => norm(shortName(a)) === norm(shortName(b))

export type StudentParse = { counts: StudentCounts; warnings: string[] }

export function parseStudentWorkbook(wb: XLSX.WorkBook, fileName: string | null): StudentParse {
  const warnings: string[] = []
  const main = sheet(wb, "مؤشرات الفروع")
  if (!main) throw new StudentFileError("لم أجد ورقة «مؤشرات الفروع» في الملف. ارفع ملف «مؤشرات أعداد الطلاب» كما يخرج من التقرير.")
  const stamp = main.slice(0, 4).map((r) => String(r?.[0] ?? "")).join(" ")
  const date = stamp.match(/(\d{4})-(\d{2})-(\d{2})/)?.[0]
  if (!date) throw new StudentFileError("لم أجد تاريخ سحب البيانات في رأس ورقة «مؤشرات الفروع» (مثل 2026-11-17).")
  const year = stamp.match(/العام الدراسي\s*(\d{4})\s*[-–/]\s*(\d{4})/)
  const t = table(main)
  if (!t || !t.rows.length) throw new StudentFileError("ورقة «مؤشرات الفروع» لا تحوي جدول الفروع تحت عنوان «الفرع».")
  const need = { current: "عدد الطلاب الحالي", newcomers: "عدد الطلاب الجدد", growth: "نسبة النمو", withdrawalRate: "نسبة الانسحاب", withdrawn: "عدد المنسحبين", occupancy: "نسبة الاشغال", capacity: "الطاقة التشغيلية" }
  const at = Object.fromEntries(Object.entries(need).map(([k, label]) => [k, t.col(label)])) as Record<keyof typeof need, number>
  const missing = Object.entries(at).filter(([k, i]) => i < 0 && k !== "growth").map(([k]) => need[k as keyof typeof need])
  if (missing.length) throw new StudentFileError(`ورقة «مؤشرات الفروع» ينقصها: ${missing.join("، ")}.`)

  const base = (name: string, cells: unknown[]): StudentRow => {
    const v = (k: keyof typeof need) => (at[k] < 0 ? null : num(cells[at[k]]))
    const req = (k: keyof typeof need) => {
      const x = v(k)
      if (x === null) throw new StudentFileError(`قيمة «${need[k]}» لـ«${name}» ليست رقمًا.`)
      return x
    }
    return { name, current: req("current"), newcomers: req("newcomers"), growth: v("growth"), withdrawalRate: req("withdrawalRate"), withdrawn: req("withdrawn"), occupancy: req("occupancy"), capacity: req("capacity"), regular: null, transferred: null, graduated: null, previous: null, stages: [], types: [] }
  }
  const branches = t.rows.map((r) => base(r.name, r.cells))
  if (!t.total) throw new StudentFileError("ورقة «مؤشرات الفروع» بلا صف «الإجمالي».")
  const total = base("الإجمالي", t.total)

  // «بيانات الحساب»: the raw counts behind the indicators
  const raw = sheet(wb, "بيانات الحساب")
  const rt = raw && table(raw)
  if (!rt) warnings.push("ورقة «بيانات الحساب» غير موجودة: لن تظهر أعداد المنتظمين والمحوّلين والمتخرجين.")
  else {
    const c = { regular: rt.col("منتظم"), transferred: rt.col("محول"), graduated: rt.col("متخرج"), previous: rt.col("عدد الطلاب") }
    const fill = (row: StudentRow, cells: unknown[] | undefined) => {
      if (!cells) return
      for (const k of Object.keys(c) as (keyof typeof c)[]) row[k] = c[k] < 0 ? null : num(cells[c[k]])
    }
    for (const b of branches) {
      const r = rt.rows.find((x) => sameBranch(x.name, b.name))
      if (!r) warnings.push(`«${b.name}» غير موجود في ورقة «بيانات الحساب».`)
      fill(b, r?.cells)
      if (b.regular !== null && b.regular + b.newcomers !== b.current) warnings.push(`«${b.name}»: المنتظم + المستجد (${b.regular + b.newcomers}) لا يساوي عدد الطلاب الحالي (${b.current}).`)
    }
    fill(total, rt.total ?? undefined)
  }

  // the two breakdowns of current students
  const split = (title: string, key: "stages" | "types") => {
    const g = sheet(wb, title)
    const s = g && table(g)
    if (!s) {
      warnings.push(`ورقة «${title}» غير موجودة.`)
      return [] as string[]
    }
    const cols = s.head.map((n, i) => ({ h: s.rawHead[i], n, i })).filter((x) => x.i > 0 && x.n && x.n !== "الاجمالي")
    const read = (cells: unknown[]) => cols.map((x) => num(cells[x.i]) ?? 0)
    for (const b of branches) {
      const r = s.rows.find((x) => sameBranch(x.name, b.name))
      if (!r) {
        warnings.push(`«${b.name}» غير موجود في ورقة «${title}».`)
        continue
      }
      b[key] = read(r.cells)
      const sum = b[key].reduce((a, x) => a + x, 0)
      if (sum !== b.current) warnings.push(`«${b.name}»: مجموع ورقة «${title}» (${sum}) لا يساوي عدد الطلاب الحالي (${b.current}).`)
    }
    if (s.total) total[key] = read(s.total)
    return cols.map((x) => x.h)
  }
  const stageNames = split("حسب المرحلة", "stages")
  const typeNames = split("حسب نوع الدراسة", "types")

  // «التعريفات والملاحظات», word for word
  const notes: { title: string; text: string }[] = []
  const ng = sheet(wb, "التعريفات والملاحظات")
  if (ng)
    for (const r of ng.slice(1)) {
      const title = String(r?.[0] ?? "").trim(), text = String(r?.[1] ?? "").trim()
      if (title && text) notes.push({ title, text })
    }

  const sum = (k: "current" | "newcomers" | "withdrawn" | "capacity") => branches.reduce((a, b) => a + b[k], 0)
  for (const [k, label] of [["current", "الطلاب الحاليين"], ["newcomers", "الطلاب الجدد"], ["withdrawn", "المنسحبين"], ["capacity", "الطاقة التشغيلية"]] as const)
    if (sum(k) !== total[k]) warnings.push(`صف «الإجمالي» لـ${label} (${total[k]}) لا يساوي مجموع الفروع (${sum(k)}).`)

  return {
    counts: { id: date, date, year: year ? `${year[1]}-${year[2]}` : "", stageNames, typeNames, branches, total, notes, fileName, uploadedAt: new Date().toISOString() },
    warnings,
  }
}

export async function readStudentFile(file: File): Promise<StudentParse> {
  if (!/\.xlsx?$/i.test(file.name)) throw new StudentFileError("الملف يجب أن يكون Excel (‎.xlsx).")
  if (file.size > 5 * 1024 * 1024) throw new StudentFileError("الملف أكبر من 5 م.ب.")
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
  } catch {
    throw new StudentFileError("تعذّر فتح الملف. تأكد أنه ملف Excel سليم.")
  }
  return parseStudentWorkbook(wb, file.name)
}
