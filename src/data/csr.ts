/**
 * Community responsibility: the rules of «دليل المسؤولية المجتمعية للفروع»,
 * with the decisions the platform owner took where the guide is silent:
 *  - counting an initiative is the management team's decision, once conditions 1–4 hold and it was executed;
 *  - documentation is proportional: 17.5 × (complete evidence items ÷ 5);
 *  - reach is proportional: 12.5 × (beneficiaries ÷ 200), capped at 12.5;
 *  - evidence later than two weeks is a warning only, never an automatic exclusion.
 * Nothing here invents a measure the guide does not name.
 */
import type { Branch, CsrEvidence, CsrInitiative, CsrPartner, CsrPartnerStage, CsrTrack } from "./types"
import { BRANCH_CITY } from "./csrMap"

export const CSR_YEAR = "2026/2027"

export const TRACKS: Record<CsrTrack, { label: string; short: string; line: string }> = {
  edu: { label: "المسار التعليمي", short: "تعليمي", line: "نقل المعرفة والمهارات من داخل المدرسة إلى المجتمع مجاناً." },
  val: { label: "المسار التربوي القيمي", short: "تربوي قيمي", line: "ترسيخ القيم والسلوك ودعم الأسرة والمجتمع تربوياً." },
}

/** «الشروط الخمسة» — wording from the guide */
export const CONDITIONS = [
  { key: "planned", label: "مخطط لها مسبقاً", detail: "موجودة في الخطة السنوية المعتمدة" },
  { key: "external", label: "تستهدف المجتمع الخارجي", detail: "المستفيد من خارج طلاب مدرستك ومنسوبيها" },
  { key: "track", label: "تنتمي لمسار", detail: "المسار التعليمي و التربوي القيمي" },
  { key: "free", label: "مجانية", detail: "لا رسوم على المستفيد إطلاقاً" },
  { key: "documented", label: "موثقة", detail: "الشواهد مرفوعة خلال أسبوعين" },
] as const

/** «الشواهد الخمسة لكل مبادرة» — wording from the guide */
export const EVIDENCES: { key: keyof CsrEvidence; label: string; detail: string }[] = [
  { key: "photos", label: "الصور", detail: "خمس صور على الأقل، واضحة، تُظهر الحضور والنشاط" },
  { key: "report", label: "تقرير موجز", detail: "صفحة واحدة: الهدف · الوصف · النتائج · التاريخ والمكان" },
  { key: "count", label: "عدد المستفيدين", detail: "الرقم الفعلي مع بيان كيف حصرته" },
  { key: "proof", label: "دليل الحصر", detail: "كشف حضور أو لقطة تسجيل أو قائمة مشاركين" },
  { key: "partner", label: "الشراكة", detail: "اسم الجهة ومذكرة التفاهم إن وُجدت" },
]

export const STAGES = ["مسجّلة", "خطة معتمدة", "منفذة", "موثقة", "محتسبة"] as const

export const PARTNER_STAGES: { key: CsrPartnerStage; label: string }[] = [
  { key: "opp", label: "فرصة شراكة" },
  { key: "contact", label: "تواصل وتفاوض" },
  { key: "mou", label: "مذكرة تفاهم" },
  { key: "deal", label: "اتفاقية معتمدة" },
]
export const PARTNER_ORGS = ["تعليمي", "خيري", "أهلي", "حكومي", "قطاع خاص", "ثقافي", "أخرى"]

export const CHARITY_RULE =
  "يُسمح للفرع بدمج العمل الخيري مع أحد مساري المسؤولية المجتمعية مرة واحدة فقط خلال العام الدراسي، على أن يُضاف إليه مكوّن واضح من المسار التعليمي أو المسار التربوي القيمي حتى يُحتسب كمبادرة. ويُشترط أن تُحتسب المبادرة الخيرية المدمجة ضمن مسار واحد فقط، بحسب المكوّن المضاف إليها، على أن تكون المبادرة الثانية المطلوبة للفرع مبادرة مستقلة من المسار الآخر."

/* ------------------------------------------------------------ helpers */
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const diffDays = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10)
const r2 = (n: number) => Math.round(n * 100) / 100
const num = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0)
export const cityOf = (slug: string) => BRANCH_CITY[slug] ?? "—"

