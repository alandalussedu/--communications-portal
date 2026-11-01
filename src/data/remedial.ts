/**
 * Remedial plans: everything here is derived from the rows read from the branch
 * files. No date is turned into "late", no completion is inferred, approval is
 * only what is written in the file, and nothing is averaged across branches.
 */
import type { Data } from "./store"
import type { Branch, RemedialRow, RemedialStage, RemedialStatus } from "./types"
import { daysSince, DEFAULT_STALE_DAYS, type Alert } from "./insights"
import { formatDate, formatNumber } from "@/lib/format"

export const STATUS_LABEL: Record<RemedialStatus, string> = {
  done: "منفّذ",
  "not-done": "غير منفّذ",
  "no-plan": "بدون خطة",
  "no-checkbox": "بدون خانة تنفيذ",
}
export const STATUS_TONE = { done: "ok", "not-done": "warn", "no-plan": "bad", "no-checkbox": "neutral" } as const

export type PlanState = "not-started" | "in-progress" | "complete" | "no-rows" | "no-file"
export const PLAN_LABEL: Record<PlanState, string> = {
  "not-started": "لم تبدأ",
  "in-progress": "جارية",
  complete: "مكتملة",
  "no-rows": "لا صفوف",
  "no-file": "لم يُقرأ بعد",
}
export const PLAN_TONE = { "not-started": "warn", "in-progress": "sky", complete: "ok", "no-rows": "neutral", "no-file": "neutral" } as const

export type Counts = { done: number; notDone: number; noPlan: number; noCheckbox: number }
export const zero = (): Counts => ({ done: 0, notDone: 0, noPlan: 0, noCheckbox: 0 })
export function countRows(rows: RemedialRow[]): Counts {
  const c = zero()
  for (const r of rows) {
    if (r.status === "done") c.done++
    else if (r.status === "not-done") c.notDone++
    else if (r.status === "no-plan") c.noPlan++
    else c.noCheckbox++
  }
  return c
}
/** done ÷ (done + not done). Rows without a plan or a checkbox are reported beside it, never inside. */
export function rate(c: Counts): number | null {
  const d = c.done + c.notDone
  return d ? c.done / d : null
}
export function rateText(c: Counts): string {
  const r = rate(c)
  return r === null ? "—" : `${formatNumber(Math.round(r * 100))}٪`
}
export function planState(c: Counts, hasFile: boolean): PlanState {
  if (!hasFile) return "no-file"
  if (c.done + c.notDone === 0) return "no-rows"
  if (c.done === 0) return "not-started"
  if (c.notDone === 0) return "complete"
  return "in-progress"
}

export type BranchPlan = {
  b: Branch
  files: Data["remedialFiles"]
  stages: RemedialStage[]
  rows: RemedialRow[]
  counts: Counts
  emptyStages: RemedialStage[]
  lastRead: string | null
  lastChange: string | null
  firstRead: string | null
  state: PlanState
  readOk: boolean
}

export function branchPlans(data: Data): BranchPlan[] {
  return data.branches.map((b) => {
    const files = data.remedialFiles.filter((f) => f.branch === b.slug)
    const stages = data.remedialStages.filter((s) => s.branch === b.slug).sort((x, y) => x.file.localeCompare(y.file) || x.order - y.order)
    const rows = data.remedialRows.filter((r) => r.branch === b.slug)
    const counts = countRows(rows)
    const okFiles = files.filter((f) => f.readStatus === "success")
    const lastRead = okFiles.map((f) => f.readAt!).sort().pop() ?? null
    const firstRead = okFiles.map((f) => f.firstReadAt ?? f.readAt!).sort()[0] ?? null
    const lastChange = rows.map((r) => r.lastChangeAt).filter(Boolean).sort().pop() ?? null
    return {
      b,
      files,
      stages,
      rows,
      counts,
      emptyStages: stages.filter((s) => s.empty),
      lastRead,
      lastChange: lastChange ?? null,
      firstRead,
      state: planState(counts, okFiles.length > 0),
      readOk: files.length > 0 && files.every((f) => f.readStatus === "success"),
    }
  })
}

/* ------------------------------------------------------------ causes */
/** Folds only obvious spelling variants: hamza forms, ta marbuta, alef maqsura, diacritics, spacing, and the
 * copy-artefact «اإل»/«األ» for «الإ»/«الأ». Compound causes joined by « / » stay one cause. */
export function causeKey(s: string): string {
  return s
    .replace(/اإل/g, "الإ")
    .replace(/األ/g, "الأ")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
}

