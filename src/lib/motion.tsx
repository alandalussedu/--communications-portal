/**
 * The portal's motion kit. Every movement is short, happens once, and says
 * something (where you are, what changed). With «reduce motion» on, each one
 * renders its final state at once.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/* ------------------------------------------------------------ sliding pill */
type Box = { x: number; y: number; w: number; h: number }
const ACTIVE = '[aria-current="page"],[aria-current="true"],[aria-selected="true"]'

/**
 * Measures the active item inside a row of tabs so one pill can slide to it.
 * The row must be `position: relative`; the pill sits behind the items.
 */
export function useSlidingPill<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    const measure = () => {
      const a = row.querySelector<HTMLElement>(ACTIVE)
      if (!a) return setBox(null)
      // offsets relative to the row, whatever wraps the item (li, etc.)
      const r = row.getBoundingClientRect(), b = a.getBoundingClientRect()
      setBox({ x: b.left - r.left + row.scrollLeft, y: b.top - r.top + row.scrollTop, w: b.width, h: b.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    row.querySelectorAll(ACTIVE).forEach((a) => ro.observe(a))
    document.fonts?.ready.then(measure).catch(() => {})
    // let the first position paint without sliding in from the corner
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => (ro.disconnect(), cancelAnimationFrame(t))
  }, [key])
  return { ref, box, ready }
}

export function Pill({ box, ready, className, style }: { box: Box | null; ready: boolean; className?: string; style?: CSSProperties }) {
  if (!box) return null
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute left-0 top-0 z-0", ready && "pill-move", className)}
      style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)`, ...style }}
    />
  )
}

/* ------------------------------------------------------------ numbers that count up once */
export function CountUp({ value, className, duration = 900 }: { value: number; className?: string; duration?: number }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  const from = useRef(0)
  useEffect(() => {
    if (reducedMotion()) return setShown(value)
    const start = performance.now(), a = from.current
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <span className={cn("num", className)} aria-label={formatNumber(value)}>
      <span aria-hidden="true">{formatNumber(shown)}</span>
    </span>
  )
}

/* ------------------------------------------------------------ the band's drifting stars */
/** A few outlined eight-point stars turning very slowly behind the header. Decorative only. */
export function LatticeCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext("2d")
    if (!c || !ctx) return
    let raf = 0, stars: { x: number; y: number; r: number; s: number }[] = []
    const still = reducedMotion()
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = c.getBoundingClientRect()
      c.width = r.width * dpr
      c.height = r.height * dpr
      const gap = 120 * dpr
      stars = Array.from({ length: Math.ceil(c.width / gap) }, (_, i) => ({
        x: (i + 0.5) * gap,
        y: c.height * (0.25 + (0.5 * ((i * 37) % 10)) / 10),
        r: (16 + ((i * 13) % 9) * 2) * dpr,
        s: (i % 2 ? 1 : -1) * 0.00005,
      }))
      ctx.lineWidth = dpr
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.strokeStyle = "rgba(255,255,255,0.09)"
      for (const s of stars) {
        ctx.beginPath()
        for (let i = 0; i < 16; i++) {
          const a = ((i * 22.5 - 90) * Math.PI) / 180 + t * s.s
          const r = i % 2 ? s.r * 0.7654 : s.r
          ctx[i ? "lineTo" : "moveTo"](s.x + r * Math.cos(a), s.y + r * Math.sin(a))
        }
        ctx.closePath()
        ctx.stroke()
      }
      if (!still && !document.hidden) raf = requestAnimationFrame(draw)
    }
    const resume = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(draw)
    }
    size()
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => (size(), resume()))
    ro.observe(c)
    document.addEventListener("visibilitychange", resume)
    return () => (cancelAnimationFrame(raf), ro.disconnect(), document.removeEventListener("visibilitychange", resume))
  }, [])
  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />
}

/** The eight-point star that draws its outline once (hero corner). */
export function DrawnStar({ className }: { className?: string }) {
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 - 90) * Math.PI) / 180, r = i % 2 ? 50 * 0.7654 : 50
    pts.push(`${(60 + r * Math.cos(a)).toFixed(2)},${(60 + r * Math.sin(a)).toFixed(2)}`)
  }
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" fill="none">
      <polygon points={pts.join(" ")} pathLength={1} className="star-draw" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" />
    </svg>
  )
}
