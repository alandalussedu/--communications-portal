import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import type { CellValue, IndicatorSummary, StageSummary } from "@/data/types"
import { Octagram } from "./common"

/* Resolve theme tokens to concrete colors so SVG charts follow light and dark. */
function readTokens() {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string) => `hsl(${s.getPropertyValue(`--${n}`).trim()})`
  return { primary: v("primary"), sky: v("sky"), gold: v("gold"), muted: v("muted-foreground"), border: v("border"), card: v("card") }
}

export function useChartColors() {
  const [c, setC] = useState(readTokens)
  useEffect(() => {
    const update = () => setC(readTokens())
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", update)
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] })
    return () => {
      mq.removeEventListener("change", update)
      mo.disconnect()
    }
  }, [])
  return c
}

export function Legend({ items }: { items: { label: string; className: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          {i.dashed ? (
            <span className={cn("inline-block w-5 border-t-2 border-dashed", i.className)} aria-hidden="true" />
          ) : (
            <span className={cn("inline-block h-3 w-3 rounded-full", i.className)} aria-hidden="true" />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------ indicator journey */
type JPoint = { k: string; target: number | null; result: number | null; targetRaw: string | null; resultRaw: string | null }

const pct = (v: CellValue | undefined) => (v && v.unit === "%" && v.num !== null ? v.num : null)

/** The four checkpoints of an indicator as they appear in the sheet. Only
 * percentage cells are plotted; a value in another unit is reported, not drawn. */
export function journey(s: Pick<IndicatorSummary, "prior" | "s1Target" | "s1Result" | "s2Target" | "s2Result" | "annualTarget" | "yearEnd">) {
  const steps: [string, CellValue | undefined, CellValue | undefined][] = [
    ["العام السابق", null, s.prior],
    ["الفصل الأول", s.s1Target, s.s1Result],
    ["الفصل الثاني", s.s2Target, s.s2Result],
    ["نهاية العام", s.annualTarget, s.yearEnd],
  ]
  const skipped: string[] = []
  const points: JPoint[] = steps.map(([k, t, r]) => {
    if (r?.raw && pct(r) === null) skipped.push(`${k}: ${r.raw}`)
    if (t?.raw && pct(t) === null) skipped.push(`مستهدف ${k}: ${t.raw}`)
    return { k, target: pct(t), result: pct(r), targetRaw: t?.raw ?? null, resultRaw: r?.raw ?? null }
  })
  const plotted = points.some((p) => p.target !== null || p.result !== null)
  return { points, skipped, plotted }
}

export function JourneyChart({
  s,
  height = 260,
  mini = false,
}: {
  s: Parameters<typeof journey>[0] | null | undefined
  height?: number
  mini?: boolean
}) {
  const c = useChartColors()
  const [hover, setHover] = useState<number | null>(null)
  if (!s) return <GhostChart height={height} mini={mini} text="لم تصل بيانات هذا المعامل بعد" />
  const { points, plotted } = journey(s)
  if (!plotted) return <GhostChart height={height} mini={mini} text="لا توجد قيم بنسبة مئوية لرسمها" />
  // Fixed drawing box; the SVG scales to the container width. Right-to-left: the first checkpoint sits on the right.
  const W = 600
  const H = height
  const pad = mini ? { t: 10, b: 6, l: 14, r: 14 } : { t: 16, b: 34, l: 16, r: 52 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const x = (i: number) => pad.l + iw - (iw * (i + 0.5)) / points.length
  const y = (v: number) => pad.t + ih - (Math.max(0, Math.min(100, v)) / 100) * ih
  const line = (vals: (number | null)[], connect: boolean) => {
    const segs: string[] = []
    let cur = ""
    vals.forEach((v, i) => {
      if (v === null) {
        if (!connect && cur) {
          segs.push(cur)
          cur = ""
        }
        return
      }
      cur += `${cur ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    })
    if (cur) segs.push(cur)
    return segs.join(" ")
  }
  const hp = hover !== null ? points[hover] : null
  return (
    <div style={{ height }} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="مسار المعامل خلال العام: المستهدف والنتيجة">
        {!mini &&
          [0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={W - pad.r + 8} y={y(t) + 4} fill={c.muted} fontSize={13} textAnchor="start" style={{ fontFamily: "Tajawal, Tahoma, sans-serif" }}>
                {t}%
              </text>
            </g>
          ))}
        {!mini &&
          points.map((p, i) => (
            <text key={p.k} x={x(i)} y={H - 10} fill={c.muted} fontSize={14} textAnchor="middle" style={{ fontFamily: "Tajawal, Tahoma, sans-serif" }}>
              {p.k}
            </text>
          ))}
        <path d={line(points.map((p) => p.target), true)} fill="none" stroke={c.gold} strokeWidth={mini ? 2 : 2.5} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <path d={line(points.map((p) => p.result), false)} fill="none" stroke={c.primary} strokeWidth={mini ? 2.5 : 3} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Dots are HTML so they stay round when the SVG stretches. */}
      {points.map((p, i) => (
        <div key={p.k}>
          {p.target !== null && (
            <span
              className="pointer-events-none absolute rounded-full border-2"
              style={{ left: `${(x(i) / W) * 100}%`, top: y(p.target), width: mini ? 7 : 10, height: mini ? 7 : 10, transform: "translate(-50%,-50%)", borderColor: c.gold, background: c.card }}
            />
          )}
          {p.result !== null && (
            <span
              className="pointer-events-none absolute rounded-full border-2"
              style={{ left: `${(x(i) / W) * 100}%`, top: y(p.result), width: mini ? 9 : 12, height: mini ? 9 : 12, transform: "translate(-50%,-50%)", borderColor: c.card, background: c.primary }}
            />
          )}
          {!mini && (
            <button
              type="button"
              aria-label={`${p.k}: المستهدف ${p.targetRaw ?? "غير منقول"}، النتيجة ${p.resultRaw ?? "لم تُدخل"}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="absolute inset-y-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${((x(i) - iw / points.length / 2) / W) * 100}%`, width: `${(iw / points.length / W) * 100}%` }}
            />
          )}
        </div>
      ))}
      {hp && hover !== null && (
        <div
          dir="rtl"
          className="pointer-events-none absolute top-2 z-10 rounded-lg border bg-popover px-3.5 py-2.5 text-[14px] shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="whitespace-nowrap font-bold">{hp.k}</p>
          {hp.k !== "العام السابق" && (
            <p className="mt-1 whitespace-nowrap text-muted-foreground">
              المستهدف: <span className="num font-medium text-foreground" dir="ltr">{hp.targetRaw ?? "غير منقول"}</span>
            </p>
          )}
          <p className="whitespace-nowrap text-muted-foreground">
            النتيجة: <span className="num font-medium text-foreground" dir="ltr">{hp.resultRaw ?? "لم تُدخل"}</span>
          </p>
        </div>
      )}
    </div>
  )
}

export function GhostChart({ height, text, mini }: { height: number; text: string; mini?: boolean }) {
  return (
    <div
      style={{ height }}
      className="relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed bg-muted/40 text-center"
    >
      <svg className="absolute inset-x-4 bottom-4 h-1/2 w-[calc(100%-2rem)] text-muted-foreground/25" viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40 C 40 32, 60 20, 100 24 S 160 10, 200 14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
      </svg>
      {!mini && <Octagram className="h-8 w-8 text-sky/60" />}
      <span className={cn("relative text-muted-foreground", mini ? "text-[14px]" : "text-[15px]")}>{text}</span>
    </div>
  )
}

/** The four checkpoints as a strip under the chart, always visible. */
export function JourneySteps({ s }: { s: Parameters<typeof journey>[0] }) {
  const steps: [string, CellValue | undefined, CellValue | undefined][] = [
    ["العام السابق", null, s.prior],
    ["الفصل الأول", s.s1Target, s.s1Result],
    ["الفصل الثاني", s.s2Target, s.s2Result],
    ["نهاية العام", s.annualTarget, s.yearEnd],
  ]
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map(([k, t, r], i) => (
        <li key={k} className="rise rounded-xl bg-muted/60 px-3.5 py-3" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="text-[14px] font-medium text-muted-foreground">{k}</div>
          {k !== "العام السابق" && (
            <div className="mt-1 flex items-baseline justify-between gap-2 text-[15px]">
              <span className="text-muted-foreground">المستهدف</span>
              {t?.raw ? <span className="num font-bold text-gold-ink" dir="ltr">{t.raw}</span> : <span className="text-[14px] text-muted-foreground">غير منقول</span>}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2 text-[15px]">
            <span className="text-muted-foreground">النتيجة</span>
            {r?.raw ? <span className="num font-bold text-primary" dir="ltr">{r.raw}</span> : <span className="text-[14px] text-muted-foreground">لم تُدخل</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------ branch comparison */
export type CompareRow = {
  id: string
  label: string
  value: number | null
  valueRaw: string | null
  target: number | null
  targetRaw: string | null
  note?: string
  onClick?: () => void
}

export function CompareBars({ rows }: { rows: CompareRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const has = r.value !== null
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={r.onClick}
              className="group block w-full rounded-lg p-2 -m-2 text-start transition-colors hover:bg-accent/60"
              aria-label={`${r.label}: النتيجة ${r.valueRaw ?? "غير متاحة"}، المستهدف ${r.targetRaw ?? "غير منقول"}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[16px] font-medium">{r.label}</span>
                <span className="num shrink-0 text-[15px]">
                  {has ? (
                    <span className="font-bold text-primary" dir="ltr">{r.valueRaw}</span>
                  ) : (
                    <span className="text-muted-foreground">{r.note ?? "لا بيانات"}</span>
                  )}
                  {r.targetRaw && (
                    <span className="ms-2 text-muted-foreground">
                      المستهدف <span className="font-medium text-gold-ink" dir="ltr">{r.targetRaw}</span>
                    </span>
                  )}
                </span>
              </div>
              <div className={cn("relative mt-1.5 h-3 w-full rounded-full", has ? "bg-muted" : "border border-dashed bg-transparent")}>
                {has && (
                  <div
                    className="grow-x absolute inset-y-0 start-0 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, r.value!)}%`, animationDelay: `${i * 60}ms` }}
                  />
                )}
                {r.target !== null && (
                  <span
                    className="absolute -top-1 bottom-[-4px] w-[3px] rounded-full bg-gold"
                    style={{ insetInlineStart: `calc(${Math.min(100, r.target)}% - 1.5px)` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------ stacked bars */
export type Segment = { key: string; label: string; value: number; className: string }
export type StackRow = { id: string; label: string; segments: Segment[]; onClick?: () => void }

export function StackedBars({ rows, unit, emptyNote }: { rows: StackRow[]; unit: string; emptyNote?: ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)))
  if (rows.length === 0) return <>{emptyNote}</>
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const total = r.segments.reduce((a, s) => a + s.value, 0)
        const desc = r.segments.map((s) => `${s.label}: ${s.value}`).join("، ")
        return (
          <li key={r.id} title={desc}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px]">{r.label}</span>
              <span className="num shrink-0 text-[15px] font-bold">
                {formatNumber(total)} <span className="text-[14px] font-normal text-muted-foreground">{unit}</span>
              </span>
            </div>
            <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="grow-x flex h-full" style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 60}ms` }}>
                {r.segments.map((s) =>
                  s.value > 0 ? <span key={s.key} className={cn("h-full", s.className)} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------ grouped bars */
export type GroupMetric = { key: string; label: string; className: string }
export type GroupRow = { id: string; label: string; values: Record<string, { num: number | null; raw: string | null }> }

export function GroupBars({ rows, metrics }: { rows: GroupRow[]; metrics: GroupMetric[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => metrics.map((m) => r.values[m.key]?.num ?? 0)))
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="text-[15px] font-medium">{r.label}</div>
          <div className="mt-1.5 space-y-1">
            {metrics.map((m) => {
              const v = r.values[m.key]
              return (
                <div key={m.key} className="flex items-center gap-2" title={`${m.label}: ${v?.raw ?? "—"}`}>
                  <div className="h-2.5 flex-1 rounded-full bg-muted">
                    {v?.num !== null && v?.num !== undefined && (
                      <div className={cn("grow-x h-full rounded-full", m.className)} style={{ width: `${(v.num / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
                    )}
                  </div>
                  <span className="num w-12 shrink-0 text-end text-[14px]" dir="ltr">{v?.raw ?? "—"}</span>
                </div>
              )
            })}
          </div>
        </li>
      ))}
    </ul>
  )
}

export type { StageSummary }
