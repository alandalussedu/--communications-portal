/**
 * «النقل المدرسي» admin: upload the Excel plan, check it, compare it with the
 * published version, approve publishing, and restore an earlier version.
 * For the platform owner only. The page itself is no protection: every write
 * goes through database functions that check the caller's role.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, History, Loader2, LogOut, RotateCcw, ShieldAlert, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import { BRANCH_CITY, CITY_GEO } from "@/data/csrMap"
import { signOut } from "@/lib/backend"
import { useRouter } from "@/lib/router"
import { formatDate, formatNumber } from "@/lib/format"
import { MAX_FILE_BYTES, diffPlan, downloadOriginal, fileProblem, listImports, parsePlan, publishImport, rejectImport, restoreImport, statsOf, tnorm, uploadPlan, type Diff, type ImportRow, type Parsed, type TransportData } from "@/lib/transport"
import { cn } from "@/lib/utils"
import { Banner, EmptyState, LoadingBlock, PageHeader, Panel, PanelHeader } from "@/components/common"
import { LoginForm } from "@/components/EditorLogin"

const STATUS: Record<ImportRow["status"], { label: string; cls: string }> = {
  published: { label: "منشورة", cls: "bg-ok-soft text-ok" },
  draft: { label: "بانتظار الاعتماد", cls: "bg-gold-soft text-gold-ink" },
  superseded: { label: "نسخة سابقة", cls: "bg-muted text-muted-foreground" },
  invalid: { label: "لم تجتز التحقق", cls: "bg-bad-soft text-bad" },
  rejected: { label: "مرفوضة", cls: "bg-muted text-muted-foreground" },
}
const kb = (n: number | null) => (n ? `${formatNumber(Math.round(n / 1024))} ك.ب` : "—")
const thisYear = () => {
  const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return [y - 1, y, y + 1, y + 2].map((a) => `${a}/${a + 1}`)
}

export default function TransportAdmin({ live, onChanged }: { live: TransportData | null; onChanged: () => void }) {
  const { member } = useStore()
  const { go } = useRouter()
  const back = (
    <button type="button" onClick={() => go({ page: "transport" })} className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
      صفحة النقل المدرسي
    </button>
  )
  let body: ReactNode
  if (!member.enabled) body = <Panel><EmptyState title="لوحة الإدارة غير متاحة في هذا العرض" body="افتح المنصة من رابطها العام وسجّل الدخول بحساب مدير المنصة." /></Panel>
  else if (!member.checked) body = <Panel><LoadingBlock rows={3} label="جارٍ التحقق من الدخول…" /></Panel>
  else if (!member.role)
    body = (
      <Panel className="mx-auto max-w-md p-6">
        <h2 className="text-[20px] font-bold">دخول مدير المنصة</h2>
        <p className="mb-4 mt-1 text-[14px] text-muted-foreground">هذه اللوحة لمدير المنصة فقط. لا يوجد تسجيل حسابات جديدة.</p>
        <LoginForm />
      </Panel>
    )
  else if (member.role !== "owner")
    body = (
      <Panel>
        <EmptyState title="غير مصرح" body="إدارة بيانات النقل المدرسي لمدير المنصة فقط." action={<button type="button" onClick={() => void signOut()} className="h-9 rounded-full border px-4 text-[14px] hover:bg-accent">تسجيل الخروج</button>} />
      </Panel>
    )
  else body = <Console live={live} onChanged={onChanged} name={member.name} />
  return (
    <>
      {back}
      <PageHeader eyebrow="النقل المدرسي" title="إدارة بيانات النقل" description="رفع ملف الخطة، التحقق منه، مقارنته بالمنشور، ثم اعتماد النشر. لا يُنشر شيء دون اعتمادك." />
      {body}
    </>
  )
}

function Console({ live, onChanged, name }: { live: TransportData | null; onChanged: () => void; name: string | null }) {
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const r = await listImports()
    setRows(r.rows)
    setError(r.error ?? null)
  }, [])
  useEffect(() => void refresh(), [refresh])
  const liveRow = rows?.find((r) => r.is_live) ?? null
  const last = rows?.[0] ?? null
  const open = rows?.find((r) => r.id === openId) ?? null
  const after = async () => (await refresh(), onChanged())
  const stats = live ? statsOf(live.campuses.map((c) => ({ cityKey: c.cityId, districts: c.districts.map((d) => d.name) }))) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-muted-foreground">
        <span>مرحبًا {name ?? "مدير المنصة"}</span>
        <button type="button" onClick={() => void signOut()} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 hover:bg-accent"><LogOut className="h-4 w-4" aria-hidden="true" />تسجيل الخروج</button>
      </div>
      {error && <Banner tone="bad" title="تعذّر قراءة سجل النسخ">{error}</Banner>}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label="السنة الدراسية المنشورة" value={live?.year ?? "لا يوجد"} />
        <Fact label="المجمعات" value={stats ? formatNumber(stats.campuses) : "—"} sub={stats ? `${formatNumber(stats.cities)} مدن` : undefined} />
        <Fact label="الأحياء" value={stats ? formatNumber(stats.entries) : "—"} sub={stats ? `${formatNumber(stats.unique)} فريدًا` : undefined} />
        <Fact label="آخر تحديث" value={live?.publishedAt ? formatDate(live.publishedAt) : "—"} sub={liveRow ? liveRow.file_name : undefined} />
      </ul>
      {last && <p className="text-[13px] text-muted-foreground">آخر عملية استيراد: «{last.file_name}» في {formatDate(last.uploaded_at)} — {STATUS[last.status].label}.</p>}

      <UploadPanel live={live} onUploaded={async (id) => (await after(), setOpenId(id))} />
      {open && <Review row={open} live={live} onClose={() => setOpenId(null)} onDone={after} />}

      <Panel>
        <PanelHeader title="سجل النسخ" hint="كل ملف رُفع يبقى هنا. استرجاع نسخة سابقة لا يحذف ما بعدها." />
        {rows === null ? (
          <LoadingBlock rows={3} label="جارٍ التحميل…" />
        ) : rows.length === 0 ? (
          <EmptyState title="لا نسخ بعد" body="ارفع ملف خطة النقل ليظهر هنا." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
                  {["النسخة", "الملف", "العام", "رُفعت", "الحالة", ""].map((h, k) => <th key={k} scope="col" className="px-4 py-2.5 text-start font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b last:border-0", r.is_live && "bg-ok-soft/30")}>
                    <td className="num px-4 py-2.5 font-bold">{formatNumber(r.version)}</td>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium">{r.file_name}</span>
                      <span className="block text-[12px] text-muted-foreground">{kb(r.file_size)}{r.notes ? ` · ${r.notes}` : ""}</span>
                    </td>
                    <td className="num px-4 py-2.5">{r.year_name}</td>
                    <td className="num px-4 py-2.5">{formatDate(r.uploaded_at)}</td>
                    <td className="px-4 py-2.5"><span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium", STATUS[r.status].cls)}>{STATUS[r.status].label}</span></td>
                    <td className="px-4 py-2.5">
                      <span className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setOpenId(r.id)} className="h-9 rounded-full border px-3 text-[13px] hover:bg-accent">{r.status === "draft" ? "مراجعة واعتماد" : r.status === "superseded" ? "مراجعة واسترجاع" : "عرض"}</button>
                        {r.file_storage_path && (
                          <button type="button" onClick={async () => { const b = await downloadOriginal(r.file_storage_path!); if (!b) return void toast.error("تعذّر تنزيل الملف"); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = r.file_name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 30000) }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent" aria-label={`تنزيل ${r.file_name}`}>
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <li className="rounded-2xl border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="num mt-1 text-[24px] font-extrabold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{sub}</p>}
    </li>
  )
}

/* ------------------------------------------------------------ upload */
function UploadPanel({ live, onUploaded }: { live: TransportData | null; onUploaded: (id: string) => void }) {
  const { data } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [year, setYear] = useState("")
  const [notes, setNotes] = useState("")
  const [cities, setCities] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null)

  const cityOptions = useMemo(() => [...new Set([...(live?.cities.map((c) => c.name) ?? []), ...Object.keys(CITY_GEO)])], [live])
  /** the city a campus had in the published version, else the city of the portal branch its name mentions */
  const guessCity = useCallback(
    (name: string) => {
      const prev = live?.campuses.find((c) => tnorm(c.name) === tnorm(name))
      if (prev) return live!.cities.find((c) => c.id === prev.cityId)?.name ?? ""
      const n = tnorm(name)
      const b = (data.settings?.branchNames ?? []).map((x) => ({ ...x, key: tnorm(x.name).split(" ")[0] })).filter((x) => x.key.length > 2 && n.includes(x.key)).sort((a, z) => z.key.length - a.key.length)[0]
      return b ? BRANCH_CITY[b.slug] ?? "" : ""
    },
    [live, data.settings],
  )

  const take = async (f: File | undefined) => {
    setParsed(null)
    setProblem(null)
    setFile(f ?? null)
    if (!f) return
    const buf = await f.arrayBuffer()
    const p0 = fileProblem(f, new Uint8Array(buf.slice(0, 8)))
    if (p0) return setProblem(p0)
    const p = parsePlan(buf)
    setParsed(p)
    setYear(p.year ?? "")
    setCities(Object.fromEntries(p.campuses.map((c) => [c.name, guessCity(c.name)])))
  }

  const campuses = (parsed?.campuses ?? []).map((c) => ({ name: c.name, city: (cities[c.name] ?? "").trim(), districts: c.districts }))
  const noCity = campuses.filter((c) => !c.city)
  const yearOk = /^\d{4}\/\d{4}$/.test(year) && Number(year.slice(5)) === Number(year.slice(0, 4)) + 1
  const errors = [...(parsed?.errors ?? []), ...(parsed && !yearOk ? ["اختر العام الدراسي."] : []), ...noCity.map((c) => `حدّد مدينة «${c.name}».`)]
  const diff = parsed && !parsed.errors.length ? diffPlan(campuses, live) : null
  const st = parsed ? statsOf(campuses.map((c) => ({ cityKey: c.city, districts: c.districts }))) : null

  const send = async () => {
    if (!file || errors.length) return
    const r = await uploadPlan(file, year, notes, campuses, (pct, label) => setProgress({ pct, label }))
    setProgress(null)
    if (r.error) return void toast.error("لم يُرفع الملف", { description: r.error })
    if (r.result!.status === "invalid") toast.error("الخادم رفض البيانات", { description: r.result!.errors[0] })
    else toast.success("رُفع الملف وهو بانتظار اعتمادك")
    setFile(null)
    setParsed(null)
    setNotes("")
    onUploaded(r.result!.id)
  }

  return (
    <Panel>
      <PanelHeader title="رفع ملف الخطة" hint={`ملف Excel (‎.xlsx أو ‎.xls) حتى ${formatNumber(MAX_FILE_BYTES / 1024 / 1024)} ميجابايت. يُقرأ ويُفحص هنا، ثم يتحقق منه الخادم قبل حفظه مسودة.`} />
      <div className="flex flex-col gap-4 p-5">
        <input ref={input} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => (void take(e.target.files?.[0]), (e.target.value = ""))} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), void take(e.dataTransfer.files?.[0]))}
          className={cn("flex min-h-36 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-6 text-center transition-colors", drag ? "border-primary bg-secondary" : "bg-muted/30 hover:bg-accent")}
        >
          {file ? <FileSpreadsheet className="h-8 w-8 text-ok" aria-hidden="true" /> : <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          <span className="text-[17px] font-bold">{file ? file.name : "اسحب الملف إلى هنا، أو اضغط لاختياره"}</span>
          <span className="num text-[13px] text-muted-foreground">{file ? kb(file.size) : "‎.xlsx · ‎.xls"}</span>
        </button>
        {problem && <Banner tone="bad" title="الملف غير مقبول">{problem}</Banner>}

        {parsed && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[14px]">
                <span className="text-muted-foreground">العام الدراسي{parsed.year ? " (من عنوان الملف)" : ""}</span>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-[16px]">
                  <option value="">اختر…</option>
                  {[...new Set([...(parsed.year ? [parsed.year] : []), ...thisYear()])].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[14px]">
                <span className="text-muted-foreground">ملاحظات (اختياري)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className="h-11 rounded-md border border-input bg-card px-3 text-[16px]" />
              </label>
            </div>

            <Report title="تقرير التحقق" errors={errors} warnings={parsed.warnings} ok={st ? `ورقة «${parsed.sheet}»: ${formatNumber(st.campuses)} مجمعًا، ${formatNumber(st.entries)} حيًّا (${formatNumber(st.unique)} فريدًا)، ${formatNumber(st.cities)} مدن.` : ""} />

            {parsed.campuses.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-[14px]">
                  <thead>
                    <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">العمود</th>
                      <th className="px-3 py-2 text-start font-medium">المجمع كما في الملف</th>
                      <th className="px-3 py-2 text-end font-medium">الأحياء</th>
                      <th className="px-3 py-2 text-start font-medium">المدينة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.campuses.map((c) => (
                      <tr key={c.column} className="border-b last:border-0">
                        <td className="num px-3 py-1.5 text-muted-foreground">{c.column}</td>
                        <td className="px-3 py-1.5 font-medium">{c.name}</td>
                        <td className="num px-3 py-1.5 text-end">{formatNumber(c.districts.length)}</td>
                        <td className="px-3 py-1.5">
                          <input list="tp-cities" aria-label={`مدينة ${c.name}`} value={cities[c.name] ?? ""} onChange={(e) => setCities((m) => ({ ...m, [c.name]: e.target.value }))} placeholder="اختر أو اكتب" className={cn("h-9 w-40 rounded-md border bg-card px-2 text-[14px]", !(cities[c.name] ?? "").trim() && "border-bad")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="tp-cities">{cityOptions.map((c) => <option key={c} value={c} />)}</datalist>
                <p className="border-t px-3 py-2 text-[12.5px] text-muted-foreground">الملف لا يذكر المدن، فاقترحتُ مدينة كل مجمع من النسخة المنشورة أو من فرعه في المنصة. راجعها قبل الرفع.</p>
              </div>
            )}

            {diff && <DiffView diff={diff} />}

            {progress ? (
              <div role="status" aria-live="polite">
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress.pct}%` }} /></div>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{progress.label}</p>
              </div>
            ) : (
              <button type="button" disabled={errors.length > 0} onClick={send} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Upload className="h-4 w-4" aria-hidden="true" />
                رفع للمراجعة (لا يُنشر الآن)
              </button>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}

function Report({ title, errors, warnings, ok }: { title: string; errors: string[]; warnings: string[]; ok?: string }) {
  return (
    <div className="rounded-xl border">
      <h3 className="flex items-center gap-2 border-b px-4 py-2.5 text-[15px] font-bold">
        {errors.length ? <XCircle className="h-5 w-5 text-bad" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden="true" />}
        {title}: {errors.length ? `${formatNumber(errors.length)} خطأ يمنع المتابعة` : "اجتاز التحقق"}
      </h3>
      <ul className="flex flex-col gap-1 px-4 py-3 text-[14px]">
        {ok && <li className="text-muted-foreground">{ok}</li>}
        {errors.map((e) => <li key={e} className="flex items-start gap-2 text-bad"><XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{e}</li>)}
        {warnings.map((w) => <li key={w} className="flex items-start gap-2 text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{w}</li>)}
      </ul>
    </div>
  )
}

function DiffView({ diff }: { diff: Diff }) {
  const none = !diff.campusesAdded.length && !diff.campusesRemoved.length && !diff.cityChanged.length && !diff.perCampus.length
  const Chips = ({ items, cls }: { items: string[]; cls: string }) => <span className="flex flex-wrap gap-1">{items.map((x) => <span key={x} className={cn("rounded-full px-2.5 py-0.5 text-[13px]", cls)}>{x}</span>)}</span>
  return (
    <div className="rounded-xl border">
      <h3 className="border-b px-4 py-2.5 text-[15px] font-bold">المقارنة بالنسخة المنشورة</h3>
      <div className="flex flex-col gap-3 px-4 py-3 text-[14px]">
        {diff.first ? (
          <p className="text-muted-foreground">لا توجد نسخة منشورة: هذه أول نسخة، وكل ما فيها جديد.</p>
        ) : none ? (
          <p className="text-muted-foreground">لا فرق عن النسخة المنشورة.</p>
        ) : (
          <>
            <p className="num text-muted-foreground">أحياء مضافة {formatNumber(diff.totals.added)} · محذوفة {formatNumber(diff.totals.removed)} · أسماء معدّلة {formatNumber(diff.totals.renamed)}</p>
            {diff.campusesAdded.length > 0 && <div><p className="mb-1 font-bold">مجمعات جديدة</p><Chips items={diff.campusesAdded} cls="bg-ok-soft text-ok" /></div>}
            {diff.campusesRemoved.length > 0 && <div><p className="mb-1 font-bold">مجمعات غير موجودة في الملف الجديد</p><Chips items={diff.campusesRemoved} cls="bg-bad-soft text-bad" /></div>}
            {diff.cityChanged.length > 0 && <div><p className="mb-1 font-bold">تغيّر المدينة</p><ul>{diff.cityChanged.map((c) => <li key={c.campus}>{c.campus}: من {c.from} إلى {c.to}</li>)}</ul></div>}
            {diff.perCampus.map((c) => (
              <div key={c.campus} className="rounded-lg bg-muted/40 p-3">
                <p className="mb-1.5 font-bold">{c.campus}</p>
                {c.added.length > 0 && <div className="mb-1 flex items-start gap-2"><span className="w-14 shrink-0 text-[13px] text-ok">مضافة</span><Chips items={c.added} cls="bg-ok-soft text-ok" /></div>}
                {c.removed.length > 0 && <div className="mb-1 flex items-start gap-2"><span className="w-14 shrink-0 text-[13px] text-bad">محذوفة</span><Chips items={c.removed} cls="bg-bad-soft text-bad" /></div>}
                {c.renamed.length > 0 && <div className="flex items-start gap-2"><span className="w-14 shrink-0 text-[13px] text-warn">معدّلة</span><Chips items={c.renamed.map((r) => `${r.from} ← ${r.to}`)} cls="bg-warn-soft text-warn" /></div>}
              </div>
            ))}
          </>
        )}
        {diff.shared.length > 0 && (
          <details>
            <summary className="cursor-pointer font-bold">أحياء مشتركة بين أكثر من مجمع ({formatNumber(diff.shared.length)}) — تبقى في كل مجمع</summary>
            <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              {diff.shared.map((s) => <li key={s.city + s.district}><b>{s.district}</b> ({s.city}): {formatNumber(s.campuses.length)} مجمعات</li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ review, approve, restore */
function Review({ row, live, onClose, onDone }: { row: ImportRow; live: TransportData | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const campuses = row.payload?.campuses ?? []
  const diff = useMemo(() => diffPlan(campuses, row.is_live ? null : live), [row.id, live]) // eslint-disable-line react-hooks/exhaustive-deps
  const st = statsOf(campuses.map((c) => ({ cityKey: c.city, districts: [...new Map(c.districts.map((d) => [tnorm(d), d])).values()] })))
  const act = async (fn: (id: string) => Promise<string | null>, ok: string) => {
    setBusy(true)
    const err = await fn(row.id)
    setBusy(false)
    setConfirm(false)
    if (err) return void toast.error("لم تُنفَّذ العملية", { description: err })
    toast.success(ok)
    await onDone()
  }
  const can = row.status === "draft" ? "publish" : row.status === "superseded" ? "restore" : null
  return (
    <Panel className="border-primary/40">
      <PanelHeader title={`النسخة ${formatNumber(row.version)} — ${STATUS[row.status].label}`} hint={`«${row.file_name}» · العام ${row.year_name} · رُفعت ${formatDate(row.uploaded_at)}`} />
      <div className="flex flex-col gap-4 p-5">
        <Report title="تحقق الخادم" errors={row.validation_report?.errors ?? []} warnings={row.validation_report?.warnings ?? []} ok={`${formatNumber(st.campuses)} مجمعًا، ${formatNumber(st.entries)} حيًّا (${formatNumber(st.unique)} فريدًا)، ${formatNumber(st.cities)} مدن.`} />
        {!row.is_live && row.status !== "invalid" && <DiffView diff={diff} />}
        {can && !confirm && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
              {can === "publish" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              {can === "publish" ? "اعتماد النشر…" : "استرجاع هذه النسخة…"}
            </button>
            {row.status === "draft" && <button type="button" disabled={busy} onClick={() => act(rejectImport, "رُفضت المسودة وبقيت في السجل")} className="h-11 rounded-full border px-5 text-[15px] text-bad hover:bg-bad-soft">رفض المسودة</button>}
            <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-[15px] text-muted-foreground hover:bg-accent">إغلاق</button>
          </div>
        )}
        {can && confirm && (
          <div className="rounded-xl border-2 border-primary bg-secondary/50 p-4" role="alertdialog" aria-labelledby="tp-confirm">
            <h3 id="tp-confirm" className="flex items-center gap-2 text-[17px] font-extrabold"><ShieldAlert className="h-5 w-5" aria-hidden="true" />{can === "publish" ? "تأكيد اعتماد النشر" : "تأكيد الاسترجاع"}</h3>
            <p className="mt-2 text-[15px] leading-relaxed">
              ستصبح النسخة <b className="num">{formatNumber(row.version)}</b> («{row.file_name}»، العام <span className="num">{row.year_name}</span>) هي المعروضة للجميع فورًا: <span className="num">{formatNumber(st.campuses)}</span> مجمعًا و<span className="num">{formatNumber(st.entries)}</span> حيًّا.
              {!diff.first && <> الفرق عن المنشور الآن: <span className="num">{formatNumber(diff.totals.added)}</span> مضافة، <span className="num">{formatNumber(diff.totals.removed)}</span> محذوفة، <span className="num">{formatNumber(diff.campusesAdded.length)}</span> مجمعات جديدة، <span className="num">{formatNumber(diff.campusesRemoved.length)}</span> غير موجودة.</>}
              {" "}النسخة الحالية تبقى في السجل ويمكن استرجاعها.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => act(can === "publish" ? publishImport : restoreImport, can === "publish" ? "نُشرت النسخة" : "استُرجعت النسخة")} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {can === "publish" ? "نعم، انشر" : "نعم، استرجع"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="h-11 rounded-full border px-5 text-[15px] hover:bg-accent">تراجع</button>
            </div>
          </div>
        )}
        {!can && <button type="button" onClick={onClose} className="h-10 self-start rounded-full border px-4 text-[14px] hover:bg-accent"><History className="me-1.5 inline h-4 w-4" aria-hidden="true" />إغلاق</button>}
      </div>
    </Panel>
  )
}
