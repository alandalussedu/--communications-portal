import type { Branch, SocialAccount, SocialReading } from "./types"
import type { Tone } from "@/components/common"

export const PLATFORMS: { key: string; label: string; short: string; tone: Tone; whatsapp?: boolean }[] = [
  { key: "x", label: "إكس (تويتر)", short: "X", tone: "neutral" },
  { key: "instagram", label: "إنستقرام", short: "IG", tone: "bad" },
  { key: "tiktok", label: "تيك توك", short: "TT", tone: "neutral" },
  { key: "snapchat", label: "سناب شات", short: "SC", tone: "gold" },
  { key: "youtube", label: "يوتيوب", short: "YT", tone: "bad" },
  { key: "linkedin", label: "لينكدإن", short: "in", tone: "sky" },
  { key: "facebook", label: "فيسبوك", short: "FB", tone: "brand" },
  { key: "whatsapp", label: "واتساب", short: "WA", tone: "ok", whatsapp: true },
  { key: "other", label: "منصة أخرى", short: "•", tone: "neutral" },
]
export const platformOf = (k: string) => PLATFORMS.find((p) => p.key === k) ?? PLATFORMS[PLATFORMS.length - 1]
export const isWhatsApp = (a: SocialAccount) => !!platformOf(a.platform).whatsapp

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
/** "2026-10" → "أكتوبر 2026" */
export function monthLabel(m: string, withYear = true) {
  const [y, mo] = m.split("-").map(Number)
  return withYear ? `${MONTHS[mo - 1]} ${y}` : MONTHS[mo - 1]
}
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}
export function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(y, mo - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Accounts grouped by their name (the school or company they speak for), in the order first seen. */
export function groupByName<T extends { a: SocialAccount }>(rows: T[]) {
  const out: { name: string; rows: T[] }[] = []
  for (const r of rows) {
    const g = out.find((x) => x.name === r.a.name)
    if (g) g.rows.push(r)
    else out.push({ name: r.a.name, rows: [r] })
  }
  return out
}

/** Branch names usable in the open tabs: the full records when open, else the public name list in settings. */
export function publicBranches(data: { branches: Branch[]; settings: { branchNames?: { slug: string; name: string; order: number }[] } | null }): { slug: string; name: string }[] {
  if (data.branches.length) return data.branches
  return [...(data.settings?.branchNames ?? [])].sort((a, b) => a.order - b.order)
}

export function ownerLabel(owner: string, branches: { slug: string; name: string }[]) {
  if (owner === "company") return "حساب الشركة"
  const b = branches.find((x) => x.slug === owner)
  return b ? `فرع ${b.name}` : owner
}

export type Index = Map<string, Map<string, number>>
/** account → month → followers */
export function indexReadings(readings: SocialReading[]): Index {
  const m: Index = new Map()
  for (const r of readings) {
    if (!m.has(r.account)) m.set(r.account, new Map())
    m.get(r.account)!.set(r.month, r.followers)
  }
  return m
}

/** Months that have at least one reading, newest first. */
export function recordedMonths(readings: SocialReading[]) {
  return Array.from(new Set(readings.map((r) => r.month))).sort().reverse()
}

export type AccountMonth = {
  followers: number | null
  previous: number | null
  /** followers − previous month's followers; null unless both months were recorded. */
  growth: number | null
}
export function accountMonth(idx: Index, account: string, month: string): AccountMonth {
  const a = idx.get(account)
  const followers = a?.get(month) ?? null
  const previous = a?.get(shiftMonth(month, -1)) ?? null
  return { followers, previous, growth: followers !== null && previous !== null ? followers - previous : null }
}

/** The last n months ending at `month`, oldest first, with null where nothing was recorded. */
export function history(idx: Index, account: string, month: string, n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const m = shiftMonth(month, i - (n - 1))
    return { month: m, followers: idx.get(account)?.get(m) ?? null }
  })
}

export function signed(n: number, fmt: (x: number) => string) {
  return n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : fmt(0)
}
