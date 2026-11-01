import type { CellValue } from "@/data/types"

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
const timeFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  hour: "numeric",
  minute: "2-digit",
})
const numFmt = new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 2 })

/** "2026-10-20" → "20 أكتوبر 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "غير محدد"
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T12:00:00" : value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return dateFmt.format(d)
}

export function formatTime(d: Date): string {
  return timeFmt.format(d)
}

export function formatNumber(n: number): string {
  return numFmt.format(n)
}

/** A cell as the sheet shows it. Returns null when the cell is empty. */
export function cellText(v: CellValue): string | null {
  if (!v || !v.raw) return null
  return v.raw
}

/** Arabic count phrasing for the few nouns the platform uses. */
export function countLabel(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 0) return `لا ${many}`
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${formatNumber(n)} ${few}`
  return `${formatNumber(n)} ${many}`
}

export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query)
  if (!q) return true
  const hay = normalize(fields.filter(Boolean).join(" "))
  return q.split(" ").every((part) => hay.includes(part))
}