export type Cause = {
  key: string
  name: string
  variants: string[]
  rows: RemedialRow[]
  branches: string[]
  counts: Counts
  perBranch: Record<string, Counts>
}
export function causes(rows: RemedialRow[]): Cause[] {
  const map = new Map<string, { rows: RemedialRow[]; names: Map<string, number> }>()
  for (const r of rows) {
    if (!r.cause) continue
    const k = causeKey(r.cause)
    if (!k) continue
    if (!map.has(k)) map.set(k, { rows: [], names: new Map() })
    const e = map.get(k)!
    e.rows.push(r)
    const n = r.cause.replace(/\s+/g, " ").trim()
    e.names.set(n, (e.names.get(n) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, e]) => {
      const perBranch: Record<string, Counts> = {}
      for (const r of e.rows) perBranch[r.branch] = countRows(e.rows.filter((x) => x.branch === r.branch))
      const names = [...e.names.entries()].sort((a, b) => b[1] - a[1])
      return { key, name: names[0][0], variants: names.map((n) => n[0]), rows: e.rows, branches: Object.keys(perBranch), counts: countRows(e.rows), perBranch }
    })
    .sort((a, b) => b.branches.length - a.branches.length || b.rows.length - a.rows.length)
}
/** Needs a decision: a cause written in three branches or more with nothing executed under it. */
export function needsDecision(cs: Cause[]): Cause[] {
  return cs.filter((c) => c.branches.length >= 3 && c.counts.done === 0)
}

/* ------------------------------------------------------------ alerts (stable id + signature like the existing ones) */
export function buildRemedialAlerts(data: Data, now = new Date()): Alert[] {
  const staleDays = data.settings?.staleDays ?? DEFAULT_STALE_DAYS
  const out: Alert[] = []
  const sig = (parts: (string | number | null | undefined)[]) => parts.map((p) => String(p ?? "")).join("|")
  for (const p of branchPlans(data)) {
    const b = p.b
    const route = { page: "remedial" as const, slug: b.slug }
    if (p.files.length === 0) {
      out.push({ id: `rem-file::${b.slug}`, signature: "no-file", kind: "rem-file", severity: "medium", title: `لا يوجد ملف خطة علاجية لفرع ${b.name} في سجل الروابط`, branch: b, reason: "الفرع غير مدرج في سجل روابط الخطط العلاجية، فلم يُقرأ له ملف.", detectedAt: null, route })
      continue
    }
    for (const f of p.files.filter((f) => f.readStatus !== "success"))
      out.push({ id: `rem-file::${f.id}`, signature: sig([f.readStatus, f.readAt]), kind: "rem-file", severity: "high", title: `ملف الخطة «${f.label ?? b.name}» ${f.readStatus === "failed" ? "فشلت قراءته" : "لم يُقرأ بعد"}`, branch: b, reason: f.message ?? "لم تُسجَّل قراءة ناجحة لهذا الملف.", detectedAt: f.readAt, route })
    if (p.files.some((f) => f.readStatus === "success") && p.stages.length === 0)
      out.push({ id: `rem-empty::${b.slug}::no-stage`, signature: "no-stage", kind: "rem-empty-stage", severity: "high", title: `لا يوجد تبويب خطة معبّأ في ملف فرع ${b.name}`, branch: b, reason: "قُرئ الملف، ولم يُعثر فيه إلا على الدليل والقالب الفارغ وتبويب المتابعة.", detectedAt: p.lastRead, route })
    for (const s of p.emptyStages)
      out.push({ id: `rem-empty::${s.id}`, signature: sig([s.total]), kind: "rem-empty-stage", severity: "medium", title: `مرحلة فارغة في فرع ${b.name}: ${s.name}`, branch: b, reason: "تبويب المرحلة موجود وفيه صف العناوين، ولا يوجد فيه أي صف بسبب أو مشكلة أو إجراءات.", detectedAt: s.readAt, route })
    const noPlan = p.rows.filter((r) => r.status === "no-plan")
    if (noPlan.length)
      out.push({ id: `rem-noplan::${b.slug}`, signature: sig(noPlan.map((r) => r.id).sort()), kind: "rem-no-plan", severity: "high", title: `${formatNumber(noPlan.length)} صفًا بدون خطة في فرع ${b.name}`, branch: b, reason: "صفوف فيها سبب أو مشكلة، وليس فيها إجراءات مكتوبة.", detectedAt: p.lastRead, route })
    const noBox = p.rows.filter((r) => r.status === "no-checkbox")
    if (noBox.length)
      out.push({ id: `rem-nobox::${b.slug}`, signature: sig(noBox.map((r) => r.id).sort()), kind: "rem-no-checkbox", severity: "low", title: `${formatNumber(noBox.length)} صفًا بدون خانة تنفيذ في فرع ${b.name}`, branch: b, reason: "صفوف فيها محتوى، ولا توجد في خانة «التنفيذ» علامة اختيار، فلا تدخل في نسبة التنفيذ.", detectedAt: p.lastRead, route })
    const since = p.lastChange ?? p.firstRead
    if (p.counts.notDone > 0 && since && daysSince(since, now) > staleDays)
      out.push({ id: `rem-stale::${b.slug}`, signature: sig([since]), kind: "rem-stale", severity: "medium", title: `لا تغيّر في تنفيذ خطة فرع ${b.name} منذ ${formatNumber(staleDays)} يومًا`, branch: b, reason: `آخر تغيّر مسجّل ${p.lastChange ? formatDate(p.lastChange) : `لا يوجد منذ أول قراءة ${formatDate(p.firstRead)}`}، وفيه ${formatNumber(p.counts.notDone)} صفًا غير منفّذ.`, detectedAt: since, route })
  }
  return out
}

export const latestRead = (data: Data) => data.remedialSync.find((s) => s.id === "status")?.lastRun ?? null
