import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, ArrowDownUp, Building2, ChevronDown, CircleGauge, Info, Percent, Search, Sparkles, UserMinus, Users, X } from "lucide-react"
import type { StudentCounts, StudentRow } from "@/data/types"
import { formatDate, formatNumber } from "@/lib/format"
import { OCCUPANCY_LEVELS, WITHDRAWAL_LEVELS, growthPreliminary, notesFor, occupancyStatus, pct, shortName, signedPct, withdrawalStatus, type Tone } from "@/lib/students"
import { cn } from "@/lib/utils"

/**
 * The «أعداد الطلاب» dashboard. Everything shown is a number from the uploaded
 * file; picking a branch (from the list, a bar, a bubble or a table row)
 * narrows every card to that branch.
 */

export const TONE_BAR: Record<Tone, string> = { ok: "bg-ok", sky: "bg-sky", warn: "bg-warn", bad: "bg-bad" }
export const TONE_CHIP: Record<Tone, string> = { ok: "bg-ok-soft text-ok", sky: "bg-sky-soft text-sky-ink", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" }
const TONE_FILL: Record<Tone, string> = { ok: "hsl(var(--ok))", sky: "hsl(var(--sky))", warn: "hsl(var(--warn))", bad: "hsl(var(--bad))" }
export const STAGE_COLORS = ["hsl(var(--gold))", "hsl(var(--primary))", "hsl(var(--sky))", "hsl(240 40% 70%)", "hsl(152 45% 40%)", "hsl(280 35% 55%)"]
export const TYPE_COLORS = ["hsl(var(--primary))", "hsl(var(--sky))", "hsl(var(--gold))", "hsl(152 45% 40%)", "hsl(280 35% 55%)", "hsl(var(--bad))", "hsl(240 40% 70%)", "hsl(20 60% 50%)"]

const Ltr = ({ children }: { children: ReactNode }) => <bdi dir="ltr">{children}</bdi>
export const Chip = ({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold leading-5", TONE_CHIP[tone], className)}>{children}</span>
)
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(20_20_80/0.04),0_8px_24px_-14px_rgb(20_20_80/0.14)]", className)}>{children}</section>
}
function CardHead({ title, hint, actions }: { title: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[18px] font-extrabold leading-snug">{title}</h2>
        {hint && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{hint}</p>}
      </div>
      {actions}
    </div>
  )
}

type Metric = "occupancy" | "withdrawalRate" | "current" | "newcomers" | "growth"
const METRICS: { key: Metric; label: string }[] = [
  { key: "occupancy", label: "الإشغال" },
  { key: "withdrawalRate", label: "الانسحاب" },
  { key: "current", label: "الحاليون" },
  { key: "newcomers", label: "الجدد" },
  { key: "growth", label: "النمو" },
]

export function Dashboard({ counts, prev, branch, onBranch }: { counts: StudentCounts; prev: StudentCounts | null; branch: string | null; onBranch: (name: string | null) => void }) {
  const row = (branch && counts.branches.find((b) => b.name === branch)) || counts.total
  const prevRow = prev ? (branch ? prev.branches.find((b) => shortName(b.name) === shortName(branch)) : prev.total) ?? null : null
  const preliminary = growthPreliminary(counts)
  const toggle = (name: string) => onBranch(branch === name ? null : name)

  return (
    <div className="flex flex-col gap-4">
      <Kpis row={row} prev={prevRow} prevDate={prev?.date ?? null} preliminary={preliminary} branchNotes={branch ? notesFor(counts, branch) : []} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Bars counts={counts} branch={branch} onPick={toggle} preliminary={preliminary} className="xl:col-span-2" />
        <div className="flex min-w-0 flex-col gap-4">
          <Breakdown title="حسب المرحلة" names={counts.stageNames} values={row.stages} total={row.current} colors={STAGE_COLORS} />
          <Breakdown title="حسب نوع الدراسة" names={counts.typeNames} values={row.types} total={row.current} colors={TYPE_COLORS} />
        </div>
        <Matrix counts={counts} branch={branch} onPick={toggle} className="xl:col-span-2" />
        <div className="flex min-w-0 flex-col gap-4">
          <States row={row} />
          <Alerts counts={counts} />
        </div>
      </div>
      <Table counts={counts} branch={branch} onPick={toggle} preliminary={preliminary} />
      <Definitions counts={counts} />
    </div>
  )
}

/* ------------------------------------------------------------------ KPIs */
function Delta({ now, before, kind, prevDate, invert }: { now: number | null; before: number | null | undefined; kind: "count" | "rate"; prevDate: string | null; invert?: boolean }) {
  if (now === null || before === null || before === undefined || !prevDate) return null
  const d = now - before
  const good = invert ? d < 0 : d > 0
  const text = kind === "count" ? `${d >= 0 ? "+" : "−"}${formatNumber(Math.abs(d))}` : `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)} نقطة`
  return (
    <p className="mt-2 text-[12px] text-muted-foreground">
      <span className={cn("font-bold", d === 0 ? "" : good ? "text-ok" : "text-bad")}>
        <Ltr>{text}</Ltr>
      </span>{" "}
      عن سحب {formatDate(prevDate)}
    </p>
  )
}

