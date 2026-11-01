/**
 * Everything an executive report shows, assembled from stored rows only.
 * The same model feeds the on-screen preview, the PDF and the Excel file, so
 * the three always agree.
 */
import type { Data } from "@/data/store"
import type { IndicatorKey, StageSummary, SyncEvent } from "@/data/types"
import { INDICATORS, resolveLink } from "@/data/links"
import {
  ACADEMIC_YEAR,
  COMPLETE_LABEL,
  FRESH_LABEL,
  TARGET_LABEL,
  buildAlerts,
  buildRows,
  isHandled,
  periodCells,
  periodLabel,
  targetStatus,
  type Alert,
  type BranchRow,
  type PeriodKey,
} from "@/data/insights"
import { formatDate, formatNumber } from "@/lib/format"

export type ReportOptions = {
  period: PeriodKey
  /** Empty means all branches. */
  branches: string[]
  indicators: IndicatorKey[]
  includePlans: boolean
  charts: boolean
}

export type SourceLine = {
  id: string
  title: string
  scope: string
  url: string | null
  lastAttempt: string | null
  lastSuccess: string | null
  result: SyncEvent["result"] | null
  method: string
}

export type ReportModel = {
  opts: ReportOptions
  generatedAt: Date
  year: string
  periodName: string
  title: string
  rows: BranchRow[]
  indicators: typeof INDICATORS
  summary: string[]
  kpis: { label: string; value: string; note: string }[]
  followUps: Alert[]
  gaps: { branch: string; issue: string }[]
  stageBranches: { row: BranchRow; byIndicator: { key: IndicatorKey; title: string; stages: StageSummary[] }[] }[]
  sources: SourceLine[]
  hasComparable: boolean
  liveSync: boolean
  lastRun: string | null
}

/** Branch count inside a sentence (object/genitive position). */
export const plural = (n: number) => (n === 0 ? "أي فرع" : n === 1 ? "فرع واحد" : n === 2 ? "فرعين" : `${formatNumber(n)} ${n <= 10 ? "فروع" : "فرعًا"}`)

