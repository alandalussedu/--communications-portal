import { useMemo, useRef, useState, type ReactNode } from "react"
import { FileDown, Loader2, Plus, Trash2, Upload, Users } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { PbxLine, PbxOfficer, PbxReport } from "@/data/types"
import { monthLabel } from "@/data/social"
import { formatDate, formatNumber } from "@/lib/format"
import { PbxFormatError, SMALL_SAMPLE, countMonth, gradeOf, lastDayOf, parsePbx, pct, rate, ranked, type Grade, type PbxFile } from "@/lib/pbx"
import { cn } from "@/lib/utils"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { exportPdf } from "@/report/pdf"
import { pbxPages, pbxTitle } from "@/report/pbx"
import { Gate } from "@/components/Gate"
import { Banner, PageHeader, Panel, PanelHeader } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/**
 * «السنترال»: how the branch communication officers answer the calls the central
 * line transfers to them, month by month, from the 3CX call report. Each person
 * is measured on their own extension. Only counts are stored.
 */

const GRADE: Record<Grade, { bar: string; chip: string }> = {
  good: { bar: "bg-ok", chip: "bg-ok text-white" },
  follow: { bar: "bg-warn", chip: "bg-warn text-white" },
  weak: { bar: "bg-bad", chip: "bg-bad text-white" },
  small: { bar: "bg-muted-foreground/35", chip: "bg-muted text-muted-foreground" },
  none: { bar: "", chip: "text-bad" },
}
const VOICEMAIL_ALERT = 3