function KpiHead({ icon, label, light }: { icon: ReactNode; label: string; light?: boolean }) {
  return (
    <header className={cn("flex items-center gap-2 whitespace-nowrap text-[14px] font-bold", light ? "text-band-soft" : "text-muted-foreground")}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px]", light ? "bg-white/10 text-gold" : "bg-muted text-primary")}>{icon}</span>
      {label}
    </header>
  )
}

function Kpis({ row, prev, prevDate, preliminary, branchNotes }: { row: StudentRow; prev: StudentRow | null; prevDate: string | null; preliminary: boolean; branchNotes: { title: string; text: string }[] }) {
  const ws = withdrawalStatus(row.withdrawalRate)
  const os = occupancyStatus(row.occupancy)
  const regular = row.regular ?? null
  return (
    <>
      {branchNotes.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            {branchNotes.map((n) => (
              <p key={n.title}>
                <b>{n.title}:</b> {n.text}
              </p>
            ))}
          </div>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1.25fr_repeat(5,minmax(0,1fr))]">
        <li className="col-span-2 min-w-0 rounded-2xl p-5 text-band-foreground md:col-span-1" style={{ background: "linear-gradient(160deg, hsl(var(--band)), hsl(240 60% 20%))" }}>
          <KpiHead icon={<Users className="h-4 w-4" aria-hidden="true" />} label="الطلاب الحاليون" light />
          <p className="num mt-3 text-[34px] font-extrabold leading-none">{formatNumber(row.current)}</p>
          {regular !== null && (
            <>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-gold" aria-hidden="true">
                <span className="h-full bg-white" style={{ width: `${(regular / Math.max(row.current, 1)) * 100}%` }} />
              </div>
              <p className="mt-2 flex justify-between gap-2 text-[12.5px] text-band-soft">
                <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-white" />منتظم {formatNumber(regular)}</span>
                <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-gold" />مستجد {formatNumber(row.newcomers)}</span>
              </p>
            </>
          )}
          {prev && prevDate && <p className="mt-2 text-[12px] text-band-soft"><Ltr>{row.current - prev.current >= 0 ? "+" : "−"}{formatNumber(Math.abs(row.current - prev.current))}</Ltr> عن سحب {formatDate(prevDate)}</p>}
        </li>
        <Kpi icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} label="الطلاب الجدد" value={formatNumber(row.newcomers)}>
          {row.growth !== null && (
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              نمو الحاليين عن العام الماضي{" "}
              <b className={row.growth >= 0 ? "text-ok" : "text-bad"}>
                <Ltr>{signedPct(row.growth)}</Ltr>
              </b>{" "}
              {preliminary && <span className="rounded-full bg-gold-soft px-1.5 text-[11px] font-bold text-gold-ink">مبدئية</span>}
            </p>
          )}
          <Delta now={row.newcomers} before={prev?.newcomers} kind="count" prevDate={prevDate} />
        </Kpi>
        <Kpi icon={<UserMinus className="h-4 w-4" aria-hidden="true" />} label="المنسحبون" value={formatNumber(row.withdrawn)}>
          {row.transferred !== null && <p className="mt-2 text-[13px] leading-6 text-muted-foreground">لا يشمل {formatNumber(row.transferred)} محوّلًا إلى فرع آخر</p>}
          <Delta now={row.withdrawn} before={prev?.withdrawn} kind="count" prevDate={prevDate} invert />
        </Kpi>
        <Kpi icon={<Percent className="h-4 w-4" aria-hidden="true" />} label="نسبة الانسحاب" value={pct(row.withdrawalRate)} chip={<Chip tone={ws.tone}>{ws.label}</Chip>}>
          <WithdrawalScale r={row.withdrawalRate} />
          <Delta now={row.withdrawalRate} before={prev?.withdrawalRate} kind="rate" prevDate={prevDate} invert />
        </Kpi>
        <li className="min-w-0 rounded-2xl border bg-card p-5">
          <KpiHead icon={<CircleGauge className="h-4 w-4" aria-hidden="true" />} label="نسبة الإشغال" />
          <Gauge value={row.occupancy} />
          <p className="mt-1 text-center"><Chip tone={os.tone}>{os.label}</Chip></p>
          <Delta now={row.occupancy} before={prev?.occupancy} kind="rate" prevDate={prevDate} />
        </li>
        <Kpi icon={<Building2 className="h-4 w-4" aria-hidden="true" />} label="الطاقة التشغيلية" value={formatNumber(row.capacity)}>
          <p className="mt-2 text-[13px] text-muted-foreground">
            <b className="num text-foreground">{formatNumber(Math.max(row.capacity - row.current, 0))}</b> مقعدًا متاحًا
          </p>
        </Kpi>
      </ul>
    </>
  )
}

