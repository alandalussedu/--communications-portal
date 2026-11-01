import { useState, type ReactNode } from "react"
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CellValue } from "@/data/types"

/* ------------------------------------------------------------ brand marks */
/** The eight-point star from the identity guide, drawn as an outline. */
export function Octagram({ className, strokeWidth = 1.2 }: { className?: string; strokeWidth?: number }) {
  const pts: string[] = []
  const R = 50
  const r = R * 0.7654
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 - 90) * Math.PI) / 180
    const rad = i % 2 === 0 ? R : r
    pts.push(`${(60 + rad * Math.cos(a)).toFixed(2)},${(60 + rad * Math.sin(a)).toFixed(2)}`)
  }
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" fill="none">
      <polygon points={pts.join(" ")} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  )
}

/** The gold double chevron that sits beside the star in the identity guide. */
export function Chevrons({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} aria-hidden="true">
      <path d="M2 9 L12 2 L22 9 Z" fill="currentColor" />
      <path d="M2 18 L12 11 L22 18 Z" fill="currentColor" />
    </svg>
  )
}

/* ------------------------------------------------------------ panels */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border bg-card", className)}>{children}</section>
}

export function PanelHeader({
  title,
  hint,
  actions,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[20px] font-bold leading-snug">{title}</h2>
        {hint && <p className="mt-0.5 text-[15px] text-muted-foreground">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[30px] font-bold leading-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 text-[17px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ status */
export type Tone = "ok" | "warn" | "bad" | "neutral" | "brand" | "gold" | "sky"

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-secondary text-secondary-foreground",
  gold: "bg-gold-soft text-gold-ink",
  sky: "bg-sky-soft text-sky-ink",
}

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[14px] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone }: { tone: Tone }) {
  const c: Record<Tone, string> = {
    ok: "bg-ok",
    warn: "bg-warn",
    bad: "bg-bad",
    neutral: "bg-muted-foreground/50",
    brand: "bg-primary",
    gold: "bg-gold",
    sky: "bg-sky",
  }
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c[tone])} aria-hidden="true" />
}

/* ------------------------------------------------------------ values */
/** A sheet cell as it was recorded. Empty cells read "لم تُدخل" in muted text. */
export function Val({ v, empty = "لم تُدخل", className }: { v: CellValue | undefined; empty?: string; className?: string }) {
  if (!v || !v.raw) return <span className={cn("text-[15px] text-muted-foreground/80", className)}>{empty}</span>
  return <span className={cn("num font-medium", className)} dir="ltr">{v.raw}</span>
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[17px]">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------ states */
export function EmptyState({
  title,
  body,
  action,
  compact,
}: {
  title: string
  body?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14")}>
      <Octagram className="h-10 w-10 text-sky/70" />
      <p className="mt-3 font-display text-[19px] font-bold">{title}</p>
      {body && <div className="mt-1 max-w-md text-[16px] text-muted-foreground">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingBlock({ rows = 4, label = "جارٍ تحميل البيانات…" }: { rows?: number; label?: string }) {
  return (
    <div className="p-5" role="status" aria-live="polite">
      <div className="mb-4 flex items-center gap-2 text-[15px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-muted" style={{ width: `${92 - i * 9}%` }} />
        ))}
      </div>
    </div>
  )
}

export function Banner({
  tone = "warn",
  title,
  children,
  action,
}: {
  tone?: "warn" | "bad" | "sky"
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const cls = tone === "bad" ? "bg-bad-soft text-bad" : tone === "sky" ? "bg-sky-soft text-sky-ink" : "bg-warn-soft text-warn"
  return (
    <div className={cn("flex flex-wrap items-start gap-3 rounded-lg px-4 py-3", cls)} role={tone === "bad" ? "alert" : "status"}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium">{title}</p>
        {children && <div className="mt-0.5 text-[15px] text-foreground/80">{children}</div>}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------ links */
export function OpenLink({
  href,
  children,
  variant = "outline",
  size = "md",
  className,
}: {
  href: string | null
  children: ReactNode
  variant?: "solid" | "outline" | "ghost"
  size?: "sm" | "md"
  className?: string
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-2"
  const sizes = size === "sm" ? "h-8 px-2.5 text-[15px]" : "h-9 px-3.5 text-[16px]"
  const variants = {
    solid: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-card hover:bg-accent text-foreground",
    ghost: "text-primary hover:bg-accent",
  }
  if (!href)
    return (
      <span className={cn(base, sizes, "cursor-not-allowed border border-dashed text-muted-foreground", className)}>
        {children}
      </span>
    )
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(base, sizes, variants[variant], className)}>
      {children}
      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
    </a>
  )
}

export function CopyButton({ text, label = "نسخ الرابط" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle")
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState("done")
        } catch {
          setState("failed")
        }
        setTimeout(() => setState("idle"), 1800)
      }}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[15px] text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label={label}
      title={state === "failed" ? "تعذّر النسخ. حدّد الرابط وانسخه يدويًا." : label}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{state === "done" ? "نُسخ" : state === "failed" ? "تعذّر النسخ" : "نسخ"}</span>
    </button>
  )
}

/* ------------------------------------------------------------ filters */
export function SearchField({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-card pe-9 ps-9 text-[16px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label="مسح البحث"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      <span className="me-1 text-[14px] text-muted-foreground">{label}</span>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[15px] transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className={cn("num text-[14px]", on ? "opacity-80" : "text-muted-foreground")}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[14px] text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 rounded-md border border-input bg-card px-2.5 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
