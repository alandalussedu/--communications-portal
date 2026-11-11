/**
 * «النقل المدرسي»: reading the approved Excel plan, checking it, comparing it
 * with the published version, and the calls to the database. Nothing here holds
 * campus or district names: they all come from the file and the database.
 */
import * as XLSX from "xlsx"
import { supabase } from "./backend"

/* ------------------------------------------------------------ types */
export type TDistrict = { id: string; name: string; norm: string; lat: number | null; lng: number | null }
export type TCampus = { id: string; name: string; cityId: string; sort: number; districts: TDistrict[] }
export type TCity = { id: string; name: string; slug: string }
export type TransportData = { importId: string; year: string; publishedAt: string | null; cities: TCity[]; campuses: TCampus[] }

/** what is read from a file, before it is saved */
export type ParsedCampus = { name: string; city: string; column: string; districts: string[] }
export type Parsed = { sheet: string; title: string; year: string | null; campuses: ParsedCampus[]; errors: string[]; warnings: string[] }

export type ImportRow = {
  id: string; version: number; year_name: string; file_name: string; file_size: number | null; file_storage_path: string | null; notes: string | null
  uploaded_at: string; status: "invalid" | "draft" | "published" | "superseded" | "rejected"; is_live: boolean
  validation_report: { errors?: string[]; warnings?: string[]; stats?: { campuses: number; entries: number } }
  payload: { campuses: { name: string; city: string; districts: string[] }[] }; published_at: string | null
}

/* ------------------------------------------------------------ names */
/** The same matching the database uses (transport_norm): hamzas, ة/ه, ى/ي, tatweel, marks, spaces and symbols. */
export function tnorm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[ـً-ْٰ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^0-9a-zء-ي]+/g, " ")
    .trim()
}
const oneLine = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim()

/* ------------------------------------------------------------ reading the Excel plan */
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const SHEET_NAME = "جدول أحياء النقل المدرسي"

/**
 * Finds the header row by its content (the row where most cells begin with «مجمع»),
 * then reads each campus column downward. Nothing is assumed about fixed rows.
 */
export function parsePlan(buf: ArrayBuffer): Parsed {
  const out: Parsed = { sheet: "", title: "", year: null, campuses: [], errors: [], warnings: [] }
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: "array" })
  } catch {
    out.errors.push("الملف تالف أو ليس ملف Excel صالحًا.")
    return out
  }
  const name = wb.SheetNames.find((n) => tnorm(n) === tnorm(SHEET_NAME)) ?? wb.SheetNames.find((n) => tnorm(n).includes(tnorm("النقل")))
  if (!name) {
    out.errors.push(`لم تُوجد ورقة «${SHEET_NAME}» في الملف. الأوراق الموجودة: ${wb.SheetNames.join("، ") || "لا شيء"}.`)
    return out
  }
  out.sheet = name
  if (tnorm(name) !== tnorm(SHEET_NAME)) out.warnings.push(`اسم الورقة «${name}» يختلف عن المعتاد «${SHEET_NAME}».`)
  const ws = wb.Sheets[name]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true, defval: null, raw: false }) as (string | null)[][]
  const cell = (r: number, c: number) => oneLine(grid[r]?.[c])

  // the title carries the academic year («لعام 2026م/2027م»)
  for (let r = 0; r < Math.min(grid.length, 12) && !out.year; r++)
    for (const v of grid[r] ?? []) {
      const m = oneLine(v).replace(/ـ/g, "").match(/(20\d{2})\s*م?\s*[/\\-]\s*(20\d{2})/)
      if (m) {
        out.title = oneLine(v).replace(/ـ/g, "")
        out.year = `${m[1]}/${m[2]}`
        break
      }
    }
  if (!out.year) out.warnings.push("لم يُعثر على العام الدراسي في عنوان الملف؛ اختره يدويًا.")

  // header row: the first row in the top 30 where at least two cells start with «مجمع»
  let head = -1
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const n = (grid[r] ?? []).filter((v) => tnorm(oneLine(v)).startsWith(tnorm("مجمع"))).length
    if (n >= 2) {
      head = r
      break
    }
  }
  if (head < 0) {
    out.errors.push("لم يُعثر على صف عناوين المجمعات (خلايا تبدأ بكلمة «مجمع»).")
    return out
  }
  const width = Math.max(...grid.map((r) => r?.length ?? 0))
  const seen = new Map<string, string>()
  for (let c = 0; c < width; c++) {
    const title = cell(head, c)
    const col = XLSX.utils.encode_col(c)
    // the districts start after the header (and after the «الأحياء» band, when present)
    const below: string[] = []
    for (let r = head + 1; r < grid.length; r++) {
      const v = cell(r, c)
      if (v) below.push(v)
    }
    const districts = below.filter((v) => v.replace(/[ـ\s]/g, "") !== "الأحياء") // the «الأحياء» band above the lists
    if (!title) {
      if (districts.length) out.errors.push(`العمود ${col} فيه ${districts.length} خلية بلا عنوان مجمع.`)
      continue
    }
    if (!tnorm(title)) {
      out.errors.push(`عنوان المجمع في العمود ${col} غير مقروء.`)
      continue
    }
    if (seen.has(tnorm(title))) {
      out.errors.push(`المجمع «${title}» مكرر في العمودين ${seen.get(tnorm(title))} و${col}.`)
      continue
    }
    seen.set(tnorm(title), col)
    if (!districts.length) {
      out.errors.push(`المجمع «${title}» (العمود ${col}) بلا أحياء.`)
      continue
    }
    const uniq: string[] = []
    const dn = new Set<string>()
    for (const d of districts) {
      if (!tnorm(d)) {
        out.errors.push(`خلية غير مقروءة في «${title}»: «${d}».`)
        continue
      }
      if (dn.has(tnorm(d))) {
        out.warnings.push(`الحي «${d}» مكرر داخل «${title}»؛ سيُحفظ مرة واحدة.`)
        continue
      }
      dn.add(tnorm(d))
      uniq.push(d)
    }
    out.campuses.push({ name: title, city: "", column: col, districts: uniq })
  }
  if (!out.campuses.length && !out.errors.length) out.errors.push("لم تُوجد مجمعات في الملف.")
  return out
}