function Kpi({ icon, label, value, chip, children }: { icon: ReactNode; label: string; value: string; chip?: ReactNode; children?: ReactNode }) {
  return (
    <li className="min-w-0 rounded-2xl border bg-card p-5">
      <KpiHead icon={icon} label={label} />
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <span className="num text-[30px] font-extrabold leading-none">{value}</span>
        {chip}
      </p>
      {children}
    </li>
  )
}

function WithdrawalScale({ r }: { r: number }) {
  const max = 0.2
  const at = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative flex h-2 gap-[3px]">
        <span className="h-full rounded-full bg-ok/55" style={{ flex: WITHDRAWAL_LEVELS.good * 100 }} />
        <span className="h-full rounded-full bg-warn/50" style={{ flex: (WITHDRAWAL_LEVELS.follow - WITHDRAWAL_LEVELS.good) * 100 }} />
        <span className="h-full rounded-full bg-bad/45" style={{ flex: (max - WITHDRAWAL_LEVELS.follow) * 100 }} />
        <span className="absolute -top-1 h-4 w-1 translate-x-1/2 rounded-sm bg-foreground" style={{ insetInlineStart: at(r) }} />
      </div>
      <div className="num relative mt-1.5 h-4 text-[11px] text-muted-foreground">
        <span className="absolute" style={{ insetInlineStart: 0 }}>0%</span>
        <span className="absolute translate-x-1/2" style={{ insetInlineStart: at(WITHDRAWAL_LEVELS.good) }}>8%</span>
        <span className="absolute translate-x-1/2" style={{ insetInlineStart: at(WITHDRAWAL_LEVELS.follow) }}>12%</span>
        <span className="absolute" style={{ insetInlineEnd: 0 }}>20%</span>
      </div>
    </div>
  )
}

/** Half-circle gauge that fills from the right, with the 70% and 85% marks. */
function Gauge({ value }: { value: number }) {
  const r = 56, len = Math.PI * r
  const pt = (v: number, rr: number) => [70 + rr * Math.cos(Math.PI * v), 72 - rr * Math.sin(Math.PI * v)]
  const tick = (v: number) => {
    const [x1, y1] = pt(v, 47), [x2, y2] = pt(v, 66)
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--gold))" strokeWidth={2.5} strokeLinecap="round" />
  }
  return (
    <div className="relative mx-auto mt-2 w-[150px]">
      <svg viewBox="0 0 140 80" className="block w-full" aria-hidden="true">
        <path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="hsl(var(--muted))" strokeWidth={13} strokeLinecap="round" />
        <path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="hsl(var(--primary))" strokeWidth={13} strokeLinecap="round" strokeDasharray={`${len * Math.min(Math.max(value, 0), 1)} ${len}`} className="transition-[stroke-dasharray] duration-700" />
        {tick(OCCUPANCY_LEVELS.good)}
        {tick(OCCUPANCY_LEVELS.high)}
      </svg>
      <span className="num absolute inset-x-0 bottom-0 text-center text-[26px] font-extrabold leading-none">{pct(value)}</span>
    </div>
  )
}

