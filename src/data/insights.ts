/**
 * Read-only views over the stored rows: periods, target status, sync state and
 * alerts. Nothing here creates an indicator value. The only comparison made is
 * between a result and its target for the same period, when both are written
 * in the sheet as percentages.
 */
import type { Branch, CellValue, IndicatorKey, IndicatorSummary, StageSummary, SyncEvent } from "./types"
import type { Data } from "./store"
import { INDICATORS, resolveLink } from "./links"

/* ------------------------------------------------------------ periods */
export type PeriodKey = "s1" | "s2" | "year"
type Checkpoint = Pick<IndicatorSummary, "s1Target" | "s1Result" | "s2Target" | "s2Result" | "annualTarget" | "yearEnd">

export const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "s1", label: "الفصل الأول", short: "ف1" },
  { key: "s2", label: "الفصل الثاني", short: "ف2" },
  { key: "year", label: "نهاية العام", short: "نهاية العام" },
]
export const periodLabel = (p: PeriodKey) => PERIODS.find((x) => x.key === p)!.label
export const ACADEMIC_YEAR = "2026/2027"

export function periodCells(s: Checkpoint | undefined | null, p: PeriodKey): { target: CellValue; result: CellValue } {
  if (!s) return { target: null, result: null }
  if (p === "s1") return { target: s.s1Target, result: s.s1Result }
  if (p === "s2") return { target: s.s2Target, result: s.s2Result }
  return { target: s.annualTarget, result: s.yearEnd }
}

/* ------------------------------------------------------------ target status */
export type TargetStatus = "met" | "unmet" | "no-result" | "no-target" | "not-comparable" | "no-data"

export const TARGET_LABEL: Record<TargetStatus, string> = {
  met: "حقق المستهدف",
  unmet: "دون المستهدف",
  "no-result": "لم تُدخل النتيجة",
  "no-target": "المستهدف غير منقول",
  "not-comparable": "غير قابل للمقارنة",
  "no-data": "لم تصل البيانات",
}
export const TARGET_TONE = {
  met: "ok",
  unmet: "bad",
  "no-result": "neutral",
  "no-target": "neutral",
  "not-comparable": "warn",
  "no-data": "neutral",
} as const

const isPct = (v: CellValue) => !!v && v.unit === "%" && v.num !== null

/** Compares a result with its own target only when both are percentages in the sheet. */
export function targetStatus(result: CellValue, target: CellValue, present = true): TargetStatus {
  if (!present) return "no-data"
  if (!result?.raw) return "no-result"
  if (!target?.raw) return "no-target"
  if (!isPct(result) || !isPct(target)) return "not-comparable"
  return result.num! >= target.num! ? "met" : "unmet"
}

/* ------------------------------------------------------------ approved components */
/** The four components of the customer-satisfaction index, as named in the company file. */
export const SATISFACTION_COMPONENTS = ["قياس رضا ولي الأمر والطالب", "NPS", "الرضا بعد الخدمة", "تحقق مستهدف الحد من الانسحاب"]

/* ------------------------------------------------------------ sync state */
export const DEFAULT_STALE_DAYS = 30

export type BranchSync = {
  events: SyncEvent[]
  lastAttempt: SyncEvent | null
  lastSuccess: SyncEvent | null
  /** True when the newest attempt failed, so shown values are older than that attempt. */
  failing: boolean
}

export function branchSync(slug: string, log: SyncEvent[]): BranchSync {
  const events = log.filter((e) => e.branch === slug && e.kind === "data")
  const byAttempt = [...events].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
  const lastAttempt = byAttempt[0] ?? null
  const lastSuccess =
    [...events].filter((e) => e.succeededAt).sort((a, b) => b.succeededAt!.localeCompare(a.succeededAt!))[0] ?? null
  return { events: byAttempt, lastAttempt, lastSuccess, failing: lastAttempt?.result === "failed" }
}

/** Shared registers (links, library) that every branch page lists in its log. */
export function sharedEvents(log: SyncEvent[]) {
  return log.filter((e) => e.branch === null)
}

export function daysSince(iso: string, now = new Date()): number {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso)
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000)
}

export type Freshness = "current" | "stale" | "failing" | "none"
export const FRESH_LABEL: Record<Freshness, string> = {
  current: "محدّثة",
  stale: "تجاوزت مدة التحديث",
  failing: "فشل آخر تحديث",
  none: "بانتظار الربط",
}
export const FRESH_TONE = { current: "ok", stale: "warn", failing: "bad", none: "neutral" } as const

