import { useMemo, useRef, useState } from "react"
import { ArrowRight, Download, FileText, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { Branch, ComplaintBlock, ComplaintReport } from "@/data/types"
import { branchNameFrom, monthFrom, monthLabel, readDocx } from "@/lib/docx"
import { readComplaintFile } from "@/lib/backend"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { normalize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { PageHeader, Panel } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/**
 * «الشكاوى»: each branch's monthly complaint report, shown exactly as its Word
 * file has it (same text, same tables, same order). Nothing is summed, charted
 * or classified here. A branch without a file for the month has no complaints.
 */

/** File names that differ from the platform's branch name. Confirmed by the platform owner. */
const ALIASES: Record<string, string> = { [normalize("الموهوبين")]: "shatee-gifted" }
const MAX_BYTES = 2 * 1024 * 1024

function matchBranch(name: string | null, branches: Branch[]): string {
  if (!name) return ""
  const n = normalize(name)
  if (ALIASES[n]) return ALIASES[n]
  return branches.find((b) => normalize(b.name) === n)?.slug ?? ""
}

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function ComplaintsPage() {
  const { data, canEdit } = useStore()
  const branches = data.branches
  const reports = data.complaintReports
  const months = useMemo(() => [...new Set(reports.map((r) => r.month))].sort().reverse(), [reports])
  const [monthPick, setMonth] = useState<string | null>(null)
  const month = monthPick ?? months[0] ?? thisMonth()
  const byBranch = useMemo(() => new Map(reports.filter((r) => r.month === month).map((r) => [r.branch, r])), [reports, month])
  const [sel, setSel] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // on wide screens a report is always open: the chosen branch, else the first one with a report
  const shown = sel ?? branches.find((b) => byBranch.has(b.slug))?.slug ?? branches[0]?.slug ?? null
  const shownBranch = branches.find((b) => b.slug === shown)

  const monthOptions = months.length ? months : [month]
  return (
    <>
      <PageHeader
        eyebrow="الأداء والتطوير"
        title="تقارير الشكاوى الشهرية"
        description="تقرير كل فرع كما ورد في ملفه."
        actions={
          <>
            <label className="sr-only" htmlFor="c-month">الشهر</label>
            <select
              id="c-month"
              value={month}
              onChange={(e) => (setMonth(e.target.value), setSel(null))}
              className="h-11 min-w-40 rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            {canEdit && (
              <button type="button" onClick={() => setUploading(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
                <Upload className="h-4 w-4" aria-hidden="true" />
                رفع تقارير
              </button>
            )}
          </>
        }
      />
      <Gate needs={["branches", "complaintReports"]}>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* phones: the list first, then the chosen report on its own */}
          <nav aria-label="الفروع" className={cn("overflow-hidden rounded-2xl border bg-card", sel && "hidden lg:block")}>
            <ul>
              {branches.map((b) => {
                const r = byBranch.get(b.slug)
                const on = b.slug === shown
                return (
                  <li key={b.slug} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSel(b.slug)}
                      aria-current={on ? "true" : undefined}
                      className={cn("flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[15px] hover:bg-accent/50", on && "lg:bg-secondary/60 lg:shadow-[inset_-4px_0_0_hsl(var(--primary))]")}
                    >
                      <span className="font-medium">{b.name}</span>
                      {r ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-bold text-secondary-foreground">تقرير {monthLabel(month)}</span>
                      ) : (
                        <span className="shrink-0 text-[12px] text-muted-foreground">لا توجد شكاوى</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className={cn(!sel && "hidden lg:block")}>
            {sel && (
              <button type="button" onClick={() => setSel(null)} className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary lg:hidden">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                كل الفروع
              </button>
            )}
            {shownBranch &&
              (byBranch.get(shownBranch.slug) ? (
                <ReportView report={byBranch.get(shownBranch.slug)!} branchName={shownBranch.name} />
              ) : (
                <Panel className="flex min-h-72 flex-col items-center justify-center gap-1 p-8 text-center">
                  <p className="text-[22px] font-bold">{shownBranch.name}</p>
                  <p className="text-[16px] text-muted-foreground">لا توجد شكاوى</p>
                </Panel>
              ))}
          </div>
        </div>
      </Gate>

      {canEdit && (
        <Sheet open={uploading} onOpenChange={setUploading}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-3xl" dir="rtl">
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">رفع تقارير الشكاوى</SheetTitle>
              <SheetDescription className="text-start text-[15px]">تتعرف المنصة على الفرع والشهر من عنوان كل ملف، وتعرضها هنا لتأكيدها قبل الحفظ.</SheetDescription>
            </SheetHeader>
            <UploadForm
              branches={branches}
              existing={reports}
              onDone={(m) => {
                setUploading(false)
                if (m) (setMonth(m), setSel(null))
              }}
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

/* ------------------------------------------------------------ the report, as in the file */
function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows
  return (
    <div className="my-3 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-max border-collapse text-[14px]">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} scope="col" className="whitespace-pre-line border-b bg-muted px-3 py-2 text-start font-bold">{c}</th>
            ))}
          </tr>
        </thead>
        {body.length > 0 && (
          <tbody>
            {body.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                {r.map((c, j) => (
                  <td key={j} className="whitespace-pre-line px-3 py-2">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function Block({ b }: { b: ComplaintBlock }) {
  if (b.t === "table") return <Table rows={b.rows} />
  if (b.style === "title" || b.style === "h1") return <h2 className="mb-2 mt-5 whitespace-pre-line text-[20px] font-bold">{b.text}</h2>
  if (b.style === "h2") return <h3 className="mb-1 mt-5 whitespace-pre-line text-[16px] font-bold text-primary">{b.text}</h3>
  const long = b.text.length > 160
  const meta = !long && (b.text.includes(" | ") || b.text.startsWith("المصدر"))
  return (
    <p
      className={cn(
        "my-2.5 whitespace-pre-line text-[15px] leading-relaxed",
        long && "rounded-xl border bg-muted/50 px-4 py-2.5 text-[14px]",
        meta && "text-[14px] text-muted-foreground",
      )}
    >
      {b.text}
    </p>
  )
}

function ReportView({ report, branchName }: { report: ComplaintReport; branchName: string }) {
  const { canEdit, deleteComplaintReport } = useStore()
  const downloads = useDownloads()
  const [busy, setBusy] = useState<"" | "dl" | "del">("")
  // the file's own title heads the report; the rest follows in the file's order
  const titleIdx = report.blocks.findIndex((b) => b.t === "p" && b.style === "title")
  const rest = report.blocks.filter((_, i) => i !== titleIdx)

  const download = async () => {
    setBusy("dl")
    try {
      const f = await readComplaintFile(report.id)
      if (!f || !downloads) return void toast.error("الملف الأصلي غير متاح في هذا العرض")
      const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))
      await downloads.save({ filename: f.name, data: new Blob([bytes], { type: f.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) })
    } catch (e) {
      const code = (e as { code?: string })?.code
      toast.error(code && SAVE_ERROR[code] ? SAVE_ERROR[code] : "تعذّر تنزيل الملف")
    } finally {
      setBusy("")
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h2 className="whitespace-pre-line text-[21px] font-extrabold leading-snug">{titleIdx >= 0 ? (report.blocks[titleIdx] as { text: string }).text : branchName}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground" dir="ltr" style={{ justifyContent: "flex-end" }}>
            {report.fileName}
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] hover:bg-accent disabled:opacity-50">
            {busy === "dl" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            تنزيل الملف الأصلي
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                if (!window.confirm(`حذف تقرير شكاوى ${branchName} لشهر ${monthLabel(report.month)}؟`)) return
                setBusy("del")
                await deleteComplaintReport(report.id)
                setBusy("")
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] text-bad hover:bg-bad-soft disabled:opacity-50"
            >
              {busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              حذف
            </button>
          )}
        </div>
      </div>
      {rest.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </Panel>
  )
}

/* ------------------------------------------------------------ upload (editors) */
type Row = { key: string; file: File; blocks?: ComplaintBlock[]; title?: string; branch: string; month: string; error?: string }

const toB64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ""))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })

function UploadForm({ branches, existing, onDone }: { branches: Branch[]; existing: ComplaintReport[]; onDone: (month: string | null) => void }) {
  const { saveComplaintReports } = useStore()
  const [rows, setRows] = useState<Row[]>([])
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setReading(true)
    const next: Row[] = []
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (!/\.docx$/i.test(file.name)) {
        next.push({ key, file, branch: "", month: "", error: "ليس ملف Word بصيغة ‎.docx" })
        continue
      }
      if (file.size > MAX_BYTES) {
        next.push({ key, file, branch: "", month: "", error: "الملف أكبر من 2MB" })
        continue
      }
      try {
        const blocks = await readDocx(file)
        const t = blocks.find((b) => b.t === "p" && b.style === "title")
        const title = t && t.t === "p" ? t.text : undefined
        next.push({ key, file, blocks, title, branch: matchBranch(branchNameFrom(blocks), branches), month: monthFrom(title ?? "", file.name) ?? "" })
      } catch {
        next.push({ key, file, branch: "", month: "", error: "تعذّرت قراءة الملف" })
      }
    }
    setRows((prev) => [...prev.filter((p) => !next.some((n) => n.key === p.key)), ...next])
    setReading(false)
    if (input.current) input.current.value = ""
  }

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const ids = rows.map((r) => (r.branch && r.month ? `${r.branch}__${r.month}` : ""))
  const status = (r: Row, i: number): { text: string; ok: boolean } => {
    if (r.error) return { text: r.error, ok: false }
    if (!r.branch) return { text: "اختر الفرع", ok: false }
    if (!/^\d{4}-\d{2}$/.test(r.month)) return { text: "اختر الشهر", ok: false }
    if (ids.indexOf(ids[i]) !== i) return { text: "مكرر مع ملف آخر لنفس الفرع والشهر", ok: false }
    if (existing.some((e) => e.id === ids[i])) return { text: "سيستبدل التقرير الحالي", ok: true }
    return { text: "جاهز", ok: true }
  }
  const ready = rows.filter((r, i) => status(r, i).ok)

  const save = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const items = await Promise.all(
        ready.map(async (r) => ({
          report: { id: `${r.branch}__${r.month}`, branch: r.branch, month: r.month, title: r.title ?? r.file.name, fileName: r.file.name, fileSize: r.file.size, blocks: r.blocks!, uploadedAt: now },
          file: { name: r.file.name, type: r.file.type, b64: await toB64(r.file) },
        })),
      )
      if (await saveComplaintReports(items)) onDone(ready[0]?.month ?? null)
    } finally {
      setSaving(false)
    }
  }

  const selCls = "h-10 w-full min-w-0 rounded-md border border-input bg-card px-2 text-[15px]"
  return (
    <div className="mt-5 space-y-4">
      <label className={cn("flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-[15px] text-muted-foreground hover:bg-accent/40", reading && "pointer-events-none opacity-60")}>
        {reading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
        {reading ? "جارٍ قراءة الملفات…" : "اختر ملفات Word ‎(.docx) لتقارير الشكاوى، ويمكن اختيار عدة ملفات معًا"}
        <input ref={input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple className="sr-only" onChange={(e) => void pick(e.target.files)} />
      </label>

      {rows.length > 0 && (
        <ul className="divide-y rounded-2xl border">
          {rows.map((r, i) => {
            const st = status(r, i)
            return (
              <li key={r.key} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold" dir="ltr" style={{ textAlign: "right" }}>{r.file.name}</p>
                    {r.title && <p className="text-[13px] text-muted-foreground">{r.title}</p>}
                  </div>
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="shrink-0 rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-accent">إزالة</button>
                </div>
                {!r.error && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`b-${i}`} className="mb-0.5 block text-[13px] text-muted-foreground">الفرع</label>
                      <select id={`b-${i}`} value={r.branch} onChange={(e) => set(r.key, { branch: e.target.value })} className={selCls}>
                        <option value="">اختر الفرع</option>
                        {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`m-${i}`} className="mb-0.5 block text-[13px] text-muted-foreground">الشهر</label>
                      <input id={`m-${i}`} type="month" value={r.month} onChange={(e) => set(r.key, { month: e.target.value })} className={selCls} dir="ltr" />
                    </div>
                  </div>
                )}
                <p className={cn("text-[13px] font-bold", st.ok ? "text-ok" : "text-bad")}>{st.text}{r.month && /^\d{4}-\d{2}$/.test(r.month) && st.ok ? ` · ${monthLabel(r.month)}` : ""}</p>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" onClick={() => onDone(null)} className="inline-flex h-11 items-center rounded-full border px-5 text-[15px] hover:bg-accent">إلغاء</button>
        <button type="button" onClick={save} disabled={!ready.length || saving || reading} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {ready.length === 1 ? "حفظ تقرير واحد" : ready.length === 2 ? "حفظ تقريرين" : `حفظ ${ready.length} تقارير`}
        </button>
      </div>
    </div>
  )
}
