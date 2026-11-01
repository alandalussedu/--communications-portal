import type { Branch, BranchLink, IndicatorKey } from "./types"

export const INDICATORS: { key: IndicatorKey; title: string; short: string; code: string }[] = [
  { key: "satisfaction", title: "معامل رضا العملاء", short: "رضا العملاء", code: "B.Br 1.1" },
  { key: "communication", title: "معامل جودة التواصل", short: "جودة التواصل", code: "A.Br 1.2" },
]

export const indicatorTitle = (k: IndicatorKey) => INDICATORS.find((i) => i.key === k)!.title
export const indicatorShort = (k: IndicatorKey) => INDICATORS.find((i) => i.key === k)!.short

const SHEET_ID = /\/spreadsheets\/d\/([\w-]+)/
const RANGE = /range=(\d+):(\d+)/

export function isSheetUrl(url: string): boolean {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(url.trim())
}

export function isDriveUrl(url: string): boolean {
  return /^https:\/\/(drive|docs)\.google\.com\//.test(url.trim())
}

/** Same rule the import used: Abha's file has satisfaction near row 11 and
 * communication quality near row 783, so a range on the other side is flagged. */
export function linkFlag(ind: IndicatorKey, range: [number, number] | null | undefined): string | null {
  if (!range) return null
  if (ind === "satisfaction" && range[0] > 500)
    return `الرابط مسجّل تحت معامل رضا العملاء لكنه يفتح عند الصفوف ${range[0]}–${range[1]}، وهي في ملف أبها موضع معامل جودة التواصل. راجعوه في سجل الروابط.`
  if (ind === "communication" && range[0] < 100)
    return `الرابط مسجّل تحت معامل جودة التواصل لكنه يفتح عند الصفوف ${range[0]}–${range[1]}، وهي في ملف أبها موضع معامل رضا العملاء. راجعوه في سجل الروابط.`
  return null
}

export function buildLink(ind: IndicatorKey, url: string | null, previous: BranchLink): BranchLink {
  if (!url) return { recorded: null, chipTitle: previous.chipTitle ?? null, fileId: null, range: null, flag: null }
  const id = url.match(SHEET_ID)?.[1] ?? null
  const r = url.match(RANGE)
  const range: [number, number] | null = r ? [Number(r[1]), Number(r[2])] : null
  return { recorded: url.trim(), chipTitle: previous.chipTitle ?? null, fileId: id, range, flag: linkFlag(ind, range) }
}

export type LinkState = "direct" | "flagged" | "file-only" | "missing"

/** What happens when someone presses the indicator's button for this branch. */
export function resolveLink(b: Branch, ind: IndicatorKey): { state: LinkState; url: string | null; note: string | null } {
  const l = b.links[ind]
  if (l?.recorded) return { state: l.flag ? "flagged" : "direct", url: l.recorded, note: l.flag ?? null }
  if (b.fileUrl)
    return {
      state: "file-only",
      url: b.fileUrl,
      note: "الرابط المباشر لهذا المعامل غير ظاهر في سجل الروابط، فالزر يفتح ملف الفرع من أوله.",
    }
  return {
    state: "missing",
    url: null,
    note: l?.chipTitle
      ? `السجل يذكر الملف «${l.chipTitle}» لكن رابطه لم يظهر في النسخة المستلمة.`
      : "لا يوجد رابط مسجّل لهذا المعامل.",
  }
}

export const LINK_STATE_LABEL: Record<LinkState, string> = {
  direct: "رابط مباشر",
  flagged: "يحتاج مراجعة",
  "file-only": "ملف الفرع فقط",
  missing: "بانتظار الرابط",
}
