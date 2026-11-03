import type { ReactNode } from "react"
import { Check, Minus, Star, X } from "lucide-react"
import type { CsrInitiative } from "@/data/types"
import { STAGES, isCounted, stageOf } from "@/data/csr"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const fmt = (n: number) => formatNumber(n)
export const fmtDate = (d: string | null | undefined) => (d ? formatDate(d) : "—")

/** the stage chip of an initiative; `null` = nothing registered in this track */
export function StageChip({ i, className }: { i: CsrInitiative | null; className?: string }) {
  if (!i) return <span className={cn("inline-flex whitespace-nowrap rounded-full border border-dashed px-2.5 py-0.5 text-[13px] text-muted-foreground", className)}>لم تُسجّل</span>
  if (i.decision === "rejected") return <span className={cn("inline-flex whitespace-nowrap rounded-full bg-bad-soft px-2.5 py-0.5 text-[13px] font-medium text-bad", className)}>غير محتسبة</span>
  const s = stageOf(i)
  const cls = ["bg-muted text-muted-foreground", "bg-sky-soft text-sky-ink", "bg-secondary text-secondary-foreground", "bg-gold-soft text-gold-ink", "bg-ok-soft text-ok"][s]
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium", cls, className)}>{STAGES[s]}</span>
}

/** the five stages as steps */
export function Stepper({ i }: { i: CsrInitiative }) {
  const s = stageOf(i)
  const rejected = i.decision === "rejected"
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="مراحل المبادرة">
      {STAGES.map((label, k) => {
        const failed = k === 4 && rejected
        return (
          <li key={label} className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-current={k === s ? "step" : undefined}>
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold",
                failed ? "border-bad bg-bad-soft text-bad" : k <= s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {failed ? <X className="h-4 w-4" /> : k <= s ? <Check className="h-4 w-4" /> : <span className="num">{k + 1}</span>}
            </span>
            <span className={cn("text-[12px] leading-tight sm:text-[13px]", k === s ? "font-bold" : "text-muted-foreground")}>{failed ? "غير محتسبة" : label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function Tick({ ok, children, sub }: { ok: boolean | null; children: ReactNode; sub?: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok === null ? "bg-muted text-muted-foreground" : ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")} aria-label={ok === null ? "لا ينطبق" : ok ? "متحقق" : "غير متحقق"}>
        {ok === null ? <Minus className="h-3 w-3" /> : ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="min-w-0 text-[15px]">
        {children}
        {sub && <span className="block text-[13px] text-muted-foreground">{sub}</span>}
      </span>
    </li>
  )
}

export function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (n: number) => void; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-4 w-4" : "h-5 w-5"
  if (!onChange)
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={value ? `التقييم ${value} من 5` : "لم يُقيَّم"}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn(cls, n <= value ? "fill-gold text-gold" : "text-border")} aria-hidden="true" />
        ))}
      </span>
    )
  return (
    <span className="inline-flex items-center" role="radiogroup" aria-label="تقييم الشراكة">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} من 5`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="rounded p-1 hover:bg-accent"
        >
          <Star className={cn(cls, n <= value ? "fill-gold text-gold" : "text-border")} aria-hidden="true" />
        </button>
      ))}
    </span>
  )
}

/** a score as "x / of" with a thin bar */
export function ScoreCell({ v, of }: { v: number; of: number }) {
  return (
    <span className="inline-flex min-w-[64px] flex-col gap-1">
      <span className="num text-[14px]">
        <b className="font-bold">{fmt(v)}</b>
        <span className="text-muted-foreground">/{of}</span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (v / of) * 100)}%` }} />
      </span>
    </span>
  )
}

export function Kpi({ label, value, of, hint, tone }: { label: string; value: string; of?: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[14px] text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-[30px] font-extrabold leading-none", tone === "warn" && "text-warn")}>
        {value}
        {of && <span className="text-[16px] font-medium text-muted-foreground"> من {of}</span>}
      </p>
      {hint && <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const btn = {
  primary: "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
  outline: "inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-card px-4 text-[15px] hover:bg-accent disabled:opacity-50",
  small: "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border bg-card px-3 text-[14px] hover:bg-accent disabled:opacity-50",
  danger: "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-[15px] text-bad hover:bg-bad-soft disabled:opacity-50",
}

export const counted = (list: CsrInitiative[]) => list.filter(isCounted)
