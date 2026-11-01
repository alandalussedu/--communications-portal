import type { Competitor, CompetitorProximity } from "./types"

/** The sheet's own columns that carry study data (name and owner are identity, not data). */
export const DATA_KEYS = [
  "branches", "founded", "kind", "fees", "proximity", "offers", "strengths", "weaknesses", "students", "classSize", "facilities", "stages", "gender",
  "tracks", "rankings", "accreditations", "staff", "pd", "social", "website", "enrichment", "platform", "digital", "growth", "marketing",
] as const

export const PROX_LABEL: Record<CompetitorProximity, string> = { near: "قريبة", mid: "نوعًا ما قريبة", far: "بعيدة", closed: "مغلقة مؤقتًا" }
export const PROX_ORDER: CompetitorProximity[] = ["near", "mid", "far", "closed"]

const nf = new Intl.NumberFormat("en-US")
export const sar = (n: number) => nf.format(n)

/** Fee range exactly as the numbers were read out of the sheet text; null when the text had none. */
export function feeRange(c: Competitor): string | null {
  if (c.feesMin == null || c.feesMax == null) return null
  return c.feesMin === c.feesMax ? sar(c.feesMin) : `من ${sar(c.feesMin)} إلى ${sar(c.feesMax)}`
}

export function completeness(c: Competitor) {
  const total = DATA_KEYS.length
  const filled = DATA_KEYS.filter((k) => !!c[k]).length
  return { filled, total, pct: Math.round((filled / total) * 100) }
}

export type Tally = { label: string; names: string[] }
export function tally(list: Competitor[], pick: (c: Competitor) => string[]): Tally[] {
  const m = new Map<string, string[]>()
  for (const c of list) for (const t of new Set(pick(c))) m.set(t, [...(m.get(t) ?? []), c.name])
  return [...m.entries()].map(([label, names]) => ({ label, names })).sort((a, b) => b.names.length - a.names.length || a.label.localeCompare(b.label, "ar"))
}

export function study(all: Competitor[]) {
  const baseline = all.find((c) => c.baseline) ?? null
  const rivals = all.filter((c) => !c.baseline && !c.suggested)
  const suggested = all.filter((c) => c.suggested)
  const priced = rivals.filter((c) => c.feesMin != null && c.feesMax != null)
  const lowest = priced.reduce<Competitor | null>((m, c) => (!m || c.feesMin! < m.feesMin! ? c : m), null)
  const highest = priced.reduce<Competitor | null>((m, c) => (!m || c.feesMax! > m.feesMax! ? c : m), null)
  const byProx = Object.fromEntries(PROX_ORDER.map((k) => [k, rivals.filter((c) => c.proxKey === k)])) as Record<CompetitorProximity, Competitor[]>
  const noProx = rivals.filter((c) => !c.proxKey)
  const accred = tally(all.filter((c) => !c.suggested), (c) => c.accredTags)
  const curricula = tally(all.filter((c) => !c.suggested), (c) => c.curricula)
  const strengths = tally(rivals, (c) => c.strengthThemes)
  const weaknesses = tally(rivals, (c) => c.weaknessThemes)
  const social = tally(all.filter((c) => !c.suggested), (c) => c.socialTags)
  const offers = { yes: rivals.filter((c) => c.offers3 === "yes"), no: rivals.filter((c) => c.offers3 === "no"), unknown: rivals.filter((c) => !c.offers3) }
  return { baseline, rivals, suggested, priced, lowest, highest, byProx, noProx, accred, curricula, strengths, weaknesses, social, offers }
}
export type Study = ReturnType<typeof study>

/** Plain-language findings, each computed from the sheet and nothing else. */
export function findings(s: Study): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = []
  const names = (l: Competitor[]) => l.map((c) => c.name).join("، ")
  const { near, mid, far, closed } = s.byProx
  if (near.length || mid.length)
    out.push({
      title: "الأقرب إلى مدارس الأندلس",
      text: `${names(near)}${near.length ? " قريبة" : ""}${near.length && mid.length ? "، و" : ""}${mid.length ? `${names(mid)} نوعًا ما قريبة` : ""}. أما ${far.length} مدارس فبعيدة${closed.length ? `، و${names(closed)} مغلقة مؤقتًا` : ""}${s.noProx.length ? `، و${names(s.noProx)} لم يُحدَّد قربها في الملف` : ""}.`,
    })
  if (s.lowest && s.highest)
    out.push({
      title: "نطاق الرسوم",
      text: `من ${sar(s.lowest.feesMin!)} (أدنى حدّ، ${s.lowest.name}) إلى ${sar(s.highest.feesMax!)} (أعلى حدّ، ${s.highest.name}) بين ${s.priced.length} مدارس سُجّلت رسومها${s.rivals.length - s.priced.length ? `؛ ورسوم ${names(s.rivals.filter((c) => c.feesMin == null))} لم تُسجَّل` : ""}.${s.baseline && s.baseline.feesMin == null ? " ورسوم اليسر نفسها غير مُدخلة في الملف، فلا يمكن حساب الفرق عنها." : ""}`,
    })
  if (s.accred[0])
    out.push({ title: "الاعتماد الأكثر ذكرًا", text: `${s.accred[0].label} في ${s.accred[0].names.length} مدارس: ${s.accred[0].names.join("، ")}.` })
  if (s.curricula[0])
    out.push({ title: "المنهج الأكثر حضورًا", text: `${s.curricula[0].label} في ${s.curricula[0].names.length} مدارس من ${s.rivals.length + (s.baseline ? 1 : 0)} مدرسة مقروءة.` })
  if (s.weaknesses[0])
    out.push({ title: "نقطة الضعف الأكثر تكرارًا لدى المنافسين", text: `${s.weaknesses[0].label} (${s.weaknesses[0].names.length} مدارس): ${s.weaknesses[0].names.join("، ")}. هذا تصنيف لنصوص الملف، وبعضه من تقييمات أولياء الأمور.` })
  if (s.strengths[0])
    out.push({ title: "نقطة القوة الأكثر تكرارًا", text: `${s.strengths[0].label} (${s.strengths[0].names.length} مدارس): ${s.strengths[0].names.join("، ")}.` })
  if (s.offers.yes.length || s.offers.no.length)
    out.push({ title: "الخصومات", text: `${s.offers.yes.length} مدارس لديها عروض أو خصومات، و${s.offers.no.length} صرّح الملف بعدم وجودها${s.offers.unknown.length ? `، و${s.offers.unknown.length} لم تُسجَّل` : ""}.` })
  return out
}