export function freshness(sync: BranchSync, staleDays: number, now = new Date()): Freshness {
  if (!sync.lastSuccess) return sync.failing ? "failing" : "none"
  if (sync.failing) return "failing"
  return daysSince(sync.lastSuccess.succeededAt!, now) > staleDays ? "stale" : "current"
}

/* ------------------------------------------------------------ completeness */
export type Completeness = "full" | "partial" | "none"
export const COMPLETE_LABEL: Record<Completeness, string> = { full: "بيانات كاملة", partial: "بيانات جزئية", none: "لا بيانات" }
export const COMPLETE_TONE = { full: "ok", partial: "sky", none: "neutral" } as const

/* ------------------------------------------------------------ branch rows */
export type BranchRow = {
  b: Branch
  sync: BranchSync
  fresh: Freshness
  complete: Completeness
  ind: Record<IndicatorKey, { s?: IndicatorSummary; target: CellValue; result: CellValue; status: TargetStatus }>
  stages: StageSummary[]
}

export function buildRows(data: Data, period: PeriodKey, now = new Date()): BranchRow[] {
  const staleDays = data.settings?.staleDays ?? DEFAULT_STALE_DAYS
  return data.branches.map((b) => {
    const sync = branchSync(b.slug, data.syncLog)
    const stages = data.stages.filter((s) => s.branch === b.slug)
    const sums = data.indicators.filter((i) => i.branch === b.slug)
    const complete: Completeness = stages.length ? "full" : sums.length ? "partial" : "none"
    const ind = Object.fromEntries(
      INDICATORS.map((it) => {
        const s = sums.find((x) => x.indicator === it.key)
        const { target, result } = periodCells(s, period)
        return [it.key, { s, target, result, status: targetStatus(result, target, !!s) }]
      }),
    ) as BranchRow["ind"]
    return { b, sync, fresh: freshness(sync, staleDays, now), complete, ind, stages }
  })
}

/* ------------------------------------------------------------ alerts */
export type AlertKind = "sync-failed" | "stale" | "no-data" | "invalid" | "link" | "target" | "rem-empty-stage" | "rem-no-plan" | "rem-no-checkbox" | "rem-stale" | "rem-file"
export type Alert = {
  /** Stable id: the same condition keeps the same id across refreshes. */
  id: string
  /** Changes when the underlying data changes, so a handled alert reopens only on new evidence. */
  signature: string
  kind: AlertKind
  severity: "high" | "medium" | "low"
  title: string
  branch: Branch | null
  reason: string
  detectedAt: string | null
  route: { page: "branch"; slug: string } | { page: "sources" } | { page: "remedial"; slug?: string }
}

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  "sync-failed": "تعذّر التحديث",
  stale: "تجاوز مدة التحديث",
  "no-data": "لم تصل البيانات",
  invalid: "بيانات ناقصة أو غير صالحة",
  link: "رابط يحتاج مراجعة",
  target: "دون المستهدف",
  "rem-empty-stage": "مرحلة فارغة",
  "rem-no-plan": "صفوف بدون خطة",
  "rem-no-checkbox": "صف بدون خانة تنفيذ",
  "rem-stale": "لا تغيّر في التنفيذ",
  "rem-file": "ملف خطة لم يُقرأ",
}