export function buildReport(data: Data, opts: ReportOptions, now = new Date()): ReportModel {
  const all = buildRows(data, opts.period, now)
  const rows = opts.branches.length ? all.filter((r) => opts.branches.includes(r.b.slug)) : all
  const inds = INDICATORS.filter((i) => opts.indicators.includes(i.key))
  const included = new Set(rows.map((r) => r.b.slug))
  const pName = periodLabel(opts.period)

  const withData = rows.filter((r) => r.complete !== "none")
  const statuses = rows.flatMap((r) => inds.map((i) => r.ind[i.key].status))
  const met = statuses.filter((s) => s === "met").length
  const unmet = statuses.filter((s) => s === "unmet").length
  const withResult = rows.filter((r) => inds.some((i) => r.ind[i.key].result?.raw))
  const notUpdated = rows.filter((r) => r.fresh !== "current")
  const alerts = buildAlerts(data, now).filter((a) => a.branch && included.has(a.branch.slug) && !isHandled(a, data.alertState))
  const followUps = alerts.filter((a) => a.kind !== "link" || inds.length > 0)

  const summary: string[] = []
  summary.push(`يغطي التقرير ${plural(rows.length)} لفترة ${pName} من العام الدراسي ${ACADEMIC_YEAR}، في ${inds.map((i) => i.title).join(" و")}.`)
  summary.push(
    withData.length
      ? `وصلت بيانات ${plural(withData.length)} من ملفات المنصة الشاملة: ${withData.map((r) => r.b.name).join("، ")}. ${rows.length - withData.length ? `ولم تصل بيانات ${plural(rows.length - withData.length)} بعد.` : ""}`
      : "لم تصل بيانات أي فرع مشمول من ملفات المنصة الشاملة بعد.",
  )
  summary.push(
    withResult.length
      ? `أُدخلت نتيجة ${pName} في ${plural(withResult.length)}. حقق المستهدف ${formatNumber(met)} معاملًا، وجاء ${formatNumber(unmet)} دون مستهدفه، من المعاملات التي لها نتيجة ومستهدف بنسبة مئوية.`
      : `لم تُدخل نتيجة ${pName} في أي ملف مقروء حتى تاريخ هذا التقرير، لذلك لا تتضمن المقارنة بالمستهدفات نتائج بعد.`,
  )
  if (notUpdated.length) summary.push(`${plural(notUpdated.length)} لم تُحدّث بياناتها أو لم تُربط بعد، وهي مذكورة في قسم المتابعة.`)
  summary.push("لا يتضمن التقرير متوسطًا عامًا للشركة لعدم وجود طريقة تجميع معتمدة للمعاملين بين الفروع.")

  const kpis = [
    { label: "الفروع المشمولة", value: formatNumber(rows.length), note: opts.branches.length ? "فروع مختارة" : "كل الفروع" },
    { label: "فروع وصلت بياناتها", value: formatNumber(withData.length), note: `من ${formatNumber(rows.length)}` },
    { label: "معاملات حققت المستهدف", value: formatNumber(met), note: pName },
    { label: "معاملات دون المستهدف", value: formatNumber(unmet), note: pName },
    { label: "فروع لم تُحدّث بياناتها", value: formatNumber(notUpdated.length), note: "أو بانتظار الربط" },
    { label: "تنبيهات مفتوحة", value: formatNumber(followUps.length), note: "تحتاج متابعة" },
  ]

  const gaps: { branch: string; issue: string }[] = []
  for (const r of rows) {
    if (r.complete === "none") gaps.push({ branch: r.b.name, issue: r.b.fileUrl ? "ملف الفرع مسجّل ولم تُقرأ قيمه بعد" : "رابط ملف الفرع غير ظاهر في سجل الروابط" })
    else if (r.complete === "partial") gaps.push({ branch: r.b.name, issue: "قُرئ الصف الرئيسي للمعاملين؛ تفاصيل المراحل لم تُقرأ بعد" })
    for (const i of inds) {
      const s = r.ind[i.key].s
      if (s && /Loading/i.test(s.note ?? "")) gaps.push({ branch: r.b.name, issue: `${i.title}: خلية مستهدف العام لم تُنقل قيمتها` })
      if (resolveLink(r.b, i.key).state === "flagged" || r.b.links[i.key]?.registerNote) gaps.push({ branch: r.b.name, issue: `رابط ${i.short} في سجل الروابط يشير إلى صفوف المعامل الآخر (المنصة تستخدم الصف الصحيح)` })
      if (s?.note && !/Loading/i.test(s.note)) gaps.push({ branch: r.b.name, issue: `${i.title}: ${s.note}` })
    }
  }

  const stageBranches = rows
    .filter((r) => r.stages.length)
    .map((row) => ({
      row,
      byIndicator: inds
        .map((i) => ({ key: i.key, title: i.title, stages: row.stages.filter((s) => s.indicator === i.key) }))
        .filter((x) => x.stages.length),
    }))

  // Only sources actually used for the included branches.
  const used = data.syncLog.filter((e) => (e.branch ? included.has(e.branch) : e.kind !== "library"))
  const sources: SourceLine[] = Array.from(new Set(used.map((e) => `${e.source}|${e.branch ?? ""}`))).map((k) => {
    const [src, br] = k.split("|")
    const evs = used.filter((e) => e.source === src && (e.branch ?? "") === br).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
    const ok = evs.find((e) => e.succeededAt)
    const info = data.meta?.sources.find((s) => s.id === src)
    return {
      id: k,
      title: info?.title ?? src,
      scope: br ? `فرع ${data.branches.find((b) => b.slug === br)?.name ?? br}` : "سجل مشترك",
      url: evs[0]?.url ?? info?.url ?? null,
      lastAttempt: evs[0]?.attemptedAt ?? null,
      lastSuccess: ok?.succeededAt ?? null,
      result: evs[0]?.result ?? null,
      method: evs[0]?.method ?? info?.method ?? "",
    }
  })

  return {
    opts,
    generatedAt: now,
    year: ACADEMIC_YEAR,
    periodName: pName,
    title: "التقرير التنفيذي لمؤشرات ولاء العملاء",
    rows,
    indicators: inds,
    summary,
    kpis,
    followUps,
    gaps,
    stageBranches,
    sources,
    hasComparable: met + unmet > 0,
    liveSync: data.meta?.liveSync.enabled ?? false,
    lastRun: data.meta?.liveSync.lastRun ?? null,
  }
}

