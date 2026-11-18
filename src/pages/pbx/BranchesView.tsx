import { Fragment, useMemo, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import type { PbxBranchReport, PbxDirectory, PbxOfficer, PbxReport } from "@/data/types"
import { monthLabel } from "@/data/social"
import { countLabel, formatDate, formatNumber } from "@/lib/format"
import { SMALL_SAMPLE, gradeOf, lastDayOf, pct, rate, type Grade } from "@/lib/pbx"
import { FOLLOW_MIN, branchView, type BranchGroup, type ExtRow, type Totals } from "@/lib/pbxBranches"
import { cn } from "@/lib/utils"
import { Banner, Panel, PanelHeader } from "@/components/common"

/**
 * «السنترال · الفروع»: every branch extension the unified line transferred calls to,
 * for editors and the owner. Branch and stage come from the extension's number, the
 * name and job title from «دليل التحويلات» (the officers list wins for officers).
 */

const GRADE: Record<Grade, { bar: string; chip: string }> = {
  good: { bar: "bg-ok", chip: "bg-ok text-white" },
  follow: { bar: "bg-warn", chip: "bg-warn text-white" },
  weak: { bar: "bg-bad", chip: "bg-bad text-white" },
  small: { bar: "bg-muted-foreground/35", chip: "bg-muted text-muted-foreground" },
  none: { bar: "", chip: "text-muted-foreground" },
}
const LIST = 8

export const callsWord = (n: number) => (n === 0 ? "لا مكالمات" : countLabel(n, "مكالمة واحدة", "مكالمتان", "مكالمات", "مكالمة"))
export const extsWord = (n: number) => countLabel(n, "تحويلة واحدة", "تحويلتان", "تحويلات", "تحويلة")
const branchesWord = (n: number) => countLabel(n, "فرع واحد", "فرعين", "فروع", "فرعًا")
const secondsWord = (n: number) => countLabel(n, "ثانية واحدة", "ثانيتين", "ثوانٍ", "ثانية")

export function RateChip({ t, className }: { t: Pick<Totals, "attempts" | "answered">; className?: string }) {
  const r = rate(t)
  if (r === null) return <span className="text-[13px] text-muted-foreground">—</span>
  return <span className={cn("num inline-block min-w-[3.6rem] rounded-full px-2 py-0.5 text-center text-[13px] font-bold", GRADE[gradeOf(t)].chip, className)}><bdi dir="ltr">{pct(r)}</bdi></span>
}

function Stat({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub: string; accent?: boolean }) {
  return (
    <li className="rise min-w-0 rounded-2xl border bg-card px-5 py-4">
      <p className="text-[14px] leading-snug text-muted-foreground">{label}</p>
      <p className={cn("num mt-1.5 text-[32px] font-extrabold leading-none", accent && "text-primary")}>
        {value}
        {unit && <span className="ms-1 text-[16px] font-bold text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{sub}</p>
    </li>
  )
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} aria-hidden="true" />
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-5 py-3 text-[13px] leading-snug text-muted-foreground">
      {item("bg-ok", "جيدة: 70% أو أكثر")}
      {item("bg-warn", "تحتاج متابعة: 50–70%")}
      {item("bg-bad", "ضعيفة: أقل من 50%")}
      {item("bg-muted-foreground/35", `أقل من ${SMALL_SAMPLE} مكالمات: لا تصلح للمقارنة`)}
    </div>
  )
}

function Ext({ n }: { n: string }) {
  return <span className="num me-1.5 inline-block rounded-md bg-muted px-1.5 text-[12px] font-bold leading-relaxed text-muted-foreground">{n}</span>
}
function OfficerTag() {
  return <span className="ms-1.5 inline-block whitespace-nowrap rounded-full bg-gold-soft px-2 text-[11px] font-bold leading-relaxed text-gold-ink">مسؤول التواصل</span>
}
/** the person on the extension, or why there is no name */
function who(r: ExtRow) {
  if (!r.inDir && !r.officer) return { name: "غير موجود في الدليل", missing: true }
  return { name: r.name ?? "بلا اسم في الدليل", missing: !r.name }
}

