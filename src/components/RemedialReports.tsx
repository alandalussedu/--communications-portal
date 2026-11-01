import { useEffect, useMemo, useRef, useState } from "react"
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import { usePersistent } from "@/lib/persist"
import { formatNumber } from "@/lib/format"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { exportPdf } from "@/report/pdf"
import { PAGE_H, PAGE_W } from "@/report/ReportPages"
import { buildRemedialReport, exportRemedialXlsx, remedialPages, type RROptions } from "@/report/remedial"
import { Panel, PanelHeader, SelectField } from "./common"

const GAP = 24
type Scope = "one" | "pick" | "all"

export function RemedialReports() {
  const { data } = useStore()
  const downloads = useDownloads()
  const branches = data.branches
  const [scope, setScope] = usePersistent<Scope>("rr-scope", "all")
  const [one, setOne] = usePersistent<string>("rr-one", branches[0]?.slug ?? "")
  const [picked, setPicked] = usePersistent<string[]>("rr-picked", [])
  const [details, setDetails] = usePersistent("rr-details", true)
  const [monthly, setMonthly] = usePersistent("rr-monthly", true)
  const [busy, setBusy] = useState<null | "pdf" | "xlsx">(null)
  const [progress, setProgress] = useState("")
  const [stamp, setStamp] = useState(() => new Date())

  const sel = scope === "one" ? [one].filter((s) => branches.some((b) => b.slug === s)) : scope === "pick" ? picked.filter((s) => branches.some((b) => b.slug === s)) : []
  const invalid = scope !== "all" && sel.length === 0 ? "اختر فرعًا واحدًا على الأقل." : null
  const opts: RROptions = { branches: sel, details, monthly }
  const model = useMemo(() => (invalid ? null : buildRemedialReport(data, opts, stamp)), [data, sel.join(","), details, monthly, stamp, invalid]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = useMemo(() => (model ? remedialPages(model) : []), [model])

  const pagesRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    if (!box) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, box.clientWidth / PAGE_W)))
    ro.observe(box)
    return () => ro.disconnect()
  }, [box])

  const base = model ? `${model.title} - ${new Date().toISOString().slice(0, 10)}` : ""
  const save = async (kind: "pdf" | "xlsx") => {
    if (!model || !downloads) return
    setBusy(kind)
    const now = new Date()
    setStamp(now)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const blob =
        kind === "pdf"
          ? await exportPdf(pagesRef.current!, model.title, (d, t) => setProgress(`صفحة ${formatNumber(d)} من ${formatNumber(t)}`))
          : exportRemedialXlsx(buildRemedialReport(data, opts, now))
      setProgress("بانتظار تأكيد الحفظ…")
      await downloads.save({ filename: `${base}.${kind}`, data: blob })
      toast.success(kind === "pdf" ? "حُفظ ملف PDF" : "حُفظ ملف Excel", { description: `${base}.${kind}` })
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err?.code === "declined") toast.message(SAVE_ERROR.declined)
      else toast.error("لم يُحفظ الملف", { description: (err?.code && SAVE_ERROR[err.code]) || err?.message || "حدث خطأ غير متوقع أثناء إنشاء الملف." })
    } finally {
      setBusy(null)
      setProgress("")
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Panel className="lg:sticky lg:top-20">
        <PanelHeader title="إعداد التقرير" hint="فرع واحد = تقرير فرع. عدة فروع أو الكل = تقرير شامل." />
        <div className="space-y-5 px-5 py-5">
          <fieldset>
            <legend className="mb-1.5 text-[14px] text-muted-foreground">النطاق</legend>
            <div className="flex flex-wrap gap-4 text-[16px]">
              {(
                [
                  ["one", "فرع"],
                  ["pick", "عدة فروع"],
                  ["all", "الكل"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="rr-scope" checked={scope === k} onChange={() => setScope(k)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  {l}
                </label>
              ))}
            </div>
            {scope === "one" && (
              <div className="mt-3">
                <SelectField id="rr-one" label="الفرع" value={one} onChange={setOne} options={branches.map((b) => ({ value: b.slug, label: b.name }))} />
              </div>
            )}
            {scope === "pick" && (
              <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg border p-3 text-[15px]">
                {branches.map((b) => (
                  <label key={b.slug} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked.includes(b.slug)}
                      onChange={() => setPicked(picked.includes(b.slug) ? picked.filter((x) => x !== b.slug) : [...picked, b.slug])}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="space-y-2 text-[16px]">
            <legend className="mb-1.5 text-[14px] text-muted-foreground">المحتوى</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              تضمين التفاصيل
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              تضمين المتابعة الشهرية
            </label>
          </fieldset>
          {invalid && <p className="text-[14px] text-bad">{invalid}</p>}
          <div className="border-t pt-4">
            {downloads === null ? (
              <p className="text-[14px] text-muted-foreground">التنزيل غير متاح في هذا العرض. افتح المنصة من رابطها في Claude.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => save("pdf")} disabled={!model || !!busy || downloads === undefined} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground disabled:opacity-60">
                  {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  تصدير PDF
                </button>
                <button type="button" onClick={() => save("xlsx")} disabled={!model || !!busy || downloads === undefined} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-5 text-[15px] hover:bg-accent disabled:opacity-60">
                  {busy === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  تصدير Excel
                </button>
              </div>
            )}
            {progress && <p className="mt-2 text-[14px] text-muted-foreground" aria-live="polite">{progress}</p>}
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
          <div className="overflow-hidden rounded-xl bg-muted/70" style={{ height: pages.length * (PAGE_H + GAP) * scale }}>
            <div ref={pagesRef} className="origin-top-right" style={{ width: PAGE_W, transform: `scale(${scale})`, display: "flex", flexDirection: "column", gap: GAP }}>
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
  )
}
