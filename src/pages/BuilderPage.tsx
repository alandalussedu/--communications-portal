import { useEffect, useMemo, useRef, useState } from "react"
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import { INDICATORS } from "@/data/links"
import type { IndicatorKey } from "@/data/types"
import { ACADEMIC_YEAR, periodLabel, type PeriodKey } from "@/data/insights"
import { formatNumber } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { Banner, PageHeader, Panel, PanelHeader, SelectField } from "@/components/common"
import { buildReport, type ReportOptions } from "@/report/model"
import { PAGE_H, PAGE_W, reportPages } from "@/report/ReportPages"
import { exportPdf } from "@/report/pdf"
import { exportXlsx } from "@/report/xlsx"
import { PeriodSwitch } from "./OverviewPage"

const PREVIEW_GAP = 24

export function BuilderPage() {
  const { data } = useStore()
  const downloads = useDownloads()
  const [period, setPeriod] = usePersistent<PeriodKey>("rb-period", "s1")
  const [scope, setScope] = usePersistent<"all" | "pick">("rb-scope", "all")
  const [picked, setPicked] = usePersistent<string[]>("rb-picked", [])
  const [inds, setInds] = usePersistent<IndicatorKey[]>("rb-inds", ["satisfaction", "communication"])
  const [includePlans, setIncludePlans] = usePersistent("rb-plans", true)
  const [charts, setCharts] = usePersistent("rb-charts", true)
  const [busy, setBusy] = useState<null | "pdf" | "xlsx">(null)
  const [progress, setProgress] = useState("")
  const [stamp, setStamp] = useState(() => new Date())

  const pickedValid = picked.filter((s) => data.branches.some((b) => b.slug === s))
  const opts: ReportOptions = { period, branches: scope === "pick" ? pickedValid : [], indicators: inds, includePlans, charts }
  const invalid = inds.length === 0 ? "اختر معاملًا واحدًا على الأقل." : scope === "pick" && pickedValid.length === 0 ? "اختر فرعًا واحدًا على الأقل، أو «جميع الفروع»." : null

  const model = useMemo(() => (invalid ? null : buildReport(data, opts, stamp)), [data, period, scope, pickedValid.join(","), inds.join(","), includePlans, charts, stamp]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = useMemo(() => (model ? reportPages(model) : []), [model])

  const pagesRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    if (!box) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, box.clientWidth / PAGE_W)))
    ro.observe(box)
    return () => ro.disconnect()
  }, [box])

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const fileBase = `التقرير التنفيذي - ${periodLabel(period)} - ${new Date().toISOString().slice(0, 10)}`

  const save = async (kind: "pdf" | "xlsx") => {
    if (!model || !downloads) return
    setBusy(kind)
    const now = new Date()
    setStamp(now)
    try {
      // Let the preview re-render with the export time before capturing it.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      let blob: Blob
      if (kind === "pdf") {
        setProgress("جارٍ تجهيز الصفحات…")
        blob = await exportPdf(pagesRef.current!, model.title, (d, t) => setProgress(`صفحة ${formatNumber(d)} من ${formatNumber(t)}`))
      } else {
        blob = exportXlsx(buildReport(data, opts, now))
      }
      setProgress("بانتظار تأكيد الحفظ…")
      await downloads.save({ filename: `${fileBase}.${kind}`, data: blob })
      toast.success(kind === "pdf" ? "حُفظ ملف PDF" : "حُفظ ملف Excel", { description: `${fileBase}.${kind}` })
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err?.code === "declined") toast.message(SAVE_ERROR.declined)
      else toast.error("لم يُحفظ الملف", { description: (err?.code && SAVE_ERROR[err.code]) || err?.message || "حدث خطأ غير متوقع أثناء إنشاء الملف." })
    } finally {
      setBusy(null)
      setProgress("")
    }
  }

  const withData = data.branches.filter((b) => data.indicators.some((i) => i.branch === b.slug))

  return (
    <>
      <PageHeader
        eyebrow="التقارير التنفيذية"
        title="مولّد التقرير التنفيذي"
        description="اختر الفترة والفروع والمعاملين، وراجع التقرير قبل تصديره. كل خيار يغيّر محتوى التقرير مباشرة."
      />
      <Gate needs={["branches", "indicators", "stages", "syncLog", "meta", "settings", "alertState"]} emptyWhen={data.branches.length === 0}>
        <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Panel className="lg:sticky lg:top-20">
            <PanelHeader title="إعداد التقرير" />
            <div className="space-y-5 px-5 py-5">
              <SelectField id="rb-year" label="العام الدراسي" value={ACADEMIC_YEAR} onChange={() => {}} options={[{ value: ACADEMIC_YEAR, label: ACADEMIC_YEAR }]} />
              <fieldset>
                <legend className="mb-1.5 text-[14px] text-muted-foreground">الفصل الدراسي / الفترة</legend>
                <PeriodSwitch value={period} onChange={setPeriod} compact />
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-[14px] text-muted-foreground">الفروع</legend>
                <div className="flex flex-wrap gap-4 text-[16px]">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rb-scope" checked={scope === "all"} onChange={() => setScope("all")} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    جميع الفروع
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rb-scope" checked={scope === "pick"} onChange={() => setScope("pick")} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    فروع مختارة
                  </label>
                </div>
                {scope === "pick" && (
                  <div className="mt-3 rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap gap-3 text-[14px]">
                      <button type="button" className="font-bold text-primary hover:underline" onClick={() => setPicked(withData.map((b) => b.slug))}>
                        التي وصلت بياناتها
                      </button>
                      <button type="button" className="font-bold text-primary hover:underline" onClick={() => setPicked(data.branches.map((b) => b.slug))}>
                        الكل
                      </button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={() => setPicked([])}>
                        إلغاء التحديد
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {data.branches.map((b) => (
                        <label key={b.slug} className="flex items-center gap-2 text-[15px]">
                          <input type="checkbox" checked={picked.includes(b.slug)} onChange={() => setPicked(toggle(picked, b.slug))} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-[14px] text-muted-foreground">المعاملات</legend>
                <div className="space-y-1.5">
                  {INDICATORS.map((i) => (
                    <label key={i.key} className="flex items-center gap-2 text-[16px]">
                      <input type="checkbox" checked={inds.includes(i.key)} onChange={() => setInds(toggle(inds, i.key))} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                      {i.title}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-[14px] text-muted-foreground">المحتوى</legend>
                <label className="flex items-center gap-2 text-[16px]">
                  <input type="checkbox" checked={includePlans} onChange={(e) => setIncludePlans(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  تضمين الخطط العلاجية والتحسينية
                </label>
                <div className="mt-2 flex flex-wrap gap-4 text-[16px]">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rb-charts" checked={charts} onChange={() => setCharts(true)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    جداول ورسوم
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="rb-charts" checked={!charts} onChange={() => setCharts(false)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    جداول فقط
                  </label>
                </div>
              </fieldset>

              {invalid && <Banner tone="warn" title={invalid} />}

              <div className="border-t pt-4">
                {downloads === null ? (
                  <Banner tone="sky" title="التنزيل غير متاح في هذا العرض">
                    افتح المنصة من رابطها في Claude وسجّل الدخول لتصدير التقرير. المعاينة متاحة هنا.
                  </Banner>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={!model || !!busy || downloads === undefined}
                      onClick={() => save("pdf")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {busy === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <FileDown className="h-5 w-5" aria-hidden="true" />}
                      تصدير PDF
                    </button>
                    <button
                      type="button"
                      disabled={!model || !!busy || downloads === undefined}
                      onClick={() => save("xlsx")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-card px-5 text-[16px] font-bold hover:bg-accent disabled:opacity-50"
                    >
                      {busy === "xlsx" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}
                      تصدير Excel
                    </button>
                    <p className="min-h-[20px] text-[14px] text-muted-foreground" role="status" aria-live="polite">
                      {progress || (model ? `${formatNumber(pages.length)} صفحات في PDF. ملف Excel يضم البيانات التي بُني عليها التقرير.` : "")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <div ref={setBox} className="min-w-0">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[20px] font-bold">معاينة التقرير</h2>
              {model && <span className="text-[14px] text-muted-foreground">{formatNumber(pages.length)} صفحات · A4</span>}
            </div>
            {!model ? (
              <Panel>
                <p className="px-5 py-10 text-center text-[16px] text-muted-foreground">أكمل إعداد التقرير لعرض المعاينة.</p>
              </Panel>
            ) : (
              <div className="overflow-hidden rounded-xl bg-muted/70 p-0" style={{ height: pages.length * (PAGE_H + PREVIEW_GAP) * scale }}>
                <div
                  ref={pagesRef}
                  className={cn("origin-top-right")}
                  style={{ width: PAGE_W, transform: `scale(${scale})`, display: "flex", flexDirection: "column", gap: PREVIEW_GAP }}
                >
                  {pages.map((p, i) => (
                    <div key={i} className="shadow-md">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Gate>
    </>
  )
}