function Alert({ tone, title, hint, children }: { tone: "bad" | "warn" | "sky"; title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <Panel className={cn("border-s-4", tone === "bad" ? "border-s-bad" : tone === "warn" ? "border-s-warn" : "border-s-sky")}>
      <div className="px-5 pb-1 pt-4">
        <h3 className="text-[17px] font-bold leading-snug">{title}</h3>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      {children}
    </Panel>
  )
}

function More({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  if (total <= LIST) return null
  return (
    <button type="button" onClick={onToggle} className="w-full border-t px-5 py-2.5 text-start text-[13.5px] font-bold text-primary hover:bg-accent">
      {open ? "عرض أقل" : `عرض الكل (${formatNumber(total)})`}
    </button>
  )
}

/* ------------------------------------------------------------ the month */
export function BranchesView({ report, prev, directory, officers, officersReport }: { report: PbxBranchReport; prev: PbxBranchReport | null; directory: PbxDirectory | null; officers: PbxOfficer[]; officersReport: PbxReport | null }) {
  const v = useMemo(() => branchView(report, directory, officers), [report, directory, officers])
  const pv = useMemo(() => (prev ? branchView(prev, directory, officers) : null), [prev, directory, officers])
  const partial = report.from && report.to && (report.from > `${report.month}-01` || report.to < lastDayOf(report.month))
  const t = v.total

  return (
    <div className="flex flex-col gap-5">
      {partial && (
        <Banner tone="sky" title="التقرير لا يغطي الشهر كاملًا">
          يغطي الملف المرفوع من {formatDate(report.from!)} إلى {formatDate(report.to!)}. صدّر التقرير من أول الشهر إلى آخره ثم ارفعه من جديد ليحل محله.
        </Banner>
      )}
      {!directory && (
        <Banner tone="warn" title="دليل التحويلات لم يُنسخ بعد">
          الفروع والأقسام تظهر من أرقام التحويلات، لكن بلا أسماء ولا مسميات حتى يُنسخ الدليل.
        </Banner>
      )}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="نسبة الرد في الفروع" value={pct(rate(t))} sub={`رد على ${formatNumber(t.answered)} من ${formatNumber(t.attempts)} مكالمة محوّلة`} accent />
        <Stat label="المكالمات المحوّلة للفروع" value={formatNumber(t.attempts)} sub={`إلى ${extsWord(t.exts)} في ${branchesWord(t.branches)}`} />
        <Stat label="لم يُرد عليها" value={formatNumber(t.unanswered)} sub={`منها ${formatNumber(t.voicemail)} انتهت في البريد الصوتي`} />
        {t.ringMedian === null ? (
          <Stat label="سرعة الرد" value="—" sub="لا يحمل الملف مدة الرنين" />
        ) : (
          <Stat label="سرعة الرد" value={formatNumber(Math.round(t.ringMedian))} unit={Math.round(t.ringMedian) >= 3 && Math.round(t.ringMedian) <= 10 ? "ثوانٍ" : "ثانية"} sub={`نصف المكالمات المُجابة رُد عليها خلال ${secondsWord(Math.round(t.ringMedian))} أو أقل`} />
        )}
      </ul>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Ranking v={v} />
        <div className="flex min-w-0 flex-col gap-5">
          <Who v={v} />
          <Follow rows={v.follow} />
        </div>
      </div>

      <Details v={v} pv={pv} prevMonth={prev?.month ?? null} />

      {pv && <Compare v={v} pv={pv} month={report.month} prevMonth={prev!.month} />}

      {officersReport && officersReport.source !== report.source && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          تقرير «مسؤولو التواصل» لشهر {monthLabel(report.month)} {officersReport.source.startsWith("من ") ? officersReport.source : `من «${officersReport.source}»`}، وأرقام مسؤولي التواصل هنا من ملف 3CX، فقد تختلف قليلًا.
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        المكالمات = رد + لم يُرد على تحويلات الفرع، و«Waiting» مستبعدة{report.waitingExcluded > 0 ? ` (${formatNumber(report.waitingExcluded)})` : ""}. خارج التقرير: الرد الآلي والطوابير وموظفو خدمة العملاء في الخط الموحد. الفرع والقسم من نطاق رقم التحويلة، والاسم والمسمى من دليل التحويلات.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ ranking */
function Ranking({ v }: { v: ReturnType<typeof branchView> }) {
  return (
    <Panel>
      <PanelHeader title="ترتيب الفروع حسب نسبة الرد" hint="كل التحويلات داخل الفرع، من الأعلى استجابة إلى الأدنى." />
      <Legend />
      <ul className="divide-y">
        {v.branches.map((b, i) => {
          const r = rate(b), g = gradeOf(b)
          return (
            <li key={b.name} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold leading-snug">{b.name}</span>
                <span className="block truncate text-[12px] leading-snug text-muted-foreground">{b.attempts ? `${callsWord(b.attempts)} · ${extsWord(b.exts)}` : "لا تحويلات هذا الشهر"}</span>
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                {r !== null && <span className={cn("grow-x block h-full rounded-full", GRADE[g].bar)} style={{ width: `${Math.max(r, 2)}%`, animationDelay: `${Math.min(i, 12) * 40}ms` }} />}
              </span>
              <span className="flex min-w-[4.5rem] items-center justify-end gap-2 sm:min-w-[8.5rem]">
                {b.attempts ? (
                  <>
                    <span className="num hidden whitespace-nowrap text-[13px] text-muted-foreground sm:inline">{formatNumber(b.answered)} من {formatNumber(b.attempts)}</span>
                    <RateChip t={b} />
                  </>
                ) : (
                  <span className="text-[13px] text-muted-foreground">لم تُحوَّل له مكالمات</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------ officers vs the rest */
function Who({ v }: { v: ReturnType<typeof branchView> }) {
  const { off, oth, total } = v
  if (!total.attempts) return null
  const po = Math.round((off.attempts / total.attempts) * 100)
  const pt = 100 - po
  return (
    <Panel>
      <PanelHeader title="من استقبل المكالمات المحوّلة؟" hint="تحويلات مسؤولي التواصل كما في قائمة المنصة، مقابل بقية تحويلات الفروع." />
      <div className="px-5 pb-5 pt-4">
        <div className="flex h-5 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`مسؤولو التواصل ${po}% من المكالمات وبقية الموظفين ${pt}%`}>
          {po > 0 && <span className="h-full" style={{ width: `${po}%`, background: "var(--pbx-off)" }} />}
          {pt > 0 && <span className="h-full" style={{ width: `${pt}%`, background: "var(--pbx-oth)" }} />}
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] leading-snug text-muted-foreground">
          <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: "var(--pbx-off)" }} />مسؤولو التواصل <b className="num text-foreground">{formatNumber(off.attempts)}</b> · <b className="num text-foreground">{po}%</b></span>
          <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: "var(--pbx-oth)" }} />بقية الموظفين <b className="num text-foreground">{formatNumber(oth.attempts)}</b> · <b className="num text-foreground">{pt}%</b></span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Figure label="الرد عند مسؤولي التواصل" t={off} />
          <Figure label="الرد عند بقية الموظفين" t={oth} />
        </div>
        {off.attempts > 0 && oth.attempts > 0 && (
          <p className="mt-3 rounded-lg bg-sky-soft px-3 py-2.5 text-[14px] leading-relaxed">
            ذهبت <b className="num">{pt}%</b> من المكالمات المحوّلة إلى موظفين ليسوا مسؤولي تواصل، ونسبة الرد عندهم <b className="num"><bdi dir="ltr">{pct(rate(oth))}</bdi></b> مقابل <b className="num"><bdi dir="ltr">{pct(rate(off))}</bdi></b> عند مسؤولي التواصل.
          </p>
        )}
      </div>
    </Panel>
  )
}
function Figure({ label, t }: { label: string; t: Totals }) {
  const g = gradeOf(t)
  return (
    <div className="min-w-0 rounded-xl border px-3.5 py-3">
      <p className="text-[13px] leading-snug text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-[24px] font-extrabold leading-tight", g === "weak" ? "text-bad" : g === "follow" ? "text-warn" : g === "good" ? "text-ok" : "")}>
        <bdi dir="ltr">{pct(rate(t))}</bdi>
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">رد على {formatNumber(t.answered)} من {formatNumber(t.attempts)} · {extsWord(t.exts)}</p>
    </div>
  )
}

/* ------------------------------------------------------------ follow-up */
function Follow({ rows }: { rows: ExtRow[] }) {
  const [all, setAll] = useState(false)
  if (!rows.length) return null
  return (
    <Alert tone="bad" title="تحويلات تحتاج متابعة" hint={`${extsWord(rows.length)} لم يُرد فيها على ${FOLLOW_MIN} مكالمات أو أكثر هذا الشهر.`}>
      <ul className="mt-2 divide-y border-t">
        {(all ? rows : rows.slice(0, LIST)).map((r) => {
          const w = who(r)
          return (
            <li key={r.ext} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="min-w-0">
                <span className={cn("block truncate text-[14.5px] font-bold leading-snug", w.missing && "text-muted-foreground")}><Ext n={r.ext} />{w.name}{r.officer && <OfficerTag />}</span>
                <span className="block truncate text-[12px] leading-snug text-muted-foreground">{r.place.branch} · {r.place.section}{r.title ? ` · ${r.title}` : ""}</span>
              </span>
              <span className="num shrink-0 whitespace-nowrap text-[13.5px]"><b>{formatNumber(r.unanswered)}</b> بلا رد من {formatNumber(r.attempts)}</span>
            </li>
          )
        })}
      </ul>
      <More total={rows.length} open={all} onToggle={() => setAll((a) => !a)} />
    </Alert>
  )
}

/* ------------------------------------------------------------ the table, each branch opens to its extensions */
function Split({ t }: { t: Totals }) {
  if (!t.attempts) return <span className="text-muted-foreground">—</span>
  return (
    <span className="whitespace-nowrap">
      <span className="num">{formatNumber(t.answered)} من {formatNumber(t.attempts)}</span> <span className="num text-[12.5px] text-muted-foreground">· <bdi dir="ltr">{pct(rate(t))}</bdi></span>
    </span>
  )
}
function delta(b: BranchGroup, p: BranchGroup | undefined) {
  if (!p || b.attempts < SMALL_SAMPLE || p.attempts < SMALL_SAMPLE) return null
  return rate(b)! - rate(p)!
}
function Delta({ d }: { d: number | null }) {
  return (
    <span className={cn("num text-[14px] font-bold", d === null || Math.abs(d) < 0.05 ? "font-normal text-muted-foreground" : d > 0 ? "text-ok" : "text-bad")} dir="ltr">
      {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
    </span>
  )
}

function Details({ v, pv, prevMonth }: { v: ReturnType<typeof branchView>; pv: ReturnType<typeof branchView> | null; prevMonth: string | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const prevOf = (name: string) => pv?.branches.find((b) => b.name === name)
  const cols = ["المكالمات", "رد", "لم يُرد", "بريد صوتي", "نسبة الرد", "التحويلات", "مسؤول التواصل", "بقية الموظفين", ...(pv ? ["عن الشهر السابق"] : [])]
  const span = cols.length + 1
  return (
    <Panel>
      <PanelHeader title="تفاصيل الفروع" hint={`اضغط على أي فرع لعرض أقسامه وكل تحويلة فيه.${pv && prevMonth ? ` «عن الشهر السابق» هو الفرق عن ${monthLabel(prevMonth)} بالنقاط.` : ""}`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-[15px]">
          <caption className="sr-only">استجابة كل فرع وتحويلاته</caption>
          <thead>
            <tr className="border-b bg-muted/50 text-[14px] text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 text-start font-medium">الفرع</th>
              {cols.map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-end font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.branches.map((b) => {
              if (!b.attempts)
                return (
                  <tr key={b.name} className="border-b">
                    <th scope="row" className="px-3 py-2.5 text-start font-bold"><span className="ms-9">{b.name}</span></th>
                    <td colSpan={span - 1} className="px-3 py-2.5 text-[14px] text-muted-foreground">لم تُحوَّل للفرع مكالمات هذا الشهر</td>
                  </tr>
                )
              const isOpen = open === b.name
              return (
                <Fragment key={b.name}>
                  <tr className={cn("border-b", isOpen && "bg-accent")}>
                    <th scope="row" className="px-3 py-1.5 text-start">
                      <button type="button" onClick={() => setOpen(isOpen ? null : b.name)} aria-expanded={isOpen} className="inline-flex min-h-10 items-center gap-2 rounded-lg pe-2 text-start font-bold hover:text-primary">
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors", isOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                        </span>
                        {b.name}
                      </button>
                    </th>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(b.attempts)}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(b.answered)}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(b.unanswered)}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(b.voicemail)}</td>
                    <td className="px-3 py-2.5 text-end"><RateChip t={b} /></td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(b.exts)}</td>
                    <td className="px-3 py-2.5 text-end"><Split t={b.off} /></td>
                    <td className="px-3 py-2.5 text-end"><Split t={b.oth} /></td>
                    {pv && <td className="px-3 py-2.5 text-end"><Delta d={delta(b, prevOf(b.name))} /></td>}
                  </tr>
                  {isOpen && b.sections.map((s) => (
                    <Fragment key={s.label}>
                      <tr className="border-b bg-accent/50 text-[13.5px]">
                        <td className="py-2 pe-3 ps-12 text-start"><b>{s.label}</b>{s.range && <span className="num text-muted-foreground"> · {s.range}</span>}</td>
                        <td className="num px-3 py-2 text-end">{formatNumber(s.attempts)}</td>
                        <td className="num px-3 py-2 text-end">{formatNumber(s.answered)}</td>
                        <td className="num px-3 py-2 text-end">{formatNumber(s.unanswered)}</td>
                        <td className="num px-3 py-2 text-end">{formatNumber(s.voicemail)}</td>
                        <td className="px-3 py-2 text-end"><RateChip t={s} /></td>
                        <td className="num px-3 py-2 text-end">{formatNumber(s.exts)}</td>
                        <td colSpan={span - 7} />
                      </tr>
                      {s.rows.map((r) => {
                        const w = who(r)
                        return (
                          <tr key={r.ext} className={cn("border-b text-[14px]", r.unanswered >= FOLLOW_MIN ? "bg-bad-soft/60" : "bg-accent/25")}>
                            <td className="py-2 pe-3 ps-12 text-start">
                              <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                                <Ext n={r.ext} />
                                <b className={cn(w.missing && "font-medium text-muted-foreground")}>{w.name}</b>
                                {r.officer && <OfficerTag />}
                                {r.title && <span className="text-[12.5px] text-muted-foreground">{r.title}</span>}
                                {!r.inDir && r.label && <span className="text-[12.5px] text-muted-foreground">في السنترال: <bdi dir="ltr">{r.label}</bdi></span>}
                                {r.others.length > 0 && <span className="text-[12px] text-warn" title={`في الدليل أيضًا: ${r.others.join("، ")}`}>· في الدليل اسم آخر</span>}
                              </span>
                            </td>
                            <td className="num px-3 py-2 text-end">{formatNumber(r.attempts)}</td>
                            <td className="num px-3 py-2 text-end">{formatNumber(r.answered)}</td>
                            <td className="num px-3 py-2 text-end">{formatNumber(r.unanswered)}</td>
                            <td className="num px-3 py-2 text-end">{formatNumber(r.voicemail)}</td>
                            <td className="px-3 py-2 text-end"><RateChip t={r} /></td>
                            <td colSpan={span - 6} />
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-extrabold">
              <th scope="row" className="px-3 py-2.5 text-start"><span className="ms-9">كل الفروع</span></th>
              <td className="num px-3 py-2.5 text-end">{formatNumber(v.total.attempts)}</td>
              <td className="num px-3 py-2.5 text-end">{formatNumber(v.total.answered)}</td>
              <td className="num px-3 py-2.5 text-end">{formatNumber(v.total.unanswered)}</td>
              <td className="num px-3 py-2.5 text-end">{formatNumber(v.total.voicemail)}</td>
              <td className="px-3 py-2.5 text-end"><RateChip t={v.total} /></td>
              <td className="num px-3 py-2.5 text-end">{formatNumber(v.total.exts)}</td>
              <td className="px-3 py-2.5 text-end"><Split t={v.off} /></td>
              <td className="px-3 py-2.5 text-end"><Split t={v.oth} /></td>
              {pv && <td className="px-3 py-2.5 text-end"><Delta d={pv.total.attempts >= SMALL_SAMPLE && v.total.attempts >= SMALL_SAMPLE ? rate(v.total)! - rate(pv.total)! : null} /></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------ this month against the previous one */
function Compare({ v, pv, month, prevMonth }: { v: ReturnType<typeof branchView>; pv: ReturnType<typeof branchView>; month: string; prevMonth: string }) {
  const rows = v.branches
    .map((b) => {
      const p = pv.branches.find((x) => x.name === b.name)
      return { name: b.name, now: b.attempts >= SMALL_SAMPLE ? rate(b) : null, before: p && p.attempts >= SMALL_SAMPLE ? rate(p) : null }
    })
    .filter((r) => r.now !== null || r.before !== null)
  if (!rows.length) return null
  const ticks = [0, 50, 70, 100]
  return (
    <Panel>
      <PanelHeader title="نسبة الرد مقارنة بالشهر السابق" hint={`${monthLabel(prevMonth)} ← ${monthLabel(month)}. الفرع الذي فيه أقل من ${SMALL_SAMPLE} مكالمات في شهر لا يُرسم له ذلك الشهر.`} />
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pt-3 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: "var(--pbx-off)" }} aria-hidden="true" />{monthLabel(prevMonth)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: "var(--pbx-off)" }} aria-hidden="true" />{monthLabel(month)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-[1.5px] border-dashed border-muted-foreground/50" aria-hidden="true" />حدّا 50% و70%</span>
      </div>
      <ul className="px-5 pb-2 pt-2">
        {rows.map((r) => {
          const d = r.now !== null && r.before !== null ? r.now - r.before : null
          const lo = r.now !== null && r.before !== null ? Math.min(r.now, r.before) : null
          const hi = r.now !== null && r.before !== null ? Math.max(r.now, r.before) : null
          return (
            <li key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_10.5rem] sm:py-1">
              <span className="truncate text-[14px] font-bold">{r.name}</span>
              <span className="relative col-span-2 row-start-2 h-6 sm:col-span-1 sm:row-start-auto" aria-hidden="true">
                <span className="absolute inset-x-0 top-[11px] h-0.5 rounded bg-muted" />
                {[50, 70].map((x) => <span key={x} className="absolute bottom-0 top-0 border-s-[1.5px] border-dashed border-muted-foreground/30" style={{ insetInlineStart: `${x}%` }} />)}
                {lo !== null && hi !== null && <span className="absolute top-[11px] h-0.5 bg-muted-foreground/45" style={{ insetInlineStart: `${lo}%`, width: `${hi - lo}%` }} />}
                {r.before !== null && <span className="absolute top-[5px] h-3.5 w-3.5 rounded-full border-2 bg-card shadow-[0_0_0_2px_hsl(var(--card))] rtl:translate-x-1/2 ltr:-translate-x-1/2" style={{ insetInlineStart: `${r.before}%`, borderColor: "var(--pbx-off)" }} />}
                {r.now !== null && <span className="absolute top-[5px] h-3.5 w-3.5 rounded-full shadow-[0_0_0_2px_hsl(var(--card))] rtl:translate-x-1/2 ltr:-translate-x-1/2" style={{ insetInlineStart: `${r.now}%`, background: "var(--pbx-off)" }} />}
              </span>
              <span className="num whitespace-nowrap text-end text-[13px] text-muted-foreground">
                {r.before !== null ? <b className="text-foreground"><bdi dir="ltr">{r.before.toFixed(0)}%</bdi></b> : "عيّنة صغيرة"} ← {r.now !== null ? <b className="text-foreground"><bdi dir="ltr">{r.now.toFixed(0)}%</bdi></b> : "عيّنة صغيرة"}
                {d !== null && (
                  <span className={cn("ms-2 font-extrabold", d > 0 ? "text-ok" : d < 0 ? "text-bad" : "")}>
                    <bdi dir="ltr">{d > 0 ? "+" : ""}{d.toFixed(0)}</bdi>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="grid grid-cols-[minmax(0,1fr)] px-5 pb-4 text-[11.5px] text-muted-foreground sm:grid-cols-[8.5rem_minmax(0,1fr)_10.5rem] sm:gap-x-3">
        <span className="hidden sm:block" />
        <span className="relative h-4">
          {ticks.map((x) => (
            <span key={x} className="num absolute whitespace-nowrap" style={{ insetInlineStart: `${x}%`, transform: x === 0 ? undefined : x === 100 ? "translateX(100%)" : "translateX(50%)" }}>{x}%</span>
          ))}
        </span>
      </div>
    </Panel>
  )
}