export function PbxPage() {
  const { data, canEdit, deletePbxReport } = useStore()
  const reports = useMemo(() => [...data.pbxReports].sort((a, b) => b.month.localeCompare(a.month)), [data.pbxReports])
  const [pick, setPick] = useState<string | null>(null)
  const report = reports.find((r) => r.month === pick) ?? reports[0] ?? null
  const prev = report ? reports.find((r) => r.month < report.month) ?? null : null
  const [sheet, setSheet] = useState<"upload" | "officers" | null>(null)
  const downloads = useDownloads()
  const [exporting, setExporting] = useState(false)
  const pagesRef = useRef<HTMLDivElement>(null)

  const exportReport = async () => {
    if (!report || !downloads) return
    setExporting(true)
    try {
      // let the hidden pages render before capturing them
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const blob = await exportPdf(pagesRef.current!, pbxTitle(report))
      const name = `تقرير السنترال - ${monthLabel(report.month)}.pdf`
      await downloads.save({ filename: name, data: blob })
      toast.success("حُفظ ملف PDF", { description: name })
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err?.code === "declined") toast.message(SAVE_ERROR.declined)
      else toast.error("لم يُحفظ الملف", { description: (err?.code && SAVE_ERROR[err.code]) || err?.message || "حدث خطأ أثناء إنشاء الملف." })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="الأداء والتطوير"
        title="السنترال"
        description="استجابة مسؤولي التواصل بالفروع للمكالمات المحوّلة من الخط الموحد. كل شخص يُقاس على تحويلته."
        actions={
          <>
            {reports.length > 0 && (
              <>
                <label className="sr-only" htmlFor="pbx-month">الشهر</label>
                <select
                  id="pbx-month"
                  value={report?.month}
                  onChange={(e) => setPick(e.target.value)}
                  className="h-11 min-w-40 rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {reports.map((r) => (
                    <option key={r.month} value={r.month}>{monthLabel(r.month)}</option>
                  ))}
                </select>
              </>
            )}
            {report && downloads !== null && (
              <button type="button" onClick={exportReport} disabled={exporting || !downloads} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[15px] font-bold hover:bg-accent disabled:opacity-50">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                تصدير PDF
              </button>
            )}
            {canEdit && (
              <>
                <button type="button" onClick={() => setSheet("upload")} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  رفع تقرير 3CX
                </button>
                <button type="button" onClick={() => setSheet("officers")} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[15px] hover:bg-accent">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  المسؤولون والتحويلات
                </button>
              </>
            )}
          </>
        }
      />
      <Gate
        needs={["pbxReports", "pbxOfficers"]}
        emptyWhen={!report}
        emptyTitle="لم يُرفع تقرير بعد"
        emptyBody={canEdit ? "صدّر تقرير المكالمات من 3CX لشهر كامل، ثم ارفعه من زر «رفع تقرير 3CX»." : "يظهر هنا تقرير كل شهر بعد أن يرفعه فريق الإدارة."}
      >
        {report && <ReportView report={report} prev={prev} />}
        {report && canEdit && (
          <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            {report.source}
            {report.fileName && ` · ${report.fileName}`} · حُفظ {formatDate(report.uploadedAt)}
            <button
              type="button"
              onClick={() => window.confirm(`حذف تقرير ${monthLabel(report.month)}؟`) && deletePbxReport(report.id).then((ok) => ok && setPick(null))}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-bad hover:bg-bad-soft"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              حذف تقرير الشهر
            </button>
          </p>
        )}
      </Gate>

      {exporting && report && (
        <div aria-hidden="true" style={{ position: "fixed", top: 0, left: -20000, pointerEvents: "none" }}>
          <div ref={pagesRef}>{pbxPages(report, prev)}</div>
        </div>
      )}
      {canEdit && (
        <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-2xl" dir="rtl">
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">{sheet === "upload" ? "رفع تقرير 3CX" : "المسؤولون والتحويلات"}</SheetTitle>
              <SheetDescription className="text-start text-[15px]">
                {sheet === "upload"
                  ? "يُقرأ الملف في متصفحك وتُحفظ أعداد المكالمات لكل مسؤول فقط. الملف وأرقام المتصلين لا تُحفظ."
                  : "تحويلة كل مسؤول تواصل كما في السنترال. تُحتسب المكالمات على هذه التحويلات فقط."}
              </SheetDescription>
            </SheetHeader>
            {sheet === "upload" && <UploadForm onDone={(m) => (setSheet(null), m && setPick(m))} />}
            {sheet === "officers" && <OfficersForm onDone={() => setSheet(null)} />}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

/* ------------------------------------------------------------ the month */
function ReportView({ report, prev }: { report: PbxReport; prev: PbxReport | null }) {
  const lines = ranked(report.lines)
  const total = lines.reduce((a, l) => ({ attempts: a.attempts + l.attempts, answered: a.answered + l.answered, unanswered: a.unanswered + l.unanswered, voicemail: a.voicemail + l.voicemail }), { attempts: 0, answered: 0, unanswered: 0, voicemail: 0 })
  const branches = new Set(lines.map((l) => l.branch)).size
  const partial = report.from && report.to && (report.from > `${report.month}-01` || report.to < lastDayOf(report.month))
  const prevOf = (l: PbxLine) => prev?.lines.find((p) => p.officer === l.officer)
  const weak = lines.filter((l) => gradeOf(l) === "weak")
  const vm = lines.filter((l) => l.voicemail >= VOICEMAIL_ALERT).sort((a, b) => b.voicemail - a.voicemail)

  return (
    <div className="flex flex-col gap-5">
      {partial && (
        <Banner tone="sky" title="التقرير لا يغطي الشهر كاملًا">
          يغطي الملف المرفوع من {formatDate(report.from!)} إلى {formatDate(report.to!)}. صدّر التقرير من أول الشهر إلى آخره ثم ارفعه من جديد ليحل محله.
        </Banner>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="نسبة الاستجابة العامة" value={pct(rate(total))} sub="المكالمات المُجابة من إجمالي المحاولات" accent />
        <Stat label="محاولات الاتصال" value={formatNumber(total.attempts)} sub={`على ${formatNumber(lines.length)} مسؤول تواصل في ${formatNumber(branches)} فرعًا`} />
        <Stat label="مكالمات لم يُرد عليها" value={formatNumber(total.unanswered)} sub={`منها ${formatNumber(total.voicemail)} تحوّلت إلى البريد الصوتي`} />
      </ul>

      <Panel>
        <PanelHeader title="تقييم كل مسؤول تواصل على تحويلته" hint="مرتبون من الأعلى استجابة إلى الأدنى." />
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-5 pb-3 text-[13px] text-muted-foreground">
          <Legend cls="bg-ok" label="جيدة: 70% أو أكثر" />
          <Legend cls="bg-warn" label="تحتاج متابعة" />
          <Legend cls="bg-bad" label="ضعيفة: أقل من 50%" />
          <Legend cls="bg-muted-foreground/35" label={`أقل من ${SMALL_SAMPLE} محاولات: لا تصلح للمقارنة`} />
        </div>
        <ul className="divide-y">
          {lines.map((l, i) => {
            const g = gradeOf(l), r = rate(l)
            return (
              <li key={l.officer} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{l.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{l.branch} · {l.school}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  {r !== null && <span className={cn("grow-x block h-full rounded-full", GRADE[g].bar)} style={{ width: `${Math.max(r, 2)}%`, animationDelay: `${Math.min(i, 12) * 40}ms` }} />}
                </span>
                <span className="flex min-w-[8.5rem] items-center justify-end gap-2">
                  {r === null ? (
                    <span className="text-[13px] text-muted-foreground">{l.exts.length ? "لا اتصالات" : "التحويلة غير محددة"}</span>
                  ) : (
                    <>
                      <span className="num text-[13px] text-muted-foreground">{formatNumber(l.answered)} من {formatNumber(l.attempts)}</span>
                      <span className={cn("num rounded-full px-2 py-0.5 text-[13px] font-bold", GRADE[g].chip)}>{pct(r)}</span>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="التفاصيل الكاملة لكل مسؤول" hint={prev ? `مع الفرق عن ${monthLabel(prev.month)} بالنقاط.` : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[15px]">
            <caption className="sr-only">استجابة كل مسؤول تواصل في {monthLabel(report.month)}</caption>
            <thead>
              <tr className="border-b bg-muted/50 text-[14px] text-muted-foreground">
                {["مسؤول التواصل", "الفرع", "المدرسة / القسم", "التحويلة", "المحاولات", "رد", "لم يُرد", "نسبة الاستجابة", "بريد صوتي", ...(prev ? ["عن الشهر السابق"] : [])].map((h, k) => (
                  <th key={h} scope="col" className={cn("px-3 py-2.5 font-medium", k < 4 ? "text-start" : "text-end")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const r = rate(l), p = prevOf(l), pr = p ? rate(p) : null
                const d = r !== null && pr !== null ? r - pr : null
                return (
                  <tr key={l.officer} className="border-b last:border-0">
                    <th scope="row" className="px-3 py-2.5 text-start font-bold">{l.name}</th>
                    <td className="px-3 py-2.5">{l.branch}</td>
                    <td className="px-3 py-2.5">{l.school}</td>
                    <td className="num px-3 py-2.5 text-muted-foreground">{l.exts.join("، ") || "—"}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(l.attempts)}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(l.answered)}</td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(l.unanswered)}</td>
                    <td className="px-3 py-2.5 text-end">
                      <span className={cn("num inline-block rounded-full px-2 py-0.5 text-[13px] font-bold", r === null ? "text-muted-foreground" : GRADE[gradeOf(l)].chip)}>{pct(r)}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-end">{formatNumber(l.voicemail)}</td>
                    {prev && (
                      <td className={cn("num px-3 py-2.5 text-end text-[14px] font-bold", d === null ? "font-normal text-muted-foreground" : d > 0 ? "text-ok" : d < 0 ? "text-bad" : "text-muted-foreground")} dir="ltr">
                        {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {(weak.length > 0 || vm.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {weak.length > 0 && (
            <Alert tone="bad" title="الأضعف في الاستجابة" hint={`عدد محاولات كافٍ (${SMALL_SAMPLE} فأكثر) ونسبة استجابة أقل من النصف.`}>
              {weak.map((l) => (
                <AlertRow key={l.officer} l={l} right={<><bdi dir="ltr" className="font-bold">{pct(rate(l))}</bdi> · رد على {formatNumber(l.answered)} من {formatNumber(l.attempts)}</>} />
              ))}
            </Alert>
          )}
          {vm.length > 0 && (
            <Alert tone="warn" title="تسرّب المكالمات إلى البريد الصوتي" hint="مكالمات انتهت برسالة مسجّلة بدل أن تصل إلى الموظف.">
              {vm.map((l) => (
                <AlertRow key={l.officer} l={l} right={<>{formatNumber(l.voicemail)} من {formatNumber(l.attempts)} · <bdi dir="ltr" className="font-bold">{pct((l.voicemail / l.attempts) * 100)}</bdi></>} />
              ))}
            </Alert>
          )}
        </div>
      )}
      {report.waitingExcluded > 0 && <p className="text-[13px] text-muted-foreground">استُبعدت {formatNumber(report.waitingExcluded)} مكالمة كانت لا تزال ترن («Waiting») وقت سحب التقرير.</p>}
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <li className="rise rounded-2xl border bg-card px-5 py-4">
      <p className="text-[14px] text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-[32px] font-extrabold leading-none", accent && "text-primary")}>{value}</p>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{sub}</p>
    </li>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} aria-hidden="true" />
      {label}
    </span>
  )
}

function Alert({ tone, title, hint, children }: { tone: "bad" | "warn"; title: string; hint: string; children: ReactNode }) {
  return (
    <Panel className={cn("border-s-4", tone === "bad" ? "border-s-bad" : "border-s-warn")}>
      <div className="px-5 pt-4">
        <h3 className="text-[17px] font-bold">{title}</h3>
        <p className="text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <ul className="mt-2 divide-y">{children}</ul>
    </Panel>
  )
}
function AlertRow({ l, right }: { l: PbxLine; right: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold">{l.name}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{l.branch} · {l.school}</span>
      </span>
      <span className="num shrink-0 text-[14px]">{right}</span>
    </li>
  )
}

/* ------------------------------------------------------------ upload */
function UploadForm({ onDone }: { onDone: (month: string | null) => void }) {
  const { data, savePbxReport } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; parsed: PbxFile } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const officers = data.pbxOfficers
  const result = file && month ? countMonth(file.parsed, month, officers) : null
  const exists = data.pbxReports.some((r) => r.month === month)
  const partial = result && result.from && result.to && (result.from > `${month}-01` || result.to < lastDayOf(month))
  const noExt = officers.filter((o) => o.active && !o.exts.length)

  const read = async (f: File | undefined) => {
    setError(null)
    setFile(null)
    if (!f) return
    if (f.size > 25 * 1024 * 1024) return setError("الملف أكبر من 25 ميجابايت.")
    try {
      const parsed = parsePbx(await f.arrayBuffer())
      setFile({ name: f.name, parsed })
      setMonth(parsed.months[0].month)
    } catch (e) {
      setError(e instanceof PbxFormatError ? e.message : "تعذّرت قراءة الملف. صدّره من 3CX بصيغة CSV أو TXT.")
    }
  }

  const save = async () => {
    if (!file || !result) return
    setSaving(true)
    const ok = await savePbxReport({
      id: month,
      month,
      from: result.from,
      to: result.to,
      lines: result.lines,
      waitingExcluded: result.waiting,
      source: "تقرير مكالمات 3CX",
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    })
    setSaving(false)
    if (ok) onDone(month)
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <ol className="list-decimal space-y-1 ps-5 text-[14px] text-muted-foreground">
        <li>من 3CX: التقارير ← سجل المكالمات، واختر الفترة من أول الشهر إلى آخره.</li>
        <li>صدّر التقرير (CSV أو TXT) وارفعه هنا كما هو.</li>
      </ol>
      <input ref={input} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()} className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-muted/30 p-5 text-center hover:bg-accent">
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-[16px] font-bold">{file ? file.name : "اختر ملف التقرير"}</span>
        {file && <span className="num text-[13px] text-muted-foreground">{formatNumber(file.parsed.months.reduce((a, m) => a + m.count, 0))} مكالمة في الملف</span>}
      </button>
      {error && <Banner tone="bad" title="لم يُقرأ الملف">{error}</Banner>}
      {noExt.length > 0 && (
        <Banner tone="warn" title="مسؤولون بلا تحويلة">
          {noExt.map((o) => o.name).join("، ")}: لن تُحتسب لهم مكالمات حتى تُضاف تحويلاتهم من «المسؤولون والتحويلات».
        </Banner>
      )}
      {file && result && (
        <>
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-muted-foreground">شهر التقرير</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-[16px]">
              {[...file.parsed.months].sort((a, b) => b.month.localeCompare(a.month)).map((m) => (
                <option key={m.month} value={m.month}>{monthLabel(m.month)} ({formatNumber(m.count)} مكالمة)</option>
              ))}
            </select>
          </label>
          {partial && (
            <Banner tone="sky" title="الملف لا يغطي الشهر كاملًا">
              فيه مكالمات {monthLabel(month)} من {formatDate(result.from!)} إلى {formatDate(result.to!)} فقط. يُفضّل تصدير الشهر كاملًا.
            </Banner>
          )}
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">المسؤول</th>
                  <th className="px-3 py-2 text-end font-medium">المحاولات</th>
                  <th className="px-3 py-2 text-end font-medium">رد</th>
                  <th className="px-3 py-2 text-end font-medium">بريد صوتي</th>
                  <th className="px-3 py-2 text-end font-medium">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {ranked(result.lines).map((l) => (
                  <tr key={l.officer} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{l.name} <span className="text-[12px] text-muted-foreground">· {l.branch}</span></td>
                    <td className="num px-3 py-1.5 text-end">{formatNumber(l.attempts)}</td>
                    <td className="num px-3 py-1.5 text-end">{formatNumber(l.answered)}</td>
                    <td className="num px-3 py-1.5 text-end">{formatNumber(l.voicemail)}</td>
                    <td className="num px-3 py-1.5 text-end font-bold">{pct(rate(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.waiting > 0 && <p className="text-[13px] text-muted-foreground">تُستبعد {formatNumber(result.waiting)} مكالمة «Waiting».</p>}
          {exists && <Banner tone="warn" title={`يوجد تقرير محفوظ لشهر ${monthLabel(month)}`}>الحفظ يستبدله بهذا الملف.</Banner>}
          <button type="button" disabled={saving} onClick={save} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            حفظ تقرير {monthLabel(month)}
          </button>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ officers and extensions */
function OfficersForm({ onDone }: { onDone: () => void }) {
  const { data, savePbxOfficers } = useStore()
  const [list, setList] = useState<PbxOfficer[]>(() => [...data.pbxOfficers].sort((a, b) => a.order - b.order))
  const [removed, setRemoved] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const set = (id: string, patch: Partial<PbxOfficer>) => setList((l) => l.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  const add = () => setList((l) => [...l, { id: `o${Date.now().toString(36)}`, name: "", branch: "", school: "", exts: [], order: l.length + 1, active: true }])
  const valid = list.every((o) => o.name.trim() && o.branch.trim())

  const save = async () => {
    setSaving(true)
    const clean = list.map((o, i) => ({ ...o, name: o.name.trim(), branch: o.branch.trim(), school: o.school.trim(), order: i + 1 }))
    const ok = await savePbxOfficers(clean, removed)
    setSaving(false)
    if (ok) onDone()
  }

  const field = "h-10 w-full rounded-md border border-input bg-card px-2.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
  return (
    <div className="mt-5 flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">تغيير التحويلات يؤثر على التقارير التي تُرفع بعده فقط؛ التقارير المحفوظة تبقى كما حُسبت.</p>
      {list.map((o) => (
        <fieldset key={o.id} className={cn("grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-[1.3fr_1fr_1fr_0.9fr_auto]", !o.active && "opacity-60")}>
          <legend className="sr-only">{o.name || "مسؤول جديد"}</legend>
          <input aria-label="الاسم" placeholder="الاسم" value={o.name} onChange={(e) => set(o.id, { name: e.target.value })} className={cn(field, "col-span-2 sm:col-span-1")} />
          <input aria-label="الفرع" placeholder="الفرع" value={o.branch} onChange={(e) => set(o.id, { branch: e.target.value })} className={field} />
          <input aria-label="المدرسة أو القسم" placeholder="المدرسة / القسم" value={o.school} onChange={(e) => set(o.id, { school: e.target.value })} className={field} />
          <input
            aria-label="التحويلة"
            placeholder="التحويلة"
            inputMode="numeric"
            dir="ltr"
            defaultValue={o.exts.join(", ")}
            onBlur={(e) => set(o.id, { exts: e.target.value.split(/[^\d]+/).filter(Boolean) })}
            className={cn(field, "num text-start")}
          />
          <span className="flex items-center justify-end gap-1">
            <label className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={o.active} onChange={(e) => set(o.id, { active: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              نشط
            </label>
            <button
              type="button"
              onClick={() => (setList((l) => l.filter((x) => x.id !== o.id)), data.pbxOfficers.some((x) => x.id === o.id) && setRemoved((r) => [...r, o.id]))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-bad hover:bg-bad-soft"
              aria-label={`حذف ${o.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </span>
        </fieldset>
      ))}
      <button type="button" onClick={add} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-dashed text-[14px] hover:bg-accent">
        <Plus className="h-4 w-4" aria-hidden="true" />
        إضافة مسؤول
      </button>
      <button type="button" disabled={saving || !valid} onClick={save} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        حفظ القائمة
      </button>
      {!valid && <p className="text-[13px] text-bad">الاسم والفرع مطلوبان لكل مسؤول.</p>}
    </div>
  )
}