export function buildAlerts(data: Data, now = new Date()): Alert[] {
  const staleDays = data.settings?.staleDays ?? DEFAULT_STALE_DAYS
  const out: Alert[] = []
  for (const b of data.branches) {
    const sync = branchSync(b.slug, data.syncLog)
    const sums = data.indicators.filter((i) => i.branch === b.slug)
    const route = { page: "branch" as const, slug: b.slug }

    if (sync.failing && sync.lastAttempt) {
      out.push({
        id: `sync__${b.slug}`,
        signature: sync.lastAttempt.attemptedAt,
        kind: "sync-failed",
        severity: "high",
        title: `تعذّر تحديث بيانات فرع ${b.name}`,
        branch: b,
        reason: sync.lastAttempt.message ?? "فشلت آخر محاولة لقراءة ملف الفرع.",
        detectedAt: sync.lastAttempt.attemptedAt,
        route,
      })
    } else if (sync.lastSuccess && daysSince(sync.lastSuccess.succeededAt!, now) > staleDays) {
      out.push({
        id: `stale__${b.slug}`,
        signature: sync.lastSuccess.succeededAt!,
        kind: "stale",
        severity: "medium",
        title: `بيانات فرع ${b.name} لم تُحدّث منذ ${daysSince(sync.lastSuccess.succeededAt!, now)} يومًا`,
        branch: b,
        reason: `مدة التحديث المحددة ${staleDays} يومًا، وآخر قراءة ناجحة كانت قبل ذلك.`,
        detectedAt: now.toISOString().slice(0, 10),
        route,
      })
    } else if (!sync.lastSuccess && sums.length === 0) {
      out.push({
        id: `nodata__${b.slug}`,
        signature: "none",
        kind: "no-data",
        severity: "low",
        title: `لم تصل بيانات فرع ${b.name}`,
        branch: b,
        reason: b.fileUrl
          ? "رابط ملف الفرع مسجّل، لكن قيم المعاملين لم تُقرأ منه بعد."
          : "رابط ملف الفرع غير ظاهر في سجل الروابط، فلا يمكن قراءته.",
        detectedAt: b.capturedAt,
        route,
      })
    }

    for (const s of sums) {
      const cells: [string, CellValue][] = [
        ["نتيجة العام السابق", s.prior],
        ["مستهدف العام", s.annualTarget],
        ["مستهدف الفصل الأول", s.s1Target],
        ["نتيجة الفصل الأول", s.s1Result],
        ["مستهدف الفصل الثاني", s.s2Target],
        ["نتيجة الفصل الثاني", s.s2Result],
        ["أداء نهاية العام", s.yearEnd],
      ]
      const bad = cells.filter(([, v]) => v?.raw && /loading|#ref|#n\/a|#value|#div|#error/i.test(v.raw)).map(([k]) => k)
      if (bad.length || s.note) {
        const loading = bad.length || /Loading/i.test(s.note ?? "")
        out.push({
          id: `invalid__${s.id}`,
          signature: `${s.capturedAt}|${s.note ?? ""}`,
          kind: "invalid",
          severity: loading || /0\.00%/.test(s.note ?? "") ? "medium" : "low",
          title: loading ? `${s.title} في فرع ${b.name}: خلية لم تُنقل قيمتها` : `${s.title} في فرع ${b.name}: بيانات ناقصة أو غير منطقية في الملف`,
          branch: b,
          reason: s.note ?? `الخلايا التالية تحمل نصًا غير صالح: ${bad.join("، ")}.`,
          detectedAt: s.capturedAt,
          route,
        })
      }
      const pairs: [string, CellValue, CellValue][] = [
        ["الفصل الأول", s.s1Result, s.s1Target],
        ["الفصل الثاني", s.s2Result, s.s2Target],
        ["نهاية العام", s.yearEnd, s.annualTarget],
      ]
      for (const [label, r, t] of pairs) {
        if (targetStatus(r, t) === "unmet") {
          out.push({
            id: `target__${s.id}__${label}`,
            signature: `${r!.raw}|${t!.raw}`,
            kind: "target",
            severity: "high",
            title: `${s.title} في فرع ${b.name} دون مستهدف ${label}`,
            branch: b,
            reason: `النتيجة ${r!.raw} والمستهدف ${t!.raw} كما وردا في ملف الفرع.`,
            detectedAt: s.capturedAt,
            route,
          })
        }
      }
    }

    for (const it of INDICATORS) {
      const l = resolveLink(b, it.key)
      const reg = b.links[it.key]?.registerNote
      if (reg && l.state !== "flagged") {
        out.push({
          id: `register__${b.slug}__${it.key}`,
          signature: b.links[it.key]?.registerUrl ?? "",
          kind: "link",
          severity: "low",
          title: `رابط ${it.short} لفرع ${b.name} في سجل الروابط يحتاج تصحيح`,
          branch: b,
          reason: reg,
          detectedAt: b.updatedAt?.slice(0, 10) ?? b.capturedAt,
          route,
        })
      }
      if (l.state === "flagged") {
        out.push({
          id: `link__${b.slug}__${it.key}`,
          signature: b.links[it.key]?.recorded ?? "",
          kind: "link",
          severity: "medium",
          title: `رابط ${it.short} في فرع ${b.name} يحتاج مراجعة`,
          branch: b,
          reason: l.note ?? "",
          detectedAt: b.updatedAt?.slice(0, 10) ?? b.capturedAt,
          route,
        })
      }
    }
  }
  const order = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

export function isHandled(a: Alert, states: Data["alertState"]) {
  const s = states.find((x) => x.id === a.id)
  return !!s && s.signature === a.signature
}