export const blankInitiative = (branch = ""): CsrInitiative => {
  const now = new Date().toISOString()
  return {
    id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    year: CSR_YEAR, branch, track: "edu", name: "", audience: "", plannedDate: null,
    inPlan: false, external: false, free: false, planApproved: false, partnerName: "", charity: false,
    status: "planned", executedDate: null, beneficiaries: null, countMethod: "", students: null, staff: null, hours: null, cost: null,
    evidenceDate: null, evidenceLink: "", ev: { photos: false, report: false, count: false, proof: false, partner: false },
    decision: null, notes: "", createdAt: now, updatedAt: now,
  }
}
export const blankPartner = (): CsrPartner => {
  const now = new Date().toISOString()
  return { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: "", org: "تعليمي", branch: null, track: null, stage: "opp", quality: 0, approved: false, contact: "", note: "", createdAt: now, updatedAt: now }
}

/* ------------------------------------------------------------ the counting engine */
export const hasPartner = (i: CsrInitiative) => !!i.partnerName.trim()
/** each evidence item and whether it is complete (the partner item is complete when there is no partner) */
export const evidenceItems = (i: CsrInitiative) => EVIDENCES.map((e) => ({ ...e, done: e.key === "partner" && !hasPartner(i) ? true : !!i.ev[e.key] }))
export const evCount = (i: CsrInitiative) => (i.status === "done" ? evidenceItems(i).filter((e) => e.done).length : 0)

/** two weeks from execution: late when evidence came after it, or when it has passed with no evidence date */
export function lateness(i: CsrInitiative, now = todayIso()): { late: boolean; days: number | null; due: string | null } {
  if (i.status !== "done" || !i.executedDate) return { late: false, days: null, due: null }
  const due = addDays(i.executedDate, 14)
  if (i.evidenceDate) {
    const d = diffDays(i.evidenceDate, i.executedDate)
    return { late: d > 14, days: d, due }
  }
  return { late: diffDays(now, i.executedDate) > 14, days: null, due }
}

export function conditions(i: CsrInitiative): Record<(typeof CONDITIONS)[number]["key"], boolean> {
  return {
    planned: i.inPlan && i.planApproved,
    external: i.external,
    track: !!i.track,
    free: i.free,
    documented: i.status === "done" && evCount(i) === 5 && !!i.evidenceDate && !lateness(i).late,
  }
}

/** what still stops the management team from counting it (conditions 1–4 and execution; condition 5 only warns) */
export function blockers(i: CsrInitiative): string[] {
  const c = conditions(i), out: string[] = []
  if (!i.planApproved) out.push("الخطة لم تُعتمد من إدارة التواصل المؤسسي.")
  else if (!i.inPlan) out.push("الشرط الأول: تأكيد أن المبادرة ضمن الخطة السنوية المعتمدة.")
  if (!c.external) out.push("الشرط الثاني: تستهدف المجتمع الخارجي.")
  if (!c.free) out.push("الشرط الرابع: مجانية بالكامل.")
  if (i.status !== "done") out.push("لم تُنفّذ بعد — الاحتساب بعد التنفيذ.")
  return out
}
export const canCount = (i: CsrInitiative) => blockers(i).length === 0
export const isCounted = (i: CsrInitiative) => i.decision === "counted"

/** score of one initiative, out of 50 */
export function scoreOne(i: CsrInitiative) {
  const counted = isCounted(i)
  const compliance = counted ? 20 : 0
  const docs = counted ? r2(17.5 * (evCount(i) / 5)) : 0
  const access = counted ? r2(12.5 * Math.min(1, Math.max(0, num(i.beneficiaries) / 200))) : 0
  return { counted, compliance, docs, access, total: r2(compliance + docs + access) }
}

/** 0 مسجّلة · 1 خطة معتمدة · 2 منفذة · 3 موثقة · 4 محتسبة */
export function stageOf(i: CsrInitiative): number {
  if (isCounted(i)) return 4
  if (i.status === "done" && evCount(i) === 5 && i.evidenceDate) return 3
  if (i.status === "done") return 2
  if (i.planApproved) return 1
  return 0
}

/** a second counted «charity + component» initiative in the same branch and year */
export const charityConflict = (i: CsrInitiative, all: CsrInitiative[]) =>
  i.charity && all.some((x) => x.id !== i.id && x.branch === i.branch && x.year === i.year && x.charity && isCounted(x))