/** quick checks on the file itself, before it is read */
export function fileProblem(f: { name: string; size: number }, head: Uint8Array): string | null {
  if (!/\.(xlsx|xls)$/i.test(f.name)) return "الامتداد غير مقبول. المقبول: ‎.xlsx و ‎.xls"
  if (f.size > MAX_FILE_BYTES) return "حجم الملف أكبر من 5 ميجابايت."
  if (f.size === 0) return "الملف فارغ."
  const zip = head[0] === 0x50 && head[1] === 0x4b // xlsx is a zip
  const ole = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0 // xls
  if (!zip && !ole) return "محتوى الملف ليس Excel (الامتداد لا يطابق المحتوى)."
  return null
}

/* ------------------------------------------------------------ figures */
export function statsOf(campuses: { cityKey: string; districts: string[] }[]) {
  const cities = new Set(campuses.map((c) => c.cityKey))
  const unique = new Set(campuses.flatMap((c) => c.districts.map((d) => `${c.cityKey}|${tnorm(d)}`)))
  return { cities: cities.size, campuses: campuses.length, entries: campuses.reduce((a, c) => a + c.districts.length, 0), unique: unique.size }
}
export const publicStats = (d: TransportData) => statsOf(d.campuses.map((c) => ({ cityKey: c.cityId, districts: c.districts.map((x) => x.name) })))

/* ------------------------------------------------------------ comparing a new file with the published version */
export type Diff = {
  first: boolean
  campusesAdded: string[]
  campusesRemoved: string[]
  cityChanged: { campus: string; from: string; to: string }[]
  perCampus: { campus: string; added: string[]; removed: string[]; renamed: { from: string; to: string }[] }[]
  shared: { district: string; city: string; campuses: string[] }[]
  totals: { added: number; removed: number; renamed: number }
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}

export function diffPlan(next: { name: string; city: string; districts: string[] }[], live: TransportData | null): Diff {
  const cityName = (id: string) => live?.cities.find((c) => c.id === id)?.name ?? ""
  const old = new Map((live?.campuses ?? []).map((c) => [tnorm(c.name), c]))
  const now = new Map(next.map((c) => [tnorm(c.name), c]))
  const out: Diff = { first: !live, campusesAdded: [], campusesRemoved: [], cityChanged: [], perCampus: [], shared: [], totals: { added: 0, removed: 0, renamed: 0 } }
  for (const [k, c] of now) if (!old.has(k)) out.campusesAdded.push(c.name)
  for (const [k, c] of old) if (!now.has(k)) out.campusesRemoved.push(c.name)
  for (const [k, c] of now) {
    const o = old.get(k)
    if (!o) continue
    if (c.city && cityName(o.cityId) && c.city !== cityName(o.cityId)) out.cityChanged.push({ campus: c.name, from: cityName(o.cityId), to: c.city })
    const before = new Map(o.districts.map((d) => [tnorm(d.name), d.name]))
    const after = new Map(c.districts.map((d) => [tnorm(d), d]))
    let added = [...after].filter(([n]) => !before.has(n)).map(([, v]) => v)
    let removed = [...before].filter(([n]) => !after.has(n)).map(([, v]) => v)
    const renamed: { from: string; to: string }[] = []
    // same name written differently (spaces, hamza…)
    for (const [n, v] of after) if (before.has(n) && before.get(n) !== v) renamed.push({ from: before.get(n)!, to: v })
    // a removed name with a very close added one: likely a corrected spelling
    for (const r of [...removed]) {
      const m = added.find((a) => lev(tnorm(a), tnorm(r)) <= Math.max(1, Math.floor(tnorm(r).length / 5)))
      if (m) {
        renamed.push({ from: r, to: m })
        added = added.filter((x) => x !== m)
        removed = removed.filter((x) => x !== r)
      }
    }
    if (added.length || removed.length || renamed.length) out.perCampus.push({ campus: c.name, added, removed, renamed })
    out.totals.added += added.length
    out.totals.removed += removed.length
    out.totals.renamed += renamed.length
  }
  const by = new Map<string, { district: string; city: string; campuses: string[] }>()
  for (const c of next)
    for (const d of c.districts) {
      const k = `${c.city}|${tnorm(d)}`
      const e = by.get(k) ?? { district: d, city: c.city, campuses: [] }
      e.campuses.push(c.name)
      by.set(k, e)
    }
  out.shared = [...by.values()].filter((e) => e.campuses.length > 1).sort((a, b) => b.campuses.length - a.campuses.length || a.district.localeCompare(b.district, "ar"))
  return out
}

