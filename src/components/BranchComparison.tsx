import { useMemo } from "react"
import { ArrowLeft, X } from "lucide-react"
import { useRouter } from "@/lib/router"
import { useStore } from "@/data/store"
import { INDICATORS } from "@/data/links"
import type { IndicatorKey } from "@/data/types"
import {
  COMPLETE_LABEL,
  COMPLETE_TONE,
  FRESH_LABEL,
  FRESH_TONE,
  TARGET_LABEL,
  TARGET_TONE,
  buildRows,
  periodLabel,
  type BranchRow,
  type Freshness,
  type PeriodKey,
  type TargetStatus,
} from "@/data/insights"
import { formatDate, formatNumber, matches } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { DataTable, type Column } from "@/components/DataTable"
import { CompareBars, Legend, StackedBars, type CompareRow } from "@/components/charts"
import { ChipGroup, EmptyState, Panel, PanelHeader, Pill, SearchField } from "@/components/common"
import { IndicatorSwitch, PeriodSwitch, branchOutcome } from "@/pages/OverviewPage"

export type FreshFilter = "all" | "outdated" | Freshness
export type OutcomeFilter = "all" | "met" | "unmet" | "unknown"

/** Rows for one period: what each branch file says, compared only where both cells are percentages. */
export function compareRows(rows: BranchRow[], ind: IndicatorKey, go: ReturnType<typeof useRouter>["go"]): CompareRow[] {
  return rows
    .map((r) => {
      const c = r.ind[ind]
      const pct = c.result?.unit === "%" && c.result.num !== null
      return {
        id: r.b.slug,
        label: r.b.name,
        value: pct ? c.result!.num : null,
        valueRaw: pct ? c.result!.raw : null,
        target: c.target?.unit === "%" ? c.target.num : null,
        targetRaw: c.target?.raw ?? null,
        note: !c.s ? "لم تصل البيانات" : c.result?.raw && !pct ? `${c.result.raw} (ليست نسبة)` : "لم تُدخل النتيجة",
        onClick: () => go({ page: "branch", slug: r.b.slug }),
      }
    })
    .sort((a, b) => (a.value !== null ? 0 : a.targetRaw ? 1 : 2) - (b.value !== null ? 0 : b.targetRaw ? 1 : 2))
}

