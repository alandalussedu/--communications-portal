import type { CalendarEvent, EventRepeat, EventType } from "./types"

/* ------------------------------------------------------------ event types */
export type TypeTone = { soft: string; ink: string }
export const EVENT_TYPES: { key: EventType; label: string; tone: TypeTone }[] = [
  { key: "branch-meeting", label: "لقاء فرع", tone: { soft: "--sky-soft", ink: "--sky-ink" } },
  { key: "indicator", label: "مؤشر مركزي مع فرع", tone: { soft: "--secondary", ink: "--primary" } },
  { key: "deadline", label: "تسليم وإغلاق", tone: { soft: "--bad-soft", ink: "--bad" } },
  { key: "campaign", label: "مناسبة ومبادرة وحملة", tone: { soft: "--gold-soft", ink: "--gold-ink" } },
  { key: "workshop", label: "ورشة ودورة", tone: { soft: "--ok-soft", ink: "--ok" } },
  { key: "holiday", label: "إجازة ويوم مهم", tone: { soft: "--warn-soft", ink: "--warn" } },
]
const TYPE_BY_KEY = new Map(EVENT_TYPES.map((t) => [t.key, t]))
export const typeOf = (k: string) => TYPE_BY_KEY.get(k as EventType) ?? EVENT_TYPES[0]

/** Inline colours for an event chip (the theme variables switch with dark mode). */
export function chipStyle(k: string) {
  const t = typeOf(k).tone
  return { background: `hsl(var(${t.soft}))`, color: `hsl(var(${t.ink}))`, borderInlineStart: `3px solid hsl(var(${t.ink}))` }
}
export const dotStyle = (k: string) => ({ background: `hsl(var(${typeOf(k).tone.ink}))` })

export const REPEAT_LABEL: Record<EventRepeat["every"], string> = { week: "أسبوعيًا", "2weeks": "كل أسبوعين", month: "شهريًا" }

/* ------------------------------------------------------------ plain dates */
const pad = (n: number) => String(n).padStart(2, "0")
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const split = (s: string) => s.split("-").map(Number) as [number, number, number]
const toUtc = (s: string) => {
  const [y, m, d] = split(s)
  return Date.UTC(y, m - 1, d)
}
const fromUtc = (t: number) => {
  const d = new Date(t)
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}
export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s))
export const addDays = (s: string, n: number) => fromUtc(toUtc(s) + n * 864e5)
export const diffDays = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 864e5)
export const weekday = (s: string) => new Date(toUtc(s)).getUTCDay()
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
export function todayYmd() {
  const d = new Date()
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/* ------------------------------------------------------------ months */
/** Month keys are "YYYY-MM". */
export const monthOf = (s: string) => s.slice(0, 7)
export function shiftMonthKey(key: string, n: number) {
  const [y, m] = key.split("-").map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}
/** The school year runs September to June; it is named by the year it starts in. */
export function schoolYearOf(key: string) {
  const [y, m] = key.split("-").map(Number)
  return m >= 9 ? y : y - 1
}
export const schoolMonths = (start: number) => [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map((m) => `${m >= 9 ? start : start + 1}-${pad(m)}`)

const monthFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "long", timeZone: "UTC" })
export function monthName(key: string) {
  const [y, m] = key.split("-").map(Number)
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)))
}
export const monthTitle = (key: string) => `${monthName(key)} ${key.slice(0, 4)}`

export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const dayFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" })
const dayYearFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
/** "الخميس 1 أكتوبر 2026" */
export const dayLabel = (s: string, withYear = true) => `${WEEKDAYS[weekday(s)]} ${(withYear ? dayYearFmt : dayFmt).format(new Date(toUtc(s)))}`
export const shortDay = (s: string) => dayFmt.format(new Date(toUtc(s)))

/** Weeks (Sunday first) covering a month, each a list of 7 dates. */
export function monthGrid(key: string): string[][] {
  const first = `${key}-01`
  const [y, m] = key.split("-").map(Number)
  const last = ymd(y, m, daysInMonth(y, m))
  let d = addDays(first, -weekday(first))
  const end = addDays(last, 6 - weekday(last))
  const weeks: string[][] = []
  while (d <= end) {
    const w: string[] = []
    for (let i = 0; i < 7; i++) {
      w.push(d)
      d = addDays(d, 1)
    }
    weeks.push(w)
  }
  return weeks
}

/** "16:30" → "4:30 م" */
export function timeLabel(t: string | null | undefined) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return null
  const [h, mi] = t.split(":").map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(mi)} ${h < 12 ? "ص" : "م"}`
}

/* ------------------------------------------------------------ occurrences */
export type Occurrence = { key: string; ev: CalendarEvent; start: string; end: string }

/** Every showing of the events that touches [from, to], repeats included. */
export function expand(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) {
    if (!isYmd(ev.start)) continue
    const span = isYmd(ev.end) && ev.end > ev.start ? diffDays(ev.start, ev.end) : 0
    const push = (s: string) => {
      const e = addDays(s, span)
      if (e >= from && s <= to) out.push({ key: `${ev.id}@${s}`, ev, start: s, end: e })
    }
    const r = ev.repeat
    if (!r || !isYmd(r.until) || r.until <= ev.start) {
      push(ev.start)
      continue
    }
    const stop = r.until < to ? r.until : to
    if (r.every === "month") {
      const [y, m, d] = split(ev.start)
      for (let k = 0; k < 120; k++) {
        const t = y * 12 + (m - 1) + k
        const yy = Math.floor(t / 12)
        const mm = (t % 12) + 1
        if (d > daysInMonth(yy, mm)) continue
        const s = ymd(yy, mm, d)
        if (s > stop) break
        push(s)
      }
    } else {
      const step = r.every === "2weeks" ? 14 : 7
      for (let s = ev.start, k = 0; s <= stop && k < 400; s = addDays(s, step), k++) push(s)
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || (a.ev.time ?? "99").localeCompare(b.ev.time ?? "99") || a.ev.title.localeCompare(b.ev.title, "ar"))
}

/** Occurrences by each date they cover (a three-day event appears on all three days). */
export function byDay(occ: Occurrence[]) {
  const map = new Map<string, Occurrence[]>()
  for (const o of occ) {
    for (let d = o.start, k = 0; d <= o.end && k < 120; d = addDays(d, 1), k++) {
      const list = map.get(d) ?? []
      list.push(o)
      map.set(d, list)
    }
  }
  return map
}

/** Wording for when an occurrence happens. */
export function whenLabel(o: { start: string; end: string; ev: CalendarEvent }) {
  const t = timeLabel(o.ev.time)
  if (o.end > o.start) return `من ${dayLabel(o.start, monthOf(o.start).slice(0, 4) !== o.end.slice(0, 4))} إلى ${dayLabel(o.end)}`
  return t ? `${dayLabel(o.start)} · ${t}` : dayLabel(o.start)
}

export function repeatLabel(r: EventRepeat | null | undefined) {
  if (!r || !isYmd(r.until)) return null
  return `يتكرر ${REPEAT_LABEL[r.every] ?? ""} حتى ${dayLabel(r.until)}`
}