/* ------------------------------------------------------------ database */
const fail = (e: { message?: string; code?: string } | null) =>
  e?.code === "42501" || /غير مصرح|permission|row-level/i.test(e?.message ?? "") ? "هذه العملية لمدير المنصة فقط." : e?.message || "تعذّر الاتصال بقاعدة البيانات."

export async function loadTransport(): Promise<{ data: TransportData | null; error?: string }> {
  const sb = supabase()
  if (!sb) return { data: null, error: "قاعدة البيانات غير متاحة في هذا العرض." }
  const { data, error } = await sb.rpc("transport_public")
  // before supabase/transport.sql is applied the function does not exist: for visitors that is simply «not published yet»
  if (error) return /transport_public|schema cache|PGRST202|404/.test(error.message + (error.code ?? "")) ? { data: null } : { data: null, error: fail(error) }
  return { data: (data as TransportData | null) ?? null }
}

export async function listImports(): Promise<{ rows: ImportRow[]; error?: string }> {
  const sb = supabase()
  if (!sb) return { rows: [], error: "قاعدة البيانات غير متاحة." }
  const { data, error } = await sb.from("transport_imports").select("id,version,year_name,file_name,file_size,file_storage_path,notes,uploaded_at,status,is_live,validation_report,payload,published_at").order("version", { ascending: false }).limit(60)
  if (error) return { rows: [], error: /transport_imports|schema cache|PGRST205|42P01/.test(error.message + (error.code ?? "")) ? "قسم النقل لم يُفعَّل في قاعدة البيانات بعد: شغّل ملف supabase/transport.sql في محرر SQL بمشروع Supabase مرة واحدة." : fail(error) }
  return { rows: (data ?? []) as ImportRow[] }
}

/** Stores the original file (private bucket), then saves the extracted data as a draft after the server's own checks. */
export async function uploadPlan(file: File, year: string, notes: string, campuses: { name: string; city: string; districts: string[] }[], onStep: (pct: number, label: string) => void) {
  const sb = supabase()
  if (!sb) return { error: "قاعدة البيانات غير متاحة." }
  onStep(15, "رفع الملف الأصلي…")
  const ext = file.name.toLowerCase().endsWith(".xls") ? "xls" : "xlsx"
  const path = `${year.replace("/", "-")}/${Date.now()}.${ext}`
  const up = await sb.storage.from("transport-files").upload(path, file, { contentType: ext === "xls" ? "application/vnd.ms-excel" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false })
  if (up.error) return { error: `لم يُرفع الملف: ${fail(up.error)}` }
  onStep(65, "التحقق من البيانات في الخادم…")
  const { data, error } = await sb.rpc("transport_upload", { p_year: year, p_file_name: file.name, p_file_size: file.size, p_file_path: path, p_notes: notes, p_payload: { campuses } })
  if (error) return { error: fail(error) }
  onStep(100, "اكتمل")
  return { result: data as { id: string; status: "draft" | "invalid"; errors: string[]; warnings: string[] } }
}

const call = async (fn: string, id: string) => {
  const sb = supabase()
  if (!sb) return "قاعدة البيانات غير متاحة."
  const { error } = await sb.rpc(fn, { p_import: id })
  return error ? fail(error) : null
}
export const publishImport = (id: string) => call("transport_publish", id)
export const restoreImport = (id: string) => call("transport_restore", id)
export const rejectImport = (id: string) => call("transport_reject", id)

export async function downloadOriginal(path: string): Promise<Blob | null> {
  const sb = supabase()
  if (!sb) return null
  const { data } = await sb.storage.from("transport-files").download(path)
  return data ?? null
}