/** branch score out of 100: the best counted initiative of each track */
export function branchScore(slug: string, inits: CsrInitiative[]) {
  const mine = inits.filter((i) => i.branch === slug && isCounted(i))
  const best = (t: CsrTrack) => mine.filter((i) => i.track === t).sort((a, b) => scoreOne(b).total - scoreOne(a).total)[0] ?? null
  const picks = [best("edu"), best("val")].filter(Boolean) as CsrInitiative[]
  const s = picks.map(scoreOne)
  const sum = (k: "compliance" | "docs" | "access") => r2(s.reduce((a, x) => a + x[k], 0))
  return { edu: best("edu"), val: best("val"), compliance: sum("compliance"), docs: sum("docs"), access: sum("access"), total: r2(s.reduce((a, x) => a + x.total, 0)) }
}

/** the most advanced initiative of a track in a branch, for its status chip */
export function trackLead(slug: string, track: CsrTrack, inits: CsrInitiative[]) {
  return inits.filter((i) => i.branch === slug && i.track === track).sort((a, b) => stageOf(b) - stageOf(a))[0] ?? null
}

export function branchRows(branches: Branch[], inits: CsrInitiative[]) {
  return branches.map((b) => {
    const mine = inits.filter((i) => i.branch === b.slug)
    const done = mine.filter((i) => i.status === "done")
    const sc = branchScore(b.slug, inits)
    return {
      branch: b, city: cityOf(b.slug), score: sc,
      eduLead: trackLead(b.slug, "edu", inits), valLead: trackLead(b.slug, "val", inits),
      registered: mine.length, done: done.length, counted: mine.filter(isCounted).length,
      ben: done.reduce((a, i) => a + num(i.beneficiaries), 0),
      vol: done.reduce((a, i) => a + num(i.students) + num(i.staff), 0),
      hours: done.reduce((a, i) => a + num(i.hours), 0),
      cost: done.reduce((a, i) => a + num(i.cost), 0),
      late: done.filter((i) => lateness(i).late && i.decision === null).length,
    }
  })
}

/** the management summary: facts from the data only, no judgement the guide does not make */
export function managementSummary(branches: Branch[], inits: CsrInitiative[], fmt: (n: number) => string, dateLabel: string): string[] {
  const rows = branchRows(branches, inits)
  const done = inits.filter((i) => i.status === "done")
  const counted = inits.filter(isCounted)
  const top = [...rows].sort((a, b) => b.score.total - a.score.total)[0]
  const full = rows.filter((r) => r.score.edu && r.score.val).length
  const late = done.filter((i) => lateness(i).late && i.decision === null)
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const out = [
    `في العام الدراسي ${CSR_YEAR} بلغ عدد المبادرات المسجّلة ${fmt(inits.length)}، نُفّذ منها ${fmt(done.length)}، واحتُسبت ${fmt(counted.length)} وفق دليل المسؤولية المجتمعية للفروع.`,
  ]
  if (top && top.score.total > 0) out.push(`تصدّر فرع ${top.branch.name} بدرجة ${fmt(top.score.total)} من 100، وأكمل ${fmt(full)} من ${fmt(rows.length)} فرعًا المسارين بمبادرة محتسبة في كل مسار.`)
  else out.push(`لم تُحتسب أي مبادرة بعد، فلا ترتيب للفروع حتى الآن.`)
  out.push(
    `بلغ المستفيدون من خارج المدارس في المبادرات المنفذة ${fmt(sum((r) => r.ben))} مستفيدًا، بمشاركة ${fmt(sum((r) => r.vol))} متطوعًا من الطلاب والمنسوبين، وبإجمالي ${fmt(sum((r) => r.hours))} ساعة تطوعية، وتكلفة إجمالية ${fmt(sum((r) => r.cost))} ريال.`,
  )
  out.push(late.length ? `تجاوزت ${fmt(late.length)} مبادرة أسبوعين من التنفيذ دون شواهد مكتملة في موعدها، وتنتظر قرار الإدارة.` : `لا توجد مبادرات متأخرة في التوثيق تنتظر قرارًا.`)
  out.push(`أُعدّ هذا الملخص آليًا من بيانات البوابة بتاريخ ${dateLabel}.`)
  return out
}
