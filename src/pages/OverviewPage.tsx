import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Bell, ExternalLink, FileText, FileType2, Folder, RefreshCcw, Search } from "lucide-react"
import { useRouter } from "@/lib/router"
import { useStore } from "@/data/store"
import { INDICATORS, type LinkState } from "@/data/links"
import type { CellValue, FileItem, IndicatorKey, IndicatorSummary } from "@/data/types"
import {
  ACADEMIC_YEAR,
  FRESH_LABEL,
  FRESH_TONE,
  PERIODS,
  TARGET_LABEL,
  TARGET_TONE,
  buildAlerts,
  buildRows,
  isHandled,
  periodLabel,
  type BranchRow,
  type PeriodKey,
} from "@/data/insights"
import { formatNumber } from "@/lib/format"
import { FILE_KIND_LABEL, searchFiles } from "@/lib/search"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { Legend } from "@/components/charts"
import { compareRows } from "@/components/BranchComparison"
import { Banner, Chevrons, Dot, Octagram, Panel, PanelHeader, Pill, type Tone } from "@/components/common"

export const LINK_TONE: Record<LinkState, Tone> = { direct: "ok", flagged: "warn", "file-only": "sky", missing: "neutral" }

/** Animate a number from 0 on first paint; instant when motion is reduced. */
export function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(target)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) {
      setV(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    setV(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** The most recent result entered for an indicator, and which checkpoint it is. */
export function latestResult(s: IndicatorSummary | undefined): { v: CellValue; label: string } | null {
  if (!s) return null
  const order: [CellValue, string][] = [
    [s.yearEnd, "نهاية العام"],
    [s.s2Result, "الفصل الثاني"],
    [s.s1Result, "الفصل الأول"],
    [s.prior, "العام السابق"],
  ]
  const hit = order.find(([v]) => v?.raw)
  return hit ? { v: hit[0], label: hit[1] } : null
}

export function IndicatorSwitch({ value, onChange }: { value: IndicatorKey; onChange: (k: IndicatorKey) => void }) {
  return (
    <div className="inline-flex rounded-full border bg-card p-1" role="tablist" aria-label="المعامل">
      {INDICATORS.map((i) => (
        <button
          key={i.key}
          type="button"
          role="tab"
          aria-selected={value === i.key}
          onClick={() => onChange(i.key)}
          className={cn(
            "h-10 rounded-full px-4 text-[15px] transition-colors",
            value === i.key ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i.short}
        </button>
      ))}
    </div>
  )
}

export function PeriodSwitch({ value, onChange, onBand = false, compact = false }: { value: PeriodKey; onChange: (p: PeriodKey) => void; onBand?: boolean; compact?: boolean }) {
  return (
    <div className={cn("inline-flex rounded-full p-1", onBand ? "bg-white/10 ring-1 ring-white/20" : "border bg-card")} role="tablist" aria-label="الفترة">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="tab"
          aria-selected={value === p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            "h-10 whitespace-nowrap rounded-full transition-colors",
            compact ? "px-3 text-[14px]" : "px-3 text-[14px] sm:px-4 sm:text-[15px]",
            value === p.key
              ? onBand
                ? "bg-white font-bold text-[hsl(240_57%_30%)]"
                : "bg-primary font-bold text-primary-foreground"
              : onBand
                ? "text-white/80 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/* A branch "met" its targets when every comparable indicator met its own target. */
export function branchOutcome(r: BranchRow): "met" | "unmet" | "unknown" {
  const st = INDICATORS.map((i) => r.ind[i.key].status)
  if (st.includes("unmet")) return "unmet"
  if (st.includes("met")) return "met"
  return "unknown"
}

/** Opens the library with a query (and no leftover filters that could hide the results). */
export function openLibrary(go: ReturnType<typeof useRouter>["go"], q: string, group = "all", section?: string) {
  try {
    const set = (k: string, v: unknown) => sessionStorage.setItem(`hub:${k}`, JSON.stringify(v))
    set("lib-q", q)
    set("lib-group", group)
    set("lib-kind", "all")
    set("lib-status", "all")
    set("lib-owner", "all")
    set("lib-date", "all")
    set("lib-sort", "relevance")
  } catch {
    /* storage blocked: the library opens with its defaults */
  }
  go({ page: "library", section })
}

const plural = (n: number) => (n === 0 ? "لا يوجد" : n === 1 ? "فرع واحد" : n === 2 ? "فرعان" : `${formatNumber(n)} ${n <= 10 ? "فروع" : "فرعًا"}`)

export function IndicatorsHomePage() {
  const { data, connection, refresh } = useStore()
  const { go } = useRouter()
  const [period, setPeriod] = usePersistent<PeriodKey>("cc-period", "s1")
  const [ind, setInd] = usePersistent<IndicatorKey>("cc-ind", "satisfaction")

  const rows = useMemo(() => buildRows(data, period), [data, period])
  const openAlerts = useMemo(() => buildAlerts(data).filter((a) => !isHandled(a, data.alertState)), [data])
  const outcomes = rows.map(branchOutcome)
  const met = outcomes.filter((o) => o === "met").length
  const unmet = outcomes.filter((o) => o === "unmet").length
  const comparable = met + unmet
  const current = rows.filter((r) => r.fresh === "current").length
  const withResult = rows.filter((r) => INDICATORS.some((i) => r.ind[i.key].result?.raw)).length
  const compare = useMemo(() => compareRows(rows, ind, go), [rows, ind, go])

  return (
    <Gate needs={["branches", "indicators", "meta", "stages", "syncLog", "settings", "alertState"]} emptyWhen={data.branches.length === 0}>
      {/* 1 · heading */}
      <section className="pattern-stars rise relative mt-2 overflow-hidden rounded-2xl bg-band px-6 py-6 text-band-foreground sm:px-8">
        <Octagram className="pointer-events-none absolute -end-10 -top-12 h-44 w-44 text-gold/25" strokeWidth={1} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] text-band-soft">
              <Chevrons className="h-2.5 w-3 text-gold" />
              العام الدراسي <span className="num">{ACADEMIC_YEAR}</span>
            </p>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight sm:text-[32px]">ملخص الفروع</h1>
            <p className="mt-1 text-[16px] text-white/80">نتيجة كل فرع مقابل مستهدفه كما وردت في ملفه، دون أي تجميع بين الفروع.</p>
          </div>
          <PeriodSwitch value={period} onChange={setPeriod} onBand />
        </div>
      </section>

      {connection.kind === "error" && (
        <div className="mt-5">
          <Banner
            tone="bad"
            title="انقطعت المزامنة مع قاعدة المنصة"
            action={
              <button type="button" onClick={refresh} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-card px-3 text-[15px] text-foreground">
                <RefreshCcw className="h-4 w-4" />
                تحديث
              </button>
            }
          >
            {connection.message} المعروض هو آخر ما وصل قبل الانقطاع.
          </Banner>
        </div>
      )}

      {/* 2 · four numbers */}
      <h2 className="sr-only">الأرقام الرئيسية</h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="الفروع"
          value={formatNumber(rows.length)}
          sub={`${formatNumber(current)} محدّثة · ${withResult ? `${formatNumber(withResult)} لها نتائج` : "لا نتائج بعد"}`}
          onClick={() => go({ page: "reports" })}
        />
        <Stat
          tone="ok"
          label="حققت المستهدف"
          value={comparable ? formatNumber(met) : "—"}
          sub={comparable ? `من ${formatNumber(comparable)} قابلة للمقارنة` : `بانتظار نتائج ${periodLabel(period)}`}
          onClick={() => go({ page: "reports" })}
        />
        <Stat
          tone="bad"
          label="دون المستهدف"
          value={comparable ? formatNumber(unmet) : "—"}
          sub={comparable ? `من ${formatNumber(comparable)} قابلة للمقارنة` : `بانتظار نتائج ${periodLabel(period)}`}
          onClick={() => go({ page: "reports" })}
        />
        <Stat
          tone="warn"
          label="تنبيهات مفتوحة"
          value={formatNumber(openAlerts.length)}
          sub={openAlerts.length ? "تحتاج متابعة" : "لا شيء يحتاج متابعة"}
          onClick={() => go({ page: "alerts" })}
          icon={<Bell className="h-4 w-4" aria-hidden="true" />}
        />
      </ul>

      {/* 3 · chart + quick file search */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel className="rise">
          <PanelHeader
            title="النتيجة مقابل المستهدف"
            hint={`${periodLabel(period)} · لكل فرع كما في ملفه`}
            actions={<IndicatorSwitch value={ind} onChange={setInd} />}
          />
          <div className="px-5 pb-5 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Legend items={[{ label: "النتيجة", className: "bg-primary" }, { label: "المستهدف", className: "bg-gold" }]} />
              {!compare.some((r) => r.value !== null) && (
                <span className="rounded-full bg-muted px-3 py-0.5 text-[13px] text-muted-foreground">لم تُدخل نتائج {periodLabel(period)} بعد · تظهر المستهدفات وحدها</span>
              )}
            </div>
            <BranchChart rows={compare} />
          </div>
        </Panel>
        <div className="flex flex-col gap-5">
          <AlertsPreview alerts={openAlerts} />
        </div>
      </div>

      {/* 5 · one card per branch */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold">الفروع</h2>
          <p className="text-[15px] text-muted-foreground">
            {periodLabel(period)} · اضغط على فرع لفتح ملفه الكامل.
          </p>
        </div>
        <button type="button" onClick={() => go({ page: "reports" })} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
          جدول المقارنة الكامل
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {rows.map((r, i) => (
          <BranchCard key={r.b.slug} r={r} delay={i} onOpen={() => go({ page: "branch", slug: r.b.slug })} />
        ))}
      </ul>
    </Gate>
  )
}

const SEV_TONE: Record<"high" | "medium" | "low", Tone> = { high: "bad", medium: "warn", low: "neutral" }

function AlertsPreview({ alerts }: { alerts: ReturnType<typeof buildAlerts> }) {
  const { go } = useRouter()
  const order = { high: 0, medium: 1, low: 2 }
  const top = [...alerts].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 4)
  return (
    <Panel className="rise">
      <PanelHeader title="أهم التنبيهات" hint={alerts.length ? `${formatNumber(alerts.length)} تنبيهًا مفتوحًا` : "لا تنبيهات مفتوحة"} />
      {top.length > 0 && (
        <ul className="divide-y px-3 py-1">
          {top.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => go(a.route)} className="flex w-full items-start gap-2.5 rounded-md px-2 py-2.5 text-start hover:bg-accent/60">
                <span className="mt-2">
                  <Dot tone={SEV_TONE[a.severity]} />
                </span>
                <span className="min-w-0 text-[14px] leading-snug">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t px-5 py-3">
        <button type="button" onClick={() => go({ page: "alerts" })} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
          كل التنبيهات
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    </Panel>
  )
}

function Stat({ label, value, sub, tone = "brand", onClick, icon }: { label: string; value: string; sub: string; tone?: Tone; onClick?: () => void; icon?: React.ReactNode }) {
  const bar: Record<Tone, string> = { ok: "bg-ok", bad: "bg-bad", warn: "bg-warn", brand: "bg-primary", neutral: "bg-muted-foreground/40", gold: "bg-gold", sky: "bg-sky" }
  return (
    <li className="rise">
      <button type="button" onClick={onClick} className="lift relative block h-full w-full rounded-xl border bg-card px-4 py-3.5 ps-5 text-start hover:border-primary/40">
        <span className={cn("absolute inset-y-3 start-0 w-1 rounded-full", bar[tone])} aria-hidden="true" />
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="num mt-0.5 block text-[28px] font-extrabold leading-tight">{value}</span>
        <span className="block text-[14px] leading-snug text-muted-foreground">{sub}</span>
      </button>
    </li>
  )
}

/** Horizontal bars, one row per branch: navy bar for the result, gold tick for the target. Percentages only. */
function BranchChart({ rows }: { rows: ReturnType<typeof compareRows> }) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-[9rem_minmax(0,1fr)_5.5rem] gap-3 text-[12px] text-muted-foreground" aria-hidden="true">
        <span />
        <span className="flex justify-between">
          <span className="num">0%</span>
          <span className="num">50%</span>
          <span className="num">100%</span>
        </span>
        <span />
      </div>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={r.onClick}
              className="grid w-full grid-cols-[9rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-md px-1 py-1 text-start hover:bg-accent/60"
              aria-label={`${r.label}: النتيجة ${r.valueRaw ?? "غير متاحة"}، المستهدف ${r.targetRaw ?? "غير منقول"}`}
            >
              <span className="truncate text-[15px] font-medium">{r.label}</span>
              <span className="relative h-3 rounded-full bg-muted">
                <span className="pointer-events-none absolute inset-y-0 start-1/2 w-px bg-border" aria-hidden="true" />
                {r.value !== null && (
                  <span className="grow-x absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${Math.min(100, r.value)}%`, animationDelay: `${i * 40}ms` }} />
                )}
                {r.target !== null && (
                  <span className="absolute -top-1 bottom-[-4px] w-[3px] rounded-full bg-gold" style={{ insetInlineStart: `calc(${Math.min(100, r.target)}% - 1.5px)` }} aria-hidden="true" />
                )}
              </span>
              <span className="num text-end text-[14px]" dir="ltr">
                {r.valueRaw ? (
                  <span className="font-bold text-primary">{r.valueRaw}</span>
                ) : r.targetRaw ? (
                  <span className="text-gold-ink">{r.targetRaw}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted-foreground">الرقم على اليسار هو النتيجة، أو المستهدف بالذهبي إن لم تُدخل النتيجة. تظهر النسب المئوية فقط.</p>
    </div>
  )
}

export function QuickSearch() {
  const { data } = useStore()
  const { go } = useRouter()
  const [q, setQ] = useState("")
  const synonyms = data.settings?.synonyms ?? []
  // Drafts and archived copies stay out of quick results, as in the library's default view.
  const files = useMemo(() => data.files.filter((f) => f.status !== "مسودة" && f.status !== "مؤرشف"), [data.files])
  const hits = useMemo(() => (q.trim() ? searchFiles(files, q, synonyms) : []), [files, q, synonyms])
  const groups = useMemo(() => {
    const m = new Map<string, number>()
    files.forEach((f) => m.set(f.group, (m.get(f.group) ?? 0) + 1))
    return [...m.entries()]
  }, [files])
  return (
    <Panel className="rise flex flex-col">
      <PanelHeader title="بحث سريع في الملفات" hint={`${formatNumber(data.files.length)} عنصرًا في مكتبة الملفات`} />
      <form
        className="px-5 pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) openLibrary(go, q.trim())
        }}
      >
        <label htmlFor="quick-file-search" className="sr-only">ابحث في الملفات</label>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="quick-file-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم الملف أو التصنيف، مثل: هوية"
            className="h-11 w-full rounded-lg border border-input bg-card pe-3 ps-9 text-[16px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </form>
      <div className="flex-1 px-5 pb-4 pt-3">
        {!q.trim() ? (
          <>
            <p className="mb-2 text-[14px] text-muted-foreground">أو تصفّح حسب التصنيف</p>
            <ul className="flex flex-wrap gap-1.5">
              {groups.map(([g, n]) => (
                <li key={g}>
                  <button type="button" onClick={() => openLibrary(go, "", g)} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-[14px] hover:bg-accent">
                    {g}
                    <span className="num text-[13px] text-muted-foreground">{n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : hits.length === 0 ? (
          <p className="rounded-lg bg-muted/70 px-4 py-3 text-[15px] text-muted-foreground">لا نتائج لـ«{q}». جرّب كلمة أخرى أو افتح المكتبة.</p>
        ) : (
          <ul className="-mx-2 divide-y">
            {hits.slice(0, 6).map(({ f }) => (
              <FileRow key={f.id} f={f} />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t px-5 py-3">
        <button type="button" onClick={() => openLibrary(go, q.trim())} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
          {q.trim() ? `كل النتائج في المكتبة (${formatNumber(hits.length)})` : "فتح مكتبة الملفات"}
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    </Panel>
  )
}

export function FileRow({ f }: { f: FileItem }) {
  const Icon = f.kind === "folder" ? Folder : f.kind === "file" ? FileText : FileType2
  const inner = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", !f.url ? "bg-muted text-muted-foreground" : f.kind === "folder" ? "bg-gold-soft text-gold-ink" : "bg-sky-soft text-sky-ink")}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{f.title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {FILE_KIND_LABEL[f.kind]} · {f.group}
        </span>
      </span>
      {f.url ? <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Pill tone="warn">بانتظار الرابط</Pill>}
    </>
  )
  return (
    <li>
      {f.url ? (
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60">
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2">{inner}</div>
      )}
    </li>
  )
}

function BranchCard({ r, delay, onOpen }: { r: BranchRow; delay: number; onOpen: () => void }) {
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(delay, 10) * 35}ms` }}>
      <button type="button" onClick={onOpen} className="lift flex h-full w-full flex-col rounded-xl border bg-card p-4 text-start hover:border-primary/40">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[18px] font-bold leading-snug">{r.b.name}</span>
          <span className="mt-1.5 inline-flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground" title={FRESH_LABEL[r.fresh]}>
            <Dot tone={FRESH_TONE[r.fresh]} />
            {FRESH_LABEL[r.fresh]}
          </span>
        </span>
        <span className="mt-3 flex flex-col gap-3 border-t pt-3">
          {INDICATORS.map((it) => {
            const c = r.ind[it.key]
            return (
              <span key={it.key} className="block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] text-muted-foreground">{it.short}</span>
                  <span className="num text-[15px]" dir="ltr">
                    {c.result?.raw ? <span className="font-bold text-primary">{c.result.raw}</span> : <span className="text-[13px] text-muted-foreground">{c.s ? "لم تُدخل" : "—"}</span>}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground">
                    المستهدف {c.target?.raw ? <span className="num font-medium text-gold-ink" dir="ltr">{c.target.raw}</span> : "غير منقول"}
                  </span>
                </span>
                {c.status !== "no-result" && c.status !== "no-data" && (
                  <Pill tone={TARGET_TONE[c.status]} className="mt-1 px-2 py-0 text-[12px]">{TARGET_LABEL[c.status]}</Pill>
                )}
              </span>
            )
          })}
        </span>
      </button>
    </li>
  )
}