/* ------------------------------------------------------------ results vs targets */
export function TargetComparison() {
  const { data } = useStore()
  const { go } = useRouter()
  const [period, setPeriod] = usePersistent<PeriodKey>("cc-period", "s1")
  const [ind, setInd] = usePersistent<IndicatorKey>("cc-ind", "satisfaction")
  const rows = useMemo(() => buildRows(data, period), [data, period])
  const compare = useMemo(() => compareRows(rows, ind, go), [rows, ind, go])
  const distribution = INDICATORS.map((it) => {
    const count = (s: TargetStatus) => rows.filter((r) => r.ind[it.key].status === s).length
    return {
      id: it.key,
      label: it.short,
      segments: [
        { key: "met", label: TARGET_LABEL.met, value: count("met"), className: "bg-ok" },
        { key: "unmet", label: TARGET_LABEL.unmet, value: count("unmet"), className: "bg-bad" },
        { key: "nc", label: TARGET_LABEL["not-comparable"], value: count("not-comparable") + count("no-target"), className: "bg-warn" },
        { key: "nr", label: TARGET_LABEL["no-result"], value: count("no-result"), className: "bg-sky" },
        { key: "nd", label: TARGET_LABEL["no-data"], value: count("no-data"), className: "bg-muted-foreground/30" },
      ],
    }
  })
  return (
    <>
      <div className="rise mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-3">
        <PeriodSwitch value={period} onChange={setPeriod} />
        <IndicatorSwitch value={ind} onChange={setInd} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel className="rise">
          <PanelHeader
            title={`${INDICATORS.find((i) => i.key === ind)!.title} · ${periodLabel(period)}`}
            hint="الشريط للنتيجة، والخط الذهبي لمستهدف الفترة نفسها. اضغط على فرع لفتح ملفه."
            actions={<Legend items={[{ label: "النتيجة", className: "bg-primary" }, { label: "المستهدف", className: "bg-gold" }]} />}
          />
          <div className="px-5 py-5">
            {!compare.some((r) => r.value !== null) && (
              <p className="mb-4 rounded-lg bg-muted/70 px-4 py-3 text-[15px] text-muted-foreground">
                لا توجد نتائج بنسبة مئوية لهذه الفترة بعد، فتظهر المستهدفات وحدها.
              </p>
            )}
            <CompareBars rows={compare} />
          </div>
        </Panel>
        <Panel className="rise">
          <PanelHeader title="توزيع الفروع" hint={`${periodLabel(period)} · عدد الفروع في كل حالة.`} />
          <div className="space-y-4 px-5 py-5">
            <StackedBars unit="فرعًا" rows={distribution} />
            <Legend
              items={[
                { label: TARGET_LABEL.met, className: "bg-ok" },
                { label: TARGET_LABEL.unmet, className: "bg-bad" },
                { label: "غير قابل للمقارنة", className: "bg-warn" },
                { label: TARGET_LABEL["no-result"], className: "bg-sky" },
                { label: TARGET_LABEL["no-data"], className: "bg-muted-foreground/30" },
              ]}
            />
            <ul className="space-y-1 border-t pt-3 text-[14px] text-muted-foreground">
              {distribution.map((r) => (
                <li key={r.id}>
                  {r.label}: {r.segments.filter((s) => s.value).map((s) => `${s.label} ${formatNumber(s.value)}`).join("، ")}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ comparison table */
export function ComparisonTable() {
  const { data } = useStore()
  const { go } = useRouter()
  const [period, setPeriod] = usePersistent<PeriodKey>("cc-period", "s1")
  const [q, setQ] = usePersistent("cc-q", "")
  const [fresh, setFresh] = usePersistent<FreshFilter>("cc-fresh", "all")
  const [outcome, setOutcome] = usePersistent<OutcomeFilter>("cc-outcome", "all")
  const rows = useMemo(() => buildRows(data, period), [data, period])
  const outcomes = rows.map(branchOutcome)
  const stat = {
    met: outcomes.filter((o) => o === "met").length,
    unmet: outcomes.filter((o) => o === "unmet").length,
    comparable: outcomes.filter((o) => o !== "unknown").length,
    notUpdated: rows.filter((r) => r.fresh !== "current").length,
  }
  const filtered = rows.filter(
    (r) =>
      matches(q, r.b.name, r.b.fileTitle) &&
      (fresh === "all" || (fresh === "outdated" ? r.fresh !== "current" : r.fresh === fresh)) &&
      (outcome === "all" || branchOutcome(r) === outcome),
  )

  const columns: Column<BranchRow>[] = [
    { key: "name", header: "الفرع", sort: (r) => r.b.name, render: (r) => <span className="whitespace-nowrap text-[17px] font-bold">{r.b.name}</span> },
    ...INDICATORS.map(
      (it): Column<BranchRow> => ({
        key: it.key,
        header: `${it.short} · ${periodLabel(period)}`,
        sort: (r) => r.ind[it.key].result?.num ?? null,
        render: (r) => {
          const c = r.ind[it.key]
          return (
            <div className="min-w-[150px]">
              <div className="flex items-baseline gap-2">
                {c.result?.raw ? (
                  <span className="num text-[17px] font-bold text-primary" dir="ltr">{c.result.raw}</span>
                ) : (
                  <span className="text-[14px] text-muted-foreground">{c.s ? "لم تُدخل" : "—"}</span>
                )}
                {c.target?.raw && (
                  <span className="text-[14px] text-muted-foreground">
                    المستهدف <span className="num font-medium text-gold-ink" dir="ltr">{c.target.raw}</span>
                  </span>
                )}
              </div>
              <Pill tone={TARGET_TONE[c.status]} className="mt-1">{TARGET_LABEL[c.status]}</Pill>
            </div>
          )
        },
      }),
    ),
    {
      key: "fresh",
      header: "حالة البيانات",
      sort: (r) => ["failing", "stale", "none", "current"].indexOf(r.fresh),
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Pill tone={FRESH_TONE[r.fresh]}>{FRESH_LABEL[r.fresh]}</Pill>
          <Pill tone={COMPLETE_TONE[r.complete]}>{COMPLETE_LABEL[r.complete]}</Pill>
        </div>
      ),
    },
    {
      key: "updated",
      header: "آخر تحديث ناجح",
      sort: (r) => r.sync.lastSuccess?.succeededAt ?? null,
      render: (r) =>
        r.sync.lastSuccess ? <span className="num whitespace-nowrap">{formatDate(r.sync.lastSuccess.succeededAt)}</span> : <span className="text-[14px] text-muted-foreground">لم يُقرأ بعد</span>,
    },
    {
      key: "plans",
      header: "الخطط العلاجية والتحسينية",
      render: (r) => <span className="text-[14px] text-muted-foreground">{r.complete === "full" ? "غير موجودة في الملف المقروء" : "بانتظار ربط الملف"}</span>,
    },
    { key: "go", header: "", render: () => <ArrowLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />, className: "w-8" },
  ]

  const activeFilters = [
    q && { label: `بحث: ${q}`, clear: () => setQ("") },
    fresh !== "all" && { label: fresh === "outdated" ? "لم تُحدّث بياناتها" : FRESH_LABEL[fresh as Freshness], clear: () => setFresh("all") },
    outcome !== "all" && { label: outcome === "met" ? "حققت المستهدف" : outcome === "unmet" ? "دون المستهدف" : "بلا مقارنة", clear: () => setOutcome("all") },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  return (
    <>
      <div className="rise mb-4 flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchField id="cc-search" value={q} onChange={setQ} placeholder="ابحث عن فرع" className="md:w-80" />
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <ChipGroup<FreshFilter>
            label="حالة البيانات"
            value={fresh}
            onChange={setFresh}
            options={[
              { value: "all", label: "الكل", count: rows.length },
              { value: "outdated", label: "لم تُحدّث", count: stat.notUpdated },
              ...(["current", "stale", "failing", "none"] as Freshness[]).map((f) => ({ value: f, label: FRESH_LABEL[f], count: rows.filter((r) => r.fresh === f).length })),
            ]}
          />
          <ChipGroup<OutcomeFilter>
            label="تحقيق المستهدف"
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: "all", label: "الكل" },
              { value: "met", label: "حققت", count: stat.met },
              { value: "unmet", label: "دون المستهدف", count: stat.unmet },
              { value: "unknown", label: "بلا مقارنة", count: rows.length - stat.comparable },
            ]}
          />
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-[14px] text-muted-foreground">المرشحات المفعّلة</span>
            {activeFilters.map((f) => (
              <button key={f.label} type="button" onClick={f.clear} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-[14px] text-secondary-foreground hover:bg-secondary/80">
                {f.label}
                <X className="h-3.5 w-3.5" aria-label="إزالة" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setQ("")
                setFresh("all")
                setOutcome("all")
              }}
              className="text-[14px] font-bold text-primary hover:underline"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>
      <Panel>
        <DataTable
          caption="مقارنة الفروع حسب المعاملين وحالة البيانات"
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.b.slug}
          rowLabel={(r) => `افتح ملف فرع ${r.b.name}`}
          onRowClick={(r) => go({ page: "branch", slug: r.b.slug })}
          stickyFirst
          empty={<EmptyState compact title="لا فروع تطابق المرشحات" body="أزل أحد المرشحات أو غيّر كلمة البحث." />}
        />
        <p className="border-t px-5 py-3 text-[14px] text-muted-foreground">
          عرض {formatNumber(filtered.length)} من {formatNumber(rows.length)} فرعًا. حالة التحقيق مقارنة مباشرة بين نتيجة الفترة ومستهدفها كما وردا في الملف، ولا تُحسب إلا إذا كانا نسبتين مئويتين.
        </p>
      </Panel>
    </>
  )
}