/* ------------------------------------------------------------ flat rows for Excel */
export function comparisonRows(m: ReportModel) {
  return m.rows.flatMap((r) =>
    m.indicators.map((i) => {
      const c = r.ind[i.key]
      return {
        "الفرع": r.b.name,
        "المعامل": i.title,
        "رمز المؤشر": c.s?.code ?? i.code,
        "الفترة": m.periodName,
        "النتيجة (كما في الملف)": c.result?.raw ?? "",
        "النتيجة (رقم)": c.result?.num ?? null,
        "المستهدف (كما في الملف)": c.target?.raw ?? "",
        "المستهدف (رقم)": c.target?.num ?? null,
        "الوحدة": c.result?.unit === "%" || c.target?.unit === "%" ? "%" : "",
        "نتيجة العام السابق": c.s?.prior?.raw ?? "",
        "حالة تحقيق المستهدف": TARGET_LABEL[c.status],
        "حالة البيانات": FRESH_LABEL[r.fresh],
        "اكتمال البيانات": COMPLETE_LABEL[r.complete],
        "آخر تحديث ناجح": r.sync.lastSuccess?.succeededAt ?? "",
        "مسؤول المؤشر": c.s?.owner ?? "",
        "رابط المصدر": resolveLink(r.b, i.key).url ?? "",
      }
    }),
  )
}

export function stageRows(m: ReportModel) {
  return m.stageBranches.flatMap(({ row, byIndicator }) =>
    byIndicator.flatMap((g) =>
      g.stages.map((s) => {
        const { target, result } = periodCells(s, m.opts.period)
        return {
          "الفرع": row.b.name,
          "المعامل": g.title,
          "المرحلة": s.stage ?? "",
          "المسار": s.track ?? "",
          "مسؤول المؤشر": s.owner ?? "",
          "مستهدف العام": s.annualTarget?.raw ?? "",
          "مستهدف الفصل الأول": s.s1Target?.raw ?? "",
          "نتيجة الفصل الأول": s.s1Result?.raw ?? "",
          "مستهدف الفصل الثاني": s.s2Target?.raw ?? "",
          "نتيجة الفصل الثاني": s.s2Result?.raw ?? "",
          "أداء نهاية العام": s.yearEnd?.raw ?? "",
          [`حالة ${m.periodName}`]: TARGET_LABEL[targetStatus(result, target)],
          "تاريخ النقل": s.capturedAt,
        }
      }),
    ),
  )
}

export function componentRows(m: ReportModel) {
  if (!m.opts.indicators.includes("communication")) return []
  return m.stageBranches.flatMap(({ row }) =>
    row.stages
      .filter((s) => s.indicator === "communication")
      .flatMap((s) =>
        (s.subIndicators ?? []).map((c) => ({
          "الفرع": row.b.name,
          "المرحلة": s.stage ?? "",
          "المكوّن": c.name.trim(),
          "لكل طالب": c.perStudent?.raw ?? "",
          "مستهدف العام": c.annualTarget?.raw ?? "",
          "نتيجة الفصل الأول": c.s1Result?.raw ?? "",
          "نتيجة الفصل الثاني": c.s2Result?.raw ?? "",
          "نهاية العام": c.yearEnd?.raw ?? "",
        })),
      ),
  )
}

export const fmtDate = (s: string | null) => (s ? formatDate(s) : "—")