/* -------------------------------------------------------------- branch bars */
function Bars({ counts, branch, onPick, preliminary, className }: { counts: StudentCounts; branch: string | null; onPick: (n: string) => void; preliminary: boolean; className?: string }) {
  const [metric, setMetric] = useState<Metric>("occupancy")
  const list = useMemo(() => [...counts.branches].sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity)), [counts, metric])
  const maxCap = Math.max(...counts.branches.map((b) => b.capacity), 1)
  const maxOf = (k: "current" | "newcomers" | "withdrawalRate") => Math.max(...counts.branches.map((b) => b[k]), 1e-9)
  const maxGrowth = Math.max(...counts.branches.map((b) => Math.abs(b.growth ?? 0)), 1e-9)
  const hint: Record<Metric, string> = {
    occupancy: "الحاليون مقابل الطاقة التشغيلية · طول الشريط = الطاقة",
    withdrawalRate: "المنسحبون ÷ (الحاليون + المنسحبون)",
    current: "منتظم + مستجد",
    newcomers: "حالة «مستجد» في الفرع",
    growth: preliminary ? "عن عدد طلاب العام الماضي · أساس المقارنة مبدئي" : "عن عدد طلاب العام الماضي",
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHead
        title="مقارنة الفروع"
        hint={`${hint[metric]} · اضغط فرعًا لتصفية الصفحة`}
        actions={
          <div role="radiogroup" aria-label="المؤشر" className="flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-muted p-1 [scrollbar-width:none]">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn("h-8 shrink-0 rounded-[9px] px-3 text-[13px] transition-colors", metric === m.key ? "bg-card font-extrabold text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />
      <ul className="flex flex-1 flex-col justify-around gap-1">
        {list.map((b, i) => {
          const on = branch === b.name
          const dim = branch !== null && !on
          const flagged = notesFor(counts, b.name)
          let bar: ReactNode, value: ReactNode, sub: ReactNode = null
          if (metric === "occupancy") {
            const s = occupancyStatus(b.occupancy)
            bar = (
              <span className="block h-3.5 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border" style={{ width: `${(b.capacity / maxCap) * 100}%` }}>
                <span className={cn("grow-x block h-full rounded-full", TONE_BAR[s.tone])} style={{ width: `${Math.min(b.occupancy, 1) * 100}%`, animationDelay: `${i * 30}ms` }} />
              </span>
            )
            value = pct(b.occupancy)
            sub = `${formatNumber(b.current)} من ${formatNumber(b.capacity)}`
          } else if (metric === "growth") {
            const g = b.growth
            bar =
              g === null ? (
                <span className="text-[12px] text-muted-foreground">غير متاح</span>
              ) : (
                <span className="relative block h-3.5">
                  <span className="absolute inset-y-[-3px] start-1/2 w-px bg-border" />
                  <span
                    className={cn("grow-x absolute top-0 block h-full rounded-full", g >= 0 ? "bg-ok" : "bg-bad")}
                    style={{ width: `${(Math.abs(g) / maxGrowth) * 50}%`, ...(g >= 0 ? { insetInlineStart: "50%" } : { insetInlineEnd: "50%" }), transformOrigin: g >= 0 ? "right center" : "left center", animationDelay: `${i * 30}ms` }}
                  />
                </span>
              )
            value = <Ltr>{signedPct(g)}</Ltr>
            sub = b.previous !== null ? `العام الماضي ${formatNumber(b.previous)}` : null
          } else {
            const tone: Tone | null = metric === "withdrawalRate" ? withdrawalStatus(b.withdrawalRate).tone : null
            const w = b[metric] / maxOf(metric)
            bar = (
              <span className="block h-3.5 overflow-hidden rounded-full bg-muted">
                <span className={cn("grow-x block h-full rounded-full", tone ? TONE_BAR[tone] : metric === "current" ? "bg-primary" : "bg-gold")} style={{ width: `${w * 100}%`, animationDelay: `${i * 30}ms` }} />
              </span>
            )
            value = metric === "withdrawalRate" ? pct(b.withdrawalRate) : formatNumber(b[metric])
            sub = metric === "withdrawalRate" ? `${formatNumber(b.withdrawn)} طالبًا` : null
          }
          return (
            <li key={b.name}>
              <button
                type="button"
                onClick={() => onPick(b.name)}
                aria-pressed={on}
                className={cn(
                  "grid w-full grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-xl px-2 py-1.5 text-start transition-[background-color,opacity] hover:bg-muted/70 sm:grid-cols-[7rem_minmax(0,1fr)_8.5rem]",
                  on && "bg-secondary ring-1 ring-primary/25",
                  dim && "opacity-55",
                )}
              >
                <span className="flex min-w-0 items-center gap-1 text-[14px] font-bold">
                  <span className="truncate">{shortName(b.name)}</span>
                  {flagged.length > 0 && (
                    <span title={flagged.map((n) => `${n.title}: ${n.text}`).join("\n")} className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-warn-soft text-[11px] font-extrabold text-warn">!</span>
                  )}
                </span>
                <span className="min-w-0">{bar}</span>
                <span className="flex items-baseline justify-end gap-2">
                  <b className="num text-[14px]">{value}</b>
                  {sub && <span className="num hidden text-[12px] text-muted-foreground sm:inline">{sub}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {metric === "occupancy" && (
        <Keys items={[{ cls: "bg-ok", label: "مرتفع: 85% فأكثر" }, { cls: "bg-sky", label: "جيد: من 70% إلى 85%" }, { cls: "bg-warn", label: "منخفض: أقل من 70%" }, { cls: "bg-muted ring-1 ring-inset ring-border", label: "طول الشريط = الطاقة التشغيلية" }]} />
      )}
      {metric === "withdrawalRate" && <Keys items={[{ cls: "bg-ok", label: "جيد: حتى 8%" }, { cls: "bg-warn", label: "متابعة: من 8% إلى 12%" }, { cls: "bg-bad", label: "مرتفع: فوق 12%" }]} />}
    </Card>
  )
}

function Keys({ items }: { items: { cls: string; label: string }[] }) {
  return (
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
      {items.map((k) => (
        <span key={k.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-[3px]", k.cls)} />
          {k.label}
        </span>
      ))}
    </p>
  )
}

/* --------------------------------------------------------------- the matrix */
function Matrix({ counts, branch, onPick, className }: { counts: StudentCounts; branch: string | null; onPick: (n: string) => void; className?: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 760, H = 430, L = 50, R = 18, T = 22, B = 44
  const bs = counts.branches
  const x0 = Math.max(0, Math.floor((Math.min(...bs.map((b) => b.occupancy)) - 0.04) * 20) / 20)
  const x1 = Math.min(1, Math.ceil((Math.max(...bs.map((b) => b.occupancy)) + 0.03) * 20) / 20)
  const y1 = Math.ceil((Math.max(...bs.map((b) => b.withdrawalRate), WITHDRAWAL_LEVELS.follow) + 0.015) * 25) / 25
  const y0 = Math.max(0, Math.floor((Math.min(...bs.map((b) => b.withdrawalRate)) - 0.015) * 25) / 25)
  const X = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R)
  const Y = (v: number) => H - B - ((v - y0) / (y1 - y0)) * (H - T - B)
  const maxCur = Math.max(...bs.map((b) => b.current), 1)
  const radius = (b: StudentRow) => 8 + 17 * Math.sqrt(b.current / maxCur)
  const xs: number[] = []
  for (let v = Math.ceil(x0 * 10) / 10; v <= x1 + 1e-9; v += 0.1) xs.push(Math.round(v * 100) / 100)
  const ys: number[] = []
  for (let v = y0; v <= y1 + 1e-9; v += 0.04) ys.push(Math.round(v * 100) / 100)
  const labels = useMemo(() => placeLabels(bs.map((b) => ({ name: shortName(b.name), x: X(b.occupancy), y: Y(b.withdrawalRate), r: radius(b) }))), [counts]) // eslint-disable-line react-hooks/exhaustive-deps
  const hb = bs.find((b) => b.name === hover)
  const zone = (xa: number, xb: number, ya: number, yb: number, fill: string) => {
    const a = Math.max(xa, x0), b2 = Math.min(xb, x1), c = Math.max(ya, y0), d = Math.min(yb, y1)
    return a < b2 && c < d ? <rect x={X(a)} y={Y(d)} width={X(b2) - X(a)} height={Y(c) - Y(d)} fill={fill} /> : null
  }

  return (
    <Card className={className}>
      <CardHead title="مصفوفة الإشغال والانسحاب" hint="حجم الفقاعة = عدد الطلاب الحاليين · لون الفقاعة = حالة الانسحاب" />
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="relative min-w-[620px]">
          <span className="absolute start-0 top-0 text-[12px] text-muted-foreground">نسبة الانسحاب ↑</span>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ direction: "ltr" }} role="img" aria-label="مصفوفة الإشغال والانسحاب لكل فرع">
            {zone(x0, OCCUPANCY_LEVELS.good, WITHDRAWAL_LEVELS.follow, y1, "hsl(var(--bad-soft))")}
            {zone(OCCUPANCY_LEVELS.high, x1, y0, WITHDRAWAL_LEVELS.good, "hsl(var(--ok-soft))")}
            {xs.map((v) => (
              <g key={`x${v}`}>
                <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="hsl(var(--border))" />
                <text x={X(v)} y={H - B + 18} textAnchor="middle" fontSize={12} fill="hsl(var(--muted-foreground))">{Math.round(v * 100)}%</text>
              </g>
            ))}
            {ys.map((v) => (
              <g key={`y${v}`}>
                <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="hsl(var(--border))" />
                <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="hsl(var(--muted-foreground))">{Math.round(v * 100)}%</text>
              </g>
            ))}
            {OCCUPANCY_LEVELS.good > x0 && OCCUPANCY_LEVELS.good < x1 && <line x1={X(OCCUPANCY_LEVELS.good)} x2={X(OCCUPANCY_LEVELS.good)} y1={T} y2={H - B} stroke="hsl(var(--gold))" strokeWidth={1.5} strokeDasharray="5 4" />}
            {WITHDRAWAL_LEVELS.follow < y1 && <line x1={L} x2={W - R} y1={Y(WITHDRAWAL_LEVELS.follow)} y2={Y(WITHDRAWAL_LEVELS.follow)} stroke="hsl(var(--gold))" strokeWidth={1.5} strokeDasharray="5 4" />}
            <text x={X(x0) + 8} y={Y(y1) + 18} fontSize={13} fontWeight={800} fill="hsl(var(--bad))" textAnchor="start">يحتاج تدخلًا</text>
            <text x={X(x1) - 8} y={Y(y0) - 10} fontSize={13} fontWeight={800} fill="hsl(var(--ok))" textAnchor="end">مستقر</text>
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="hsl(var(--muted-foreground))">نسبة الإشغال</text>
            {[...bs].sort((a, b) => b.current - a.current).map((b) => {
              const on = branch === b.name, dim = branch !== null && !on
              const tone = withdrawalStatus(b.withdrawalRate).tone
              return (
                <circle
                  key={b.name}
                  cx={X(b.occupancy)}
                  cy={Y(b.withdrawalRate)}
                  r={radius(b)}
                  fill={TONE_FILL[tone]}
                  fillOpacity={dim ? 0.25 : 0.8}
                  stroke={on || hover === b.name ? "hsl(var(--foreground))" : "hsl(var(--card))"}
                  strokeWidth={on || hover === b.name ? 2.5 : 2}
                  tabIndex={0}
                  role="button"
                  aria-label={`${shortName(b.name)}: الإشغال ${pct(b.occupancy)}، الانسحاب ${pct(b.withdrawalRate)}`}
                  className="cursor-pointer outline-none transition-[fill-opacity]"
                  onMouseEnter={() => setHover(b.name)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(b.name)}
                  onBlur={() => setHover(null)}
                  onClick={() => onPick(b.name)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(b.name))}
                />
              )
            })}
            {labels.map((l) => (
              <text key={l.name} x={l.tx} y={l.ty} textAnchor={l.anchor} fontSize={13} fontWeight={700} fill="hsl(var(--foreground))" pointerEvents="none" opacity={branch !== null && shortName(branch) !== l.name ? 0.4 : 1}>
                {l.name}
              </text>
            ))}
          </svg>
          {hb && (
            <div
              className="pointer-events-none absolute z-10 flex flex-col gap-0.5 whitespace-nowrap rounded-xl bg-foreground px-3 py-2 text-[12px] text-background shadow-lg"
              style={{ left: `${(X(hb.occupancy) / W) * 100}%`, top: `${(Y(hb.withdrawalRate) / H) * 100}%`, transform: X(hb.occupancy) > W / 2 ? "translate(calc(-100% - 28px), -50%)" : "translate(28px, -50%)" }}
              dir="rtl"
            >
              <b className="text-[13.5px]">{shortName(hb.name)}</b>
              <span>الانسحاب {pct(hb.withdrawalRate)} · {formatNumber(hb.withdrawn)} طالبًا</span>
              <span>الإشغال {pct(hb.occupancy)} · {formatNumber(hb.current)} من {formatNumber(hb.capacity)}</span>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground md:hidden">اسحب أفقيًا لرؤية المصفوفة كاملة.</p>
    </Card>
  )
}

/** Puts each name next to its bubble where it overlaps the fewest other bubbles and names. */
function placeLabels(items: { name: string; x: number; y: number; r: number }[]) {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = []
  const hit = (a: { x0: number; y0: number; x1: number; y1: number }) => {
    let s = 0
    for (const b of boxes) s += Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
    for (const c of items) {
      const dx = Math.max(a.x0 - c.x, 0, c.x - a.x1), dy = Math.max(a.y0 - c.y, 0, c.y - a.y1)
      if (dx * dx + dy * dy < c.r * c.r) s += 400
    }
    return s
  }
  return [...items]
    .sort((a, b) => b.r - a.r)
    .map((it) => {
      const w = it.name.length * 7.4 + 4, h = 15
      const opts = [
        { tx: it.x, ty: it.y - it.r - 5, anchor: "middle" as const, box: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - it.r - 5 - h + 3, y1: it.y - it.r - 2 } },
        { tx: it.x, ty: it.y + it.r + 14, anchor: "middle" as const, box: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y + it.r + 2, y1: it.y + it.r + 17 } },
        { tx: it.x + it.r + 5, ty: it.y + 4, anchor: "start" as const, box: { x0: it.x + it.r + 3, x1: it.x + it.r + 5 + w, y0: it.y - h / 2, y1: it.y + h / 2 } },
        { tx: it.x - it.r - 5, ty: it.y + 4, anchor: "end" as const, box: { x0: it.x - it.r - 5 - w, x1: it.x - it.r - 3, y0: it.y - h / 2, y1: it.y + h / 2 } },
      ]
      let best = opts[0], score = Infinity
      for (const o of opts) {
        const s = hit(o.box)
        if (s < score - 1) (best = o), (score = s)
      }
      boxes.push(best.box)
      return { name: it.name, tx: best.tx, ty: best.ty, anchor: best.anchor }
    })
}

/* --------------------------------------------------------------- breakdowns */
function Breakdown({ title, names, values, total, colors }: { title: string; names: string[]; values: number[]; total: number; colors: string[] }) {
  if (!names.length || !values.length)
    return (
      <Card>
        <CardHead title={title} />
        <p className="text-[14px] text-muted-foreground">غير متاح في الملف المرفوع.</p>
      </Card>
    )
  const sum = values.reduce((a, b) => a + b, 0) || 1
  const r = 52, c = 2 * Math.PI * r
  let off = 0
  return (
    <Card className="flex-1">
      <CardHead title={title} hint="الطلاب الحاليون" />
      <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
        <div className="relative w-[150px] shrink-0">
          <svg viewBox="0 0 140 140" className="block w-full" role="img" aria-label={`${title}: ${names.map((n, i) => `${n} ${formatNumber(values[i] ?? 0)}`).join("، ")}`}>
            <circle r={r} cx={70} cy={70} fill="none" stroke="hsl(var(--muted))" strokeWidth={18} />
            {values.map((v, i) => {
              const len = (c * v) / sum
              const el = v > 0 ? <circle key={i} r={r} cx={70} cy={70} fill="none" stroke={colors[i % colors.length]} strokeWidth={18} strokeDasharray={`${Math.max(len - 2, 0.5)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"><title>{`${names[i]}: ${formatNumber(v)}`}</title></circle> : null
              off += len
              return el
            })}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <b className="num text-[19px] font-extrabold">{formatNumber(total)}</b>
            <span className="text-[11px] text-muted-foreground">طالب</span>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
          {names.map((n, i) => (
            <li key={n} className="grid grid-cols-[10px_minmax(0,1fr)_auto_3.2rem] items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colors[i % colors.length] }} />
              <span className="truncate">{n}</span>
              <b className="num">{formatNumber(values[i] ?? 0)}</b>
              <span className="num text-end text-[12px] text-muted-foreground">{pct((values[i] ?? 0) / sum)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function States({ row }: { row: StudentRow }) {
  const items = [
    { label: "منتظم", v: row.regular, cls: "bg-primary" },
    { label: "مستجد", v: row.newcomers, cls: "bg-gold" },
    { label: "منسحب فعلي", v: row.withdrawn, cls: "bg-bad" },
    { label: "محوّل إلى فرع آخر", v: row.transferred, cls: "bg-sky" },
    { label: "متخرج", v: row.graduated, cls: "bg-muted-foreground/45" },
  ].filter((x) => x.v !== null) as { label: string; v: number; cls: string }[]
  const max = Math.max(...items.map((x) => x.v), 1)
  return (
    <Card>
      <CardHead title="حالات الطلاب" hint="من تقرير البيانات الأساسية" />
      <ul className="flex flex-col gap-3">
        {items.map((x) => (
          <li key={x.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[13px]">
            <span>{x.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span className={cn("grow-x block h-full rounded-full", x.cls)} style={{ width: `${(x.v / max) * 100}%` }} />
            </span>
            <b className="num text-end">{formatNumber(x.v)}</b>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">الحاليون = منتظم + مستجد. المحوَّلون والمتخرجون خارج الانسحاب.</p>
    </Card>
  )
}

const ALERT_RE = /ملاحظة|تصحيح|خارج|مبدئي|افتراض/
function Alerts({ counts }: { counts: StudentCounts }) {
  const [open, setOpen] = useState(false)
  const list = counts.notes.filter((n) => ALERT_RE.test(n.title))
  if (!list.length) return null
  return (
    <Card className="flex-1">
      <CardHead title="ملاحظات الملف" hint="كما وردت في ورقة «التعريفات والملاحظات»" />
      <ul className="flex flex-col gap-2.5 text-[13px] leading-6">
        {list.map((n) => (
          <li key={n.title} className={cn("relative ps-3.5 before:absolute before:start-0 before:top-2.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gold", !open && "line-clamp-1")}>
            <b>{n.title}:</b> {n.text}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline">
        {open ? "إخفاء التفاصيل" : "عرض النص كاملًا"}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
    </Card>
  )
}

/* -------------------------------------------------------------------- table */
type SortKey = "name" | "current" | "newcomers" | "withdrawn" | "withdrawalRate" | "occupancy" | "capacity" | "growth"
const COLS: { key: SortKey; label: string }[] = [
  { key: "name", label: "الفرع" },
  { key: "current", label: "الحاليون" },
  { key: "newcomers", label: "الجدد" },
  { key: "withdrawn", label: "المنسحبون" },
  { key: "withdrawalRate", label: "نسبة الانسحاب" },
  { key: "occupancy", label: "نسبة الإشغال" },
  { key: "capacity", label: "الطاقة التشغيلية" },
  { key: "growth", label: "النمو" },
]

function Table({ counts, branch, onPick, preliminary }: { counts: StudentCounts; branch: string | null; onPick: (n: string) => void; preliminary: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "current", dir: -1 })
  const [q, setQ] = useState("")
  const rows = useMemo(() => {
    const t = q.trim()
    const list = counts.branches.filter((b) => !t || b.name.includes(t))
    return list.sort((a, b) => {
      if (sort.key === "name") return sort.dir * shortName(a.name).localeCompare(shortName(b.name), "ar")
      return sort.dir * ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity))
    })
  }, [counts, sort, q])
  const t = counts.total
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="text-[18px] font-extrabold">كل الفروع</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">اضغط عنوان أي عمود للترتيب · {formatNumber(counts.branches.length)} فرعًا في تقرير النظام</p>
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">ابحث عن فرع</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فرع" className="h-10 w-full rounded-xl border border-input bg-card pe-3 ps-9 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[14px]">
          <caption className="sr-only">مؤشرات أعداد الطلاب لكل فرع</caption>
          <thead>
            <tr className="border-y bg-muted/50 text-[12.5px] text-muted-foreground">
              {COLS.map((c) => {
                const active = sort.key === c.key
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className="px-3 py-2 text-start font-bold first:ps-5">
                    <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === "name" ? 1 : -1 }))} className={cn("inline-flex items-center gap-1 rounded px-1 py-1 hover:text-foreground", active && "text-foreground")}>
                      {c.label}
                      {c.key === "growth" && preliminary && <span className="rounded-full bg-gold-soft px-1.5 text-[10.5px] font-bold text-gold-ink">مبدئية</span>}
                      {active ? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sort.dir === 1 && "rotate-180")} aria-hidden="true" /> : <ArrowDownUp className="h-3 w-3 opacity-40" aria-hidden="true" />}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const ws = withdrawalStatus(b.withdrawalRate), os = occupancyStatus(b.occupancy)
              const on = branch === b.name
              const flagged = notesFor(counts, b.name)
              return (
                <tr key={b.name} onClick={() => onPick(b.name)} className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60", on && "bg-secondary")}>
                  <th scope="row" className="px-3 py-2.5 ps-5 text-start font-bold">
                    <button type="button" onClick={(e) => (e.stopPropagation(), onPick(b.name))} aria-pressed={on} className="inline-flex items-center gap-1 rounded hover:underline">
                      {shortName(b.name)}
                      {flagged.length > 0 && <span title={flagged.map((n) => n.text).join("\n")} className="grid h-4 w-4 place-items-center rounded-full bg-warn-soft text-[11px] font-extrabold text-warn">!</span>}
                    </button>
                  </th>
                  <td className="num px-3 py-2.5">{formatNumber(b.current)}</td>
                  <td className="num px-3 py-2.5">{formatNumber(b.newcomers)}</td>
                  <td className="num px-3 py-2.5">{formatNumber(b.withdrawn)}</td>
                  <td className="px-3 py-2.5">
                    <span className="num inline-block min-w-[3.2rem] font-bold">{pct(b.withdrawalRate)}</span>
                    <Chip tone={ws.tone}>{ws.label}</Chip>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="me-2 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-muted align-middle">
                      <span className={cn("block h-full", TONE_BAR[os.tone])} style={{ width: `${Math.min(b.occupancy, 1) * 100}%` }} />
                    </span>
                    <span className="num inline-block min-w-[3.2rem] font-bold">{pct(b.occupancy)}</span>
                    <Chip tone={os.tone}>{os.label}</Chip>
                  </td>
                  <td className="num px-3 py-2.5">{formatNumber(b.capacity)}</td>
                  <td className={cn("num px-3 py-2.5 font-bold", b.growth === null ? "text-muted-foreground" : b.growth >= 0 ? "text-ok" : "text-bad")}>
                    <Ltr>{signedPct(b.growth)}</Ltr>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={COLS.length} className="px-5 py-6 text-center text-muted-foreground">لا يوجد فرع بهذا الاسم.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-extrabold">
              <th scope="row" className="px-3 py-3 ps-5 text-start">الإجمالي</th>
              <td className="num px-3 py-3">{formatNumber(t.current)}</td>
              <td className="num px-3 py-3">{formatNumber(t.newcomers)}</td>
              <td className="num px-3 py-3">{formatNumber(t.withdrawn)}</td>
              <td className="num px-3 py-3">{pct(t.withdrawalRate)}</td>
              <td className="num px-3 py-3">{pct(t.occupancy)}</td>
              <td className="num px-3 py-3">{formatNumber(t.capacity)}</td>
              <td className={cn("num px-3 py-3", (t.growth ?? 0) >= 0 ? "text-ok" : "text-bad")}><Ltr>{signedPct(t.growth)}</Ltr></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

function Definitions({ counts }: { counts: StudentCounts }) {
  if (!counts.notes.length) return null
  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 text-[16px] font-bold">
          <Info className="h-4 w-4 text-primary" aria-hidden="true" />
          التعريفات والملاحظات كاملة
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t px-5 py-4 text-[14px] leading-7 md:grid-cols-2">
        {counts.notes.map((n) => (
          <div key={n.title}>
            <dt className="font-bold">{n.title}</dt>
            <dd className="text-muted-foreground">{n.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export function BranchChip({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-primary ps-3 pe-1 text-[14px] font-bold text-primary-foreground">
      {shortName(name)}
      <button type="button" onClick={onClear} aria-label="عرض كل الفروع" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  )
}
