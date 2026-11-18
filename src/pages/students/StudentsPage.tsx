import { useMemo, useRef, useState } from "react"
import { AlertTriangle, FileDown, FileSpreadsheet, Loader2, Lock, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { StudentCounts, StudentTarget } from "@/data/types"
import { formatDate, formatNumber } from "@/lib/format"
import { StudentFileError, isPull, isTarget, nextYear, pct, readStudentFile, shortName, yearLabel, type StudentParse } from "@/lib/students"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { exportPdf } from "@/report/pdf"
import { studentsPages, studentsTitle } from "@/report/students"
import { Gate } from "@/components/Gate"
import { Banner, PageHeader, Panel } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BranchChip, Dashboard } from "./Dashboard"

/**
 * «أعداد الطلاب»: student numbers per branch from the system pull, for the
 * platform owner only. The database refuses this collection to everyone else
 * (owner_collection in supabase/schema.sql); hiding the tab is only courtesy.
 */
export function StudentsPage() {
  const { data, vault, deleteStudentCounts } = useStore()
  const list = useMemo(() => data.studentCounts.filter(isPull).sort((a, b) => b.date.localeCompare(a.date)), [data.studentCounts])
  const [pick, setPick] = useState<string | null>(null)
  const counts = list.find((c) => c.id === pick) ?? list[0] ?? null
  const prev = counts ? list.find((c) => c.date < counts.date) ?? null : null
  const [branch, setBranch] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingTarget, setEditingTarget] = useState(false)
  const targetYear = counts ? nextYear(counts) : ""
  const target = (data.studentCounts.find((d) => isTarget(d) && d.year === targetYear) as StudentTarget | undefined) ?? null
  const downloads = useDownloads()
  const [exporting, setExporting] = useState(false)
  const pagesRef = useRef<HTMLDivElement>(null)

  if (!vault.isOwner)
    return (
      <Panel className="mx-auto mt-8 max-w-lg p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-[22px] font-bold">أعداد الطلاب لمدير المنصة فقط</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">هذه الصفحة متاحة لحسابات مدير المنصة وحدها.</p>
      </Panel>
    )

  const exportReport = async () => {
    if (!counts || !downloads) return
    setExporting(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const blob = await exportPdf(pagesRef.current!, studentsTitle(counts))
      const name = `أعداد الطلاب - ${counts.date}.pdf`
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
  const selectCls = "h-10 rounded-full border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              مدير المنصة فقط
            </span>
            الأداء والتطوير{counts?.year ? ` · العام الدراسي ${counts.year.replace("-", "/")}` : ""}
          </span>
        }
        title="أعداد الطلاب"
        description={counts ? <>آخر سحب من نظام الحلول الخبيرة: <b className="text-foreground">{formatDate(counts.date)}</b></> : "مؤشرات أعداد الطلاب لكل فرع من سحب نظام الحلول الخبيرة."}
        actions={
          <>
            <button type="button" onClick={() => setUploading(true)} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[15px] font-bold text-primary hover:bg-accent">
              <Upload className="h-4 w-4" aria-hidden="true" />
              رفع ملف جديد
            </button>
            {counts && downloads !== null && (
              <button type="button" onClick={exportReport} disabled={exporting || !downloads} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                تصدير PDF
              </button>
            )}
          </>
        }
      />
      <Gate
        needs={["studentCounts"]}
        emptyWhen={!counts}
        emptyTitle="لم يُرفع ملف بعد"
        emptyBody="ارفع ملف «مؤشرات أعداد الطلاب» (Excel) من زر «رفع ملف جديد»."
      >
        {counts && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="st-branch">الفرع</label>
              <select id="st-branch" value={branch ?? ""} onChange={(e) => setBranch(e.target.value || null)} className={selectCls}>
                <option value="">كل الفروع</option>
                {counts.branches.map((b) => (
                  <option key={b.name} value={b.name}>{shortName(b.name)}</option>
                ))}
              </select>
              {branch && <BranchChip name={branch} onClear={() => setBranch(null)} />}
              {list.length > 1 && (
                <span className="ms-auto inline-flex items-center gap-2 text-[14px] text-muted-foreground">
                  <label htmlFor="st-pull">السحب</label>
                  <select id="st-pull" value={counts.id} onChange={(e) => (setPick(e.target.value), setBranch(null))} className={selectCls}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>{formatDate(c.date)}</option>
                    ))}
                  </select>
                </span>
              )}
            </div>
            <Dashboard counts={counts} prev={prev} branch={branch && counts.branches.some((b) => b.name === branch) ? branch : null} onBranch={setBranch} target={target} targetYear={targetYear} onEditTarget={() => setEditingTarget(true)} />
            <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {counts.fileName ?? "ملف مؤشرات أعداد الطلاب"} · حُفظ {formatDate(counts.uploadedAt)}
              <button
                type="button"
                onClick={() => window.confirm(`حذف سحب ${formatDate(counts.date)}؟`) && deleteStudentCounts(counts.id).then((ok) => ok && setPick(null))}
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-bad hover:bg-bad-soft"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                حذف هذا السحب
              </button>
            </p>
          </>
        )}
      </Gate>

      {exporting && counts && (
        <div aria-hidden="true" style={{ position: "fixed", top: 0, left: -20000, pointerEvents: "none" }}>
          <div ref={pagesRef}>{studentsPages(counts, target, targetYear)}</div>
        </div>
      )}
      <Sheet open={uploading} onOpenChange={setUploading}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">رفع ملف أعداد الطلاب</SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              ملف «مؤشرات أعداد الطلاب» كما يخرج من التقرير. يُقرأ في متصفحك وتُحفظ الأرقام فقط، ويُعرف السحب بتاريخه المكتوب في الملف.
            </SheetDescription>
          </SheetHeader>
          <UploadForm existing={list} onDone={(id) => (setUploading(false), id && (setPick(id), setBranch(null)))} />
        </SheetContent>
      </Sheet>
      {counts && (
        <Sheet open={editingTarget} onOpenChange={setEditingTarget}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">مستهدف العام القادم · <bdi dir="ltr">{yearLabel(targetYear)}</bdi></SheetTitle>
              <SheetDescription className="text-start text-[15px]">
                يُدخل يدويًا لكل فرع، وليس من ملف Excel. الإجمالي يُجمع تلقائيًا، والبطاقة تعرض الإجمالي فقط. يبقى المستهدف كما هو عند رفع سحب جديد.
              </SheetDescription>
            </SheetHeader>
            <TargetForm key={target?.updatedAt ?? "new"} counts={counts} year={targetYear} target={target} onDone={() => setEditingTarget(false)} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

function UploadForm({ existing, onDone }: { existing: StudentCounts[]; onDone: (id: string | null) => void }) {
  const { saveStudentCounts } = useStore()
  const [parsed, setParsed] = useState<StudentParse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const replaces = parsed ? existing.find((c) => c.id === parsed.counts.id) : null

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setParsed(null)
    try {
      setParsed(await readStudentFile(file))
    } catch (e) {
      setError(e instanceof StudentFileError ? e.message : "تعذّر قراءة الملف.")
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!parsed) return
    setSaving(true)
    const ok = await saveStudentCounts({ ...parsed.counts, uploadedAt: new Date().toISOString() })
    setSaving(false)
    if (ok) onDone(parsed.counts.id)
  }
  const t = parsed?.counts.total

  return (
    <div className="mt-5 flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-input bg-muted/40 px-6 py-8 text-center hover:bg-muted/70">
        {busy ? <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" /> : <FileSpreadsheet className="h-7 w-7 text-primary" aria-hidden="true" />}
        <span className="text-[16px] font-bold">اختر ملف Excel</span>
        <span className="text-[13px] text-muted-foreground">الأوراق: مؤشرات الفروع، بيانات الحساب، حسب المرحلة، حسب نوع الدراسة، التعريفات والملاحظات</span>
        <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {error && <Banner tone="bad" title="لم يُقرأ الملف">{error}</Banner>}
      {parsed && t && (
        <>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-[15px]">
              سحب <b>{formatDate(parsed.counts.date)}</b>
              {parsed.counts.year && <> · العام الدراسي <b>{parsed.counts.year.replace("-", "/")}</b></>} · <b>{formatNumber(parsed.counts.branches.length)}</b> فرعًا
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-3">
              {[
                ["الطلاب الحاليون", formatNumber(t.current)],
                ["الطلاب الجدد", formatNumber(t.newcomers)],
                ["المنسحبون", formatNumber(t.withdrawn)],
                ["نسبة الانسحاب", pct(t.withdrawalRate)],
                ["نسبة الإشغال", pct(t.occupancy)],
                ["الطاقة التشغيلية", formatNumber(t.capacity)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12.5px] text-muted-foreground">{k}</dt>
                  <dd className="num font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-muted-foreground">
              {parsed.counts.stageNames.length} مراحل · {parsed.counts.typeNames.length} أنواع دراسة · {parsed.counts.notes.length} ملاحظة وتعريفًا
            </p>
          </div>
          {parsed.warnings.length > 0 && (
            <Banner tone="warn" title={`${parsed.warnings.length} ملاحظة على الملف`}>
              <ul className="mt-1 list-disc ps-5">
                {parsed.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </Banner>
          )}
          {replaces && (
            <p className="flex items-center gap-2 text-[14px] text-warn">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              يوجد سحب بالتاريخ نفسه، وسيحل هذا الملف محله.
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {replaces ? "استبدال السحب" : "حفظ السحب"}
            </button>
            <button type="button" onClick={() => onDone(null)} className="h-11 rounded-full border px-5 text-[15px] hover:bg-accent">إلغاء</button>
          </div>
        </>
      )}
    </div>
  )
}

function TargetForm({ counts, year, target, onDone }: { counts: StudentCounts; year: string; target: StudentTarget | null; onDone: () => void }) {
  const { saveStudentTarget } = useStore()
  const rows = useMemo(() => [...counts.branches].sort((a, b) => b.current - a.current), [counts])
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((b) => [shortName(b.name), target && target.branches[shortName(b.name)] > 0 ? String(target.branches[shortName(b.name)]) : ""])),
  )
  const [saving, setSaving] = useState(false)
  const parse = (v: string) => {
    const d = v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[,\s]/g, "")
    return /^\d+$/.test(d) ? Number(d) : null
  }
  const bad = Object.entries(values).filter(([, v]) => v.trim() !== "" && parse(v) === null).map(([k]) => k)
  const entered = Object.values(values).map(parse).filter((n): n is number => n !== null && n > 0)
  const total = entered.reduce((a, n) => a + n, 0)
  const save = async () => {
    if (bad.length) return
    setSaving(true)
    const branches: Record<string, number> = {}
    for (const [k, v] of Object.entries(values)) {
      const n = parse(v)
      if (n !== null && n > 0) branches[k] = n
    }
    const ok = await saveStudentTarget({ id: `target-${year}`, kind: "target", year, branches, updatedAt: new Date().toISOString() })
    setSaving(false)
    if (ok) onDone()
  }
  return (
    <div className="mt-5">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_9rem] gap-3 border-b pb-2 text-[13px] font-bold text-muted-foreground">
        <span>الفرع</span>
        <span className="text-end">الحاليون الآن</span>
        <span>المستهدف</span>
      </div>
      <ul className="divide-y">
        {rows.map((b, i) => {
          const k = shortName(b.name)
          const invalid = bad.includes(k)
          return (
            <li key={k} className="grid grid-cols-[minmax(0,1fr)_6rem_9rem] items-center gap-3 py-2">
              <label htmlFor={`tg-${i}`} className="truncate text-[15px] font-medium">{k}</label>
              <span className="num text-end text-[13px] text-muted-foreground">{formatNumber(b.current)}</span>
              <input
                id={`tg-${i}`}
                inputMode="numeric"
                dir="ltr"
                placeholder="—"
                value={values[k]}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                aria-invalid={invalid}
                className={`num h-10 w-full rounded-lg border bg-card px-3 text-start text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${invalid ? "border-bad" : "border-input focus-visible:border-ring"}`}
              />
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-4 py-3 font-bold">
        <span>الإجمالي</span>
        <span className="num">{total ? formatNumber(total) : "—"}</span>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {bad.length ? <span className="text-bad">اكتب أرقامًا صحيحة فقط في: {bad.join("، ")}.</span> : `مُدخل لـ ${formatNumber(entered.length)} من ${formatNumber(rows.length)} فرعًا. اترك الخانة فارغة للفرع الذي لم يُحدَّد مستهدفه.`}
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={save} disabled={saving || bad.length > 0} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          حفظ المستهدف
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-full border px-5 text-[15px] hover:bg-accent">إلغاء</button>
      </div>
    </div>
  )
}
